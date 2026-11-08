// Where on the pump a concern is, so the landing page can light up that area of the 3D pump.
// The model is one solid piece, so these are areas along the shaft, in model units (-1 motor end to 1 suction end),
// not exact parts. Machine faults point to the part they affect. Sensor faults point to where that sensor sits.
import type { Alert } from "./types.ts";

export type PumpArea = { key: string; label: string; x: [number, number] };

export const AREAS: Record<string, PumpArea> = {
  motor: { key: "motor", label: "Motor", x: [-1, -0.27] },
  coupling: { key: "coupling", label: "Coupling", x: [-0.3, -0.08] },
  bearings: { key: "bearings", label: "Bearing housing", x: [-0.1, 0.36] },
  casing: { key: "casing", label: "Casing and impeller", x: [0.34, 0.84] },
  suction: { key: "suction", label: "Suction end, towards the strainer", x: [0.8, 1.01] },
};

const BY_FAULT: Record<string, string> = {
  SUCTION_STRAINER_CLOGGING: "suction",
  AIR_ENTRAINMENT: "suction",
  CAVITATION: "casing",
  DISCHARGE_RESTRICTION: "casing",
  IMPELLER_WEAR: "casing",
  IMBALANCE: "casing",
  MISALIGNMENT: "coupling",
  BEARING_WEAR: "bearings",
};

const BY_CHANNEL: Record<string, string> = {
  suction_pressure_kpa: "suction",
  flow_m3_h: "suction",
  discharge_pressure_kpa: "casing",
  fluid_temp_c: "casing",
  bearing_temp_c: "bearings",
  vibration_rms_mm_s: "bearings",
  vibration_accel_rms_g: "bearings",
  vibration_crest_factor: "bearings",
  motor_current_a: "motor",
  motor_power_kw: "motor",
  motor_speed_rpm: "motor",
  motor_winding_temp_c: "motor",
};

/** The area for an alert, or null when it names no part or reading (an unclear cause, a lost connection). */
export function areaFor(alert: Alert, channel: string | null): PumpArea | null {
  const key = alert.event_class === "SENSOR" ? (channel ? BY_CHANNEL[channel] : undefined) : BY_FAULT[alert.fault_type];
  return key ? AREAS[key] : null;
}
