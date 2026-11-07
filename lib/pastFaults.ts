// The faults behind each results row: one fault's result for the alerts and for the plant alarms, in words.
// Pure, so lib/pastFaults.test.ts can check that each list adds up to the figure in its row.
import { clock, faultLabel } from "./labels.ts";
import type { PerEvent } from "./review-data.ts";

export type RowKey = "caught" | "limit" | "cause" | "false";
export type Outcome = { ok: boolean; text: string };

/** Same rule as tools/build_ui_data.py. Lead times are rounded to 0.1 h, so -0 means a few minutes late. */
export const warnedBefore = (h: number | null) => h !== null && h >= 0 && !Object.is(h, -0);

function leadWords(h: number | null, caught: boolean): Outcome {
  if (!caught) return { ok: false, text: "Missed" };
  if (h === null) return { ok: false, text: "Caught after the limit" };
  const n = Math.abs(h) < 1 ? "Under 1 h" : `${Math.round(Math.abs(h))} h`;
  return warnedBefore(h) ? { ok: true, text: `${n} before` } : { ok: false, text: `${n} after` };
}

/** One fault's result in a row, for the alerts and the plant alarms. */
export function outcome(key: Exclude<RowKey, "false">, e: PerEvent): [Outcome, Outcome] {
  if (key === "caught")
    return [
      e.detected ? { ok: true, text: `Caught, ${clock(e.firstAlertHour ?? 0)}` } : { ok: false, text: "Missed" },
      e.plantDetected ? { ok: true, text: "Caught" } : { ok: false, text: "Missed" },
    ];
  if (key === "limit") return [leadWords(e.leadHours, e.detected), leadWords(e.plantLeadHours, e.plantDetected)];
  return [
    !e.detected ? { ok: false, text: "Missed" } : e.typeCorrect ? { ok: true, text: "Named it" } : { ok: false, text: `Said ${faultLabel(e.predictedType ?? "UNKNOWN").toLowerCase()}` },
    !e.plantDetected ? { ok: false, text: "Missed" } : e.plantTypeCorrect ? { ok: true, text: "Named it" } : { ok: false, text: "Did not name it" },
  ];
}

