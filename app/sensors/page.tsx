"use client";

import { useEffect, useState } from "react";
import { CaseMark } from "@/components/Marks";
import { faultLabel } from "@/lib/labels";
import { LEVELS, type LevelKey } from "@/lib/sensor-levels";
import type { EventClass } from "@/lib/types";

type Cell = { seen: number; total: number };
type Row = { eventClass: EventClass } & Record<LevelKey, Cell>;
type Visibility = { faults: Record<string, Row>; events: number };

const MACHINE_ORDER = ["BEARING_WEAR", "MISALIGNMENT", "IMBALANCE", "SUCTION_STRAINER_CLOGGING", "CAVITATION", "DISCHARGE_RESTRICTION", "IMPELLER_WEAR", "AIR_ENTRAINMENT"];
const SENSOR_ORDER = ["SENSOR_DRIFT", "SENSOR_STUCK", "SENSOR_CALIBRATION_SHIFT", "SENSOR_NOISE_SPIKES", "COMMUNICATION_LOSS"];

function CellText({ cell }: { cell: Cell }) {
  if (cell.total === 0) return <span className="text-ink-3">No such sensor</span>;
  if (cell.seen === 0) return <span className="font-semibold text-machine">None of {cell.total}</span>;
  return <span>{cell.seen === cell.total ? `All ${cell.total}` : `${cell.seen} of ${cell.total}`}</span>;
}

export default function SensorsPage() {
  const [data, setData] = useState<Visibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LevelKey>("T1_RETROFIT");

  useEffect(() => {
    fetch("/data/review/sensors.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the sensor comparison (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="p-6">{error}. Run tools/build_sensor_compare.py, then reload.</p>;
  if (!data) return <p className="p-6 text-ink-2">Loading the comparison</p>;

  const level = LEVELS.find((l) => l.key === selected)!;
  const rows = [...MACHINE_ORDER, ...SENSOR_ORDER].filter((f) => data.faults[f]);
  const visibleTypes = (key: LevelKey) => rows.filter((f) => data.faults[f][key].seen > 0).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <header className="max-w-3xl">
        <h1 className="font-cond text-3xl font-semibold">What each sensor level can see</h1>
        <p className="text-ink-2">
          Start with the signals a pump already has, and add sensors only where they change a decision. This shows what each step buys, and what stays hidden.
        </p>
      </header>

      <div role="group" aria-label="Choose a sensor level" className="flex flex-wrap gap-1">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            type="button"
            aria-pressed={l.key === selected}
            onClick={() => setSelected(l.key)}
            className={`min-h-14 min-w-44 flex-1 border px-3 py-1.5 text-left sm:flex-none ${l.key === selected ? "border-ink bg-ink text-raised" : "border-line bg-raised"}`}
          >
            <span className="block font-cond text-lg leading-tight font-semibold">{l.name}</span>
            <span className="text-[13px]">{l.total}, {visibleTypes(l.key)} of {rows.length} fault types</span>
          </button>
        ))}
      </div>

      <section aria-labelledby="level" className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        <div>
          <h2 id="level" className="font-cond text-xl font-semibold">{level.name}</h2>
          <p>{level.adds}</p>
          <h3 className="mt-3 font-medium">Can see</h3>
          <ul className="list-disc pl-5 text-ink-2">{level.sees.map((s) => <li key={s}>{s}</li>)}</ul>
          <h3 className="mt-3 font-medium">Cannot see</h3>
          <ul className="list-disc pl-5 text-ink-2">{level.cannotSee.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="min-w-0">
          <h3 className="font-cond text-xl font-semibold">Hardware for one pump: {level.total}</h3>
          <p className="text-[13px] text-ink-2">{level.totalNote}</p>
          <table className="mt-2 w-full text-left">
            <thead className="text-[13px] text-ink-2">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">Item</th>
                <th className="py-1 text-right font-medium">Price</th>
                <th className="py-1 pl-3 font-medium">Basis</th>
              </tr>
            </thead>
            <tbody>
              {level.parts.map((p) => (
                <tr key={p.item} className="border-b align-top" style={{ borderColor: "var(--line-soft)" }}>
                  <td className="py-1">{p.item}</td>
                  <td className="py-1 text-right whitespace-nowrap">{p.price}</td>
                  <td className="py-1 pl-3 text-[13px] whitespace-nowrap text-ink-2">{p.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[13px] text-ink-3">
            Before cabling, enclosure, installation, class or flag approvals and software. List prices seen 30 Oct 2026. Replace assumptions with real quotes. Not a vendor recommendation.
          </p>
        </div>
      </section>

      <section aria-labelledby="visibility">
        <h2 id="visibility" className="font-cond text-xl font-semibold">Which faults leave evidence at each level</h2>
        <p className="max-w-3xl text-ink-2">
          Out of {data.events} labelled faults. A level counts when it has a channel that carried the fault&rsquo;s earliest evidence, so this is about the sensors, not any detector, and it is a cautious count. Simulated data only.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[38rem] text-left">
            <thead className="text-[13px] text-ink-2">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">Fault</th>
                {LEVELS.map((l) => (
                  <th key={l.key} className={`px-2 py-1 font-medium ${l.key === selected ? "bg-raised text-ink" : ""}`}>{l.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const row = data.faults[f];
                return (
                  <tr key={f} className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                    <td className="py-1">
                      <span className="flex items-center gap-1.5"><CaseMark eventClass={row.eventClass} size={12} />{faultLabel(f)}</span>
                    </td>
                    {LEVELS.map((l) => (
                      <td key={l.key} className={`px-2 py-1 ${l.key === selected ? "bg-raised" : ""}`}><CellText cell={row[l.key]} /></td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-3xl text-[13px] text-ink-3">
          Totals differ across a row for two reasons. A sensor fault is left out where that instrument would not exist. A fault a legacy pump could not reveal counts as not seen at that level, and is left out above it, where the labels say nothing about it.
        </p>
      </section>

      <section aria-labelledby="transfer" className="max-w-3xl">
        <h2 id="transfer" className="font-cond text-xl font-semibold">Using this on other rotating machines</h2>
        <p className="text-ink-2">
          Start with what the drive or motor starter already knows. Add one vibration and temperature point for each critical bearing. Add process measurements only where they would change a decision.
        </p>
      </section>
    </div>
  );
}
