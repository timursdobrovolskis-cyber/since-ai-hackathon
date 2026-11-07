"use client";

// How the alerts compare with the plant's own alarms, on the 9 pumps whose real faults are known. The totals come from
// key-numbers.json, which tools/build_ui_data.py writes from the organizers' scorer:
//   faults caught, faults warned about before a conventional limit (of those that reached one within the week), faults
//   with the right cause named, and false or extra alerts per pump per day, each for the alerts and the plant alarms.
// Shown as one table: Jona chose it over dots and plain sentences on 7 Nov. A click on a row opens the faults behind its
// figures, from review/scorecard.json (the scorer's per-fault results). Those are labelled answers, so they load only on
// that click and are marked as a review of past faults. lib/results.test.ts ties each list to the figures in its row.
import { Check, ChevronDown, Minus } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { loadAlerts, loadKeyNumbers, type KeyNumbers } from "@/lib/data";
import { clock, faultLabel } from "@/lib/labels";
import { outcome, type RowKey } from "@/lib/pastFaults";
import { pumpName } from "@/lib/plain";
import { loadScorecard, type PerEvent } from "@/lib/review-data";
import type { Alert } from "@/lib/types";

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

type Row = { key: RowKey; label: string; note: string; alerts: number; alarms: number; of: number };

function rowsFor(k: KeyNumbers): Row[] {
  return [
    { key: "caught", label: "Faults caught", note: `Of the ${k.faults} real faults on the 9 pumps with known answers.`, alerts: k.caught, alarms: k.alarmsCaught, of: k.faults },
    { key: "limit", label: "Warned before the alarm limit", note: `Of the ${k.withLimit} faults that reached a conventional alarm limit within the week.`, alerts: k.beforeLimit, alarms: k.beforeLimitAlarms, of: k.withLimit },
    { key: "cause", label: "Right cause named", note: "The alert named the actual fault, not only that something was wrong.", alerts: k.rightCause, alarms: k.rightCauseAlarms, of: k.faults },
  ];
}

const per = (v: number) => v.toFixed(2);

type Faults = { pump: string; e: PerEvent }[];
type FalseAlert = { pump: string; a: Alert };

/** The scorer's per-fault results and the alerts it marked false, loaded the first time a row opens. */
function usePastFaults(want: boolean) {
  const [data, setData] = useState<{ faults: Faults; falseAlerts: FalseAlert[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!want || data) return;
    Promise.all([loadScorecard(), loadAlerts()])
      .then(([card, { alerts }]) => {
        const faults = Object.entries(card.pumps).flatMap(([pump, p]) => p.perEvent.map((e) => ({ pump, e })));
        const byId = new Map(alerts.map((a) => [a.alert_id, a]));
        const falseAlerts = Object.entries(card.pumps).flatMap(([pump, p]) => p.falseAlertIds.flatMap((id) => (byId.has(id) ? [{ pump, a: byId.get(id)! }] : [])));
        setData({ faults, falseAlerts });
      })
      .catch(() => setFailed(true));
  }, [want, data]);
  return { data, failed };
}

function Bar({ value, of, tone, seen }: { value: number; of: number; tone: "alerts" | "alarms"; seen: boolean }) {
  return (
    <span className="block h-1.5 bg-white/10">
      <span
        className={`block h-full transition-[width] duration-[900ms] ease-out ${tone === "alerts" ? "bg-mz-accent" : "bg-white/55"}`}
        style={{ width: seen ? `${(value / of) * 100}%` : "0%" }}
      />
    </span>
  );
}

function Mark({ ok, text }: { ok: boolean; text: string }) {
  const Icon = ok ? Check : Minus;
  return (
    <span className={`inline-flex items-start gap-1.5 ${ok ? "text-white" : "text-white/50"}`}>
      <Icon aria-hidden className="mt-[3px] size-3.5 shrink-0" strokeWidth={2} />
      {text}
    </span>
  );
}

const HEAD = "pb-2 text-[13px] font-normal text-white/50";

/** The faults behind one row, as a review of past faults with known answers. */
function Detail({ row, data, failed }: { row: RowKey; data: ReturnType<typeof usePastFaults>["data"]; failed: boolean }) {
  if (failed) return <p className="text-[14px] text-white/65">The list of past faults could not load. Reload the page to try again.</p>;
  if (!data) return <p className="text-[14px] text-white/65">Loading the past faults…</p>;

  const intro = (
    <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-white/55">
      A review of past faults with known answers, from the organizers&rsquo; labels for these test weeks. The alarm panel above does not use them.
    </p>
  );

  if (row === "false")
    return (
      <>
        {intro}
        <table className="w-full table-fixed border-collapse text-left text-[14px]">
          <thead>
            <tr>
              <th className={`${HEAD} w-[40%]`}>Pump</th>
              <th className={HEAD}>The alert said</th>
            </tr>
          </thead>
          <tbody>
            {data.falseAlerts.map(({ pump, a }) => (
              <tr key={a.alert_id} className="border-t border-white/10 align-top">
                <td className="py-2.5 pr-4">{pumpName(pump)}</td>
                <td className="py-2.5">
                  {faultLabel(a.fault_type)} at {clock(a.offset_hours)}. No fault was active.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[13px] text-white/55">The scorer does not list the plant&rsquo;s false alarms one by one, only their rate.</p>
      </>
    );

  const list = row === "limit" ? data.faults.filter((f) => f.e.hasLimit) : data.faults;
  return (
    <>
      {intro}
      <table className="w-full table-fixed border-collapse text-left text-[14px]">
        <thead>
          <tr>
            <th className={`${HEAD} w-[40%]`}>Fault</th>
            <th className={`${HEAD} w-[30%]`}>Alerts</th>
            <th className={`${HEAD} w-[30%]`}>Plant alarms</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ pump, e }) => {
            const [alerts, alarms] = outcome(row, e);
            return (
              <tr key={e.eventId} className="border-t border-white/10 align-top">
                <th scope="row" className="py-2.5 pr-4 font-normal">
                  <span className="block">{pumpName(pump)}</span>
                  <span className="block text-white/55">
                    {faultLabel(e.faultType)}, {e.eventClass === "SENSOR" ? "sensor" : "machine"}
                  </span>
                </th>
                <td className="py-2.5 pr-4">
                  <Mark {...alerts} />
                </td>
                <td className="py-2.5">
                  <Mark {...alarms} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/** One comparison table, alerts against plant alarms. Each row opens the faults behind it. */
function Table({ k, seen }: { k: KeyNumbers; seen: boolean }) {
  const [open, setOpen] = useState<RowKey | null>(null);
  const [asked, setAsked] = useState(false);
  const past = usePastFaults(asked);
  const base = useId();
  const toggle = (key: RowKey) => {
    setAsked(true);
    setOpen((o) => (o === key ? null : key));
  };

  const rows: (Row | { key: "false"; label: string; note: string })[] = [
    ...rowsFor(k),
    { key: "false", label: "False or extra alerts", note: "Per pump per day. Lower is better." },
  ];
  const count = (key: RowKey) => (key === "limit" ? k.withLimit : key === "false" ? null : k.faults);

  return (
    <table className="w-full max-w-4xl table-fixed border-collapse text-left">
      <thead>
        <tr className="text-[14px] text-white/60">
          <th className="w-[40%] pb-3 font-normal">
            <span className="sr-only">Measure</span>
          </th>
          <th className="w-[30%] pb-3 font-normal">
            <span aria-hidden className="mr-2 inline-block size-2 bg-mz-accent align-middle" />
            Alerts
          </th>
          <th className="w-[30%] pb-3 font-normal">
            <span aria-hidden className="mr-2 inline-block size-2 bg-white/55 align-middle" />
            Plant alarms
          </th>
        </tr>
      </thead>
      {rows.map((r) => {
        const isOpen = open === r.key;
        const n = count(r.key);
        const panel = `${base}-${r.key}`;
        return (
          <tbody key={r.key} className="group border-t border-white/15">
            <tr onClick={() => toggle(r.key)} className="cursor-pointer align-top">
              <th scope="row" className="py-5 pr-6 pl-0 font-normal">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggle(r.key);
                  }}
                  className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mz-accent"
                >
                  <span className="block text-[17px] underline-offset-4 decoration-white/30 group-hover:underline">{r.label}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-white/55">{r.note}</span>
                  <span className="mt-2.5 inline-flex min-h-6 items-center gap-1 text-[13px] text-mz-accent-soft">
                    {isOpen ? "Hide" : n ? `Show the ${n} faults` : "Show which alerts"}
                    <ChevronDown aria-hidden className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} strokeWidth={2} />
                  </span>
                </button>
              </th>
              {"alerts" in r ? (
                [r.alerts, r.alarms].map((v, i) => (
                  <td key={i} className="py-5 pr-8">
                    <span className="block text-[28px] leading-none font-light tabular-nums">
                      {v}
                      <span className="text-[15px] text-white/55"> of {r.of}</span>
                    </span>
                    <span className="mt-3 block max-w-[14rem]">
                      <Bar value={v} of={r.of} tone={i === 0 ? "alerts" : "alarms"} seen={seen} />
                    </span>
                  </td>
                ))
              ) : (
                <>
                  <td className="py-5 text-[28px] leading-none font-light tabular-nums">{per(k.falsePerPumpDay)}</td>
                  <td className="py-5 text-[28px] leading-none font-light tabular-nums">{per(k.falsePerPumpDayAlarms)}</td>
                </>
              )}
            </tr>
            {isOpen && (
              <tr>
                <td id={panel} colSpan={3} className="results-detail pb-8">
                  <Detail row={r.key} data={past.data} failed={past.failed} />
                </td>
              </tr>
            )}
          </tbody>
        );
      })}
    </table>
  );
}

export function Results() {
  const key = useKeyNumbers();
  const { ref, seen } = useSeen<HTMLDivElement>();
  if (!key) return null;

  return (
    <section id="results" aria-labelledby="results-title" className="bg-mz-ink px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-24">
      <h2 id="results-title" className="text-[36px] leading-[1.1] font-light tracking-[-0.03em] lg:text-[44px]">
        Against the plant&rsquo;s own alarms
      </h2>
      <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-white/65">
        The same faults, scored by the organizers for both: the alerts on this page, and the alarms the plants already have. Open a row to see the faults behind it.
      </p>

      <div ref={ref} className="mt-12">
        <Table k={key} seen={seen} />
      </div>

      <p className="mt-12 max-w-[70ch] text-[13px] leading-relaxed text-white/55">
        Alerts from the {key.source}. Scored by the organizers&rsquo; scorer on simulated data, not results from a real ship or
        plant.
      </p>
    </section>
  );
}
