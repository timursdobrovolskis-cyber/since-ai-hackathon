// Time to act: turns a concern into a decision with the cost of waiting, for the pump card.
// Costs are the organizers' business-case figures (lib/payback.ts BASE). The advice follows the trend of the reading
// behind the alert and the next chance to stop in the schedule. There is no "hours until the limit" figure: the data
// holds no alarm limit per reading, so any such number would be invented.
import { BASE } from "./payback.ts";
import type { PumpData } from "./types.ts";
import type { Trend } from "./worker.ts";

export const PLANNED_EUR = BASE.plannedStopH * BASE.downtimeEurH + BASE.repairPlannedEur;
export const BREAKDOWN_EUR = BASE.unplannedStopH * BASE.downtimeEurH + BASE.repairUnplannedEur;
/** A pump opened for nothing: one planned stop, no repair. */
export const SENSOR_CHECK_SAVES_EUR = BASE.plannedStopH * BASE.downtimeEurH;

/** Hours until the next chance to stop, 0 if one is open now, null if the schedule has none left this week. */
export function hoursToStop(pump: PumpData | undefined, hour: number): { hours: number; label: string } | null {
  const stops = pump?.stops ?? [];
  const now = stops.find(([start, end]) => hour >= start && hour < end);
  if (now) return { hours: 0, label: now[2] };
  const next = stops.find(([start]) => start > hour);
  return next ? { hours: next[0] - hour, label: next[2] } : null;
}

export type Advice = { headline: string; why: string };

/** One plain decision for a machine fault, from its trend and the next stop. */
export function adviceFor(trend: Trend | null, stop: { hours: number; label: string } | null): Advice {
  // Plant schedules call their planned window "night"; ships call theirs "port call".
  const name = stop?.label === "night" ? "night stop" : stop?.label;
  const at = stop ? (stop.hours === 0 ? `now, during the ${name}` : `at the next ${name}, in about ${Math.max(1, Math.round(stop.hours))} h`) : "at the next planned stop";
  if (trend === "Getting worse") return { headline: `Fix it ${at}.`, why: "The reading is moving further from normal, so waiting raises the risk of a breakdown." };
  if (trend === "Steady") return { headline: `Plan it ${at}, or the stop after.`, why: "The reading is off normal but not moving fast. Keep watching it until then." };
  if (trend === "Easing") return { headline: "Keep watching. No stop needed yet.", why: "The reading is moving back towards normal. Plan a check at a convenient stop." };
  return { headline: `Plan a check ${at}.`, why: "There is not enough recent data to say which way the reading is going." };
}
