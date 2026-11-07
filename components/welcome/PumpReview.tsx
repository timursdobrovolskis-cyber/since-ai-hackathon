"use client";

// The human review on a pump card: Acknowledge (I will check it), Dismiss with a reason, or Escalate to the duty
// engineer, with undo. Decisions are saved in this browser.
import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { useApp } from "@/components/AppProvider";
import type { Decision, DecisionKind } from "@/lib/types";
import type { Concern } from "./concerns";

const DISMISS_REASONS = ["It's normal for this situation", "Already known", "I checked and it's fine", "Too little to go on", "Something else"];

export const DONE: Record<DecisionKind, string> = {
  approved: "Acknowledged. You will check it.",
  rejected: "Dismissed as not a problem.",
  watching: "Reminder set.",
  escalated: "Escalated to the duty engineer. It stays open until they decide.",
};

export const DECIDED_SHORT: Record<DecisionKind, string> = { approved: "Acknowledged", rejected: "Dismissed", watching: "Reminder set", escalated: "Escalated" };

export function PumpReview({ c }: { c: Concern }) {
  const { decisions, decide, undoDecision } = useApp();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState(DISMISS_REASONS[0]);
  const group = useId();
  const done = decisions[c.lead.id] as Decision | undefined;
  const base = { caseId: c.lead.id, assetId: c.id, faultType: c.lead.faultType };
  const btn =
    "inline-flex min-h-11 items-center rounded-lg px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent";

  if (done) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[15px]">
          {DONE[done.kind]}
          {done.kind === "rejected" && done.reason && <span className="text-mz-muted"> Reason: {done.reason}.</span>}
        </p>
        <button type="button" onClick={() => undoDecision(c.lead.id)} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-mz-accent underline-offset-4 hover:underline">
          <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} /> Undo
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => decide({ ...base, kind: "approved" })} className={`${btn} bg-mz-ink text-white hover:bg-mz-accent`}>
          Acknowledge
        </button>
        <button type="button" aria-expanded={dismissing} onClick={() => setDismissing((d) => !d)} className={`${btn} shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)] hover:shadow-[inset_0_0_0_1px_var(--mz-ink)]`}>
          Dismiss
        </button>
        <button type="button" onClick={() => decide({ ...base, kind: "escalated" })} className={`${btn} shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)] hover:shadow-[inset_0_0_0_1px_var(--mz-ink)]`}>
          Escalate
        </button>
      </div>
      <p className="mt-2 text-[13px] text-mz-muted">Acknowledge means you will check it. Escalate passes it to the duty engineer.</p>
      {dismissing && (
        <fieldset className="mt-3 rounded-xl bg-mz-panel p-4">
          <legend className="sr-only">Why is it not a problem?</legend>
          <p aria-hidden className="mb-2 text-[15px]">Why is it not a problem?</p>
          <div className="space-y-1">
            {DISMISS_REASONS.map((r) => (
              <label key={r} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]">
                <input type="radio" name={group} value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-mz-accent" />
                {r}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => decide({ ...base, kind: "rejected", reason })} className={`${btn} mt-3 bg-mz-ink text-white hover:bg-mz-accent`}>
            Dismiss alert
          </button>
        </fieldset>
      )}
    </>
  );
}
