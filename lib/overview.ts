// Numbers for the overview screen. Everything here is worked out from cases, alarms and decisions at or before `hour`,
// so the overview cannot show the future. `lib/overview.test.ts` checks that rule.
import { pumpState } from "./cases.ts";
import { faultLabel } from "./labels.ts";
import type { Case, Decision, EventClass, PumpData, PumpState } from "./types.ts";

export type Filter = "all" | "MACHINE" | "SENSOR";

export const matches = (filter: Filter, eventClass: EventClass) => filter === "all" || filter === eventClass;

export function overviewStats(cases: Case[], pumps: PumpData[], decisions: Record<string, Decision>, hour: number) {
  const open = cases.filter((c) => !decisions[c.id]);
  const alarmsSoFar = pumps.flatMap((p) => p.alarms.filter((a) => a.raisedHour <= hour).map(() => p.id));
  return {
    open: open.length,
    newToday: open.filter((c) => hour - c.first.offset_hours <= 24).length,
    machine: open.filter((c) => c.eventClass === "MACHINE").length,
    sensor: open.filter((c) => c.eventClass === "SENSOR").length,
    alarms: alarmsSoFar.length,
    pumpsWithAlarms: new Set(alarmsSoFar).size,
    decided: cases.length - open.length,
  };
}

export const casesPerDay = (cases: Case[], filter: Filter) =>
  [0, 1, 2, 3, 4, 5, 6].map(
    (day) => cases.filter((c) => matches(filter, c.eventClass) && Math.floor(c.first.offset_hours / 24) === day).length,
  );

/** Pumps flagged so far by each source, hour by hour. Values after `hour` are null, so a line stops at the replay time. */
export function flaggedOverTime(cases: Case[], pumps: PumpData[], hour: number) {
  const firstCase = new Map<string, number>();
  for (const c of cases) firstCase.set(c.assetId, Math.min(firstCase.get(c.assetId) ?? Infinity, c.first.offset_hours));
  const firstAlarm = pumps.flatMap((p) => {
    const raised = p.alarms.filter((a) => a.raisedHour <= hour).map((a) => a.raisedHour);
    return raised.length ? [Math.min(...raised)] : [];
  });
  const hours = Array.from({ length: 169 }, (_, h) => h);
  const count = (firsts: number[]) => hours.map((h) => (h <= hour ? firsts.filter((f) => f <= h).length : null));
  return { hours, ours: count([...firstCase.values()]), alarms: count(firstAlarm) };
}

export type Activity = { key: string; hour: number; assetId: string; kind: "case" | "update" | "alarm" | "work" | "decision"; text: string; eventClass?: EventClass; faultType?: string };

const DECIDED: Record<Decision["kind"], string> = { approved: "Inspection approved", rejected: "Alert rejected", watching: "Keeping watch" };

export function recentActivity(cases: Case[], pumps: PumpData[], decisions: Record<string, Decision>, hour: number, limit = 8): Activity[] {
  const items: Activity[] = [];
  for (const c of cases) {
    c.alerts.forEach((a, i) => {
      items.push({
        key: a.alert_id, hour: a.offset_hours, assetId: c.assetId, kind: i === 0 ? "case" : "update",
        text: `${i === 0 ? "New case" : "Update"}: ${faultLabel(c.faultType).toLowerCase()}`, eventClass: c.eventClass, faultType: c.faultType,
      });
    });
  }
  for (const p of pumps) {
    for (const a of p.alarms) {
      if (a.raisedHour <= hour) items.push({ key: `${p.id}-${a.tag}-${a.raisedHour}`, hour: a.raisedHour, assetId: p.id, kind: "alarm", text: "Plant alarm raised" });
    }
    for (const m of p.maintenance) {
      if (m.startHour <= hour) items.push({ key: m.id, hour: m.startHour, assetId: p.id, kind: "work", text: `${m.planned ? "Planned work" : "Corrective work"}: ${m.workType.replaceAll("_", " ").toLowerCase()}` });
    }
  }
  for (const d of Object.values(decisions)) {
    if (d.atHour <= hour) items.push({ key: `decision-${d.caseId}`, hour: d.atHour, assetId: d.assetId, kind: "decision", text: `${DECIDED[d.kind]}: ${faultLabel(d.faultType).toLowerCase()}` });
  }
  return items.sort((a, b) => b.hour - a.hour).slice(0, limit);
}

export const STATE_RANK: Record<PumpState, number> = { "Needs review": 0, "Data problem": 1, Watching: 2, Stopped: 3, Normal: 4 };

export const fleetStates = (pumps: PumpData[], cases: Case[], decisions: Record<string, Decision>, hour: number) =>
  Object.fromEntries(pumps.map((p) => [p.id, pumpState(p, cases.filter((c) => c.assetId === p.id), decisions, hour)])) as Record<string, PumpState>;
