"use client";

// Part 2 of .plans/welcome-landing-spec.md: one fictional site with 12 pumps in four zones. Scrolling runs `hour` from
// 0 to the shift, and each pump's light follows the same rule as Today. Clicking a pump comes in part 3.
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { clock } from "@/lib/labels";
import { pumpName } from "@/lib/plain";
import { siteAt, TEST_PUMPS, ZONES, type Light } from "@/lib/sitemap";

const W = 800;
const H = 520;
const GAP = 20;

// Two columns, two rows. The left column is wider because it holds the zones with the most pumps.
const BOXES: Record<string, { x: number; y: number; w: number; h: number }> = {
  sw: { x: 0, y: 0, w: 520, h: (H - GAP) / 2 },
  fw: { x: 520 + GAP, y: 0, w: W - 520 - GAP, h: (H - GAP) / 2 },
  cw: { x: 0, y: (H + GAP) / 2, w: 520, h: (H - GAP) / 2 },
  pw: { x: 520 + GAP, y: (H + GAP) / 2, w: W - 520 - GAP, h: (H - GAP) / 2 },
};

const LIGHT_WORDS: Record<Light, string> = {
  red: "needs you today",
  orange: "check the reading",
  green: "normal or can wait",
  none: "test pump, no data yet",
};

/** Counts up or down to `value` over a quarter of a second. */
function Count({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / 250);
      setShown(Math.round(a + (value - a) * k));
      if (k < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}

function Stat({ value, label, swatch }: { value: number; label: string; swatch?: string }) {
  return (
    <div className="border-l border-mz-line px-4 first:border-l-0 first:pl-0">
      <p className="text-[28px] leading-none font-light tracking-[-0.02em] tabular-nums">
        <Count value={value} />
      </p>
      <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">
        {swatch && <span aria-hidden className={`site-swatch size-2 ${swatch}`} />}
        {label}
      </p>
    </div>
  );
}

export function SiteMap({ hour, shiftHour }: { hour: number; shiftHour: number }) {
  const { fleet, alertsToShift, alertSource, decisions, record, pumps } = useApp();
  const site = useMemo(
    () => siteAt(alertsToShift, hour, shiftHour, decisions, record, pumps),
    [alertsToShift, hour, shiftHour, decisions, record, pumps],
  );

  if (!fleet) return <p className="text-mz-muted">Loading pump data</p>;

  const atShift = site.hour === shiftHour;
  const summary = ZONES.flatMap((z) => z.pumps)
    .filter((id) => site.lights[id] === "red" || site.lights[id] === "orange")
    .map((id) => `${pumpName(id)} ${LIGHT_WORDS[site.lights[id]]}`);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <p className="font-mono text-[22px] leading-none tracking-[-0.01em] tabular-nums">{clock(site.hour)}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mz-muted">
          {atShift ? "Evening shift · as on Today" : "Scroll to run the week"}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 block w-full"
        role="img"
        aria-label={`Site map at ${clock(site.hour)}. ${summary.length ? summary.join(". ") : "All live pumps normal"}. Fictional layout.`}
      >
        {ZONES.map((zone) => {
          const b = BOXES[zone.id];
          const header = b.y + b.h - 44;
          const n = zone.pumps.length;
          const xs = zone.pumps.map((_, i) => b.x + ((i + 0.5) * b.w) / n);
          return (
            <g key={zone.id}>
              <rect x={b.x + 0.5} y={b.y + 0.5} width={b.w - 1} height={b.h - 1} className="site-zone" />
              <text x={b.x + 16} y={b.y + 28} className="site-zone-label">
                {zone.label.toUpperCase()} &middot; {n}
              </text>
              {/* Supply header the pumps feed into. */}
              <line x1={b.x + 24} x2={b.x + b.w - 24} y1={header} y2={header} className="site-pipe" />
              <text x={b.x + b.w - 24} y={header + 18} textAnchor="end" className="site-zone-label">
                HEADER
              </text>
              {zone.pumps.map((id, i) => {
                const x = xs[i];
                const y = b.y + 112;
                const light = site.lights[id];
                const test = TEST_PUMPS.has(id);
                return (
                  <g key={id} className={test ? "site-test" : undefined}>
                    <line x1={x} x2={x} y1={test ? y + 46 : y + 14} y2={header} className="site-pipe" />
                    <text x={x} y={y - 28} textAnchor="middle" className="site-name">
                      {pumpName(id)}
                    </text>
                    {test ? (
                      <>
                        <circle cx={x} cy={y} r={9} className="site-light-empty" />
                        <text x={x} y={y + 32} textAnchor="middle" className="site-zone-label">
                          NO DATA
                        </text>
                      </>
                    ) : (
                      <>
                        <circle cx={x} cy={y} r={17} className={`site-halo site-${light}`} />
                        {/* Keyed on the colour, so the ring replays whenever the light changes. */}
                        {(light === "red" || light === "orange") && <circle key={light} cx={x} cy={y} r={10} className={`site-burst site-${light}`} />}
                        <circle cx={x} cy={y} r={9} className={`site-light site-${light}`} />
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">
        {(["red", "orange", "green", "none"] as Light[]).map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span aria-hidden className={`site-swatch size-2 ${l === "none" ? "site-swatch-empty" : `site-${l}`}`} />
            {LIGHT_WORDS[l]}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-4 border-t border-mz-line pt-4">
        <Stat value={site.alerts} label="Alerts so far" />
        <Stat value={site.red} label="Need you" swatch="site-red" />
        <Stat value={site.orange} label="Check reading" swatch="site-orange" />
        <Stat value={site.alarms} label="Plant alarms" />
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-mz-muted">
        Fictional layout &middot; alerts from {alertSource}
      </p>
    </div>
  );
}
