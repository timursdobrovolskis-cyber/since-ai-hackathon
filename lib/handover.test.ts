import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCases } from "./cases.ts";
import { handoverScript, shiftLabel } from "./handover.ts";
import type { Alert } from "./types.ts";

const alert = (id: string, asset: string, hour: number, cls: "MACHINE" | "SENSOR", type: string) =>
  ({ alert_id: id, asset_id: asset, offset_hours: hour, event_class: cls, fault_type: type, evidence: { summary: "", channels: [], blind_spots: [] }, hypotheses: [] }) as unknown as Alert;

test("a quiet shift says so", () => {
  assert.equal(handoverScript([], {}, 42), "Handover for Day 2, evening shift. No pump problems need you right now.");
});

test("only the top three are spoken, and the rest are counted", () => {
  const alerts = ["PUMP-01", "PUMP-02", "PUMP-03", "PUMP-04"].map((p, i) => alert(p, p, 40 + i, "MACHINE", "BEARING_WEAR"));
  const script = handoverScript(buildCases(alerts, 50), {}, 50);
  assert.match(script, /^Handover for Day 3, morning shift\. 4 pump problems need you today\./);
  assert.match(script, /Pump 4\. Bearing is probably wearing out\./);
  assert.doesNotMatch(script, /Pump 1\./);
  assert.match(script, /1 more is on your list\./);
});

test("nothing from after the shift is spoken", () => {
  const alerts = [alert("a", "PUMP-08", 60, "MACHINE", "SUCTION_STRAINER_CLOGGING")];
  assert.doesNotMatch(handoverScript(buildCases(alerts, 54), {}, 54), /Pump 8/);
  assert.match(handoverScript(buildCases(alerts, 66), {}, 66), /Pump 8/);
});

test("shift names follow the clock", () => {
  assert.equal(shiftLabel(30), "Day 2, morning shift");
  assert.equal(shiftLabel(66), "Day 3, evening shift");
});
