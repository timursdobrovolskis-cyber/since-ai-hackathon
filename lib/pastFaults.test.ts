// The faults listed under each results row must add up to the figure shown in that row, so a click never contradicts the table.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { outcome, warnedBefore } from "./pastFaults.ts";
import type { PerEvent } from "./review-data.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../public/data/${p}`, import.meta.url), "utf8"));
const key = read("key-numbers.json");
const card = read("review/scorecard.json");
const faults: PerEvent[] = Object.values(card.pumps as Record<string, { perEvent: PerEvent[] }>).flatMap((p) => p.perEvent);
const ticks = (row: "caught" | "limit" | "cause", list: PerEvent[]) => [0, 1].map((i) => list.filter((e) => outcome(row, e)[i].ok).length);

test("faults caught add up to the row", () => {
  assert.equal(faults.length, key.faults);
  assert.deepEqual(ticks("caught", faults), [key.caught, key.alarmsCaught]);
});

test("warnings before the limit add up to the row", () => {
  const limited = faults.filter((e) => e.hasLimit);
  assert.equal(limited.length, key.withLimit);
  assert.deepEqual(ticks("limit", limited), [key.beforeLimit, key.beforeLimitAlarms]);
});

test("right causes add up to the row", () => {
  assert.deepEqual(ticks("cause", faults), [key.rightCause, key.rightCauseAlarms]);
});

test("a lead time rounded to -0 counts as late", () => {
  assert.equal(warnedBefore(-0), false);
  assert.equal(warnedBefore(0), true);
  assert.equal(warnedBefore(null), false);
});
