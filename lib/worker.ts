// Small facts that help someone decide: is it getting worse, when can it be done, and when was it last done.
import { LAST_WORK } from "./plain.ts";
import type { Alert, Case, PumpData } from "./types.ts";

// Corrective work that would clear each kind of problem.
const FIXED_BY: Record<string, string[]> = {
  SUCTION_STRAINER_CLOGGING: ["STRAINER_CLEANING"],
  CAVITATION: ["STRAINER_CLEANING"],
  DISCHARGE_RESTRICTION: ["VALVE_OR_COOLER_SERVICE"],
  BEARING_WEAR: ["BEARING_REPLACEMENT"],
  MISALIGNMENT: ["REALIGNMENT"],
  SENSOR_DRIFT: ["SENSOR_RECALIBRATION", "SENSOR_REPLACEMENT", "WIRING_REPAIR"],
  SENSOR_STUCK: ["SENSOR_RECALIBRATION", "SENSOR_REPLACEMENT", "WIRING_REPAIR"],
  SENSOR_CALIBRATION_SHIFT: ["SENSOR_RECALIBRATION", "SENSOR_REPLACEMENT", "WIRING_REPAIR"],
  SENSOR_NOISE_SPIKES: ["SENSOR_RECALIBRATION", "SENSOR_REPLACEMENT", "WIRING_REPAIR"],
  COMMUNICATION_LOSS: ["NETWORK_RESET"],
};

/** Corrective work done since the latest alert, so a case stops nagging about something already dealt with. */
export function workSince(c: Case, pump: PumpData | undefined, hour: number) {
  const types = FIXED_BY[c.faultType] ?? [];
  const done = pump?.maintenance.filter((m) => !m.planned && types.includes(m.workType) && m.startHour >= c.latest.offset_hours && m.startHour <= hour).at(-1);
  if (!done) return null;
  const hoursAgo = Math.max(1, Math.round(hour - done.startHour));
  return `Work was done ${hoursAgo} h ago, after this alert: ${done.workType.replaceAll("_", " ").toLowerCase()}. Check it helped.`;
}

export type Trend = "Getting worse" | "Steady" | "Easing";

const WINDOW_POINTS = 24; // two hours of 5-minute points
const LOOK_BACK_POINTS = 72; // six hours

function meanDistance(pump: PumpData, channel: string, end: number) {
  const s = pump.series[channel];
  if (!s?.lo || !s.hi) return null;
  const gaps: number[] = [];
  for (let i = Math.max(0, end - WINDOW_POINTS + 1); i <= end; i++) {
    const v = s.obs[i], lo = s.lo[i], hi = s.hi[i];
    if (v !== null && v !== undefined && lo !== null && lo !== undefined && hi !== null && hi !== undefined) gaps.push(Math.abs(v - (lo + hi) / 2));
  }
  return gaps.length >= 6 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
}

/** Compares how far the named signal sits from normal now and six hours ago. Null when there is nothing fair to compare. */
export function trendOf(alert: Alert, pump: PumpData | undefined, hour: number): Trend | null {
  const channel = alert.evidence.channels[0]?.channel;
  if (!channel || !pump) return null;
  const now = Math.floor((hour * 60) / pump.stepMinutes);
  const recent = meanDistance(pump, channel, now);
  const before = meanDistance(pump, channel, now - LOOK_BACK_POINTS);
  if (recent === null || before === null) return null;
  if (recent > before * 1.25) return "Getting worse";
  if (recent < before * 0.75) return "Easing";
  return "Steady";
}

const inWords = (hours: number) => {
  if (hours < 1) return "in under an hour";
  const n = Math.round(hours);
  return n >= 48 ? `in about ${Math.round(hours / 24)} days` : `in about ${n} ${n === 1 ? "hour" : "hours"}`;
};

/** The next time the schedule gives a chance to stop. A published timetable, so it may read ahead of the replay time. */
export function nextStop(pump: PumpData | undefined, hour: number) {
  const stops = pump?.stops ?? [];
  const now = stops.find(([start, end]) => hour >= start && hour < end);
  if (now) return `Chance to stop now: ${now[2]}, ${inWords(now[1] - hour).replace("in ", "for ")}.`;
  const next = stops.find(([start]) => start > hour);
  return next ? `Next chance to stop: ${next[2]}, ${inWords(next[0] - hour)}.` : null;
}

/** "Strainer last cleaned 15 days ago: Light debris." from the newest record at or before the replay time. */
export function lastDone(pump: PumpData | undefined, workType: string | undefined, hour: number) {
  if (!pump || !workType) return null;
  const during = pump.maintenance.filter((m) => m.workType === workType && m.startHour <= hour).at(-1);
  const before = pump.lastWork?.[workType];
  const hit = during ? { hour: during.startHour, observation: during.observation } : before;
  if (!hit) return null;
  const hoursAgo = hour - hit.hour;
  const when = hoursAgo < 36 ? `${Math.max(1, Math.round(hoursAgo))} h ago` : `${Math.round(hoursAgo / 24)} days ago`;
  return `${LAST_WORK[workType] ?? "Last done"} ${when}: ${hit.observation}`;
}
