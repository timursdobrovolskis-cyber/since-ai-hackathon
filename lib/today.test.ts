import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCases } from "./cases.ts";
import { FAULT_LABEL } from "./labels.ts";
import { PLAIN, plainAlert, pumpName } from "./plain.ts";
import { groupCases } from "./today.ts";
import type { Alert, Decision } from "./types.ts";

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

test("cases fall into today, readings and can wait, newest first", () => {
  const g = groupCases(buildCases(ALERTS, 100), {}, 100);
  assert.deepEqual(g.today.map((c) => c.id), ["d", "a"]);
  assert.deepEqual(g.readings.map((c) => c.id), ["b"]);
  assert.deepEqual(g.wait.map((c) => c.id), ["c"]);
});

test("nothing from after the replay hour appears", () => {
  const g = groupCases(buildCases(ALERTS, 50), {}, 50);
  assert.deepEqual([g.today.length, g.readings.length, g.wait.length], [1, 0, 0]);
});

test("a decision clears a case, and remind me later brings it back when due", () => {
  const cases = buildCases(ALERTS, 100);
  const done = { a: { caseId: "a", kind: "approved", atHour: 96 } as Decision };
  assert.equal(groupCases(cases, done, 100).done, 1);
  const later = { a: { caseId: "a", kind: "watching", atHour: 96, followUpHour: 108 } as Decision };
  assert.deepEqual(groupCases(cases, later, 100).today.map((c) => c.id), ["d"]);
  assert.ok(groupCases(cases, later, 110).today.some((c) => c.id === "a"));
  const old = groupCases(buildCases(ALERTS, 130), later, 130);
  assert.ok(old.today.some((c) => c.id === "a"), "a due reminder stays at the top even when the case is old");
});
