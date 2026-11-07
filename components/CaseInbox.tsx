"use client";

import Link from "next/link";
import { certainty } from "@/lib/cases";
import { age, faultLabel } from "@/lib/labels";
import type { Case, Decision } from "@/lib/types";
import { useApp } from "./AppProvider";
import { CaseMark, classLabel } from "./Marks";

const DECISION_LABEL: Record<Decision["kind"], string> = {
  approved: "Inspection approved",
  rejected: "Rejected",
  watching: "Keeping watch",
};

export function CaseCard({ item, active }: { item: Case; active?: boolean }) {
  const { hour, decisions } = useApp();
  const decided = decisions[item.id];
  const level = certainty(item.latest.confidence, item.latest.confidence_calibrated);
  const edge = item.eventClass === "SENSOR" ? "var(--sensor)" : "var(--machine)";
  return (
    <Link
      href={`/cases/${item.id}`}
      aria-current={active ? "page" : undefined}
      className="block border-b border-l-4 border-b-line px-3 py-2 hover:bg-raised"
      style={{ background: active ? "var(--raised)" : undefined, borderLeftColor: decided ? "transparent" : edge }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1"><CaseMark eventClass={item.eventClass} faultType={item.faultType} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[13px] font-semibold tracking-[0.04em]">{item.assetId}</span>
            <span className="font-mono text-[12px] text-ink-2">{age(hour - item.first.offset_hours)}</span>
          </div>
          <p className="font-medium">{faultLabel(item.faultType)}</p>
          <p className="text-[13px] text-ink-2">
            {classLabel(item.eventClass)}, {level ? `${level.toLowerCase()} certainty` : "certainty not calibrated"}
            {item.alerts.length > 1 ? `, ${item.alerts.length} updates` : ""}
          </p>
          {decided && <p className="text-[13px] font-medium">{DECISION_LABEL[decided.kind]}</p>}
        </div>
      </div>
    </Link>
  );
}

export function CaseInbox({ activeId, scroll = false }: { activeId?: string; scroll?: boolean }) {
  const { cases, decisions } = useApp();
  const sorted = [...cases].sort((a, b) => Number(!!decisions[a.id]) - Number(!!decisions[b.id]) || b.latest.offset_hours - a.latest.offset_hours);
  const open = cases.filter((c) => !decisions[c.id]).length;
  return (
    <section aria-label="Cases">
      <h2 className="border-b border-line px-3 py-2 font-cond text-lg font-semibold">
        {open === 0 ? "Nothing needs review" : `${open} ${open === 1 ? "case needs" : "cases need"} review`}
      </h2>
      {sorted.length === 0 ? (
        <p className="px-3 py-3 text-ink-2">No alerts yet. Press Play to run the week.</p>
      ) : (
        <ul className={`reveal ${scroll ? "max-h-[26rem] overflow-y-auto lg:max-h-[33rem]" : ""}`}>
          {sorted.map((c) => (
            <li key={c.id}><CaseCard item={c} active={c.id === activeId} /></li>
          ))}
        </ul>
      )}
    </section>
  );
}
