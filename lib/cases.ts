import type { Alert, Case, Decision, PumpData, PumpState } from "./types";

/** Alerts for one pump and fault further apart than this start a new case. */
const CASE_GAP_HOURS = 36;

/**
 * Merge repeat alerts into cases. Takes only alerts at or before `hour`, so live screens cannot see the future.
 * A case keeps its id because the id comes from its first alert.
 */
export function buildCases(alerts: Alert[], hour: number): Case[] {
  const visible = alerts.filter((a) => a.offset_hours <= hour).sort((a, b) => a.offset_hours - b.offset_hours);
  const open = new Map<string, Case>();
  const all: Case[] = [];
  for (const alert of visible) {
    const key = `${alert.asset_id}|${alert.fault_type}`;
    const current = open.get(key);
    if (current && alert.offset_hours - current.latest.offset_hours <= CASE_GAP_HOURS) {
      current.alerts.push(alert);
      current.latest = alert;
      continue;
    }
    const created: Case = {
      id: alert.alert_id,
      assetId: alert.asset_id,
      faultType: alert.fault_type,
      eventClass: alert.event_class,
      alerts: [alert],
      first: alert,
      latest: alert,
    };
    open.set(key, created);
    all.push(created);
  }
  return all;
}

/** Operating state at an hour, or null when the hour is outside the data. */
export function stateAt(pump: PumpData, hour: number): string | null {
  const run = pump.stateRuns.find(([start, end]) => hour >= start && hour < end);
  return run ? run[2] : null;
}

const STOPPED = new Set(["STOPPED", "LOCKED_OUT", "STOPPING"]);

export function pumpState(pump: PumpData, cases: Case[], decisions: Record<string, Decision>, hour: number): PumpState {
  const undecided = cases.filter((c) => !decisions[c.id]);
  if (undecided.some((c) => c.eventClass === "MACHINE")) return "Needs review";
  const running = stateAt(pump, hour);
  if (running === "NO_DATA" || undecided.some((c) => c.eventClass === "SENSOR")) return "Data problem";
  if (cases.some((c) => decisions[c.id]?.kind === "watching")) return "Watching";
  if (running && STOPPED.has(running)) return "Stopped";
  return "Normal";
}

export type Certainty = "High" | "Medium" | "Low";

/** Provisional bands from the spec. Returns null when the number should not be shown as certainty. */
export function certainty(probability: number, calibrated: boolean): Certainty | null {
  if (!calibrated) return null;
  if (probability >= 0.7) return "High";
  if (probability >= 0.4) return "Medium";
  return "Low";
}
