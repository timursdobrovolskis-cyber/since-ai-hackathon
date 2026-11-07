// The Today list: one line per pump. Newest first by a simple rule, not a claim about true urgency, and a detector that
// estimates time to the limit can replace this later. Works only on cases known at the replay hour.
import { TRUST_RANK, trustFor, type TrackRecord } from "./trust.ts";
import type { Case, Decision, PumpData } from "./types.ts";
import { workSince } from "./worker.ts";

export const RECENT_HOURS = 24;

/** A case still needs someone if nobody decided, or a "remind me later" time has arrived. */
export function needsAttention(c: Case, decisions: Record<string, Decision>, hour: number) {
  const d = decisions[c.id];
  if (!d) return true;
  return d.kind === "watching" && d.followUpHour !== undefined && hour >= d.followUpHour;
}

export type PumpLine = { assetId: string; lead: Case; others: Case[] };

const rank = (c: Case, record?: TrackRecord) => {
  const trust = trustFor(c.faultType, record);
  return trust ? TRUST_RANK[trust.level] : -1;
};

export function groupByPump(cases: Case[], decisions: Record<string, Decision>, hour: number, record?: TrackRecord, pumps?: Record<string, PumpData>) {
  const open = cases.filter((c) => needsAttention(c, decisions, hour));
  // A reminder that has come due goes back to the top, however old the case is.
  // Corrective work done since the latest alert moves a case down the list.
  const recent = (c: Case) => !workSince(c, pumps?.[c.assetId], hour) && (hour - c.latest.offset_hours <= RECENT_HOURS || decisions[c.id]?.kind === "watching");
  const lines = [...new Set(open.map((c) => c.assetId))].map((assetId) => {
    const own = open.filter((c) => c.assetId === assetId);
    const pumpIssues = own.filter((c) => c.eventClass !== "SENSOR" && recent(c));
    const readings = own.filter((c) => c.eventClass === "SENSOR" && recent(c));
    const group = pumpIssues.length ? "today" : readings.length ? "readings" : "wait";
    const pool = pumpIssues.length ? pumpIssues : readings.length ? readings : own;
    // The most reliable concern leads, and the newest breaks a tie.
    const lead = [...pool].sort((a, b) => rank(b, record) - rank(a, record) || b.latest.offset_hours - a.latest.offset_hours)[0];
    return { group, line: { assetId, lead, others: own.filter((c) => c !== lead) } as PumpLine, newest: Math.max(...pool.map((c) => c.latest.offset_hours)) };
  }).sort((a, b) => b.newest - a.newest);
  const pick = (group: string) => lines.filter((p) => p.group === group).map((p) => p.line);
  return { today: pick("today"), readings: pick("readings"), wait: pick("wait"), done: cases.length - open.length };
}
