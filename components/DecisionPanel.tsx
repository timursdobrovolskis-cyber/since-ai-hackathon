"use client";

import Link from "next/link";
import { useState } from "react";
import { clock } from "@/lib/labels";
import { PLAIN, pumpName } from "@/lib/plain";
import type { Case, Finding } from "@/lib/types";
import { useApp } from "./AppProvider";

const REASONS = ["It's normal for this situation", "Already known", "I checked and it's fine", "Too little to go on", "Something else"];
const REMINDERS = [4, 12, 24];
const FINDINGS: { id: Finding; label: string }[] = [
  { id: "found", label: "Found it" },
  { id: "other", label: "Found something else" },
  { id: "nothing", label: "Nothing wrong" },
];

export function DecisionPanel({ item }: { item: Case }) {
  const { decisions, decide, recordFinding, hour } = useApp();
  const [mode, setMode] = useState<"none" | "reject" | "later">("none");
  const [reason, setReason] = useState(REASONS[0]);
  const [later, setLater] = useState(REMINDERS[1]);
  const decided = decisions[item.id];
  const base = { caseId: item.id, assetId: item.assetId, faultType: item.faultType };
  const button = "min-h-11 rounded-md border px-4 font-medium";
  const words = PLAIN[item.faultType];

  if (decided) {
    return (
      <section aria-label="Decision" className="rounded-md border border-line bg-raised p-4">
        {decided.kind === "approved" && (
          <>
            <h2 className="font-cond text-lg font-semibold">Draft work order</h2>
            <p className="text-[13px] font-medium text-ink-2">Draft only. Not sent anywhere.</p>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-ink-2">Pump</dt><dd>{pumpName(item.assetId)}</dd>
              <dt className="text-ink-2">Looks like</dt><dd>{words?.short ?? item.faultType}</dd>
              <dt className="text-ink-2">Evidence</dt><dd>{item.latest.evidence.summary}</dd>
              <dt className="text-ink-2">To do</dt><dd>{words?.check ?? item.latest.recommended_action}</dd>
              <dt className="text-ink-2">Accepted</dt><dd>{clock(decided.atHour)}</dd>
            </dl>
            <div className="mt-3 border-t border-line pt-3">
              <h3 className="font-medium">{decided.finding ? `You recorded: ${FINDINGS.find((f) => f.id === decided.finding)?.label}` : "After checking, what did you find?"}</h3>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {FINDINGS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={decided.finding === f.id} onClick={() => recordFinding(item.id, f.id)} className={`min-h-11 rounded-md border px-3 ${decided.finding === f.id ? "border-ink bg-ink text-raised" : "border-line bg-panel"}`}>{f.label}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[13px] text-ink-3">Your answer builds a track record for this site.</p>
            </div>
          </>
        )}
        {decided.kind === "rejected" && <p>You marked this as not a problem at {clock(decided.atHour)}. Reason: {decided.reason}.</p>}
        {decided.kind === "watching" && <p>Reminder set. This comes back at {clock(decided.followUpHour ?? hour)}.</p>}
        <Link href="/log" className="mt-2 inline-block text-[13px] underline underline-offset-2">See my decisions</Link>
      </section>
    );
  }

  return (
    <section aria-label="Your decision">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${button} border-ink bg-ink text-raised`} onClick={() => decide({ ...base, kind: "approved" })}>I&rsquo;ll check it</button>
        <button type="button" aria-expanded={mode === "later"} className={`${button} border-line bg-raised`} onClick={() => setMode(mode === "later" ? "none" : "later")}>Remind me later</button>
        <button type="button" aria-expanded={mode === "reject"} className={`${button} border-line bg-raised`} onClick={() => setMode(mode === "reject" ? "none" : "reject")}>Not a problem</button>
      </div>
      <p className="mt-1.5 text-[13px] text-ink-3">This only records your decision. Nothing is sent to the machine.</p>
      {mode === "reject" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[13px] text-ink-2">
            Why not?
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-11 rounded-md border border-line bg-raised px-2 text-[15px] text-ink">
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <button type="button" className={`${button} border-ink`} onClick={() => decide({ ...base, kind: "rejected", reason })}>Save</button>
        </div>
      )}
      {mode === "later" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[13px] text-ink-2">
            Remind me in
            <select value={later} onChange={(e) => setLater(Number(e.target.value))} className="min-h-11 rounded-md border border-line bg-raised px-2 text-[15px] text-ink">
              {REMINDERS.map((h) => <option key={h} value={h}>{h} hours</option>)}
            </select>
          </label>
          <button type="button" className={`${button} border-ink`} onClick={() => decide({ ...base, kind: "watching", followUpHour: hour + later })}>Set reminder</button>
        </div>
      )}
    </section>
  );
}
