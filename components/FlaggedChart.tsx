"use client";

import { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import { flaggedOverTime } from "@/lib/overview";
import { useApp } from "./AppProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Canvas cannot read CSS variables, so resolve the mono stack before handing it to uPlot.
const axisFont = () => `12px ${css("--font-mono") || "monospace"}`;
const HEIGHT = 300;

export function FlaggedChart() {
  const { cases, pumps, hour } = useApp();
  const list = useMemo(() => Object.values(pumps), [pumps]);
  const total = list.length;
  const series = flaggedOverTime(cases, list, hour);
  const data = useRef<uPlot.AlignedData>([series.hours, series.ours, series.alarms]);
  data.current = [series.hours, series.ours, series.alarms];
  const box = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const hourRef = useRef(hour);
  hourRef.current = hour;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const grid = { stroke: css("--line-soft"), width: 1 };
    const step = uPlot.paths.stepped?.({ align: 1 });
    const u = new uPlot(
      {
        width: el.clientWidth,
        height: HEIGHT,
        padding: [8, 12, 0, 0],
        scales: { x: { time: false, range: [0, 168] }, y: { range: [0, total] } },
        legend: { show: false },
        cursor: { y: false, drag: { x: false, y: false } },
        axes: [
          { stroke: css("--ink-3"), grid, ticks: { show: false }, splits: () => [0, 24, 48, 72, 96, 120, 144], values: (_u, s) => s.map((h) => `Day ${h / 24 + 1}`), font: axisFont(), size: 24 },
          { stroke: css("--ink-3"), grid, ticks: { show: false }, incrs: [1, 3], font: axisFont(), size: 28 },
        ],
        series: [
          {},
          { stroke: css("--ink"), width: 2.5, paths: step, spanGaps: false, points: { show: false } },
          { stroke: css("--ink-3"), width: 2, dash: [5, 4], paths: step, spanGaps: false, points: { show: false } },
        ],
        hooks: {
          draw: [
            (p) => {
              const { ctx, bbox } = p;
              const x = Math.round(p.valToPos(hourRef.current, "x", true));
              ctx.save();
              ctx.strokeStyle = css("--cursor");
              ctx.lineWidth = uPlot.pxRatio;
              ctx.beginPath();
              ctx.moveTo(x, bbox.top);
              ctx.lineTo(x, bbox.top + bbox.height);
              ctx.stroke();
              ctx.restore();
            },
          ],
        },
      },
      data.current,
      el,
    );
    plot.current = u;
    const resize = new ResizeObserver(() => u.setSize({ width: el.clientWidth, height: HEIGHT }));
    resize.observe(el);
    return () => {
      resize.disconnect();
      u.destroy();
      plot.current = null;
    };
  }, [total]);

  useEffect(() => {
    plot.current?.setData(data.current);
  }, [hour, cases]);

  const ours = series.ours[Math.floor(Math.min(hour, 168))] ?? 0;
  const alarms = series.alarms[Math.floor(Math.min(hour, 168))] ?? 0;

  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle>Which pumps got flagged, and by what</CardTitle>
        <CardDescription>Flagged is not the same as faulty. Review shows which alerts were right.</CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={box} className="overflow-hidden" role="img" aria-label={`Pumps flagged so far: ${ours} of ${total} by alerts, ${alarms} of ${total} by plant alarms`} />
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
          <div className="flex items-center gap-2"><span aria-hidden className="h-0.5 w-5 bg-ink" /><dt>Alerts</dt><dd className="font-semibold text-ink">{ours} of {total} pumps</dd></div>
          <div className="flex items-center gap-2"><span aria-hidden className="w-5 border-t-2 border-dashed border-[var(--ink-3)]" /><dt>Plant alarms</dt><dd className="font-semibold text-ink">{alarms} of {total} pumps</dd></div>
        </dl>
      </CardContent>
    </Card>
  );
}
