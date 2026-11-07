// Plain wording for workers. Written by hand, one entry per fault type, so it is instant, works offline and cannot
// invent anything. Engineering names stay behind "Why does it think this?".
import type { Alert } from "./types.ts";

type Wording = { what: string; check: string; short: string };

const SIGNAL = "{signal}";

export const PLAIN: Record<string, Wording> = {
  BEARING_WEAR: { what: "Bearing is probably wearing out.", check: "Listen at the bearing housing and check lubrication. Plan a bearing change.", short: "bearing wearing" },
  SUCTION_STRAINER_CLOGGING: { what: "Strainer is probably clogging.", check: "Check and clean it at the next stop.", short: "strainer clogging" },
  CAVITATION: { what: "Pump may be short of water at the inlet.", check: "Check the strainer and the water level on the inlet side.", short: "short of water at the inlet" },
  DISCHARGE_RESTRICTION: { what: "Something is probably blocking flow after the pump.", check: "Check the discharge valves and the cooler.", short: "flow blocked after the pump" },
  MISALIGNMENT: { what: "Pump and motor are probably out of line.", check: "Check the coupling alignment.", short: "pump and motor out of line" },
  IMBALANCE: { what: "Impeller is probably out of balance.", check: "Inspect the impeller for deposits or damage.", short: "impeller out of balance" },
  IMPELLER_WEAR: { what: "Impeller is probably worn.", check: "Arrange a performance check and inspect the impeller.", short: "impeller worn" },
  AIR_ENTRAINMENT: { what: "Air is probably getting into the water.", check: "Check the inlet side and the water level.", short: "air in the water" },
  SENSOR_DRIFT: { what: `The ${SIGNAL} reading is slowly drifting. The pump may be fine.`, check: "Compare it with a local gauge before any repair.", short: "reading drifting" },
  SENSOR_STUCK: { what: `The ${SIGNAL} reading has frozen. The pump may be fine.`, check: "Check the sensor and its cable.", short: "reading frozen" },
  SENSOR_CALIBRATION_SHIFT: { what: `The ${SIGNAL} reading looks wrong. The pump may be fine.`, check: "Compare it with a local gauge before any repair.", short: "reading looks wrong" },
  SENSOR_NOISE_SPIKES: { what: `The ${SIGNAL} reading is jumping around. The pump may be fine.`, check: "Check the sensor cable and connector.", short: "reading jumping around" },
  COMMUNICATION_LOSS: { what: "Data has stopped arriving from this pump.", check: "Check the gateway and network. The pump itself may be fine.", short: "data stopped arriving" },
  UNKNOWN: { what: "Something looks unusual, but the cause is unclear.", check: "Walk past and inspect the pump.", short: "cause unclear" },
};

const FALLBACK: Wording = { what: "Something needs a look.", check: "Inspect the pump.", short: "needs a look" };

/** "PUMP-08" becomes "Pump 8". */
export const pumpName = (id: string) => id.replace(/^PUMP-0*/, "Pump ");

type Meta = Record<string, { label: string }>;

/** The signal an instrument alert is about, in lower case, or "sensor" when the alert does not say. */
function signalName(alert: Alert, meta: Meta) {
  const channel = alert.evidence.channels[0]?.channel;
  if (channel && meta[channel]) return meta[channel].label.toLowerCase();
  const summary = alert.evidence.summary.toLowerCase();
  const named = Object.values(meta).map((m) => m.label.toLowerCase()).find((label) => summary.includes(label));
  return named ?? "sensor";
}

export function plainAlert(alert: Alert, meta: Meta) {
  const w = PLAIN[alert.fault_type] ?? FALLBACK;
  return { what: w.what.replace(SIGNAL, signalName(alert, meta)), check: w.check, short: w.short };
}
