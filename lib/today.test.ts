import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCases } from "./cases.ts";
import { FAULT_LABEL } from "./labels.ts";
import { PLAIN, plainAlert, pumpName } from "./plain.ts";
import { groupByPump } from "./today.ts";
import { trustFor } from "./trust.ts";
import { lastDone, nextStop, trendOf, workSince } from "./worker.ts";
import type { Alert, Decision, PumpData } from "./types.ts";

const alert = (id: string, asset: string, hour: number, cls: "MACHINE" | "SENSOR", type: string, channel?: string, summary = "") =>
  ({ alert_id: id, asset_id: asset, offset_hours: hour, event_class: cls, fault_type: type, evidence: { summary, channels: channel ? [{ channel }] : [], blind_spots: [] }, hypotheses: [] }) as unknown as Alert;
const META = { suction_pressure_kpa: { label: "Suction pressure" }, discharge_pressure_kpa: { label: "Discharge pressure" } };

test("every fault type has plain wording, and no engineering terms reach the worker", () => {
  for (const type of Object.keys(FAULT_LABEL)) assert.ok(PLAIN[type], `${type} has no plain wording`);
  const banned = /z-?score|\bsd\b|calibrat|NPSH|entrainment|cavitation|restriction/i;
  for (const [type, w] of Object.entries(PLAIN)) assert.equal(banned.test(`${w.what} ${w.check} ${w.short}`), false, type);
});

test("pump names read naturally", () => {
  assert.equal(pumpName("PUMP-08"), "Pump 8");
  assert.equal(pumpName("PUMP-12"), "Pump 12");
});

test("sensor wording names the signal from the alert or its summary", () => {
  assert.equal(plainAlert(alert("a", "P", 1, "SENSOR", "SENSOR_DRIFT", "suction_pressure_kpa"), META).what, "The suction pressure reading is slowly drifting. The pump may be fine.");
  assert.equal(plainAlert(alert("b", "P", 1, "SENSOR", "SENSOR_STUCK", undefined, "Discharge pressure reading is frozen"), META).what, "The discharge pressure reading has frozen. The pump may be fine.");
  assert.equal(plainAlert(alert("c", "P", 1, "SENSOR", "SENSOR_STUCK"), META).what, "The sensor reading has frozen. The pump may be fine.");
});

const ALERTS = [
  alert("a", "P1", 90, "MACHINE", "BEARING_WEAR"),
  alert("b", "P2", 95, "SENSOR", "SENSOR_DRIFT"),
  alert("c", "P3", 40, "MACHINE", "IMBALANCE"),
  alert("d", "P4", 92, "MACHINE", "UNKNOWN"),
];

const ids = (lines: { lead: { id: string } }[]) => lines.map((l) => l.lead.id);

test("pumps fall into today, readings and can wait, newest first", () => {
  const g = groupByPump(buildCases(ALERTS, 100), {}, 100);
  assert.deepEqual(ids(g.today), ["d", "a"]);
  assert.deepEqual(ids(g.readings), ["b"]);
  assert.deepEqual(ids(g.wait), ["c"]);
});

test("nothing from after the replay hour appears", () => {
  const g = groupByPump(buildCases(ALERTS, 50), {}, 50);
  assert.deepEqual([g.today.length, g.readings.length, g.wait.length], [1, 0, 0]);
});

test("a decision clears a case, and remind me later brings it back when due", () => {
  const cases = buildCases(ALERTS, 100);
  const done = { a: { caseId: "a", kind: "approved", atHour: 96 } as Decision };
  assert.equal(groupByPump(cases, done, 100).done, 1);
  const later = { a: { caseId: "a", kind: "watching", atHour: 96, followUpHour: 108 } as Decision };
  assert.deepEqual(ids(groupByPump(cases, later, 100).today), ["d"]);
  assert.ok(ids(groupByPump(cases, later, 110).today).includes("a"));
  assert.ok(ids(groupByPump(buildCases(ALERTS, 130), later, 130).today).includes("a"), "a due reminder stays at the top even when the case is old");
});

const RECORD = { SUCTION_STRAINER_CLOGGING: { right: 8, total: 9, wrongKind: 0 }, SENSOR_CALIBRATION_SHIFT: { right: 5, total: 20, wrongKind: 6 }, DISCHARGE_RESTRICTION: { right: 5, total: 10, wrongKind: 0 }, COMMUNICATION_LOSS: { right: 2, total: 2, wrongKind: 0 } };

test("a pump gets one line, led by the most reliable concern", () => {
  const alerts = [alert("x", "P9", 95, "MACHINE", "DISCHARGE_RESTRICTION"), alert("y", "P9", 90, "MACHINE", "SUCTION_STRAINER_CLOGGING"), alert("z", "P9", 96, "SENSOR", "SENSOR_DRIFT")];
  const g = groupByPump(buildCases(alerts, 100), {}, 100, RECORD);
  assert.equal(g.today.length, 1);
  assert.equal(g.today[0].lead.id, "y");
  assert.equal(g.today[0].others.length, 2);
  assert.equal(g.readings.length, 0);
});

test("trust is stated in plain words, and small samples say so", () => {
  assert.equal(trustFor("SUCTION_STRAINER_CLOGGING", RECORD)?.words, "Usually right: 8 of 9 past cases");
  assert.equal(trustFor("DISCHARGE_RESTRICTION", RECORD)?.words, "Right about half the time: 5 of 10 past cases");
  assert.equal(trustFor("SENSOR_CALIBRATION_SHIFT", RECORD)?.words, "Often wrong: 5 of 20 past cases");
  assert.equal(trustFor("COMMUNICATION_LOSS", RECORD)?.words, "Too few past cases to say (2 of 2 past cases)");
  assert.equal(trustFor("UNKNOWN", RECORD), null);
});

test("an unreliable sensor alert never reassures anyone about the pump", () => {
  const w = plainAlert(alert("a", "P", 1, "SENSOR", "SENSOR_CALIBRATION_SHIFT", "suction_pressure_kpa"), META, RECORD);
  assert.equal(w.what, "The suction pressure reading looks wrong. It could also be a real pump problem.");
  assert.match(w.check, /Check the pump as well\./);
  const fine = plainAlert(alert("b", "P", 1, "SENSOR", "SENSOR_CALIBRATION_SHIFT", "suction_pressure_kpa"), META);
  assert.match(fine.what, /The pump may be fine\./);
});

test("corrective work after the last alert moves a pump to can wait, and a new alert brings it back", () => {
  const strainer = alert("s", "P5", 90, "MACHINE", "SUCTION_STRAINER_CLOGGING");
  const pumps = { P5: { maintenance: [{ workType: "STRAINER_CLEANING", startHour: 95, planned: false }] } as unknown as PumpData };
  const cases = buildCases([strainer], 100);
  assert.deepEqual(ids(groupByPump(cases, {}, 100, undefined, pumps).wait), ["s"]);
  assert.match(workSince(cases[0], pumps.P5, 100) ?? "", /Work was done 5 h ago, after this alert: strainer cleaning\./);
  assert.deepEqual(ids(groupByPump(cases, {}, 94, undefined, pumps).today), ["s"], "work in the future changes nothing");
  const again = buildCases([strainer, alert("s2", "P5", 98, "MACHINE", "SUCTION_STRAINER_CLOGGING")], 100);
  assert.deepEqual(ids(groupByPump(again, {}, 100, undefined, pumps).today), ["s"]);
  const routine = { P5: { maintenance: [{ workType: "STRAINER_CLEANING", startHour: 95, planned: true }] } as unknown as PumpData };
  assert.deepEqual(ids(groupByPump(cases, {}, 100, undefined, routine).today), ["s"], "routine work does not clear a case");
});

test("every alert type has a job card", () => {
  for (const [type, w] of Object.entries(PLAIN)) {
    assert.ok(w.steps.length >= 1 && w.ifRight && w.ifNot, type);
  }
});

const pump = (values: (number | null)[]) =>
  ({ stepMinutes: 5, series: { suction_pressure_kpa: { obs: values, lo: values.map(() => 38), hi: values.map(() => 42) } }, maintenance: [{ workType: "LUBRICATION", startHour: 90, observation: "Greased." }], lastWork: { STRAINER_CLEANING: { hour: -300, observation: "Light debris." }, LUBRICATION: { hour: -50, observation: "Old." } }, stops: [[3, 5, "port call"], [10, 12, "port call"]] }) as unknown as PumpData;
const trendAlert = alert("a", "P", 1, "MACHINE", "SUCTION_STRAINER_CLOGGING", "suction_pressure_kpa");
const fill = (before: number, after: number) => [...Array(150).fill(before), ...Array(100).fill(after)];

test("trend compares the named signal with six hours ago", () => {
  assert.equal(trendOf(trendAlert, pump(fill(39, 30)), 200 * 5 / 60), "Getting worse");
  assert.equal(trendOf(trendAlert, pump(fill(30, 30)), 200 * 5 / 60), "Steady");
  assert.equal(trendOf(trendAlert, pump(fill(30, 39)), 200 * 5 / 60), "Easing");
});

test("trend says nothing when there is nothing fair to compare", () => {
  assert.equal(trendOf(alert("a", "P", 1, "MACHINE", "UNKNOWN"), pump(fill(30, 30)), 16), null);
  assert.equal(trendOf(trendAlert, pump(fill(30, 30)), 1), null);
  assert.equal(trendOf(trendAlert, pump(Array(200).fill(null)), 16), null);
});

test("the next stop comes from the schedule", () => {
  assert.equal(nextStop(pump([]), 1), "Next chance to stop: port call, in about 2 hours.");
  assert.equal(nextStop(pump([]), 4), "Chance to stop now: port call, for about 1 hour.");
  assert.equal(nextStop(pump([]), 11.5), "Chance to stop now: port call, for under an hour.");
  assert.equal(nextStop(pump([]), 20), null);
});

test("last done uses the newest record at or before the replay time", () => {
  assert.equal(lastDone(pump([]), "STRAINER_CLEANING", 60), "Strainer last cleaned 15 days ago: Light debris.");
  assert.equal(lastDone(pump([]), "LUBRICATION", 60), "Last greased 5 days ago: Old.");
  assert.equal(lastDone(pump([]), "LUBRICATION", 100), "Last greased 10 h ago: Greased.");
  assert.equal(lastDone(pump([]), undefined, 60), null);
});
