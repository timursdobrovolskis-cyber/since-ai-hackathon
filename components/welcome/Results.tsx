"use client";

// How the alerts compare with the plant's own alarms, on the 9 pumps whose real faults are known. Every figure comes
// from key-numbers.json, which tools/build_ui_data.py writes from the organizers' scorer, totals only:
//   faults caught, faults warned about before a conventional limit (of those that reached one within the week), faults
//   with the right cause named, and false or extra alerts per pump per day, each for the alerts and the plant alarms.
// Shown as one table: Jona chose it over dots and plain sentences on 7 Nov.
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

/** One comparison table, alerts against plant alarms. */
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


export function Results() {
  const key = useKeyNumbers();
  const { ref, seen } = useSeen<HTMLDivElement>();
  if (!key) return null;

  return (
    <section id="results" aria-labelledby="results-title" className="bg-mz-ink px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-24">
      <div>
        <div>
          <h2 id="results-title" className="text-[36px] leading-[1.1] font-light tracking-[-0.03em] lg:text-[44px]">
            Against the plant&rsquo;s own alarms
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-white/65">
            The same faults, scored by the organizers for both: the alerts on this page, and the alarms the plants already have.
          </p>
        </div>
      </div>

      <div ref={ref} className="mt-12">
        <Table k={key} seen={seen} />
      </div>

      <p className="mt-12 max-w-[70ch] text-[13px] leading-relaxed text-white/55">
        Alerts from the {key.source} until the team&rsquo;s detector is in. Scored by the organizers&rsquo; scorer on simulated data, not results from a real ship or
        plant.
      </p>
    </section>
  );
}
