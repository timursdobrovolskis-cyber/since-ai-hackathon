// The results on the landing page come from key-numbers.json. These checks tie every figure in it back to the
// organizers' scorer output in review/scorecard.json, so a figure on the page cannot drift from what was scored.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../public/data/${p}`, import.meta.url), "utf8"));
const key = read("key-numbers.json");
const card = read("review/scorecard.json");
const now = card.totals.current.all;
const plant = card.totals.plant.all;
const events = Object.values(card.pumps as Record<string, { perEvent: { detected: boolean; typeCorrect: boolean; leadHours: number | null; plantLeadHours: number | null }[] }>).flatMap(
  (p) => p.perEvent,
);

test("counts and rates match the scorer", () => {
  assert.equal(key.faults, now.events_scored);
  assert.equal(key.caught, now.true_positive_events);
  assert.equal(key.alarmsCaught, plant.true_positive_events);
  assert.equal(key.falsePerPumpDay, now.false_alerts_per_asset_day);
  assert.equal(key.falsePerPumpDayAlarms, plant.false_alerts_per_asset_day);
  assert.equal(key.caught, events.filter((e) => e.detected).length);
});

test("right causes match the scorer's fault-type recall", () => {
  assert.equal(key.rightCause, events.filter((e) => e.typeCorrect).length);
  assert.equal(key.rightCause, Math.round(now.fault_type_recall * now.events_scored));
  assert.equal(key.rightCauseAlarms, Math.round(plant.fault_type_recall * plant.events_scored));
});

test("warnings before the limit match the scorer's early-warning rate", () => {
  // The scorer's rate is over faults that reached a limit and were caught at all.
  const caughtWithLimit = events.filter((e) => e.leadHours !== null).length;
  const alarmsCaughtWithLimit = events.filter((e) => e.plantLeadHours !== null).length;
  assert.ok(Math.abs(key.beforeLimit / caughtWithLimit - now.early_warning_rate) < 1e-3);
  assert.ok(Math.abs(key.beforeLimitAlarms / alarmsCaughtWithLimit - plant.early_warning_rate) < 1e-3);
  assert.ok(key.withLimit >= caughtWithLimit && key.withLimit <= key.faults);
});
