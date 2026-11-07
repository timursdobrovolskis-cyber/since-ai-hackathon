// What the voice assistant is told about one pump. Built only from what is known at the replay hour, and never from labels.
import { plainAlert, pumpName } from "./plain.ts";
import type { TrackRecord } from "./trust.ts";
import type { Case, Fleet, PumpData, PumpMeta } from "./types.ts";

export function pumpBrief(item: Case, cases: Case[], meta: PumpMeta, pump: PumpData, channels: Fleet["channelMeta"], hour: number, record?: TrackRecord) {
  const name = pumpName(meta.id);
  const words = plainAlert(item.latest, channels, record);
  const others = cases.filter((c) => c.assetId === meta.id && c.id !== item.id).map((c) => plainAlert(c.latest, channels).what);
  const alarms = pump.alarms.filter((a) => a.raisedHour <= hour);
  const notes = [...pump.history, ...pump.maintenance].filter((n) => n.startHour <= hour).slice(-3);
  const measured = item.latest.evidence.channels
    .filter((c) => c.observed !== null && c.expected !== null)
    .map((c) => `${channels[c.channel]?.label ?? c.channel}: ${c.observed} ${channels[c.channel]?.unit ?? ""} measured, ${c.expected} expected`);
  const unseen = item.latest.evidence.blind_spots.map((c) => channels[c]?.label.toLowerCase() ?? c);
  // Latest value of every signal this pump measures, so "what is it reading now?" has a true answer.
  const lastIndex = Math.floor((hour * 60) / pump.stepMinutes);
  const latest = Object.entries(pump.series ?? {}).flatMap(([channel, series]) => {
    const value = series.obs.slice(0, lastIndex + 1).findLast((v) => v !== null);
    return value === undefined || value === null ? [] : [`${channels[channel]?.label ?? channel} ${value} ${channels[channel]?.unit ?? ""}`.trim()];
  });
  return [
    `Pump: ${name}, ${meta.system}, ${meta.site.split(" (")[0]}, in service since ${meta.commissionedYear}.`,
    `What the system thinks: ${words.what}`,
    `Recommended check: ${words.check}`,
    words.trust ? `How reliable this kind of alert has been: ${words.trust.words}.` : "",
    `Evidence: ${item.latest.evidence.summary}`,
    measured.length ? `Readings at the alert: ${measured.join("; ")}.` : "",
    latest.length ? `Latest readings on this pump: ${latest.join("; ")}. Anything not listed here or below has no reading.` : "",
    unseen.length ? `Not measured on this pump: ${unseen.join(", ")}.` : "",
    `Alerts on this problem so far: ${item.alerts.length}.`,
    others.length ? `Other open concerns on this pump: ${others.join(" ")}` : "No other concerns on this pump.",
    alarms.length ? `Plant alarms on this pump so far: ${alarms.length}.` : "No plant alarms on this pump so far.",
    notes.length ? `Maintenance notes, written by people and possibly wrong: ${notes.map((n) => n.observation).join(" ")}` : "",
  ].filter(Boolean).join("\n");
}
