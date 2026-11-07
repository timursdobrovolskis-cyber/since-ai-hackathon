import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCases } from "./cases.ts";
import type { Alert, PumpData, PumpMeta } from "./types.ts";
import { pumpBrief } from "./voice.ts";

const alert = { alert_id: "a", asset_id: "PUMP-08", offset_hours: 60, event_class: "MACHINE", fault_type: "SUCTION_STRAINER_CLOGGING", evidence: { summary: "Suction pressure is 6.4 kPa below expected.", channels: [], blind_spots: ["flow_m3_h"] }, hypotheses: [] } as unknown as Alert;
const meta = { id: "PUMP-08", system: "Seawater cooling", site: "Vessel B (RoPax, fictional)", commissionedYear: 2016 } as PumpMeta;
const note = (id: string, startHour: number, observation: string) => ({ id, startHour, observation });
const pump = { stepMinutes: 60, series: { bearing_temp_c: { obs: [40, null, 41, ...Array(100).fill(null), 99] } }, alarms: [{ raisedHour: 10 }, { raisedHour: 100 }], history: [note("h", -100, "Bearings regreased.")], maintenance: [note("m", 82, "Suspected cavitation.")] } as unknown as PumpData;
const channels = { flow_m3_h: { label: "Flow", unit: "m³/h" }, bearing_temp_c: { label: "Bearing temperature", unit: "°C" } };

test("the brief holds what is known at the replay hour", () => {
  const cases = buildCases([alert], 65);
  const brief = pumpBrief(cases[0], cases, meta, pump, channels, 65);
  assert.match(brief, /Pump 8, Seawater cooling, Vessel B/);
  assert.match(brief, /Strainer is probably clogging\./);
  assert.match(brief, /Not measured on this pump: flow\./);
  assert.match(brief, /Plant alarms on this pump so far: 1\./);
  assert.match(brief, /possibly wrong: Bearings regreased\./);
});

test("the brief gives the latest reading of what the pump measures, and nothing later", () => {
  const cases = buildCases([alert], 65);
  const brief = pumpBrief(cases[0], cases, meta, pump, channels, 65);
  assert.match(brief, /Bearing temperature 41 °C/);
  assert.doesNotMatch(brief, /Bearing temperature 99/);
  assert.match(pumpBrief(cases[0], cases, meta, pump, channels, 110), /Bearing temperature 99 °C/);
});

test("the brief leaves out anything after the replay hour", () => {
  const cases = buildCases([alert], 65);
  const brief = pumpBrief(cases[0], cases, meta, pump, channels, 65);
  assert.doesNotMatch(brief, /Suspected cavitation/);
  assert.match(pumpBrief(cases[0], cases, meta, pump, channels, 90), /Suspected cavitation/);
});
