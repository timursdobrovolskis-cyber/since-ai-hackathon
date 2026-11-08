// Run with: node --test lib/payback.test.ts
// Every expected number is copied from the organizers' examples/business_case_output.md.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BASE, breakEvenDowntime, breakEvenFalseAlerts, evaluate, SWINGS } from "./payback.ts";

const near = (actual: number, expected: number, tolerance = 0.5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test("base case matches the published result", () => {
  const r = evaluate(BASE);
  near(r.caughtPerYear, 0.53, 0.005);
  near(r.benefit, 8268);
  near(r.falseAlertCost, 3110);
  near(r.net, 4458);
  near(r.paybackYears, 1.0, 0.05);
});

test("sensitivity table matches the published result", () => {
  const published: Record<string, [number, number]> = {
    faultsPerYear: [-1054, 12726],
    recall: [-90, 5025],
    falsePerPumpDay: [7568, -14332],
    downtimeEurH: [-1143, 17526],
    repairUnplannedEur: [2324, 7658],
    installedEur: [4458, 4458],
  };
  for (const s of SWINGS) {
    near(evaluate({ ...BASE, [s.key]: s.low }).net, published[s.key][0]);
    near(evaluate({ ...BASE, [s.key]: s.high }).net, published[s.key][1]);
  }
});

test("break-even and redundant pump match the published result", () => {
  near(breakEvenDowntime(BASE), 547);
  near(evaluate({ ...BASE, downtimeEurH: 0, faultsPerYear: 0.3 }).net, -2476);
  assert.equal(evaluate({ ...BASE, downtimeEurH: 0, faultsPerYear: 0.3 }).paybackYears, Infinity);
});

test("false alert break-even really is where net reaches zero", () => {
  near(evaluate({ ...BASE, falsePerPumpDay: breakEvenFalseAlerts(BASE) }).net, 0, 0.01);
});
