"use client";

// What the alerts are worth to the crew, after the Results section:
//   Pump or sensor?  sensor faults sent to the sensor instead of the pump, and the pump stops that saved (totals only,
//                    from key-numbers.json, so nothing labelled loads on the main page)
//   Energy watch     each live pump against its best efficiency point up to the shift (energy.json), and which pumps
//                    are candidates for speed control
// Money uses the organizers' own business-case figures (lib/value.ts) or a stated electricity price. All illustrative.
import { useEffect, useState } from "react";
import { loadEnergy, type EnergyPump } from "@/lib/data";
import { pumpName } from "@/lib/plain";
import { euros, NEEDLESS_OPENING_EUR } from "@/lib/value";
import { useKeyNumbers } from "./Results";

// Fixed speed or valve throttled, from the organizers' assets file: the pumps a variable-speed drive would change most.
const SPEED_CONTROL_CANDIDATES = [
  { id: "PUMP-03", why: "fixed speed" },
  { id: "PUMP-05", why: "fixed speed" },
  { id: "PUMP-09", why: "fixed speed" },
  { id: "PUMP-06", why: "flow set by a control valve" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mz-muted">{children}</p>;
}

function useEnergy() {
  const [data, setData] = useState<{ priceEurKwh: number; pumps: EnergyPump[] } | null>(null);
  useEffect(() => {
    loadEnergy().then(setData).catch(() => {});
  }, []);
  return data;
}

export function CrewValue() {
  const k = useKeyNumbers();
  const energy = useEnergy();
  if (!k) return null;
  const sensorFaults = k.sensorFaults ?? 0;
  const saved = (k.sensorAsSensor ?? 0) * NEEDLESS_OPENING_EUR;
  const placed = energy?.pumps.filter((p) => p.method) ?? [];
  const blind = energy?.pumps.filter((p) => !p.method) ?? [];
  const maxEur = Math.max(1, ...placed.map((p) => p.eurYear ?? 0));

  return (
    <section id="value" aria-labelledby="value-title" className="bg-white px-5 py-20 sm:px-10 lg:px-16 lg:py-24">
      <h2 id="value-title" className="text-[36px] leading-[1.1] font-light tracking-[-0.03em] lg:text-[44px]">
        What it saves the crew
      </h2>
      <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-mz-muted">
        Two decisions the alerts change on board: whether to open a pump at all, and which pumps are worth fitting with speed control.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        {/* Pump or sensor? */}
        <div className="border-t border-mz-ink pt-6">
          <Label>01 · Pump or sensor?</Label>
          <p className="mt-4 text-[64px] leading-none font-light tracking-[-0.04em] tabular-nums">
            {k.sensorAsSensor ?? 0}
            <span className="ml-2 text-[24px] tracking-normal text-mz-muted">of {sensorFaults}</span>
          </p>
          <p className="mt-3 max-w-[38ch] text-[17px] leading-snug">
            sensor faults sent to <b className="font-medium">the sensor, not the pump</b>. None sent to the pump by mistake.
          </p>
          <div className="mt-8 grid grid-cols-2 border-t border-mz-line pt-5">
            <div>
              <p className="text-[28px] leading-none font-light tabular-nums">{k.sensorAsMachine ?? 0}</p>
              <p className="mt-2 text-[13px] leading-snug text-mz-muted">pumps opened for a lying sensor</p>
            </div>
            <div className="border-l border-mz-line pl-5">
              <p className="text-[28px] leading-none font-light tabular-nums">{euros(saved)}</p>
              <p className="mt-2 text-[13px] leading-snug text-mz-muted">of needless pump stops avoided, at least</p>
            </div>
          </div>
          <p className="mt-5 max-w-[48ch] text-[12.5px] leading-relaxed text-mz-muted">
            On the 9 pumps with known answers. Each avoided opening is counted as one planned stop of 3 h at {euros(1500)} an hour, the organizers&rsquo; figures, with no
            repair cost, so the total is a floor.
          </p>
        </div>

        {/* Energy watch */}
        <div className="border-t border-mz-ink pt-6">
          <Label>02 · Energy watch</Label>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-snug">
            The pumps run close to their best point: <b className="font-medium">under {euros(maxEur)} a year</b> is lost inside any one pump. The bigger saving is speed
            control on the pumps that don&rsquo;t have it.
          </p>
          {placed.length > 0 && (
            <table className="mt-6 w-full table-fixed border-collapse text-left text-[14px]">
              <thead>
                <tr className="text-[12.5px] text-mz-muted">
                  <th className="w-[22%] pb-2 font-normal">Pump</th>
                  <th className="w-[26%] pb-2 font-normal">Share of best flow</th>
                  <th className="w-[26%] pb-2 font-normal">Lost power</th>
                  <th className="w-[26%] pb-2 text-right font-normal">Per year</th>
                </tr>
              </thead>
              <tbody>
                {placed.map((p) => (
                  <tr key={p.id} className="border-t border-mz-line">
                    <td className="py-2.5">{pumpName(p.id)}</td>
                    <td className="py-2.5 tabular-nums">{Math.round((p.bepShare ?? 0) * 100)}%</td>
                    <td className="py-2.5 tabular-nums">
                      <span className="mr-2 inline-block h-1.5 bg-mz-accent align-middle" style={{ width: `${Math.max(4, ((p.eurYear ?? 0) / maxEur) * 72)}px` }} />
                      {(p.wasteKw ?? 0).toFixed(1)} kW
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{euros(p.eurYear ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-6 grid gap-5 border-t border-mz-line pt-5 sm:grid-cols-2">
            <div>
              <p className="text-[13px] font-medium">Candidates for speed control</p>
              <ul className="mt-1.5 text-[13.5px] leading-relaxed">
                {SPEED_CONTROL_CANDIDATES.map((c) => (
                  <li key={c.id}>
                    {pumpName(c.id)} <span className="text-mz-muted">· {c.why}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mz-muted">
                Published cases report about $30,000 saved per vessel a year, payback under 14 months (vendor figures, quoted by the organizers).
              </p>
            </div>
            {blind.length > 0 && (
              <div>
                <p className="text-[13px] font-medium">Can&rsquo;t be checked yet</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed">
                  {blind.map((p) => pumpName(p.id)).join(" and ")} <span className="text-mz-muted">measure neither flow nor both pressures. One suction pressure sensor would place them on their curve.</span>
                </p>
              </div>
            )}
          </div>
          {energy && (
            <p className="mt-5 text-[12.5px] leading-relaxed text-mz-muted">
              Running hours up to the evening shift, each pump against its datasheet curve. Money at an assumed €{energy.priceEurKwh.toFixed(2)} per kWh.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
