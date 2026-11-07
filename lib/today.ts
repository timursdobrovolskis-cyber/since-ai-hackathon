// The Today list. Newest first by a simple rule, not a claim about true urgency: a detector that estimates time to the
// limit can replace this later. Works only on cases known at the replay hour.
import type { Case, Decision } from "./types.ts";

export const RECENT_HOURS = 24;

/** A case still needs someone if nobody decided, or a "remind me later" time has arrived. */
export function needsAttention(c: Case, decisions: Record<string, Decision>, hour: number) {
  const d = decisions[c.id];
  if (!d) return true;
  return d.kind === "watching" && d.followUpHour !== undefined && hour >= d.followUpHour;
}

export function groupCases(cases: Case[], decisions: Record<string, Decision>, hour: number) {
  const open = cases.filter((c) => needsAttention(c, decisions, hour)).sort((a, b) => b.latest.offset_hours - a.latest.offset_hours);
  // A reminder that has come due goes back to the top, however old the case is.
  const recent = (c: Case) => hour - c.latest.offset_hours <= RECENT_HOURS || decisions[c.id]?.kind === "watching";
  return {
    today: open.filter((c) => c.eventClass !== "SENSOR" && recent(c)),
    readings: open.filter((c) => c.eventClass === "SENSOR" && recent(c)),
    wait: open.filter((c) => !recent(c)),
    done: cases.length - open.length,
  };
}
