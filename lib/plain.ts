// Plain wording and job cards for workers. Written by hand, one entry per alert type, so it is instant, works offline
// and cannot invent anything. Steps are general guidance, to be checked by someone who works on these pumps.
// Engineering names stay behind "Why does it think this?".
import { trustFor, type Trust, type TrackRecord } from "./trust.ts";
import type { Alert } from "./types.ts";

export type Job = "clean" | "bearing" | "align" | "inspect";

type Wording = {
  what: string;
  check: string;
  short: string;
  steps: string[];
  ifRight: string;
  ifNot: string;
  job?: Job;
  lastWork?: string;
};

const SIGNAL = "{signal}";
const MAYBE_FINE = " The pump may be fine.";

/** Illustrative hours, from the assumptions in the organizers' sandbox. Replace with site figures. */
export const JOB_HOURS: Record<Job, { stop: number; labour: number; words: string }> = {
  clean: { stop: 1.5, labour: 3, words: "Cleaning" },
  bearing: { stop: 6, labour: 12, words: "A bearing change" },
  align: { stop: 3, labour: 6, words: "Realigning" },
  inspect: { stop: 1, labour: 2, words: "An inspection" },
};

export const LAST_WORK: Record<string, string> = {
  STRAINER_CLEANING: "Strainer last cleaned",
  LUBRICATION: "Last greased",
  ALIGNMENT_CHECK: "Alignment last checked",
  VIBRATION_ROUTE_MEASUREMENT: "Last vibration reading",
  ROUTINE_INSPECTION: "Last inspected",
};

const COMPARE = ["Find a local gauge or a second reading for the same thing.", "Compare it with what the screen shows.", "If they differ, get the sensor checked before any repair."];

export const PLAIN: Record<string, Wording> = {
  BEARING_WEAR: {
    what: "Bearing is probably wearing out.", check: "Listen at the bearing housing and check lubrication. Plan a bearing change.", short: "bearing wearing",
    steps: ["Listen and feel at the bearing housing for rumble, roughness or heat.", "Check the grease and when it was last done.", "If it is rough or hot, plan a bearing change at the next stop."],
    ifRight: "A rough noise, extra heat or more vibration at the housing.", ifNot: "If it runs smooth and cool, note it and keep watching.", job: "bearing", lastWork: "LUBRICATION",
  },
  SUCTION_STRAINER_CLOGGING: {
    what: "Strainer is probably clogging.", check: "Check and clean it at the next stop.", short: "strainer clogging",
    steps: ["At the next stop, isolate the pump the way your site requires.", "Open the strainer and look for debris or mussels.", "Clean it, refit it, and check the inlet pressure recovers."],
    ifRight: "Debris or mussels in the strainer.", ifNot: "If it is clean, check the inlet valve and the water level.", job: "clean", lastWork: "STRAINER_CLEANING",
  },
  CAVITATION: {
    what: "Pump may be short of water at the inlet.", check: "Check the strainer and the water level on the inlet side.", short: "short of water at the inlet",
    steps: ["Listen for a crackling, gravelly noise at the pump.", "Check the strainer and the inlet valve.", "Check the water level or supply on the inlet side."],
    ifRight: "A crackling noise and unsteady pressure.", ifNot: "If the inlet is clear and it sounds normal, note it and keep watching.", job: "clean", lastWork: "STRAINER_CLEANING",
  },
  DISCHARGE_RESTRICTION: {
    what: "Something is probably blocking flow after the pump.", check: "Check the discharge valves and the cooler.", short: "flow blocked after the pump",
    steps: ["Walk the discharge line and check the valves are fully open.", "Check whether the cooler has been fouling.", "Compare the pressure with a local gauge."],
    ifRight: "A valve left part closed, or a fouled cooler.", ifNot: "If the line is clear, the pressure reading itself may be wrong.", job: "inspect", lastWork: "ROUTINE_INSPECTION",
  },
  MISALIGNMENT: {
    what: "Pump and motor are probably out of line.", check: "Check the coupling alignment.", short: "pump and motor out of line",
    steps: ["Check the coupling and its guard for wear or damage.", "Feel the bearing and motor for extra heat.", "Check the alignment with a laser tool at the next stop."],
    ifRight: "Coupling wear, extra heat, or a failed alignment check.", ifNot: "If alignment is within tolerance, ask for a vibration reading.", job: "align", lastWork: "ALIGNMENT_CHECK",
  },
  IMBALANCE: {
    what: "Impeller is probably out of balance.", check: "Inspect the impeller for deposits or damage.", short: "impeller out of balance",
    steps: ["Listen and feel for vibration, especially at higher speed.", "At the next stop, inspect the impeller for deposits or damage.", "Clean it, or plan balancing if it is damaged."],
    ifRight: "Deposits or damage on the impeller.", ifNot: "If the impeller is clean, ask for a vibration reading.", job: "inspect", lastWork: "VIBRATION_ROUTE_MEASUREMENT",
  },
  IMPELLER_WEAR: {
    what: "Impeller is probably worn.", check: "Arrange a performance check and inspect the impeller.", short: "impeller worn",
    steps: ["Compare pressure and motor current with what is normal for this pump.", "Arrange a performance check.", "Inspect the impeller and wear rings at the next planned stop."],
    ifRight: "Lower pressure than normal at the same load, and visible wear.", ifNot: "If performance is normal, check the pressure reading.", job: "inspect", lastWork: "ROUTINE_INSPECTION",
  },
  AIR_ENTRAINMENT: {
    what: "Air is probably getting into the water.", check: "Check the inlet side and the water level.", short: "air in the water",
    steps: ["Check the water level or supply on the inlet side.", "Look for leaks on the inlet line.", "Listen for uneven running. Heavy weather can cause this at sea."],
    ifRight: "A low level, an inlet leak, or uneven running.", ifNot: "If the inlet is sound, note it and keep watching.", job: "inspect", lastWork: "ROUTINE_INSPECTION",
  },
  SENSOR_DRIFT: { what: `The ${SIGNAL} reading is slowly drifting.${MAYBE_FINE}`, check: "Compare it with a local gauge before any repair.", short: "reading drifting", steps: COMPARE, ifRight: "The screen and the local gauge disagree.", ifNot: "If they agree, the change is real, so treat it as a pump problem." },
  SENSOR_STUCK: { what: `The ${SIGNAL} reading has frozen.${MAYBE_FINE}`, check: "Check the sensor and its cable.", short: "reading frozen", steps: ["Check whether the value moves at all when the load changes.", "Check the sensor connector and cable.", "Replace or repair it if it stays frozen."], ifRight: "The value does not move while the pump's load does.", ifNot: "If it moves normally, mark this as not a problem." },
  SENSOR_CALIBRATION_SHIFT: { what: `The ${SIGNAL} reading looks wrong.${MAYBE_FINE}`, check: "Compare it with a local gauge before any repair.", short: "reading looks wrong", steps: COMPARE, ifRight: "The screen and the local gauge disagree.", ifNot: "If they agree, the change is real, so treat it as a pump problem." },
  SENSOR_NOISE_SPIKES: { what: `The ${SIGNAL} reading is jumping around.${MAYBE_FINE}`, check: "Check the sensor cable and connector.", short: "reading jumping around", steps: ["Check the connector and cable screen.", "Look for damage or loose wiring near the sensor.", "Compare it with a local gauge."], ifRight: "A loose connector or damaged cable.", ifNot: "If the wiring is sound, the changes may be real, so check the pump." },
  COMMUNICATION_LOSS: { what: "Data has stopped arriving from this pump.", check: "Check the gateway and network. The pump itself may be fine.", short: "data stopped arriving", steps: ["Check the gateway or network box has power.", "Check the sensor battery if it is wireless.", "Walk past the pump, because nothing is watching it right now."], ifRight: "A powered-off gateway, a flat battery or a dropped network.", ifNot: "If everything looks fine, report it to whoever runs the network." },
  UNKNOWN: { what: "Something looks unusual, but the cause is unclear.", check: "Walk past and inspect the pump.", short: "cause unclear", steps: ["Walk past and listen, look and feel.", "Compare what you see with what the screen shows.", "Record what you find."], ifRight: "Anything that does not look or sound normal.", ifNot: "If all looks normal, mark it as nothing wrong.", job: "inspect", lastWork: "ROUTINE_INSPECTION" },
};

const FALLBACK: Wording = { what: "Something needs a look.", check: "Inspect the pump.", short: "needs a look", steps: ["Walk past and inspect the pump."], ifRight: "Anything unusual.", ifNot: "If all looks normal, mark it as nothing wrong." };

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

export function plainAlert(alert: Alert, meta: Meta, record?: TrackRecord) {
  const w = PLAIN[alert.fault_type] ?? FALLBACK;
  const trust: Trust | null = trustFor(alert.fault_type, record);
  const weak = trust?.level === "weak";
  // A cause that is often wrong must not reassure anyone about the pump.
  const what = w.what.replace(SIGNAL, signalName(alert, meta)).replace(MAYBE_FINE, weak ? " It could also be a real pump problem." : MAYBE_FINE);
  return { ...w, what, check: weak ? `${w.check} Check the pump as well.` : w.check, trust };
}
