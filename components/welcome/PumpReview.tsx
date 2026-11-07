"use client";

// The human review on a pump card: Acknowledge (I will check it), Dismiss with a reason, or Escalate to the duty
// engineer, with undo. After Acknowledge the worker records what they found on site, as Amazon Monitron and Siemens
// Senseye ask before an alert is closed: the named fault, another fault, nothing wrong, or not sure yet. Saved in this
// browser only. Findings are not fed into the results table, which stays the organizers' scoring.
import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { FAULT_LABEL, faultLabel } from "@/lib/labels";
import type { Decision, DecisionKind, Finding } from "@/lib/types";
import type { Concern } from "./concerns";

const DISMISS_REASONS = [
  "It's normal for this situation",
  "Already known",
  "I checked and it's fine",
  "Too little to go on",
  "Something else",
];

export const DONE: Record<DecisionKind, string> = {
  approved: "Acknowledged. You will check it.",
  rejected: "Dismissed as not a problem.",
  watching: "Reminder set.",
  escalated: "Escalated to the duty engineer. It stays open until they decide.",
};

export const DECIDED_SHORT: Record<DecisionKind, string> = {
  approved: "Acknowledged",
  rejected: "Dismissed",
  watching: "Reminder set",
  escalated: "Escalated",
};

const FOUND_SHORT: Record<Finding, string> = {
  found: "Checked, found it",
  other: "Checked, other fault",
  nothing: "Checked, nothing wrong",
  unsure: "Checked, watching",
};

/** The short word for a pump's window on the alarm panel: the finding once there is one, else the decision. */
export const decidedShort = (d: Decision) =>
  d.kind === "approved" && d.finding
    ? FOUND_SHORT[d.finding]
    : DECIDED_SHORT[d.kind];

const isSensor = (t: string) =>
  t.startsWith("SENSOR_") || t === "COMMUNICATION_LOSS";
const TYPES = Object.keys(FAULT_LABEL).filter((t) => t !== "UNKNOWN");

function foundWords(d: Decision) {
  if (d.finding === "found")
    return `You found ${faultLabel(d.faultType).toLowerCase()}, as the alert said.`;
  if (d.finding === "other")
    return `You found ${faultLabel(d.foundType ?? "UNKNOWN").toLowerCase()}, not what the alert said.`;
  if (d.finding === "nothing") return "You found nothing wrong.";
  return "Not sure yet. Keep watching it.";
}

/** What the worker found on site, asked once they have acknowledged the alert. */
function FindingForm({ d }: { d: Decision }) {
  const { recordFinding } = useApp();
  const named = d.faultType !== "UNKNOWN";
  const [other, setOther] = useState(false);
  const [type, setType] = useState(
    TYPES.find(
      (t) => t !== d.faultType && isSensor(t) === isSensor(d.faultType),
    ) ?? TYPES[0],
  );
  const pick = useId();
  const btn =
    "inline-flex min-h-11 items-center rounded-lg px-4 text-[15px] shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)] transition-colors hover:shadow-[inset_0_0_0_1px_var(--mz-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent";

  if (d.finding)
    return (
      <div
        role="status"
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-mz-line pt-4"
      >
        <p className="text-[15px]">{foundWords(d)}</p>
        <button
          type="button"
          onClick={() => recordFinding(d.caseId)}
          className="inline-flex min-h-11 items-center text-[15px] text-mz-accent underline-offset-4 hover:underline"
        >
          Change
        </button>
      </div>
    );

  return (
    <div className="mt-4 border-t border-mz-line pt-4">
      <p className="text-[15px] font-medium">
        When you have checked it, what did you find?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {named && (
          <button
            type="button"
            onClick={() => recordFinding(d.caseId, "found")}
            className={btn}
          >
            {faultLabel(d.faultType)}, as it said
          </button>
        )}
        <button
          type="button"
          aria-expanded={other}
          onClick={() => setOther((o) => !o)}
          className={btn}
        >
          {named ? "Something else" : "A fault"}
        </button>
        <button
          type="button"
          onClick={() => recordFinding(d.caseId, "nothing")}
          className={btn}
        >
          Nothing wrong
        </button>
        <button
          type="button"
          onClick={() => recordFinding(d.caseId, "unsure")}
          className={btn}
        >
          Not sure, keep watching
        </button>
      </div>
      {other && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-mz-panel p-4">
          <label htmlFor={pick} className="w-full text-[15px]">
            Which fault did you find?
          </label>
          <select
            id={pick}
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="min-h-11 rounded-lg bg-white px-3 text-[15px] shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)]"
          >
            <optgroup label="Machine">
              {TYPES.filter((t) => !isSensor(t)).map((t) => (
                <option key={t} value={t}>
                  {faultLabel(t)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sensor">
              {TYPES.filter(isSensor).map((t) => (
                <option key={t} value={t}>
                  {faultLabel(t)}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={() => recordFinding(d.caseId, "other", type)}
            className={`${btn} bg-mz-ink text-white shadow-none hover:bg-mz-accent`}
          >
            Save finding
          </button>
        </div>
      )}
      <p className="mt-2 text-[13px] text-mz-muted">
        Saved on this device. It does not change the alert or the results.
      </p>
    </div>
  );
}

export function PumpReview({ c }: { c: Concern }) {
  const { decisions, decide, undoDecision } = useApp();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState(DISMISS_REASONS[0]);
  const group = useId();
  const done = decisions[c.lead.id] as Decision | undefined;
  const base = {
    caseId: c.lead.id,
    assetId: c.id,
    faultType: c.lead.faultType,
  };
  const btn =
    "inline-flex min-h-11 items-center rounded-lg px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent";

  if (done) {
    return (
      <>
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          <p className="text-[15px]">
            {DONE[done.kind]}
            {done.kind === "rejected" && done.reason && (
              <span className="text-mz-muted"> Reason: {done.reason}.</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => undoDecision(c.lead.id)}
            className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-mz-accent underline-offset-4 hover:underline"
          >
            <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} /> Undo
          </button>
        </div>
        {done.kind === "approved" && <FindingForm d={done} />}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide({ ...base, kind: "approved" })}
          className={`${btn} bg-mz-ink text-white hover:bg-mz-accent`}
        >
          Acknowledge
        </button>
        <button
          type="button"
          aria-expanded={dismissing}
          onClick={() => setDismissing((d) => !d)}
          className={`${btn} shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)] hover:shadow-[inset_0_0_0_1px_var(--mz-ink)]`}
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => decide({ ...base, kind: "escalated" })}
          className={`${btn} shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)] hover:shadow-[inset_0_0_0_1px_var(--mz-ink)]`}
        >
          Escalate
        </button>
      </div>
      <p className="mt-2 text-[13px] text-mz-muted">
        Acknowledge means you will check it. Escalate passes it to the duty
        engineer.
      </p>
      {dismissing && (
        <fieldset className="mt-3 rounded-xl bg-mz-panel p-4">
          <legend className="sr-only">Why is it not a problem?</legend>
          <p aria-hidden className="mb-2 text-[15px]">
            Why is it not a problem?
          </p>
          <div className="space-y-1">
            {DISMISS_REASONS.map((r) => (
              <label
                key={r}
                className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]"
              >
                <input
                  type="radio"
                  name={group}
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="size-4 accent-mz-accent"
                />
                {r}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => decide({ ...base, kind: "rejected", reason })}
            className={`${btn} mt-3 bg-mz-ink text-white hover:bg-mz-accent`}
          >
            Dismiss alert
          </button>
        </fieldset>
      )}
    </>
  );
}
