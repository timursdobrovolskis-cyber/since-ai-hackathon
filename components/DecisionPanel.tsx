"use client";

import Link from "next/link";
import { useState } from "react";
import { clock, faultLabel } from "@/lib/labels";
import type { Case } from "@/lib/types";
import { useApp } from "./AppProvider";

const REASONS = ["Normal operation", "Already known", "Sensor checked and fine", "Evidence too weak", "Other"];
const FOLLOW_UPS = [4, 12, 24];

export function DecisionPanel({ item }: { item: Case }) {
  const { decisions, decide, hour } = useApp();
  const [mode, setMode] = useState<"none" | "reject" | "watch">("none");
  const [reason, setReason] = useState(REASONS[0]);
  const [followUp, setFollowUp] = useState(FOLLOW_UPS[1]);
  const decided = decisions[item.id];
  const base = { caseId: item.id, assetId: item.assetId, faultType: item.faultType };
  const button = "min-h-10 border px-3 font-medium";

  if (decided) {
    return (
      <section aria-label="Decision" className="border border-line bg-raised p-4">
        {decided.kind === "approved" && (
          <>
            <h2 className="font-cond text-lg font-semibold">Draft work order</h2>
            <p className="text-[13px] font-medium text-ink-2">Draft only. Not sent anywhere.</p>
            <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-ink-2">Pump</dt><dd>{item.assetId}</dd>
              <dt className="text-ink-2">Suspected cause</dt><dd>{faultLabel(item.faultType)}</dd>
              <dt className="text-ink-2">Evidence</dt><dd>{item.latest.evidence.summary}</dd>
              <dt className="text-ink-2">Requested check</dt><dd>{item.latest.recommended_action}</dd>
              <dt className="text-ink-2">Approved at</dt><dd>{clock(decided.atHour)}</dd>
            </dl>
          </>
        )}
        {decided.kind === "rejected" && <p>Rejected at {clock(decided.atHour)}. Reason: {decided.reason}.</p>}
        {decided.kind === "watching" && (
          <p>Keeping watch since {clock(decided.atHour)}. Look again at {clock(decided.followUpHour ?? hour)}.</p>
        )}
        <Link href="/log" className="mt-2 inline-block text-[13px] underline underline-offset-2">View decision log</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="decide" className="border border-line bg-raised p-4">
      <h2 id="decide" className="font-cond text-lg font-semibold">Your decision</h2>
      <p className="text-ink-2">This only records your decision. Nothing is sent to the machine.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={`${button} border-ink bg-ink text-raised`} onClick={() => decide({ ...base, kind: "approved" })}>
          Approve inspection request
        </button>
        <button type="button" aria-expanded={mode === "watch"} className={`${button} border-line`} onClick={() => setMode(mode === "watch" ? "none" : "watch")}>
          Keep watching
        </button>
        <button type="button" aria-expanded={mode === "reject"} className={`${button} border-line`} onClick={() => setMode(mode === "reject" ? "none" : "reject")}>
          Reject alert
        </button>
      </div>
      {mode === "reject" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[13px] text-ink-2">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-10 border border-line bg-raised px-2 text-[15px] text-ink">
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <button type="button" className={`${button} border-ink`} onClick={() => decide({ ...base, kind: "rejected", reason })}>Reject with this reason</button>
        </div>
      )}
      {mode === "watch" && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[13px] text-ink-2">
            Look again in
            <select value={followUp} onChange={(e) => setFollowUp(Number(e.target.value))} className="min-h-10 border border-line bg-raised px-2 text-[15px] text-ink">
              {FOLLOW_UPS.map((h) => <option key={h} value={h}>{h} hours</option>)}
            </select>
          </label>
          <button type="button" className={`${button} border-ink`} onClick={() => decide({ ...base, kind: "watching", followUpHour: hour + followUp })}>Keep watching</button>
        </div>
      )}
    </section>
  );
}
