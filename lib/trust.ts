// How far to trust a named cause, from how often it matched a real fault on the labelled pumps.
export type TrackRecord = Record<string, { right: number; total: number; wrongKind: number }>;

export type Trust = { level: "good" | "mixed" | "weak" | "few"; words: string };

export const TRUST_RANK: Record<Trust["level"], number> = { good: 3, few: 2, mixed: 1, weak: 0 };

const MIN_CASES = 3;

export function trustFor(faultType: string, record?: TrackRecord): Trust | null {
  const r = record?.[faultType];
  if (!r || faultType === "UNKNOWN") return null;
  const past = `${r.right} of ${r.total} past cases`;
  if (r.total < MIN_CASES) return { level: "few", words: `Too few past cases to say (${past})` };
  const rate = r.right / r.total;
  if (rate >= 0.7) return { level: "good", words: `Usually right: ${past}` };
  if (rate >= 0.4) return { level: "mixed", words: `Right about half the time: ${past}` };
  return { level: "weak", words: `Often wrong: ${past}` };
}
