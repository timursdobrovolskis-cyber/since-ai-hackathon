"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { HandoverPlayer } from "@/components/HandoverPlayer";
import { CaseMark } from "@/components/Marks";
import { TrustLine } from "@/components/ui/trust-line";
import { plainAlert, pumpName } from "@/lib/plain";
import { groupByPump, type PumpLine } from "@/lib/today";
import { workSince } from "@/lib/worker";

function Line({ line }: { line: PumpLine }) {
  const { fleet, hour, pumps, record } = useApp();
  const { lead, others } = line;
  const words = plainAlert(lead.latest, fleet?.channelMeta ?? {}, record);
  const done = workSince(lead, pumps[line.assetId], hour);
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/cases/${lead.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised">
        <span className="self-start pt-1.5"><CaseMark eventClass={lead.eventClass} faultType={lead.faultType} size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] leading-snug"><span className="font-semibold">{pumpName(line.assetId)}:</span> {words.what}</p>
          <p className="text-ink-2">{words.check}{others.length > 0 && <span className="text-ink-3"> Plus {others.length} more on this pump.</span>}</p>
          {done && <p className="text-[13px] font-medium">{done}</p>}
          <TrustLine trust={words.trust} alert={lead.latest} pump={pumps[line.assetId]} hour={hour} />
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
      </Link>
    </li>
  );
}

function Group({ title, lines }: { title: string; lines: PumpLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-1.5 font-cond text-xl font-semibold">{title}</h2>
      <ul className="rounded-md border border-line bg-panel">{lines.map((l) => <Line key={l.assetId} line={l} />)}</ul>
    </section>
  );
}

export default function TodayPage() {
  const { cases, decisions, hour, pumps, record } = useApp();
  const { today, readings, wait, done } = groupByPump(cases, decisions, hour, record, pumps);
  const nothing = today.length + readings.length + wait.length === 0;
  const headline = nothing
    ? "All pumps look normal. Nothing needs you right now."
    : today.length === 0
      ? "No pumps need you urgently right now."
      : `${today.length} ${today.length === 1 ? "pump needs" : "pumps need"} you today.`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:py-6">
      <header>
        <h1 className="font-cond text-3xl leading-tight font-semibold">{headline}</h1>
        {!nothing && <p className="text-ink-2">One line per pump, newest first. Open a line for the job card.</p>}
      </header>
      <HandoverPlayer />
      <Group title="Needs you today" lines={today} />
      <Group title="Check the reading" lines={readings} />
      {wait.length > 0 && (
        <details className="rounded-md border border-line bg-panel">
          <summary className="min-h-11 cursor-pointer px-4 py-2.5 font-medium">{wait.length} {wait.length === 1 ? "pump can" : "pumps can"} wait</summary>
          <ul className="border-t border-line">{wait.map((l) => <Line key={l.assetId} line={l} />)}</ul>
        </details>
      )}
      {done > 0 && <p className="text-[13px] text-ink-3">{done} already handled. <Link href="/log" className="underline underline-offset-2">See my decisions</Link></p>}
    </div>
  );
}
