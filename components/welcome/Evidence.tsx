"use client";

// The evidence chart on a pump card, with two ways to look closer. Any reading under "Readings now" can be shown here
// over the same hours (PumpCard passes the one pointed at or picked). "Replay the warning" sweeps a cursor through
// those hours up to the shift, reading out each value against its normal band and marking each alert as it passes,
// then says when the reading first left its band and how long before this shift the first alert came. Everything
// comes from the recorded readings and alerts up to the shift (lib/signal.ts), nothing is predicted.
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clock } from "@/lib/labels";
import { concernWindow, signalRows, type SignalRow } from "@/lib/signal";
import type { PumpData } from "@/lib/types";
import type { Concern } from "./concerns";
import { AXES_MARGIN, SignalChart } from "./SignalChart";

const REPLAY_MS = 6000;
const num = (v: number) =>
  Math.abs(v) >= 100
    ? v.toFixed(0)
    : Math.abs(v) >= 10
      ? v.toFixed(1)
      : v.toFixed(2);
const outside = (r: SignalRow) =>
  r.hi > r.lo && (r.value < r.lo || r.value > r.hi);
const hoursWords = (h: number) =>
  h < 1
    ? "less than an hour"
    : `${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"}`;

type Props = {
  c: Concern;
  pump: PumpData;
  meta: Record<string, { label: string; unit?: string }>;
  shiftHour: number;
  /** The reading to show. The concern's own reading when it is the same or null. */
  channel: string | null;
  onBack: () => void;
};

export function Evidence({ c, pump, meta, shiftHour, channel, onBack }: Props) {
  const ch = channel ?? c.channel;
  const own = !ch || ch === c.channel;
  const rows = useMemo(() => {
    if (own || !ch) return c.rows;
    const w = concernWindow(c.lead.first.offset_hours, shiftHour);
    return signalRows(pump, ch, w.from, w.to, shiftHour);
  }, [own, ch, c, pump, shiftHour]);
  const label = own ? c.channelLabel : (meta[ch!]?.label ?? ch!);
  const unit = own ? c.unit : (meta[ch!]?.unit ?? "");

  // Replay: t runs 0 to 1 while playing, and `done` holds the closing summary once it ends.
  const [t, setT] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const raf = useRef(0);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    setT(null);
  };
  useEffect(() => {
    // A different reading or pump starts fresh.
    cancelAnimationFrame(raf.current);
    setT(null); // eslint-disable-line react-hooks/set-state-in-effect -- resetting the replay when the reading changes
    setDone(false);
  }, [ch, c.id]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const play = () => {
    if (t !== null) return stop();
    setDone(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return setDone(true);
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / REPLAY_MS);
      setT(k);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else {
        setT(null);
        setDone(true);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const first = rows[0]?.hour ?? 0;
  const last = rows[rows.length - 1]?.hour ?? 1;
  const at =
    t === null
      ? null
      : rows[Math.min(rows.length - 1, Math.round(t * (rows.length - 1)))];
  const passed = at ? c.alertHours.filter((h) => h <= at.hour + 1e-6) : [];
  const leftBand = rows.find(outside);
  const firstAlert = c.alertHours[0];

  // The cursor's place across the plot area, in pixels from the chart box's left edge.
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const x = at
    ? AXES_MARGIN.left +
      ((at.hour - first) / Math.max(1e-6, last - first)) *
        Math.max(0, w - AXES_MARGIN.left - AXES_MARGIN.right)
    : 0;

  return (
    <>
      <div ref={box} className="relative mt-3 bg-mz-panel px-1 pt-1">
        <SignalChart
          rows={rows}
          unit={unit}
          alertHours={c.alertHours}
          replayKey={`card-${c.id}-${ch}`}
          aspectRatio="2.8 / 1"
          ticks={3}
        />
        {at && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute bg-mz-panel/90"
              style={{
                left: x + 4,
                right: AXES_MARGIN.right - 4,
                top: AXES_MARGIN.top,
                bottom: AXES_MARGIN.bottom,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute w-px bg-mz-ink"
              style={{
                left: x + 4,
                top: AXES_MARGIN.top - 6,
                bottom: AXES_MARGIN.bottom,
              }}
            />
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {rows.length > 1 && (
          <button
            type="button"
            onClick={play}
            className="press inline-flex min-h-10 items-center gap-1.5 px-3 text-[14px] font-medium shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)] transition-colors hover:shadow-[inset_0_0_0_1px_var(--mz-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent"
          >
            {t === null ? (
              <Play aria-hidden className="size-3.5" strokeWidth={2} />
            ) : (
              <Pause aria-hidden className="size-3.5" strokeWidth={2} />
            )}
            {t === null ? "Replay the warning" : "Stop"}
          </button>
        )}
        {at ? (
          <p aria-hidden className="font-mono text-[12.5px] tabular-nums">
            {at.label}: {num(at.value)} {unit}
            {at.hi > at.lo && (
              <span
                className={
                  outside(at) ? "font-medium text-[#b42318]" : "text-mz-muted"
                }
              >
                {outside(at)
                  ? at.value < at.lo
                    ? ", below normal"
                    : ", above normal"
                  : ", normal"}
              </span>
            )}
            {passed.length > 0 && (
              <span className="text-mz-accent">
                . Alert {passed.length} raised
              </span>
            )}
          </p>
        ) : (
          <p className="text-[12.5px] text-mz-muted">
            {label} up to now. The grey band is normal for this pump at its
            speed.
            {!own && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onBack}
                  className="text-mz-accent underline-offset-4 hover:underline"
                >
                  Back to {c.channelLabel.toLowerCase()}
                </button>
              </>
            )}
          </p>
        )}
      </div>

      <p role="status" className="mt-2 text-[14px] leading-snug empty:hidden">
        {done &&
          [
            leftBand
              ? leftBand === rows[0]
                ? `${label} was already outside its normal band at the start of this chart, ${rows[0].label}.`
                : `${label} first left its normal band at ${leftBand.label}.`
              : `${label} stayed inside its normal band on this chart.`,
            firstAlert !== undefined
              ? `The first alert came at ${clock(firstAlert)}, ${hoursWords(shiftHour - firstAlert)} before this shift.`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
      </p>
    </>
  );
}
