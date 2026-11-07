"use client";

// Part 5 of .plans/welcome-landing-spec.md: how well it works, as big counting figures on ink. Totals only, from
// key-numbers.json, so this section loads no labelled fault. The figures belong to whichever detector built the data.
import NumberFlow from "@number-flow/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadKeyNumbers, type KeyNumbers } from "@/lib/data";
import { BASE, breakEvenFalseAlerts } from "@/lib/payback";

/**
 * True once the element has been on screen, so figures count up and charts draw in when the reader gets there.
 * A callback ref, because these sections render only once their data has loaded, after the first effect has run.
 */
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

function Figure({ value, digits, suffix, label, note, children }: { value: number; digits: number; suffix?: string; label: string; note: string; children?: React.ReactNode }) {
  return (
    <div className="border-t border-white/20 pt-6">
      <p className="text-[64px] leading-none font-light tracking-[-0.045em] tabular-nums lg:text-[84px]">
        <NumberFlow value={value} locales="en" format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} />
        {suffix && <span className="ml-1 text-[0.45em] tracking-[-0.02em] text-white/70">{suffix}</span>}
      </p>
      <p className="mt-4 text-[17px] leading-snug">{label}</p>
      <p className="mt-1 text-[14px] leading-snug text-white/55">{note}</p>
      {children}
    </div>
  );
}

export function Results() {
  const key = useKeyNumbers();
  const { ref, seen } = useSeen<HTMLDivElement>();
  if (!key) return null;
  const on = seen ? 1 : 0;
  const breakEven = breakEvenFalseAlerts({ ...BASE, recall: key.recall, falsePerPumpDay: key.falsePerPumpDay });
  const share = (n: number) => `${(n / key.faults) * 100}%`;

  return (
    <section id="results" aria-labelledby="results-title" className="bg-mz-ink px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-24">
      <h2 id="results-title" className="max-w-[22ch] text-[36px] leading-[1.1] font-light tracking-[-0.03em] lg:text-[44px]">
        Earlier than the alarms, on the same pumps.
      </h2>
      <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-white/65">
        How the alerts did on {key.faults} real faults across the 9 pumps with known answers, scored by the organizers against what actually happened.
      </p>
      <div ref={ref} className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
        <Figure value={key.caught * on} digits={0} suffix={`of ${key.faults}`} label="Faults caught" note={`The plant's own alarms caught ${key.alarmsCaught} of the same ${key.faults}.`}>
          <div className="mt-5 space-y-2.5 text-[13px] text-white/70">
            {[
              { label: "Alerts", value: key.caught, bar: "bg-mz-accent" },
              { label: "Plant alarms", value: key.alarmsCaught, bar: "bg-white/55" },
            ].map((b) => (
              <div key={b.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3">
                <span>{b.label}</span>
                <span className="h-1.5 rounded-full bg-white/10">
                  <span className={`block h-full rounded-full ${b.bar} transition-[width] duration-[1400ms] ease-out`} style={{ width: seen ? share(b.value) : "0%" }} />
                </span>
                <span className="text-right font-mono tabular-nums">{b.value}</span>
              </div>
            ))}
          </div>
        </Figure>
        <Figure value={key.medianWarningH * on} digits={1} suffix="h" label="Warning before the limit, median" note="Enough time to plan a stop instead of reacting to a trip." />
        <Figure value={key.falsePerPumpDay * on} digits={2} label="False or extra alerts per pump per day" note={`Payback is lost above ${breakEven.toFixed(2)}, so this number decides whether it pays.`} />
      </div>
      <p className="mt-12 max-w-[70ch] text-[13px] leading-relaxed text-white/55">
        From the {key.source}, on the 9 pumps with known answers, with the organizers&rsquo; scorer. Simulated data, not results from a real ship or plant.{" "}
        <Link href="/review" className="text-white underline underline-offset-4 hover:text-white/80">
          See every fault in Review
        </Link>
      </p>
    </section>
  );
}
