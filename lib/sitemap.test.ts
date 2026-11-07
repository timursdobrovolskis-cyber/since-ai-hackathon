import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCases } from "./cases.ts";
import { siteAt, TEST_PUMPS, ZONES } from "./sitemap.ts";
import { groupByPump } from "./today.ts";
import type { Alert, Decision } from "./types.ts";

const alert = (id: string, asset: string, hour: number, cls: "MACHINE" | "SENSOR", type: string) =>
  ({ alert_id: id, asset_id: asset, offset_hours: hour, event_class: cls, fault_type: type, evidence: { summary: "", channels: [], blind_spots: [] }, hypotheses: [] }) as unknown as Alert;

const ALERTS = [
  alert("a", "PUMP-08", 40, "MACHINE", "SUCTION_STRAINER_CLOGGING"),
  alert("b", "PUMP-07", 55, "SENSOR", "SENSOR_DRIFT"),
  alert("c", "PUMP-04", 80, "MACHINE", "IMBALANCE"),
];
const SHIFT = 66;

test("the map holds all 12 pumps once, with the 3 test pumps", () => {
  const ids = ZONES.flatMap((z) => z.pumps);
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  for (const id of TEST_PUMPS) assert.ok(ids.includes(id));
});

test("before the first alert every live pump is green, and test pumps have no light", () => {
  const s = siteAt(ALERTS, 10, SHIFT, {});
  for (const [id, light] of Object.entries(s.lights)) assert.equal(light, TEST_PUMPS.has(id) ? "none" : "green", id);
  assert.equal(s.alerts, 0);
});

test("lights change as alerts arrive", () => {
  assert.equal(siteAt(ALERTS, 45, SHIFT, {}).lights["PUMP-08"], "red");
  assert.equal(siteAt(ALERTS, 45, SHIFT, {}).lights["PUMP-07"], "green");
  assert.equal(siteAt(ALERTS, 60, SHIFT, {}).lights["PUMP-07"], "orange");
});

test("nothing after the shift reaches the map, even if asked for a later hour", () => {
  const s = siteAt(ALERTS, 120, SHIFT, {});
  assert.equal(s.hour, SHIFT);
  assert.equal(s.lights["PUMP-04"], "green");
  assert.equal(s.alerts, 2);
});

test("at the shift the map agrees with Today, decisions included", () => {
  const decisions = { a: { caseId: "a", kind: "rejected", atHour: SHIFT } } as unknown as Record<string, Decision>;
  const s = siteAt(ALERTS, SHIFT, SHIFT, decisions);
  const today = groupByPump(buildCases(ALERTS, SHIFT), decisions, SHIFT);
  const lit = (colour: string) => Object.keys(s.lights).filter((id) => s.lights[id] === colour).sort();
  assert.deepEqual(today.today.map((l) => l.assetId).sort(), lit("red"));
  assert.deepEqual(today.readings.map((l) => l.assetId).sort(), lit("orange"));
});

test("a decision made at the shift does not change the picture earlier in the week", () => {
  const decisions = { a: { caseId: "a", kind: "rejected", atHour: SHIFT } } as unknown as Record<string, Decision>;
  assert.equal(siteAt(ALERTS, 50, SHIFT, decisions).lights["PUMP-08"], "red");
});
