import assert from "node:assert/strict";
import { test } from "node:test";
import { areaFor } from "./pumpArea.ts";
import { concernWindow, evidenceChannel, signalRows } from "./signal.ts";
import type { Alert, PumpData } from "./types.ts";

const pump = {
  id: "P",
  stepMinutes: 5,
  series: {
    suction_pressure_kpa: { obs: Array.from({ length: 2016 }, (_, i) => (i === 10 ? null : 40 + (i % 7))), lo: Array(2016).fill(38), hi: Array(2016).fill(48) },
    discharge_pressure_kpa: { obs: Array(2016).fill(300), lo: null, hi: null },
  },
} as unknown as PumpData;
const meta = { suction_pressure_kpa: { label: "Suction pressure" }, discharge_pressure_kpa: { label: "Discharge pressure" } };
const alert = (cls: string, type: string, channels: string[], summary = "") =>
  ({ event_class: cls, fault_type: type, evidence: { summary, channels: channels.map((channel) => ({ channel })) } }) as unknown as Alert;

test("chart rows never pass the shift, even when asked for later", () => {
  const rows = signalRows(pump, "suction_pressure_kpa", 0, 168, 66);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.hour <= 66));
});

test("gaps are skipped and a missing band collapses onto the reading", () => {
  const rows = signalRows(pump, "suction_pressure_kpa", 0, 2, 66, 1);
  assert.ok(rows.every((r) => r.hour !== 10 * (5 / 60)));
  const flat = signalRows(pump, "discharge_pressure_kpa", 0, 1, 66, 1);
  assert.ok(flat.every((r) => r.lo === r.value && r.hi === r.value));
});

test("the evidence channel comes from the alert, or from the words in its summary", () => {
  assert.equal(evidenceChannel(alert("MACHINE", "X", ["suction_pressure_kpa"]), meta, pump), "suction_pressure_kpa");
  assert.equal(evidenceChannel(alert("SENSOR", "SENSOR_STUCK", [], "Discharge pressure reading is frozen"), meta, pump), "discharge_pressure_kpa");
  assert.equal(evidenceChannel(alert("SENSOR", "SENSOR_STUCK", [], "Something odd"), meta, pump), null);
});

test("the chart window starts 18 hours before the first alert, not before the week", () => {
  assert.deepEqual(concernWindow(60, 66), { from: 42, to: 66 });
  assert.deepEqual(concernWindow(5, 66), { from: 0, to: 66 });
});

test("machine faults light up their part, sensor faults the place the sensor sits", () => {
  assert.equal(areaFor(alert("MACHINE", "SUCTION_STRAINER_CLOGGING", []), null)?.key, "suction");
  assert.equal(areaFor(alert("MACHINE", "BEARING_WEAR", []), null)?.key, "bearings");
  assert.equal(areaFor(alert("SENSOR", "SENSOR_DRIFT", []), "motor_winding_temp_c")?.key, "motor");
  assert.equal(areaFor(alert("MACHINE", "UNKNOWN", []), null), null);
});
