// Run with: npm test. Checks the overview cannot show anything from after the replay time.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCases } from "./cases.ts";
import { casesPerDay, flaggedOverTime, overviewStats, recentActivity } from "./overview.ts";
import type { Alert, Decision, PumpData } from "./types.ts";

const alert = (id: string, asset: string, hour: number, cls: "MACHINE" | "SENSOR", type: string) =>
  ({ alert_id: id, asset_id: asset, offset_hours: hour, event_class: cls, fault_type: type, alert_time_utc: "", evidence: { summary: "", channels: [], blind_spots: [] }, hypotheses: [] }) as unknown as Alert;
const pump = (id: string, alarmHours: number[] = [], workHours: number[] = []) =>
  ({
    id, stateRuns: [[0, 168, "RUNNING"]], history: [],
    alarms: alarmHours.map((h) => ({ tag: "x", raisedHour: h })),
    maintenance: workHours.map((h) => ({ id: `${id}-${h}`, startHour: h, workType: "LUBRICATION", planned: true })),
  }) as unknown as PumpData;

const ALERTS = [alert("a", "P1", 10, "MACHINE", "BEARING_WEAR"), alert("b", "P2", 30, "SENSOR", "SENSOR_DRIFT"), alert("c", "P1", 100, "MACHINE", "IMBALANCE")];
const PUMPS = [pump("P1", [50], [20, 90]), pump("P2", [120])];

test("stats only count what has happened by the replay hour", () => {
  const s = overviewStats(buildCases(ALERTS, 40), PUMPS, {}, 40);
  assert.deepEqual([s.open, s.machine, s.sensor, s.alarms, s.pumpsWithAlarms], [2, 1, 1, 0, 0]);
  const later = overviewStats(buildCases(ALERTS, 130), PUMPS, {}, 130);
  assert.deepEqual([later.open, later.alarms, later.pumpsWithAlarms], [3, 2, 2]);
});

test("a decision moves a case out of the open count", () => {
  const cases = buildCases(ALERTS, 40);
  const decisions = { [cases[0].id]: { caseId: cases[0].id, kind: "approved", atHour: 35 } as Decision };
  const s = overviewStats(cases, PUMPS, decisions, 40);
  assert.deepEqual([s.open, s.machine, s.decided], [1, 0, 1]);
});

test("cases per day respects the filter", () => {
  const cases = buildCases(ALERTS, 168);
  assert.deepEqual(casesPerDay(cases, "all"), [1, 1, 0, 0, 1, 0, 0]);
  assert.deepEqual(casesPerDay(cases, "SENSOR"), [0, 1, 0, 0, 0, 0, 0]);
});

test("the flagged lines stop at the replay hour", () => {
  const { ours, alarms } = flaggedOverTime(buildCases(ALERTS, 60), PUMPS, 60);
  assert.equal(ours[60], 2);
  assert.equal(ours[61], null);
  assert.equal(alarms[60], 1);
  assert.equal(alarms[168], null);
});

test("recent activity holds nothing from the future and shows the newest first", () => {
  const items = recentActivity(buildCases(ALERTS, 60), PUMPS, {}, 60);
  assert.ok(items.every((i) => i.hour <= 60));
  assert.deepEqual(items.map((i) => i.hour), [50, 30, 20, 10]);
});
