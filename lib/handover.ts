// The spoken shift handover. Built from the same rules as the Today list, so what you hear matches what you see.
// Uses only cases known at `hour`, and leaves out personal decisions, because the audio is recorded once for everyone.
import { plainAlert, pumpName } from "./plain.ts";
import { groupByPump } from "./today.ts";
import type { TrackRecord } from "./trust.ts";
import type { Case, Fleet, PumpData } from "./types.ts";

const SPOKEN_LIMIT = 3;

export function shiftLabel(hour: number) {
  return `${hour % 24 < 12 ? "morning" : "evening"} shift`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function handoverScript(cases: Case[], meta: Fleet["channelMeta"], hour: number, record?: TrackRecord, pumps?: Record<string, PumpData>) {
  const { today, readings, wait } = groupByPump(cases, {}, hour, record, pumps);
  const parts = [`Handover for the ${shiftLabel(hour)}.`];
  if (today.length === 0) {
    parts.push("No pumps need you right now.");
  } else {
    parts.push(`${plural(today.length, "pump needs", "pumps need")} you today.`);
    for (const line of today.slice(0, SPOKEN_LIMIT)) {
      const w = plainAlert(line.lead.latest, meta, record);
      parts.push(`${pumpName(line.assetId)}. ${w.what} ${w.check}`);
    }
    if (today.length > SPOKEN_LIMIT) parts.push(`${plural(today.length - SPOKEN_LIMIT, "more is", "more are")} on your list.`);
  }
  if (readings.length) parts.push(`Also, check the readings on ${plural(readings.length, "pump", "pumps")}.`);
  if (wait.length) parts.push(`${plural(wait.length, "other pump", "other pumps")} can wait.`);
  return parts.join(" ");
}
