"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { HandoverPlayer } from "@/components/HandoverPlayer";
import { CaseMark } from "@/components/Marks";
import { age } from "@/lib/labels";
import { plainAlert, pumpName } from "@/lib/plain";
import { groupCases } from "@/lib/today";
import type { Case } from "@/lib/types";

function Line({ item }: { item: Case }) {
  const { fleet, hour } = useApp();
  const words = plainAlert(item.latest, fleet?.channelMeta ?? {});
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/cases/${item.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised">
        <span className="mt-0.5 self-start pt-1"><CaseMark eventClass={item.eventClass} faultType={item.faultType} size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] leading-snug"><span className="font-semibold">{pumpName(item.assetId)}:</span> {words.what}</p>
          <p className="text-ink-2">{words.check}</p>
          <p className="text-[13px] text-ink-3">Latest update {age(hour - item.latest.offset_hours)}</p>
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
      </Link>
    </li>
  );
}

function Group({ title, items }: { title: string; items: Case[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-1.5 font-cond text-xl font-semibold">{title}</h2>
      <ul className="rounded-md border border-line bg-panel">{items.map((c) => <Line key={c.id} item={c} />)}</ul>
    </section>
  );
}

export default function TodayPage() {
  const { cases, decisions, hour } = useApp();
  const { today, readings, wait, done } = groupCases(cases, decisions, hour);
  const nothing = today.length + readings.length + wait.length === 0;
  const headline = nothing
    ? "All pumps look normal. Nothing needs you right now."
    : today.length === 0
      ? "Nothing urgent on the pumps right now."
      : `${today.length} ${today.length === 1 ? "pump problem needs" : "pump problems need"} you today.`;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:py-6">
      <header>
        <h1 className="font-cond text-3xl leading-tight font-semibold">{headline}</h1>
        {!nothing && <p className="text-ink-2">Newest first. Open a line to see what to do.</p>}
      </header>
      <HandoverPlayer />
      <Group title="Needs you today" items={today} />
      <Group title="Check the reading" items={readings} />
      {wait.length > 0 && (
        <details className="rounded-md border border-line bg-panel">
          <summary className="min-h-11 cursor-pointer px-4 py-2.5 font-medium">{wait.length} can wait</summary>
          <ul className="border-t border-line">{wait.map((c) => <Line key={c.id} item={c} />)}</ul>
        </details>
      )}
      {done > 0 && <p className="text-[13px] text-ink-3">{done} already handled. <Link href="/log" className="underline underline-offset-2">See my decisions</Link></p>}
    </div>
  );
}
