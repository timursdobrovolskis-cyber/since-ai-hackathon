// One plain sentence about a reading on the evidence chart, worked out from the recorded rows up to the shift:
// when it left its normal band, how far from normal it is now, and whether it is still moving, has settled or is
// coming back. Our wording, built only from the data. The detector's own summary is shown separately.
import type { SignalRow } from "./signal.ts";

const mid = (r: SignalRow) => (r.lo + r.hi) / 2;
const hasBand = (r: SignalRow) => r.hi > r.lo;
const out = (r: SignalRow) => hasBand(r) && (r.value < r.lo || r.value > r.hi);

/** A gap or level in plain figures: whole numbers from 10 up, one decimal from 1, two below. */
export function amount(v: number) {
  const a = Math.abs(v);
  return a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : a.toFixed(2);
}

/** The start of the run of out-of-band rows that ends at `end`, allowing up to `gap` rows back inside in between. */
function runStart(rows: SignalRow[], end: number, gap = 2) {
  let start = end;
  let inside = 0;
  for (let i = end - 1; i >= 0; i--) {
    if (out(rows[i])) {
      start = i;
      inside = 0;
    } else if (++inside > gap) break;
  }
  return start;
}

/** Mean of `value - mid` over the rows from `fromHour` to `toHour`. */
function meanGap(rows: SignalRow[], fromHour: number, toHour: number) {
  const pick = rows.filter((r) => r.hour >= fromHour && r.hour <= toHour);
  return pick.length ? pick.reduce((s, r) => s + (r.value - mid(r)), 0) / pick.length : null;
}

export type Drift = { sentence: string; leftAt: string | null; now: number; gap: number; trend: "steady" | "away" | "back" | null };
// Example: "Discharge pressure went above its normal band at Day 2, 23:45. It is 23 kPa above normal now, holding steady."

/**
 * `label` is the reading's name ("Discharge pressure"), `unit` its unit. The trend compares the last 3 hours with the
 * 3 hours before, against the band's width: under 15 % of it is steady, otherwise moving away from or back to normal.
 */
export function describeDrift(rows: SignalRow[], label: string, unit: string): Drift | null {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const u = unit ? ` ${unit}` : "";
  const gap = last.value - mid(last);
  const width = last.hi - last.lo;

  if (!hasBand(last)) {
    return { sentence: `${label} is ${amount(last.value)}${u} now. There is no normal range to compare it with.`, leftAt: null, now: last.value, gap: 0, trend: null };
  }

  // A sensor that sends the same value for hours is the clearest sign of a stuck reading.
  const recent = rows.filter((r) => r.hour >= last.hour - 6);
  const spread = Math.max(...recent.map((r) => r.value)) - Math.min(...recent.map((r) => r.value));
  if (recent.length >= 6 && spread <= width * 0.002) {
    const since = rows[rows.length - recent.length];
    return { sentence: `${label} has not moved from ${amount(last.value)}${u} since ${since.label}.`, leftAt: null, now: last.value, gap, trend: "steady" };
  }

  const a = meanGap(rows, last.hour - 3, last.hour);
  const b = meanGap(rows, last.hour - 6, last.hour - 3);
  const change = a !== null && b !== null ? a - b : 0;
  const trend: Drift["trend"] = Math.abs(change) < width * 0.15 ? "steady" : Math.sign(change) === Math.sign(gap) ? "away" : "back";

  if (!out(last)) {
    const firstOut = rows.find(out);
    const sentence = firstOut
      ? `${label} went outside its normal band at ${firstOut.label} and is back inside it now, at ${amount(last.value)}${u}.`
      : `${label} has stayed inside its normal band on this chart, at ${amount(last.value)}${u} now.`;
    return { sentence, leftAt: firstOut?.label ?? null, now: last.value, gap, trend };
  }

  const start = rows[runStart(rows, rows.length - 1)];
  const dir = gap > 0 ? "above" : "below";
  const first =
    start === rows[0] ? `${label} has been ${dir} its normal band since at least ${start.label}.` : `${label} went ${dir} its normal band at ${start.label}.`;
  // A trend needs a few hours outside the band to mean anything.
  const settled = last.hour - start.hour >= 3;
  const tail = !settled
    ? ""
    : trend === "steady"
      ? ", holding steady"
      : trend === "away"
        ? `, still ${gap > 0 ? "rising" : "falling"}`
        : ", but coming back";
  const sentence = `${first} It is ${amount(gap)}${u} ${dir} normal now${tail}.`;
  return { sentence, leftAt: start.label, now: last.value, gap, trend };
}
