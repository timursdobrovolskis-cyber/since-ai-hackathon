"use client";

// The pump dashboard on the landing page: every pump on the site at the evening shift, and one pump's report at a
// time. The report reads in the order a person on shift needs it: what's wrong, the evidence, how sure it is, what to
// do, and their review (Acknowledge, Dismiss or Escalate). Advice only: nothing here is sent to a pump.
//
// The list always shows the shift as the alerts left it, whatever has been decided, so a pump never jumps out of the
// list while someone is reviewing it. Decisions show on the pump's row and in its report instead.
import { Cog, Gauge, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { certainty } from "@/lib/cases";
import { clock, faultLabel } from "@/lib/labels";
import { pumpName } from "@/lib/plain";
import { siteAt, TEST_PUMPS, ZONES, type Light } from "@/lib/sitemap";
import type { Decision, DecisionKind } from "@/lib/types";
import { useConcerns, type Concern } from "./concerns";
import { SignalChart } from "./SignalChart";

const DISMISS_REASONS = ["It's normal for this situation", "Already known", "I checked and it's fine", "Too little to go on", "Something else"];

const GROUPS: { key: string; title: string; light: Light | "normal" | "test" }[] = [
  { key: "red", title: "Needs you today", light: "red" },
  { key: "orange", title: "Check the reading", light: "orange" },
  { key: "wait", title: "Can wait", light: "green" },
  { key: "normal", title: "Normal", light: "normal" },
  { key: "test", title: "Test pumps, no data yet", light: "test" },
];

const DONE: Record<DecisionKind, string> = {
  approved: "Acknowledged. You will check it.",
  rejected: "Dismissed as not a problem.",
  watching: "Reminder set.",
  escalated: "Escalated to the duty engineer. It stays open until they decide.",
};

const short: Record<DecisionKind, string> = { approved: "Acknowledged", rejected: "Dismissed", watching: "Reminder", escalated: "Escalated" };

function Mark({ light }: { light: Light | "normal" | "test" }) {
  if (light === "test") return <span aria-hidden className="size-2.5 shrink-0 rounded-full border border-dashed border-mz-muted" />;
  const cls = light === "red" ? "site-red" : light === "orange" ? "site-orange" : "site-green";
  return <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${cls}`} />;
}

function Kind({ sensor }: { sensor: boolean }) {
  const Icon = sensor ? Gauge : Cog;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-mz-line px-2.5 py-0.5 text-[13px] text-mz-ink">
      <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />
      {sensor ? "Sensor" : "Machine"}
    </span>
  );
}

/** One row of the report: a label in the left gutter, the content on the right. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-mz-line py-5 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-6">
      <h3 className="text-[14px] text-mz-muted">{label}</h3>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const num = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

/** True on phone-sized screens, where the chart gets taller and fewer time labels. */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setNarrow(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return narrow;
}

function Evidence({ c }: { c: Concern }) {
  const { fleet } = useApp();
  const narrow = useNarrow();
  const ev = c.lead.latest.evidence;
  const ch = ev?.channels?.find((x) => x.observed !== null && x.expected !== null);
  const meta = ch ? fleet?.channelMeta[ch.channel] : undefined;
  const blind = (ev?.blind_spots ?? []).map((b) => fleet?.channelMeta[b]?.label.toLowerCase()).filter(Boolean);
  return (
    <>
      <p className="max-w-[40ch] text-[22px] leading-snug tracking-[-0.015em] text-balance">{ev?.summary || "The detector gave no reading for this alert."}</p>
      {ch && meta && (
        <p className="mt-2 font-mono text-[13px] text-mz-muted tabular-nums">
          {meta.label} now {num(ch.observed!)} {meta.unit}, expected {num(ch.expected!)} {meta.unit}
        </p>
      )}
      <div className="mt-4 border border-mz-line bg-mz-panel px-1 pt-1">
        <SignalChart rows={c.rows} unit={c.unit} alertHours={c.alertHours} replayKey={c.id} aspectRatio={narrow ? "1.5 / 1" : "3 / 1"} ticks={narrow ? 2 : 4} />
      </div>
      <p className="mt-2 text-[13px] text-mz-muted">
        {c.channelLabel} up to the evening shift. The grey band is what this pump normally reads at its speed. Numbered marks are alerts.
      </p>
      {blind.length > 0 && <p className="mt-2 text-[13px] text-mz-muted">This pump cannot measure {blind.join(", ")}.</p>}
    </>
  );
}

function HowSure({ c }: { c: Concern }) {
  const a = c.lead.latest;
  if (a.fault_type === "UNKNOWN") {
    return (
      <>
        <p className="text-[20px] tracking-[-0.01em]">Unsure</p>
        <p className="mt-1 text-[15px] text-mz-muted">Something is off, but the cause is unclear. Inspect the pump before acting.</p>
      </>
    );
  }
  const band = certainty(a.confidence, a.confidence_calibrated);
  return (
    <>
      <p className="text-[20px] tracking-[-0.01em]">{band ? `${band}, ${Math.round(a.confidence * 100)} %` : "Not calibrated"}</p>
      <p className="mt-1 text-[15px] leading-snug text-mz-muted">
        {band ? "The detector's own estimate. " : `The detector scored it ${a.confidence.toFixed(2)}, but that score is not a probability. `}
        {c.trust ? `${c.trust.words}.` : "There are no past cases of this cause yet."}
      </p>
    </>
  );
}

function Review({ c }: { c: Concern }) {
  const { decisions, decide, undoDecision } = useApp();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState(DISMISS_REASONS[0]);
  const group = useId();
  const done = decisions[c.lead.id] as Decision | undefined;
  const base = { caseId: c.lead.id, assetId: c.id, faultType: c.lead.faultType };
  const btn =
    "inline-flex min-h-11 items-center rounded-lg px-5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent";

  if (done) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[16px]">
          {DONE[done.kind]}
          {done.kind === "rejected" && done.reason && <span className="text-mz-muted"> Reason: {done.reason}.</span>}
        </p>
        <button type="button" onClick={() => undoDecision(c.lead.id)} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-mz-accent hover:underline underline-offset-4">
          <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} /> Undo
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => decide({ ...base, kind: "approved" })} className={`${btn} bg-mz-ink text-white hover:bg-mz-accent`}>
          Acknowledge
        </button>
        <button type="button" aria-expanded={dismissing} onClick={() => setDismissing((d) => !d)} className={`${btn} border border-mz-ink/25 hover:border-mz-ink`}>
          Dismiss
        </button>
        <button type="button" onClick={() => decide({ ...base, kind: "escalated" })} className={`${btn} border border-mz-ink/25 hover:border-mz-ink`}>
          Escalate
        </button>
      </div>
      <p className="mt-2 text-[13px] text-mz-muted">Acknowledge means you will check it. Escalate passes it to the duty engineer.</p>
      {dismissing && (
        <fieldset className="mt-4 max-w-md rounded-xl bg-mz-panel p-4">
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

function Report({ id, c }: { id: string; c: Concern | undefined }) {
  const { fleet, pumps } = useApp();
  const meta = fleet?.pumps.find((p) => p.id === id);
  const sensor = c?.lead.eventClass === "SENSOR";

  return (
    <article aria-labelledby="pump-report-title" className="min-w-0">
      <header className="pb-5">
        <h3 id="pump-report-title" className="text-[32px] leading-tight font-normal tracking-[-0.025em]">
          {pumpName(id)}
        </h3>
        {meta && (
          <p className="mt-1 text-[15px] text-mz-muted">
            {meta.system}, {meta.site.replace(" (fictional)", "")}
          </p>
        )}
      </header>

      {TEST_PUMPS.has(id) ? (
        <Row label="Status">
          <p className="max-w-[52ch] text-[16px]">This is a test pump. The organizers hold its answers, so the app shows no data for it until the submission is frozen.</p>
        </Row>
      ) : !c ? (
        <Row label="What's wrong">
          <p className="text-[20px] tracking-[-0.01em]">Nothing found</p>
          <p className="mt-1 text-[15px] text-mz-muted">
            No alerts on this pump so far this week. It measures {pumps[id]?.channels.length ?? 0} kinds of reading.
          </p>
        </Row>
      ) : (
        <>
          <Row label="What's wrong">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[24px] leading-tight tracking-[-0.02em]">{faultLabel(c.lead.faultType)}</p>
              <Kind sensor={sensor} />
            </div>
            <p className="mt-1.5 text-[15px] text-mz-muted">
              {c.what} First noticed {c.firstNoticed}
              {c.others > 0 ? `, and ${c.others} more ${c.others === 1 ? "concern" : "concerns"} on this pump` : ""}.
            </p>
          </Row>
          <Row label="Evidence">
            <Evidence c={c} />
          </Row>
          <Row label="How sure">
            <HowSure c={c} />
          </Row>
          <Row label="What to do">
            <p className="max-w-[48ch] text-[18px] leading-snug">{c.check}</p>
            {c.stop && <p className="mt-1.5 text-[15px] text-mz-muted">{c.stop}</p>}
            <p className="mt-1.5 text-[15px] text-mz-muted">
              Advice only. Nothing is sent to the pump.{" "}
              <Link href={`/cases/${c.lead.id}`} className="text-mz-accent underline-offset-4 hover:underline">
                Open the job card
              </Link>
            </p>
          </Row>
          <Row label="Your review">
            <Review c={c} />
          </Row>
        </>
      )}
    </article>
  );
}

export function PumpDashboard({ shiftHour }: { shiftHour: number }) {
  const { alertsToShift, decisions, record, pumps } = useApp();
  // The shift without decisions, so the list stays put while pumps are reviewed (see the note at the top).
  const site = useMemo(() => siteAt(alertsToShift, shiftHour, shiftHour, {}, record, pumps), [alertsToShift, shiftHour, record, pumps]);
  const withLine = useMemo(() => ZONES.flatMap((z) => z.pumps).filter((id) => site.lines[id]), [site]);
  const concerns = useConcerns(site, withLine);
  const byId = useMemo(() => Object.fromEntries(concerns.map((c) => [c.id, c])), [concerns]);
  const concernFor = (id: string): Concern | undefined => byId[id];

  const groups = useMemo(() => {
    const all = ZONES.flatMap((z) => z.pumps);
    const waiting = all.filter((id) => site.lights[id] === "green" && site.lines[id]);
    return GROUPS.map((g) => ({
      ...g,
      ids:
        g.key === "red" ? site.order.red
        : g.key === "orange" ? site.order.orange
        : g.key === "wait" ? waiting
        : g.key === "normal" ? all.filter((id) => !TEST_PUMPS.has(id) && site.lights[id] === "green" && !site.lines[id])
        : all.filter((id) => TEST_PUMPS.has(id)),
    })).filter((g) => g.ids.length);
  }, [site]);
  const order = groups.flatMap((g) => g.ids);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? order[0] ?? null;
  const listRef = useRef<HTMLDivElement>(null);

  /** Arrow keys move through the list, like any list of messages. */
  const onKey = (e: React.KeyboardEvent) => {
    if (!selected || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = order.indexOf(selected);
    const next = e.key === "Home" ? 0 : e.key === "End" ? order.length - 1 : Math.min(order.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)));
    setPicked(order[next]);
    listRef.current?.querySelector<HTMLElement>(`[data-row="${order[next]}"]`)?.focus();
  };

  const concernCount = site.order.red.length + site.order.orange.length;

  return (
    <section id="pumps" aria-labelledby="pumps-title" className="bg-white px-5 py-16 sm:px-10 lg:px-16 lg:py-24">
      <div className="max-w-3xl">
        <h2 id="pumps-title" className="text-[36px] leading-[1.1] font-light tracking-[-0.03em] lg:text-[44px]">
          {concernCount === 1 ? "One pump needs" : `${concernCount} pumps need`} a look this evening.
        </h2>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-mz-muted">
          Every pump on the site at the evening shift, {clock(shiftHour)}. Pick one to see what is wrong, the reading that shows
          it, how sure the detector is, and what to check. Then acknowledge, dismiss or escalate it.
        </p>
      </div>

      {/* Phones: a plain picker above the report. */}
      <label className="mt-8 block md:hidden">
        <span className="text-[14px] text-mz-muted">Pump</span>
        <select
          value={selected ?? ""}
          onChange={(e) => setPicked(e.target.value)}
          className="mt-1 block min-h-12 w-full rounded-lg border border-mz-line bg-white px-3 text-[16px]"
        >
          {groups.map((g) => (
            <optgroup key={g.key} label={g.title}>
              {g.ids.map((id) => (
                <option key={id} value={id}>
                  {pumpName(id)}
                  {concernFor(id) ? `: ${faultLabel(concernFor(id)!.lead.faultType)}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="mt-10 grid gap-10 md:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14">
        <div ref={listRef} role="listbox" aria-label="Pumps" onKeyDown={onKey} className="hidden self-start md:sticky md:top-24 md:block">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`grp-${g.key}`} className="mb-6">
              <p id={`grp-${g.key}`} className="mb-1 flex items-baseline justify-between text-[14px] text-mz-muted">
                {g.title}
                <span className="font-mono text-[12px] tabular-nums">{g.ids.length}</span>
              </p>
              {g.ids.map((id) => {
                const c = concernFor(id);
                const on = id === selected;
                const d = c ? decisions[c.lead.id] : undefined;
                return (
                  <div
                    key={id}
                    id={`row-${id}`}
                    data-row={id}
                    role="option"
                    aria-selected={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setPicked(id)}
                    className={`-mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-mz-accent ${on ? "bg-mz-panel" : "hover:bg-mz-panel/60"}`}
                  >
                    <Mark light={g.light} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[15px] ${on ? "font-medium" : ""}`}>{pumpName(id)}</span>
                      <span className="block truncate text-[13px] text-mz-muted">
                        {c ? faultLabel(c.lead.faultType) : TEST_PUMPS.has(id) ? "No data yet" : "No alerts"}
                      </span>
                    </span>
                    {d && <span className="shrink-0 text-[12px] text-mz-muted">{short[d.kind]}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {selected && <Report id={selected} c={concernFor(selected)} />}
      </div>
    </section>
  );
}
