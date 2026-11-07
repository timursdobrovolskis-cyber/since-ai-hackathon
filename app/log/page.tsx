"use client";

import { useApp } from "@/components/AppProvider";
import { clock } from "@/lib/labels";
import { PLAIN, pumpName } from "@/lib/plain";
import type { Decision } from "@/lib/types";

const KIND: Record<Decision["kind"], string> = { approved: "I'll check it", rejected: "Not a problem", watching: "Remind me later" };

export default function LogPage() {
  const { decisions } = useApp();
  const rows = Object.values(decisions).sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));

  const exportCsv = () => {
    const quote = (v: string | number | undefined) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const head = ["case_id", "pump", "fault_type", "decision", "reason", "follow_up_hour", "replay_hour", "decided_at"];
    const lines = rows.map((r) => [r.caseId, r.assetId, r.faultType, r.kind, r.reason, r.followUpHour, r.atHour.toFixed(2), r.decidedAt].map(quote).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "decision-log.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-cond text-2xl font-semibold">My decisions</h1>
        <button type="button" disabled={rows.length === 0} onClick={exportCsv} className="min-h-9 border border-line bg-raised px-3 text-[13px] disabled:opacity-50">
          Export CSV
        </button>
      </div>
      <p className="text-ink-2">Stored in this browser only. Nothing is sent anywhere.</p>
      {rows.length === 0 ? (
        <p className="mt-4">No decisions yet. Open a case and record one.</p>
      ) : (
        <table className="mt-3 w-full text-left">
          <thead className="text-[13px] text-ink-2">
            <tr className="border-b border-line">
              <th className="py-1 font-medium">Replay time</th>
              <th className="py-1 font-medium">Pump</th>
              <th className="py-1 font-medium">What it looked like</th>
              <th className="py-1 font-medium">Decision</th>
              <th className="py-1 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.caseId} className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                <td className="py-1">{clock(r.atHour)}</td>
                <td className="py-1">{pumpName(r.assetId)}</td>
                <td className="py-1">{PLAIN[r.faultType]?.short ?? r.faultType}</td>
                <td className="py-1">{KIND[r.kind]}</td>
                <td className="py-1">{r.reason ?? (r.followUpHour !== undefined ? `Look again at ${clock(r.followUpHour)}` : "Draft work order")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
