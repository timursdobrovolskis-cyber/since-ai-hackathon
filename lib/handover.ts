// The spoken shift handover. Built from the same rules as the Today list, so what you hear matches what you see.
// Uses only cases known at `hour`, and leaves out personal decisions, because the audio is recorded once for everyone.
import { plainAlert, pumpName } from "./plain.ts";
import { groupCases } from "./today.ts";
import type { Case, Fleet } from "./types.ts";

const SPOKEN_LIMIT = 3;

export function shiftLabel(hour: number) {
  const day = Math.floor(hour / 24) + 1;
  const time = hour % 24;
  return `Day ${day}, ${time < 12 ? "morning" : "evening"} shift`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function handoverScript(cases: Case[], meta: Fleet["channelMeta"], hour: number) {
  const { today, readings, wait } = groupCases(cases, {}, hour);
  const parts = [`Handover for ${shiftLabel(hour)}.`];
  if (today.length === 0) {
    parts.push("No pump problems need you right now.");
  } else {
    parts.push(`${plural(today.length, "pump problem needs", "pump problems need")} you today.`);
    for (const c of today.slice(0, SPOKEN_LIMIT)) {
      const w = plainAlert(c.latest, meta);
      parts.push(`${pumpName(c.assetId)}. ${w.what} ${w.check}`);
    }
    if (today.length > SPOKEN_LIMIT) parts.push(`${plural(today.length - SPOKEN_LIMIT, "more is", "more are")} on your list.`);
  }
  if (readings.length) parts.push(`Also, ${plural(readings.length, "sensor reading needs", "sensor readings need")} checking. The pumps may be fine.`);
  if (wait.length) parts.push(`${plural(wait.length, "other thing", "other things")} can wait.`);
  return parts.join(" ");
}
