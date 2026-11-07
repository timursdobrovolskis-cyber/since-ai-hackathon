"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadKeyNumbers, type KeyNumbers as Numbers } from "@/lib/data";
import { BASE, evaluate } from "@/lib/payback";
import { useApp } from "./AppProvider";

function Number_({ href, value, label }: { href: string; value: string; label: string }) {
  return (
    <Link href={href} className="block px-4 py-2.5 hover:bg-raised">
      <span className="block font-cond text-xl font-semibold">{value}</span>
      <span className="block text-[13px] text-ink-2">{label}</span>
    </Link>
  );
}

/** The proof in one quiet row. Each number opens its detail. */
export function KeyNumbers() {
  const { alertSource } = useApp();
  const [data, setData] = useState<Numbers | null>(null);

  useEffect(() => {
    loadKeyNumbers().then(setData).catch(() => {
      // The list above is what matters. It works without these numbers.
    });
  }, []);

  // Numbers built for another detector would not describe the alerts on screen.
  if (!data || data.source !== alertSource) return null;
  const { paybackYears } = evaluate({ ...BASE, recall: data.recall, falsePerPumpDay: data.falsePerPumpDay });

  return (
    <section aria-label="How well it works">
      <h2 className="mb-1.5 font-cond text-xl font-semibold">How well it works</h2>
      <div className="grid divide-y divide-line rounded-md border border-line bg-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Number_ href="/review" value={`${data.caught} of ${data.faults} faults`} label={`caught, against ${data.alarmsCaught} by plant alarms`} />
        <Number_ href="/review" value={`${Math.round(data.medianWarningH)} hours`} label="typical warning before the limit" />
        <Number_ href="/payback" value={`${paybackYears.toFixed(1)} years`} label="payback, illustrative only" />
      </div>
      <p className="mt-1 text-[13px] text-ink-3">From the simulated test week, using placeholder alerts ({data.source}).</p>
    </section>
  );
}
