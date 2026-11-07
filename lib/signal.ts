// The reading behind an alert, as chart rows for the landing page. Rows stop at the shift, so a chart can never show
// data the person on shift could not have seen yet.
import { clock } from "./labels.ts";
import type { Alert, PumpData } from "./types.ts";

type Meta = Record<string, { label: string; unit?: string }>;

export type SignalRow = { date: Date; hour: number; value: number; lo: number; hi: number; label: string };

/** Charts need dates for spacing. These are only for spacing, never shown: labels come from `clock()`. */
const BASE = Date.UTC(2026, 0, 1);

/**
 * The channel an alert is about: its first evidence channel the pump records, else the reading its summary names
 * (some alerts, such as a stuck sensor, only name it in words), else null.
 */
export function evidenceChannel(alert: Alert, meta: Meta, pump: PumpData | undefined) {
  if (!pump) return null;
  const listed = alert.evidence?.channels?.map((c) => c.channel).find((c) => pump.series[c]);
  if (listed) return listed;
  const summary = (alert.evidence?.summary ?? "").toLowerCase();
  const named = Object.entries(meta).find(([ch, m]) => pump.series[ch] && summary.includes(m.label.toLowerCase()));
  return named ? named[0] : null;
}

/**
 * Rows from `fromHour` to `toHour`, never past `shiftHour`, every `stride` points. Gaps in the reading are skipped.
 * Where there is no expected band, the band collapses onto the reading.
 */
export function signalRows(pump: PumpData, channel: string, fromHour: number, toHour: number, shiftHour: number, stride = 3): SignalRow[] {
  const s = pump.series[channel];
  if (!s) return [];
  const step = pump.stepMinutes / 60;
  const end = Math.min(toHour, shiftHour);
  const rows: SignalRow[] = [];
  const push = (i: number) => {
    const value = s.obs[i];
    if (value === null || value === undefined) return;
    const hour = i * step;
    const lo = s.lo?.[i] ?? value;
    const hi = s.hi?.[i] ?? value;
    rows.push({ date: new Date(BASE + hour * 3600e3), hour, value, lo: Math.min(lo, hi), hi: Math.max(lo, hi), label: clock(hour) });
  };
  const first = Math.max(0, Math.floor(fromHour / step));
  const last = Math.min(s.obs.length - 1, Math.floor(end / step + 1e-9));
  let i = first;
  for (; i <= last; i += stride) push(i);
  // Thinning can skip the newest reading. Keep it, so the chart ends on the value the card lists as "now".
  if (last >= first && i - stride !== last) {
    let j = last;
    while (j > i - stride && (s.obs[j] === null || s.obs[j] === undefined)) j--;
    if (j > i - stride) push(j);
  }
  return rows;
}

/** The chart window for a concern: from 18 hours before its first alert, or the start of the week, to the shift. */
export function concernWindow(firstHour: number, shiftHour: number) {
  return { from: Math.max(0, firstHour - 18), to: shiftHour };
}
