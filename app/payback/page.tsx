"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE, breakEvenDowntime, breakEvenFalseAlerts, evaluate, SWINGS, type Inputs } from "@/lib/payback";
import { loadScorecard, type Scorecard } from "@/lib/review-data";

const eur = (v: number) => `${v < 0 ? "-" : ""}EUR ${Math.abs(Math.round(v)).toLocaleString("en-GB")}`;
const years = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)} years` : "Never");

type Field = { key: keyof Inputs; label: string; min: number; max: number; step: number; show: (v: number) => string; basis: string };

const MEASURED: Field[] = [
  { key: "recall", label: "Share of faults caught", min: 0, max: 1, step: 0.01, show: (v) => `${Math.round(v * 100)} %`, basis: "Measured" },
  { key: "falsePerPumpDay", label: "False and excess alerts per pump per day", min: 0, max: 0.5, step: 0.005, show: (v) => v.toFixed(3), basis: "Measured" },
];

const ASSUMED: Field[] = [
  { key: "faultsPerYear", label: "Developing faults per year", min: 0, max: 2, step: 0.1, show: (v) => v.toFixed(1), basis: "Faults that would otherwise end in an unplanned stop" },
  { key: "downtimeEurH", label: "Downtime cost per hour", min: 0, max: 5000, step: 50, show: eur, basis: "Mid-size process line with no spare pump" },
  { key: "unplannedStopH", label: "Unplanned stop", min: 1, max: 48, step: 1, show: (v) => `${v} h`, basis: "Failure, diagnosis, parts and repair" },
  { key: "plannedStopH", label: "Planned stop", min: 0, max: 24, step: 1, show: (v) => `${v} h`, basis: "Same work, prepared in a planned window" },
  { key: "repairUnplannedEur", label: "Unplanned repair", min: 0, max: 20000, step: 500, show: eur, basis: "Within a typical small or medium pump overhaul" },
  { key: "repairPlannedEur", label: "Planned repair", min: 0, max: 20000, step: 500, show: eur, basis: "Damage limited when caught early" },
  { key: "falseAlertEur", label: "Checking one false alert", min: 0, max: 300, step: 10, show: eur, basis: "About 1.5 h of technician or operator time" },
  { key: "installedEur", label: "Installed cost", min: 1000, max: 15000, step: 100, show: eur, basis: "Hardware option B plus cabling and installation" },
  { key: "operatingEurYear", label: "Operating cost per year", min: 0, max: 3000, step: 50, show: eur, basis: "Connectivity, software upkeep, batteries" },
];

function Slider({ field, value, set }: { field: Field; value: number; set: (v: number) => void }) {
  return (
    <div>
      <label className="flex items-baseline justify-between gap-3">
        <span>{field.label}</span>
        <span className="font-semibold">{field.show(value)}</span>
      </label>
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={field.label}
        aria-valuetext={field.show(value)}
        className="block w-full"
      />
      <p className="text-[13px] text-ink-3">{field.basis}</p>
    </div>
  );
}

export default function PaybackPage() {
  const [card, setCard] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Inputs>(BASE);
  const [preset, setPreset] = useState("all");

  useEffect(() => {
    loadScorecard()
      .then((c) => {
        const all = c.totals.current.all;
        setCard(c);
        setInputs({ ...BASE, recall: all.event_recall, falsePerPumpDay: all.false_alerts_per_asset_day });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const result = useMemo(() => evaluate(inputs), [inputs]);
  const maxFalse = useMemo(() => breakEvenFalseAlerts(inputs), [inputs]);
  const neededDowntime = useMemo(() => breakEvenDowntime(inputs), [inputs]);

  if (error) return <p className="p-6">{error}. Run tools/build_ui_data.py, then reload.</p>;
  if (!card) return <p className="p-6 text-ink-2">Loading the measured results</p>;

  const { all, validation } = card.totals.current;
  const PRESETS = [
    {
      id: "all",
      label: "All labelled pumps",
      note: `Process line with no spare pump. Measured on all ${all.events_scored} scored faults.`,
      values: { ...BASE, recall: all.event_recall, falsePerPumpDay: all.false_alerts_per_asset_day },
    },
    {
      id: "validation",
      label: "Validation pumps only",
      note: `The organizers' worked example. Only ${validation.events_scored} scored faults on 2 pumps, so it flatters the result.`,
      values: { ...BASE },
    },
    {
      id: "standby",
      label: "Ship pump with a standby",
      note: "A healthy standby makes downtime cost about zero, with 0.3 faults per year.",
      values: { ...BASE, recall: all.event_recall, falsePerPumpDay: all.false_alerts_per_asset_day, downtimeEurH: 0, faultsPerYear: 0.3 },
    },
  ];
  const active = PRESETS.find((p) => p.id === preset);
  const set = (key: keyof Inputs) => (v: number) => {
    setInputs({ ...inputs, [key]: v });
    setPreset("custom");
  };
  const loses = result.net <= 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <header className="max-w-3xl">
        <h1 className="font-cond text-3xl font-semibold">Would this pay back on one pump?</h1>
        <p className="font-medium">Illustrative only, not a realised or expected saving.</p>
        <p className="text-ink-2">
          Every input is an assumption or a benchmark result on simulated data. Change them to match a real site. Measured values come from the {card.alertSource}, a placeholder until the team&rsquo;s detector is connected.
        </p>
      </header>

      <div>
        <div role="group" aria-label="Starting point" className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === preset}
              onClick={() => {
                setInputs(p.values);
                setPreset(p.id);
              }}
              className={`min-h-10 border px-3 ${p.id === preset ? "border-ink bg-ink text-raised" : "border-line bg-raised"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[13px] text-ink-2">{active ? active.note : "Your own values."}</p>
      </div>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="result" className="order-1 lg:order-2">
          <div className="border border-line bg-raised p-4 lg:sticky lg:top-4" aria-live="polite">
            <h2 id="result" className="text-[13px] text-ink-2">Simple payback</h2>
            <p className={`font-cond text-4xl font-semibold ${loses ? "text-machine" : ""}`}>{years(result.paybackYears)}</p>
            <table className="mt-3 w-full">
              <tbody>
                <tr><td className="py-0.5">Avoided downtime and repair</td><td className="text-right">{eur(result.benefit)}</td></tr>
                <tr><td className="py-0.5">Checking false alerts</td><td className="text-right">{eur(-result.falseAlertCost)}</td></tr>
                <tr><td className="py-0.5">Operating cost</td><td className="text-right">{eur(-inputs.operatingEurYear)}</td></tr>
                <tr className="border-t border-line font-semibold"><td className="py-1">Net effect per year</td><td className="text-right">{eur(result.net)}</td></tr>
              </tbody>
            </table>
            <p className="mt-3">
              {loses
                ? "At these inputs the system costs more per year than it saves."
                : `This stops paying above ${maxFalse.toFixed(2)} false alerts per pump per day. The current input is ${inputs.falsePerPumpDay.toFixed(2)}.`}
            </p>
            <p className="mt-1 text-[13px] text-ink-2">
              Faults caught per year: {result.caughtPerYear.toFixed(2)}. A 5-year payback needs downtime to cost at least {eur(neededDowntime)} per hour.
            </p>
          </div>
        </section>

        <section aria-label="Inputs" className="order-2 min-w-0 space-y-5 lg:order-1">
          <fieldset>
            <legend className="font-cond text-xl font-semibold">Measured from the alerts</legend>
            <div className="mt-1 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {MEASURED.map((f) => <Slider key={f.key} field={f} value={inputs[f.key]} set={set(f.key)} />)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-cond text-xl font-semibold">Assumptions to replace with site data</legend>
            <div className="mt-1 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {ASSUMED.map((f) => <Slider key={f.key} field={f} value={inputs[f.key]} set={set(f.key)} />)}
            </div>
          </fieldset>
        </section>
      </div>

      <section aria-labelledby="swing">
        <h2 id="swing" className="font-cond text-xl font-semibold">What moves the result most</h2>
        <p className="max-w-3xl text-ink-2">One input changed at a time, from your current values.</p>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full max-w-4xl min-w-[38rem] text-left">
            <thead className="text-[13px] text-ink-2">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">Input</th>
                <th className="py-1 text-right font-medium">Low</th>
                <th className="py-1 text-right font-medium">Net per year</th>
                <th className="py-1 text-right font-medium">High</th>
                <th className="py-1 text-right font-medium">Net per year</th>
              </tr>
            </thead>
            <tbody>
              {SWINGS.map((s) => {
                const low = evaluate({ ...inputs, [s.key]: s.low }).net;
                const high = evaluate({ ...inputs, [s.key]: s.high }).net;
                return (
                  <tr key={s.key} className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                    <td className="py-1">{s.label}</td>
                    <td className="py-1 text-right">{s.low.toLocaleString("en-GB")}</td>
                    <td className={`py-1 text-right ${low < 0 ? "font-semibold text-machine" : ""}`}>{eur(low)}</td>
                    <td className="py-1 text-right">{s.high.toLocaleString("en-GB")}</td>
                    <td className={`py-1 text-right ${high < 0 ? "font-semibold text-machine" : ""}`}>{eur(high)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-3xl text-[13px] text-ink-3">
          Installed cost changes payback time, not the yearly net effect. Method and assumptions come from the organizers&rsquo; business case example. Energy savings from drives are a separate lever and are not counted here.
        </p>
      </section>
    </div>
  );
}
