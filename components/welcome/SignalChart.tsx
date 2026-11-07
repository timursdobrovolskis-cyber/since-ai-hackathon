"use client";

// The reading behind a concern, against its expected band, with the alerts marked. Built on bklit-ui. The x axis
// shows the test week's day and hour, never a real date, and the rows stop at the shift (lib/signal.ts).
import { Band } from "@/components/charts/band";
import { Grid } from "@/components/charts/grid";
import { Line, LineChart } from "@/components/charts/line-chart";
import { ChartMarkers } from "@/components/charts/markers";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { useMemo } from "react";
import type { SignalRow } from "@/lib/signal";

type Props = {
  rows: SignalRow[];
  unit: string;
  /** Hours of the alerts in this concern, marked on the chart. */
  alertHours: number[];
  /** Change this to replay the drawing-in animation. */
  replayKey: string;
  aspectRatio?: string;
  axes?: boolean;
  /** Labels along the time axis. */
  ticks?: number;
};

/** The plot's margins with axes, so an overlay such as the replay cursor can line up with the plot area. */
export const AXES_MARGIN = { top: 28, right: 44, bottom: 32, left: 56 };

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

export function SignalChart({ rows, unit, alertHours, replayKey, aspectRatio = "2 / 1", axes = true, ticks = 4 }: Props) {
  // The chart's scale starts at zero for positive data, which flattens a reading into a thin line. Centring each
  // reading on its midpoint makes the scale fit the data. Axis labels and the tooltip add the midpoint back, so every
  // number shown is the real reading.
  const { data, mid } = useMemo(() => {
    const all = rows.flatMap((r) => [r.value, r.lo, r.hi]);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const centre = (lo + hi) / 2;
    return {
      mid: centre,
      data: rows.map((r) => ({ date: r.date, value: r.value - centre, lo: r.lo - centre, hi: r.hi - centre, raw: r.value, rawLo: r.lo, rawHi: r.hi })),
    };
  }, [rows]);
  const labels = useMemo(() => rows.map((r) => r.label), [rows]);
  const markers = useMemo(
    () =>
      alertHours
        .map((h) => rows.reduce((best, r) => (Math.abs(r.hour - h) < Math.abs(best.hour - h) ? r : best), rows[0]))
        .filter(Boolean)
        .map((r, i) => ({
          date: r.date,
          icon: <span className="font-mono text-[10px] font-medium">{i + 1}</span>,
          title: `Alert ${i + 1}`,
          description: r.label,
          color: "var(--mz-accent)",
        })),
    [alertHours, rows],
  );

  if (rows.length < 2) return <p className="p-6 text-center text-sm text-mz-muted">No reading recorded for this concern.</p>;

  return (
    <LineChart data={data} aspectRatio={aspectRatio} revealSignature={replayKey} margin={axes ? AXES_MARGIN : { top: 20, right: 8, bottom: 8, left: 8 }}>
      <Grid horizontal numTicksRows={4} />
      <Band upperKey="hi" lowerKey="lo" label="Expected" fill="var(--welcome-band)" fillOpacity={1} stroke="var(--welcome-band-edge)" strokeWidth={1} />
      <Line dataKey="value" stroke="var(--mz-accent)" strokeWidth={1.75} />
      {axes && <XAxis labels={labels} numTicks={ticks} />}
      {axes && <YAxis numTicks={4} formatValue={(v) => fmt(v + mid)} />}
      <ChartMarkers items={markers} size={20} />
      {/* A square ring, not a dot: the site uses no round shapes. */}
      <ChartTooltip
        dotVariant="ring"
        dotRadiusFraction={0}
        dotSize={4.5}
        showDatePill
        dateLabels={labels}
        rows={(p) => [
          { color: "var(--mz-accent)", label: "Reading", value: `${fmt(Number(p.raw))} ${unit}` },
          { color: "var(--welcome-band-edge)", label: "Expected", value: `${fmt(Number(p.rawLo))} to ${fmt(Number(p.rawHi))} ${unit}` },
        ]}
      />
    </LineChart>
  );
}
