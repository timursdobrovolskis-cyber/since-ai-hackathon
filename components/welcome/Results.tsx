"use client";

// How the alerts compare with the plant's own alarms, on the 9 pumps whose real faults are known. Every figure comes
// from key-numbers.json, which tools/build_ui_data.py writes from the organizers' scorer, totals only:
//   faults caught, faults warned about before a conventional limit (of those that reached one within the week), faults
//   with the right cause named, and false or extra alerts per pump per day, each for the alerts and the plant alarms.
// Three layouts to compare, picked with the switch in the section or ?results=table|dots|plain.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadKeyNumbers, type KeyNumbers } from "@/lib/data";

/** True once the element has been on screen. A callback ref, because the section renders only once its data loads. */
export function useSeen<T extends Element>() {
  const [seen, setSeen] = useState(false);
  const io = useRef<IntersectionObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    io.current?.disconnect();
    if (!el) return;
    io.current = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.25 });
    io.current.observe(el);
  }, []);
  useEffect(() => () => io.current?.disconnect(), []);
  return { ref, seen };
}

export function useKeyNumbers() {
  const [key, setKey] = useState<KeyNumbers | null>(null);
  useEffect(() => {
    loadKeyNumbers().then(setKey).catch(() => {});
  }, []);
  return key;
}

type Row = { key: string; label: string; note: string; alerts: number; alarms: number; of: number };

function rowsFor(k: KeyNumbers): Row[] {
  return [
    { key: "caught", label: "Faults caught", note: `Of the ${k.faults} real faults on the 9 pumps with known answers.`, alerts: k.caught, alarms: k.alarmsCaught, of: k.faults },
    { key: "limit", label: "Warned before the alarm limit", note: `Of the ${k.withLimit} faults that reached a conventional alarm limit within the week.`, alerts: k.beforeLimit, alarms: k.beforeLimitAlarms, of: k.withLimit },
    { key: "cause", label: "Right cause named", note: "The alert named the actual fault, not only that something was wrong.", alerts: k.rightCause, alarms: k.rightCauseAlarms, of: k.faults },
  ];
}

const per = (v: number) => v.toFixed(2);

function Bar({ value, of, tone, seen }: { value: number; of: number; tone: "alerts" | "alarms"; seen: boolean }) {
  return (
    <span className="block h-1.5 rounded-full bg-white/10">
      <span
        className={`block h-full rounded-full transition-[width] duration-[900ms] ease-out ${tone === "alerts" ? "bg-mz-accent" : "bg-white/55"}`}
        style={{ width: seen ? `${(value / of) * 100}%` : "0%" }}
      />
    </span>
  );
}

/** Layout 1: one comparison table, alerts against plant alarms. */
function Table({ k, seen }: { k: KeyNumbers; seen: boolean }) {
  const rows = rowsFor(k);
  return (
    <table className="w-full max-w-4xl border-collapse text-left">
      <thead>
        <tr className="text-[14px] text-white/60">
          <th className="w-[40%] pb-3 font-normal">
            <span className="sr-only">Measure</span>
          </th>
          <th className="pb-3 font-normal">
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-mz-accent align-middle" />
            Alerts
          </th>
          <th className="pb-3 font-normal">
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-white/55 align-middle" />
            Plant alarms
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-white/15 align-top">
            <th scope="row" className="py-5 pr-6 font-normal">
              <span className="block text-[17px]">{r.label}</span>
              <span className="mt-1 block text-[13px] leading-snug text-white/55">{r.note}</span>
            </th>
            {[r.alerts, r.alarms].map((v, i) => (
              <td key={i} className="py-5 pr-8">
                <span className="block text-[28px] leading-none font-light tabular-nums">
                  {v}
                  <span className="text-[15px] text-white/55"> of {r.of}</span>
                </span>
                <span className="mt-3 block max-w-[14rem]">
                  <Bar value={v} of={r.of} tone={i === 0 ? "alerts" : "alarms"} seen={seen} />
                </span>
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-white/15 align-top">
          <th scope="row" className="py-5 pr-6 font-normal">
            <span className="block text-[17px]">False or extra alerts</span>
            <span className="mt-1 block text-[13px] leading-snug text-white/55">Per pump per day. Lower is better.</span>
          </th>
          <td className="py-5 text-[28px] leading-none font-light tabular-nums">{per(k.falsePerPumpDay)}</td>
          <td className="py-5 text-[28px] leading-none font-light tabular-nums">{per(k.falsePerPumpDayAlarms)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Dots({ value, of, tone, seen }: { value: number; of: number; tone: "alerts" | "alarms"; seen: boolean }) {
  return (
    <span aria-hidden className="flex flex-wrap gap-[5px]">
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={`size-2.5 rounded-full transition-colors duration-300 ${i < value && seen ? (tone === "alerts" ? "bg-mz-accent" : "bg-white/70") : "bg-white/12"}`}
          style={{ transitionDelay: seen ? `${i * 18}ms` : "0ms" }}
        />
      ))}
    </span>
  );
}

/** Layout 2: one dot per fault, so the counts can be seen rather than read. */
function DotsView({ k, seen }: { k: KeyNumbers; seen: boolean }) {
  return (
    <div className="grid max-w-5xl gap-x-14 gap-y-10 lg:grid-cols-2">
      {rowsFor(k).map((r) => (
        <div key={r.key}>
          <h3 className="text-[17px]">{r.label}</h3>
          <p className="mt-1 text-[13px] text-white/55">{r.note}</p>
          <div className="mt-4 space-y-2.5">
            {(["alerts", "alarms"] as const).map((tone) => (
              <div key={tone} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-[14px]">
                <span className="text-white/70">{tone === "alerts" ? "Alerts" : "Plant alarms"}</span>
                <Dots value={tone === "alerts" ? r.alerts : r.alarms} of={r.of} tone={tone} seen={seen} />
                <span className="text-right tabular-nums">
                  {tone === "alerts" ? r.alerts : r.alarms}
                  <span className="text-white/50"> of {r.of}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div>
        <h3 className="text-[17px]">False or extra alerts</h3>
        <p className="mt-1 text-[13px] text-white/55">Per pump per day. Lower is better.</p>
        <p className="mt-4 text-[15px] text-white/80">
          Alerts <span className="text-white tabular-nums">{per(k.falsePerPumpDay)}</span>, plant alarms{" "}
          <span className="text-white tabular-nums">{per(k.falsePerPumpDayAlarms)}</span>.
        </p>
      </div>
    </div>
  );
}

/** Layout 3: plain sentences, each with its two bars. */
function Plain({ k, seen }: { k: KeyNumbers; seen: boolean }) {
  const same = per(k.falsePerPumpDay) === per(k.falsePerPumpDayAlarms);
  const lines = [
    { key: "caught", text: <>The alerts caught <b>{k.caught} of {k.faults}</b> faults. The plant&rsquo;s alarms caught {k.alarmsCaught}.</>, a: k.caught, b: k.alarmsCaught, of: k.faults },
    { key: "limit", text: <>Of the {k.withLimit} faults that reached an alarm limit, the alerts warned before it on <b>{k.beforeLimit}</b>. The plant&rsquo;s alarms on {k.beforeLimitAlarms}.</>, a: k.beforeLimit, b: k.beforeLimitAlarms, of: k.withLimit },
    { key: "cause", text: <>The alerts named the right cause for <b>{k.rightCause} of {k.faults}</b>. The plant&rsquo;s alarms for {k.rightCauseAlarms}.</>, a: k.rightCause, b: k.rightCauseAlarms, of: k.faults },
  ];
  return (
    <ol className="max-w-4xl space-y-9">
      {lines.map((l) => (
        <li key={l.key}>
          <p className="max-w-[40ch] text-[24px] leading-snug font-light tracking-[-0.015em] [&_b]:font-normal [&_b]:text-white">{l.text}</p>
          <div className="mt-3 grid max-w-md gap-1.5">
            <Bar value={l.a} of={l.of} tone="alerts" seen={seen} />
            <Bar value={l.b} of={l.of} tone="alarms" seen={seen} />
          </div>
        </li>
      ))}
      <li>
        <p className="max-w-[40ch] text-[24px] leading-snug font-light tracking-[-0.015em]">
          {same
            ? `Both raised ${per(k.falsePerPumpDay)} false or extra alerts per pump per day.`
            : `False or extra alerts per pump per day: ${per(k.falsePerPumpDay)} for the alerts, ${per(k.falsePerPumpDayAlarms)} for the plant's alarms.`}
        </p>
      </li>
    </ol>
  );
}

const LAYOUTS = [
  { key: "table", label: "Table" },
  { key: "dots", label: "Dots" },
  { key: "plain", label: "Plain" },
] as const;
type Layout = (typeof LAYOUTS)[number]["key"];

export function Results() {
  const key = useKeyNumbers();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [layout, setLayout] = useState<Layout>("table");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("results");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address bar is only readable after mount
    if (LAYOUTS.some((l) => l.key === wanted)) setLayout(wanted as Layout);
  }, []);
  const pick = (l: Layout) => {
    setLayout(l);
    const url = new URL(window.location.href);
    url.searchParams.set("results", l);
    window.history.replaceState(null, "", url);
  };
  if (!key) return null;

  return (
    <section id="results" aria-labelledby="results-title" className="bg-mz-ink px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 id="results-title" className="text-[36px] leading-[1.1] font-light tracking-[-0.03em] lg:text-[44px]">
            Against the plant&rsquo;s own alarms
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-white/65">
            The same faults, scored by the organizers for both: the alerts on this page, and the alarms the plants already have.
          </p>
        </div>
        {/* Temporary: compare the three layouts, then keep one. */}
        <div role="group" aria-label="Results layout" className="flex items-center gap-1 rounded-full bg-white/8 p-1 text-[13px]">
          {LAYOUTS.map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={layout === l.key}
              onClick={() => pick(l.key)}
              className={`min-h-9 rounded-full px-3.5 transition-colors ${layout === l.key ? "bg-white text-mz-ink" : "text-white/75 hover:text-white"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className="mt-12">
        {layout === "table" ? <Table k={key} seen={seen} /> : layout === "dots" ? <DotsView k={key} seen={seen} /> : <Plain k={key} seen={seen} />}
      </div>

      <p className="mt-12 max-w-[70ch] text-[13px] leading-relaxed text-white/55">
        Alerts from the {key.source} until the team&rsquo;s detector is in. Simulated data, not results from a real ship or plant.{" "}
        <Link href="/review" className="text-white underline underline-offset-4 hover:text-white/80">
          See every fault in Review
        </Link>
      </p>
    </section>
  );
}
