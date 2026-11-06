"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import type { EventClass, Series } from "@/lib/types";

const LEARNING_HOURS = 24;

type Props = {
  label: string;
  unit: string;
  series: Series;
  stepMinutes: number;
  /** Replay position. Nothing after this hour is drawn. */
  hour: number;
  alertHours: number[];
  eventClass: EventClass;
  height?: number;
  /** The phone layout shows one trend chart. */
  phoneHidden?: boolean;
};

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Cut every array at the replay hour. The band also stays hidden while normal behaviour is still being learned. */
function slice(series: Series, stepMinutes: number, hour: number) {
  const n = series.obs.length;
  const x = Array.from({ length: n }, (_, i) => (i * stepMinutes) / 60);
  const lastIndex = Math.floor((hour * 60) / stepMinutes);
  const shown = (v: number | null, i: number) => (i <= lastIndex ? v : null);
  const band = (v: number | null, i: number) => (i <= lastIndex && x[i] >= LEARNING_HOURS ? v : null);
  const obs = series.obs.map(shown);
  const lo = (series.lo ?? []).map(band);
  const hi = (series.hi ?? []).map(band);
  const outside = obs.map((v, i) => {
    const l = lo[i];
    const h = hi[i];
    return v !== null && v !== undefined && l !== null && l !== undefined && h !== null && h !== undefined && (v < l || v > h) ? v : null;
  });
  return [x, lo.length ? lo : obs.map(() => null), hi.length ? hi : obs.map(() => null), obs, outside] as uPlot.AlignedData;
}

export function EvidenceChart({ label, unit, series, stepMinutes, hour, alertHours, eventClass, height = 150, phoneHidden = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const hourRef = useRef(hour);
  const alertsRef = useRef(alertHours);

  useEffect(() => {
    hourRef.current = hour;
    alertsRef.current = alertHours;
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const accent = css(eventClass === "SENSOR" ? "--sensor" : "--machine");
    const grid = { stroke: css("--line-soft"), width: 1 };
    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      padding: [8, 12, 0, 0],
      scales: { x: { time: false, range: [0, 168] } },
      legend: { show: false },
      cursor: { y: false, points: { size: 7 }, drag: { x: false, y: false } },
      axes: [
        {
          stroke: css("--ink-3"),
          grid,
          ticks: { show: false },
          splits: () => [0, 24, 48, 72, 96, 120, 144],
          values: (_u, splits) => splits.map((h) => `Day ${h / 24 + 1}`),
          font: "13px var(--font-barlow), sans-serif",
          size: 24,
        },
        { stroke: css("--ink-3"), grid, ticks: { show: false }, font: "13px var(--font-barlow), sans-serif", size: 52 },
      ],
      series: [
        {},
        // The band edges need real paths, because uPlot fills between them. They just stay unstroked.
        { stroke: "transparent", width: 0, spanGaps: false, points: { show: false } },
        { stroke: "transparent", width: 0, spanGaps: false, points: { show: false } },
        { stroke: css("--ink"), width: 2, spanGaps: false, points: { show: false } },
        { stroke: accent, width: 2.5, spanGaps: false, points: { show: true, size: 3, stroke: accent, fill: accent } },
      ],
      bands: [{ series: [2, 1], fill: css("--band") }],
      hooks: {
        draw: [
          (u) => {
            const { ctx } = u;
            const { top, height: h } = u.bbox;
            const ratio = uPlot.pxRatio;
            ctx.save();
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5 * ratio;
            ctx.setLineDash([4 * ratio, 3 * ratio]);
            for (const t of alertsRef.current) {
              if (t > hourRef.current) continue;
              const x = Math.round(u.valToPos(t, "x", true));
              ctx.beginPath();
              ctx.moveTo(x, top);
              ctx.lineTo(x, top + h);
              ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.strokeStyle = css("--cursor");
            ctx.lineWidth = ratio;
            const c = Math.round(u.valToPos(hourRef.current, "x", true));
            ctx.beginPath();
            ctx.moveTo(c, top);
            ctx.lineTo(c, top + h);
            ctx.stroke();
            ctx.restore();
          },
        ],
      },
    };
    const u = new uPlot(opts, slice(series, stepMinutes, hourRef.current), el);
    plot.current = u;
    const resize = new ResizeObserver(() => u.setSize({ width: el.clientWidth, height }));
    resize.observe(el);
    return () => {
      resize.disconnect();
      u.destroy();
      plot.current = null;
    };
  }, [series, stepMinutes, eventClass, height]);

  useEffect(() => {
    plot.current?.setData(slice(series, stepMinutes, hour));
  }, [series, stepMinutes, hour]);

  return (
    <figure className={`min-w-0 ${phoneHidden ? "hidden sm:block" : ""}`}>
      <figcaption className="text-[13px] font-medium text-ink-2">
        {label}{unit ? ` (${unit})` : ""}
      </figcaption>
      <div ref={box} className="overflow-hidden bg-raised" role="img" aria-label={`${label} over the week up to the replay time, against its expected band`} />
    </figure>
  );
}
