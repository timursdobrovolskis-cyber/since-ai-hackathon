"use client";

import { ChevronDown, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { AskPump } from "@/components/AskPump";
import { CaseEvidence } from "@/components/CaseEvidence";
import { DecisionPanel } from "@/components/DecisionPanel";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { CaseMark, classLabel } from "@/components/Marks";
import { TrustLine } from "@/components/ui/trust-line";
import { clock } from "@/lib/labels";
import { JOB_HOURS, plainAlert, pumpName } from "@/lib/plain";
import { lastDone, nextStop, workSince } from "@/lib/worker";

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { cases, decisions, fleet, hour, pumps, record } = useApp();
  const [why, setWhy] = useState(false);
  const item = cases.find((c) => c.id === id);

  if (!fleet) return null;
  if (!item) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p>This has not happened yet at {clock(hour)}. Move the replay forward, or go back to Today.</p>
        <Link href="/" className="underline underline-offset-2">Back to Today</Link>
      </div>
    );
  }

  const meta = fleet.pumps.find((p) => p.id === item.assetId)!;
  const pump = pumps[item.assetId];
  const words = plainAlert(item.latest, fleet.channelMeta, record);
  const job = words.job ? JOB_HOURS[words.job] : null;
  const previous = lastDone(pump, words.lastWork, hour);
  const fixed = workSince(item, pump, hour);
  const alsoHere = cases.filter((c) => c.assetId === item.assetId && c.id !== item.id && !decisions[c.id]);
  const edge = item.eventClass === "SENSOR" ? "var(--sensor)" : "var(--machine)";

  return (
    <article className="mx-auto max-w-3xl space-y-5 p-4 sm:py-6">
      <Link href="/" className="inline-flex min-h-9 items-center gap-1 text-ink-2 hover:text-ink"><ChevronLeft aria-hidden className="size-4" />Today</Link>

      <header className="flex items-start gap-3">
        <span className="mt-2"><CaseMark eventClass={item.eventClass} faultType={item.faultType} size={22} /></span>
        <div>
          <p className="text-ink-2">{pumpName(meta.id)}, {meta.system}, {meta.site.split(" (")[0]}</p>
          <h1 className="font-cond text-3xl leading-tight font-semibold">{words.what}</h1>
          <p className="text-[13px] text-ink-3">{classLabel(item.eventClass)}. First noticed {clock(item.first.offset_hours)}{item.alerts.length > 1 ? `, ${item.alerts.length - 1} ${item.alerts.length === 2 ? "update" : "updates"} since` : ""}.</p>
        </div>
      </header>

      <TrustLine trust={words.trust} alert={item.latest} pump={pump} hour={hour} showStop={false} />

      {fixed && <p role="status" className="rounded-md border border-line bg-raised px-4 py-2 font-medium">{fixed}</p>}

      <section aria-label="What to do" className="border-l-4 bg-raised px-4 py-3" style={{ borderColor: edge }}>
        <h2 className="font-cond text-lg font-semibold">What to do</h2>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-[17px] leading-snug">
          {words.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <dl className="mt-3 space-y-1">
          <div><dt className="inline font-medium">You&rsquo;d expect to find: </dt><dd className="inline">{words.ifRight}</dd></div>
          <div><dt className="inline font-medium">If not: </dt><dd className="inline">{words.ifNot}</dd></div>
        </dl>
        {job && <p className="mt-3 text-ink-2">{job.words} takes about {job.stop} h with the pump stopped, and {job.labour} h of work. Estimate, not a site figure.</p>}
        <p className="text-ink-2">{nextStop(pump, hour)}</p>
        {previous && <p className="text-ink-2">{previous}</p>}
      </section>

      {alsoHere.length > 0 && (
        <section aria-label="Also on this pump">
          <h2 className="font-medium">Also on this pump</h2>
          <ul>
            {alsoHere.map((c) => <li key={c.id}><Link href={`/cases/${c.id}`} className="underline underline-offset-2">{plainAlert(c.latest, fleet.channelMeta, record).what}</Link></li>)}
          </ul>
        </section>
      )}

      <DecisionPanel item={item} />

      <AskPump key={item.latest.alert_id} item={item} meta={meta} />

      <section aria-label="Details">
        <button
          type="button"
          aria-expanded={why}
          onClick={() => setWhy(!why)}
          className="flex min-h-11 w-full items-center justify-between rounded-md border border-line bg-panel px-4 py-2 font-medium"
        >
          Why does it think this?
          <ChevronDown aria-hidden className={`size-5 transition-transform ${why ? "rotate-180" : ""}`} />
        </button>
        {why && (
          <div className="mt-4 space-y-5">
            <ExplanationPanel item={item} />
            <CaseEvidence item={item} meta={meta} />
          </div>
        )}
      </section>
    </article>
  );
}
