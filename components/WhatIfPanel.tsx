"use client";

import { useEffect, useState } from "react";
import { loadSimIndex, loadSimResult, type Severity, type SimIndex, type SimResult, type SimState } from "@/lib/whatif";
import type { Case } from "@/lib/types";

const SEVERITIES: Severity[] = ["mild", "moderate", "severe"];

/** The sandbox writes for engineers reading JSON. Reword its most common message, and keep the rest as it is. */
function plain(text: string) {
  const m = text.match(/^cooling-duty satisfaction ([\d.]+) below the minimum ([\d.]+) \(flow (\d+) vs required (\d+) m3\/h\)$/);
  if (m) return `Cooling demand met is ${Math.round(Number(m[1]) * 100)} %, below the ${Math.round(Number(m[2]) * 100)} % minimum (flow ${m[3]} m³/h, needs ${m[4]} m³/h).`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
const fixed = (digits: number, unit = "") => (v: number | null) => (v === null ? "Not known" : `${v.toFixed(digits)}${unit}`);

const ROWS: { label: string; key: keyof SimState; show: (v: number | null) => string }[] = [
  { label: "Flow", key: "flow_m3h", show: fixed(0, " m³/h") },
  { label: "Cooling demand met", key: "duty_satisfaction", show: (v) => (v === null ? "Not known" : `${Math.round(v * 100)} %`) },
  { label: "Margin against cavitation (NPSH ratio)", key: "npsh_margin", show: fixed(2) },
  { label: "Pump speed", key: "speed_ratio", show: (v) => (v === null ? "Not known" : `${Math.round(v * 100)} %`) },
  { label: "Power", key: "input_kw", show: fixed(1, " kW") },
  { label: "Energy per day", key: "energy_eur_per_day", show: fixed(0, " EUR") },
  { label: "Risk indicator, 0 to 1", key: "risk_proxy", show: fixed(2) },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="whatif" className="border border-line bg-raised p-4">
      <h2 id="whatif" className="font-cond text-lg font-semibold">Try a fix in the simulator</h2>
      <p className="text-ink-2">Simulation only. Nothing is sent to any machine.</p>
      {children}
    </section>
  );
}

export function WhatIfPanel({ item }: { item: Case }) {
  const alertId = item.latest.alert_id;
  const [index, setIndex] = useState<SimIndex | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [chosen, setChosen] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadSimIndex()
      .then(async (ix) => {
        if (!live) return;
        setIndex(ix);
        if (ix.alertIds.includes(alertId)) {
          const r = await loadSimResult(alertId);
          if (live) setResult(r);
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [alertId]);

  if (item.eventClass === "SENSOR") {
    return <Shell><p className="mt-2">This looks like a sensor problem. The simulator models the machine, so there is nothing to test here. Check the sensor first.</p></Shell>;
  }
  if (item.faultType === "UNKNOWN") {
    return <Shell><p className="mt-2">The cause is unclear, so there is no condition to test yet. Inspect the pump first.</p></Shell>;
  }
  if (failed) return <Shell><p className="mt-2">The simulator results could not be loaded. Reload the page to try again.</p></Shell>;
  if (!index) return <Shell><p className="mt-2 text-ink-2">Loading simulator results</p></Shell>;
  if (!index.alertIds.includes(alertId)) {
    return <Shell><p className="mt-2">No simulator results for this alert. Run tools/build_what_if.py after loading new alerts.</p></Shell>;
  }
  if (!result) return <Shell><p className="mt-2 text-ink-2">Loading simulator results</p></Shell>;
  if ("unavailable" in result) {
    return <Shell><p className="mt-2">The simulator cannot test this moment: {result.unavailable}.</p></Shell>;
  }

  const state = result.severities[severity];
  const option = state.options[Math.min(chosen, state.options.length - 1)];
  // A problem can already exist now and also remain after the action, so show each message once.
  const warnings = [...new Set([...state.warnings, ...option.warnings])].filter((w) => !option.reasons.includes(w));

  return (
    <Shell>
      <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-3">
        <fieldset>
          <legend className="text-[13px] text-ink-2">How severe do you assume it is?</legend>
          <div className="mt-1 flex">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === severity}
                onClick={() => setSeverity(s)}
                className={`-ml-px min-h-10 border px-3 capitalize first:ml-0 ${s === severity ? "border-ink bg-ink text-raised" : "border-line"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[13px] text-ink-3">Assumed {result.assumption.name}: {state.level}. Your assumption, not a measurement.</p>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="text-[13px] text-ink-2">What should the simulator try?</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {state.options.map((o, i) => (
              <button
                key={o.action + o.label}
                type="button"
                aria-pressed={o === option}
                onClick={() => setChosen(i)}
                className={`min-h-10 border px-3 ${o === option ? "border-ink bg-ink text-raised" : "border-line"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-4" aria-live="polite">
        {option.allowed ? (
          <p className="font-semibold">The simulator allows this.</p>
        ) : (
          <div>
            <p className="font-semibold text-machine">The simulator blocks this.</p>
            <ul className="mt-1 list-disc pl-5">
              {option.reasons.map((r) => <li key={r}>{plain(r)}</li>)}
            </ul>
          </div>
        )}
        {warnings.map((w) => <p key={w} className="mt-1 text-ink-2">{plain(w)}</p>)}

        {option.proposed && (
          <table className="mt-2 w-full max-w-xl text-left">
            <thead className="text-[13px] text-ink-2">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">Simulated result</th>
                <th className="py-1 text-right font-medium">As it is now</th>
                <th className="py-1 text-right font-medium">With this action</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key} className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                  <td className="py-1">{r.label}</td>
                  <td className="py-1 text-right">{r.show(state.now[r.key])}</td>
                  <td className="py-1 text-right font-semibold">{r.show(option.proposed![r.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {option.costEur !== null && option.costEur > 0 && (
          <p className="mt-2 text-ink-2">
            Illustrative cost {option.costEur} EUR: {option.stopHours} h stopped, {option.labourHours} h labour, {option.partsEur} EUR parts.
          </p>
        )}
      </div>

      <details className="mt-3 text-[13px] text-ink-2">
        <summary className="cursor-pointer">What this simulation cannot tell you</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {index.caveats.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </details>
    </Shell>
  );
}
