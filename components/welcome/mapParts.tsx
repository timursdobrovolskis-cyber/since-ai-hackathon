"use client";

// Shared by the site map alternatives: one row of facts per pump at the map's hour, a heading whose sentence counts up
// as the week runs, and the props every alternative takes.
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { clock } from "@/lib/labels";
import { PLAIN, pumpName } from "@/lib/plain";
import { TEST_PUMPS, ZONES, type Light, type SiteState } from "@/lib/sitemap";
import { useConcerns } from "./concerns";

export type MapProps = {
  site: SiteState;
  shiftHour: number;
  /** False while the map is still too faint to use: pumps then take no clicks and no keyboard focus. */
  ready: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
};

export type Status = "needs" | "check" | "wait" | "normal" | "nodata";

export const STATUS_WORD: Record<Status, string> = {
  needs: "Needs you",
  check: "Check reading",
  wait: "Can wait",
  normal: "Normal",
  nodata: "No data yet",
};

export type PumpRow = {
  id: string;
  name: string;
  zone: string;
  light: Light;
  status: Status;
  /** What is wrong, in a few words, or null when nothing is. */
  fault: string | null;
  /** Whole hours since the first alert of the leading concern. */
  since: number | null;
  /** Every alert on the pump up to the map's hour. */
  alertHours: number[];
  /** When the leading concern started, for the timeline. */
  from: number | null;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function usePumpRows(site: SiteState): PumpRow[] {
  const { alertsToShift } = useApp();
  const withLine = useMemo(() => ZONES.flatMap((z) => z.pumps).filter((id) => site.lines[id]), [site]);
  const concerns = useConcerns(site, withLine);
  return useMemo(() => {
    const byId = Object.fromEntries(concerns.map((c) => [c.id, c]));
    return ZONES.flatMap((z) =>
      z.pumps.map((id) => {
        const c = byId[id];
        const light = site.lights[id];
        const status: Status = TEST_PUMPS.has(id) ? "nodata" : light === "red" ? "needs" : light === "orange" ? "check" : c ? "wait" : "normal";
        const short = c ? PLAIN[c.lead.faultType]?.short : undefined;
        // Sensor problems name the reading, because "reading looks wrong" alone does not say which one.
        const fault = c ? (c.lead.eventClass === "SENSOR" ? `${c.channelLabel} ${short?.replace(/^reading /, "") ?? "reading"}` : cap(short ?? "needs a look")) : null;
        return {
          id,
          name: pumpName(id),
          zone: z.label,
          light,
          status,
          fault,
          since: c ? Math.max(0, Math.round(site.hour - c.lead.first.offset_hours)) : null,
          alertHours: alertsToShift.filter((a) => a.asset_id === id && a.offset_hours <= site.hour).map((a) => a.offset_hours),
          from: c ? c.lead.first.offset_hours : null,
        };
      }),
    );
  }, [concerns, site, alertsToShift]);
}

/** Counts to `value` over a quarter of a second, so figures tick as the week runs. */
export function Count({ value }: { value: number }) {
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
  return <span className="tabular-nums">{shown}</span>;
}

/** The heading over every alternative: the hour, and what it means in one sentence. */
export function MapHead({ site, shiftHour }: { site: SiteState; shiftHour: number }) {
  const atShift = site.hour === shiftHour;
  return (
    <div className="mb-5">
      <h2 className="text-[26px] leading-tight font-light tracking-[-0.025em]">
        The site at <span className="font-normal tabular-nums">{clock(site.hour)}</span>
      </h2>
      <p className="mt-1.5 text-[15px] leading-snug text-mz-muted">
        {site.alerts === 0 ? (
          "No alerts yet. Every pump with data is normal."
        ) : (
          <>
            <span className="text-mz-ink">
              <Count value={site.red} /> {site.red === 1 ? "pump needs" : "pumps need"} you
            </span>
            , <Count value={site.orange} /> {site.orange === 1 ? "reading" : "readings"} to check, from <Count value={site.alerts} /> alerts. Plant alarms so far:{" "}
            <Count value={site.alarms} />.
          </>
        )}
      </p>
      <p className="mt-1 text-[13px] text-mz-muted">{atShift ? "This is the evening shift, as on Today. Pick a pump for details." : "Keep scrolling to run the week to the evening shift."} The layout is fictional.</p>
    </div>
  );
}

/** Pick a pump with a click, Enter or Space, only once the map is visible. */
export function pickProps(id: string, { ready, selected, onSelect }: MapProps, label: string) {
  const pick = () => onSelect(selected === id ? null : id);
  return {
    "data-pump": id,
    role: "button",
    tabIndex: ready ? 0 : -1,
    "aria-pressed": selected === id,
    "aria-label": label,
    onClick: ready ? pick : undefined,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (ready && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        pick();
      }
    },
  } as const;
}
