"use client";

// Part 5 of .plans/welcome-landing-spec.md: how well it works, as big counting figures on ink. Totals only, from
// key-numbers.json, so this section loads no labelled fault. The figures belong to whichever detector built the data.
import NumberFlow from "@number-flow/react";
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
    <section id="results" aria-label="How well it works" className="welcome-dark relative overflow-hidden bg-mz-ink px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-28">
      <div aria-hidden className="welcome-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">04 &middot; How well it works</p>
        <h2 className="mt-4 max-w-[20ch] text-[34px] leading-[1.08] font-light tracking-[-0.03em] lg:text-[44px]">Earlier than the alarms, on the same pumps.</h2>
        <div ref={ref} className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
          <Figure value={key.caught * on} digits={0} suffix={`of ${key.faults}`} label="Faults caught before they became a problem" note={`The plant's own alarms caught ${key.alarmsCaught}.`}>
            <div className="mt-5 space-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0">Alerts</span>
                <span className="h-1.5 flex-1 bg-white/10"><span className="block h-full bg-mz-accent transition-[width] duration-[1400ms] ease-out" style={{ width: seen ? share(key.caught) : "0%" }} /></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0">Plant alarms</span>
                <span className="h-1.5 flex-1 bg-white/10"><span className="block h-full bg-white/60 transition-[width] duration-[1400ms] ease-out" style={{ width: seen ? share(key.alarmsCaught) : "0%" }} /></span>
              </div>
            </div>
          </Figure>
          <Figure value={key.medianWarningH * on} digits={1} suffix="h" label="Median warning before a conventional limit" note="Time to plan a stop, instead of reacting to a trip." />
          <Figure value={key.falsePerPumpDay * on} digits={2} label="False or extra alerts per pump per day" note={`The business case stops paying above ${breakEven.toFixed(2)}, so this number decides it.`} />
        </div>
        <p className="mt-12 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-white/45">
          {key.source} &middot; {key.faults} scored faults on the 9 labelled pumps &middot; organizers&rsquo; scorer &middot; synthetic data, not field results
        </p>
      </div>
    </section>
  );
}
