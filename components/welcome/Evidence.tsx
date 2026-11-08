"use client";

// The evidence on a pump card (from the pump card readability spec):
//   one plain sentence per reading the alert names, worked out from the recorded rows up to the shift (lib/drift.ts)
//   one small chart per named reading, stacked on one time axis, each headed with its name, unit, value now and normal
//   range, and a legend for the band, the reading and the alerts
//   a reading pointed at or picked under "Readings now" adds one more chart below, with a button to remove it
//   "Replay the warning" sweeps a cursor through every chart together, reading out each value against its band
//   the detector's own words, in small print
// Everything comes from the recorded readings and alerts up to the shift. Nothing is predicted.
import { Pause, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { amount, describeDrift } from "@/lib/drift";
import { clock } from "@/lib/labels";
import { concernWindow, signalRows, type SignalRow } from "@/lib/signal";
import type { Alert, PumpData } from "@/lib/types";
import type { Concern } from "./concerns";
import { chartMargin, SignalChart } from "./SignalChart";

const REPLAY_MS = 6000;
const outside = (r: SignalRow) => r.hi > r.lo && (r.value < r.lo || r.value > r.hi);
const hoursWords = (h: number) => (h < 1 ? "less than an hour" : `${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"}`);
const stateWord = (r: SignalRow) => (r.hi <= r.lo ? "" : r.value < r.lo ? "below normal" : r.value > r.hi ? "above normal" : "normal");

type Meta = Record<string, { label: string; unit?: string }>;
type Series = { channel: string; label: string; unit: string; rows: SignalRow[]; extra: boolean };

type Props = {
  c: Concern;
  alert: Alert;
  pump: PumpData;
  meta: Meta;
  shiftHour: number;
  /** A reading to add below the named ones, pointed at or picked under "Readings now". */
  extra: string | null;
  onRemoveExtra: () => void;
};

/** The readings the alert names that this pump records, at most two, else the concern's own reading. */
export function namedChannels(alert: Alert, pump: PumpData, fallback: string | null) {
  const named = [...new Set((alert.evidence?.channels ?? []).map((x) => x.channel))].filter((ch) => pump.series[ch]).slice(0, 2);
  return named.length ? named : fallback ? [fallback] : [];
}

/** One chart with its heading. The replay cursor is drawn over it at `t` (0 to 1), when playing. */
function ChartBlock({ s, c, t, last, stacked, onRemove }: { s: Series; c: Concern; t: number | null; last: boolean; stacked: boolean; onRemove?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const end = s.rows[s.rows.length - 1];
  const first = s.rows[0]?.hour ?? 0;
  const span = Math.max(1e-6, (end?.hour ?? 1) - first);
  const at = t === null ? null : s.rows[Math.min(s.rows.length - 1, Math.round(t * (s.rows.length - 1)))];
  const m = chartMargin(last);
  const x = at ? m.left + ((at.hour - first) / span) * Math.max(0, w - m.left - m.right) : 0;
  const u = s.unit ? ` ${s.unit}` : "";

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-0.5 pb-1">
        <p className="text-[14px] font-medium">
          {s.label}
          {s.unit && <span className="font-normal text-mz-muted">, {s.unit}</span>}
        </p>
        <p className="flex items-baseline gap-3 text-[13px] tabular-nums">
          {end && (
            <span>
              Now <span className="font-medium">{amount(end.value)}{u}</span>
              {end.hi > end.lo && (
                <span className="text-mz-muted">
                  , normal {amount(end.lo)} to {amount(end.hi)}
                </span>
              )}
            </span>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} aria-label={`Remove the ${s.label.toLowerCase()} chart`} className="press -my-2 inline-flex size-8 items-center justify-center text-mz-muted hover:bg-mz-panel hover:text-mz-ink">
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </p>
      </div>
      <div ref={box} className="relative bg-mz-panel px-1 pt-1">
        <SignalChart rows={s.rows} unit={s.unit} alertHours={c.alertHours} replayKey={`card-${c.id}-${s.channel}`} aspectRatio={stacked ? "3.4 / 1" : "2.8 / 1"} ticks={3} xAxis={last} />
        {at && (
          <>
            <div aria-hidden className="pointer-events-none absolute bg-mz-panel/90" style={{ left: x + 4, right: m.right - 4, top: m.top, bottom: m.bottom }} />
            <div aria-hidden className="pointer-events-none absolute w-px bg-mz-ink" style={{ left: x + 4, top: m.top - 6, bottom: m.bottom }} />
          </>
        )}
      </div>
    </div>
  );
}

export function Evidence({ c, alert, pump, meta, shiftHour, extra, onRemoveExtra }: Props) {
  const named = useMemo(() => namedChannels(alert, pump, c.channel), [alert, pump, c.channel]);
  const series = useMemo<Series[]>(() => {
    const w = concernWindow(c.lead.first.offset_hours, shiftHour);
    const make = (ch: string, isExtra: boolean): Series => ({
      channel: ch,
      label: meta[ch]?.label ?? ch,
      unit: meta[ch]?.unit ?? "",
      rows: ch === c.channel ? c.rows : signalRows(pump, ch, w.from, w.to, shiftHour),
      extra: isExtra,
    });
    const list = named.map((ch) => make(ch, false));
    if (extra && !named.includes(extra) && pump.series[extra]) list.push(make(extra, true));
    return list.filter((s) => s.rows.length > 1);
  }, [named, extra, c, pump, meta, shiftHour]);
  const sentences = useMemo(
    () => series.filter((s) => !s.extra).map((s) => describeDrift(s.rows, s.label, s.unit)?.sentence).filter(Boolean) as string[],
    [series],
  );

  // Replay: t runs 0 to 1 while playing, and `done` shows the closing line once it ends.
  const [t, setT] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const raf = useRef(0);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    setT(null);
  };
  useEffect(() => {
    // A different pump starts fresh.
    cancelAnimationFrame(raf.current);
    setT(null); // eslint-disable-line react-hooks/set-state-in-effect -- resetting the replay when the pump changes
    setDone(false);
  }, [c.id]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const play = () => {
    if (t !== null) return stop();
    setDone(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setDone(true);
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

  const lead = series[0];
  const at = t === null || !lead ? null : lead.rows[Math.min(lead.rows.length - 1, Math.round(t * (lead.rows.length - 1)))];
  const passed = at ? c.alertHours.filter((h) => h <= at.hour + 1e-6).length : 0;
  const firstAlert = c.alertHours[0];
  const valueAt = (s: Series, hour: number) => s.rows.reduce((best, r) => (Math.abs(r.hour - hour) < Math.abs(best.hour - hour) ? r : best), s.rows[0]);

  if (!series.length) return <p className="text-[15px] text-mz-muted">No reading recorded for this alert.</p>;

  return (
    <>
      <div className="space-y-1.5">
        {sentences.map((s) => (
          <p key={s} className="text-[16px] leading-snug">
            {s}
          </p>
        ))}
      </div>

      {series.map((s, i) => (
        <ChartBlock key={s.channel} s={s} c={c} t={t} last={i === series.length - 1} stacked={series.length > 1} onRemove={s.extra ? onRemoveExtra : undefined} />
      ))}

      <ul aria-label="Chart key" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-mz-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 bg-[var(--welcome-band)] shadow-[inset_0_0_0_1px_var(--welcome-band-edge)]" />
          Normal for this pump at its speed
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 bg-mz-accent" />
          Reading
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 bg-mz-accent" />
          Alert
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={play}
          className="press inline-flex min-h-10 items-center gap-1.5 px-3 text-[14px] font-medium shadow-[inset_0_0_0_1px_rgb(11_16_20/0.25)] hover:shadow-[inset_0_0_0_1px_var(--mz-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent"
        >
          {t === null ? <Play aria-hidden className="size-3.5" strokeWidth={2} /> : <Pause aria-hidden className="size-3.5" strokeWidth={2} />}
          {t === null ? "Replay the warning" : "Stop"}
        </button>
        {at && (
          <p aria-hidden className="text-[13px] tabular-nums">
            <span className="font-medium">{at.label}</span>
            {series.map((s) => {
              const r = valueAt(s, at.hour);
              const off = outside(r);
              return (
                <span key={s.channel} className="ml-2">
                  {s.label} {amount(r.value)}
                  {s.unit ? ` ${s.unit}` : ""}
                  <span className={off ? "font-medium text-[#b42318]" : "text-mz-muted"}>{stateWord(r) ? `, ${stateWord(r)}` : ""}</span>.
                </span>
              );
            })}
            {passed > 0 && <span className="text-mz-accent"> Alert {passed} raised.</span>}
          </p>
        )}
      </div>
      <p role="status" className="mt-2 text-[14px] leading-snug empty:hidden">
        {done && firstAlert !== undefined ? `The first alert came at ${clock(firstAlert)}, ${hoursWords(shiftHour - firstAlert)} before this shift.` : ""}
      </p>

    </>
  );
}
