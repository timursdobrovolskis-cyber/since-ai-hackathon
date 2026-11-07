"use client";

// The pump card: opens from the alarm panel in place of the 3D pump, which flickers away. Laid out answer first
// (.plans/pump-card-readability-spec.md):
//   the top part: what's wrong (cause, Machine or Sensor, what it means in plain words, since when), what to do (the
//   detector's recommended check and the next stop), and the review
//   then the proof: state now, the evidence (plain sentences and stacked charts), every reading now on a range bar,
//   how sure (past record first, the raw score in small print) and the latest work from the log
// Everything comes from the data as the evening shift stands. The plain fault line is our own wording per fault type
// (lib/plain.ts), and the evidence sentences are worked out from the readings (lib/drift.ts).
// On phones it is a bottom sheet with two stops: it opens to the top part, and pulls up for the rest.
import { ChevronLeft, ChevronRight, Cog, Gauge, X } from "lucide-react";
import { animate, type AnimationPlaybackControls } from "motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { stateAt } from "@/lib/cases";
import { amount } from "@/lib/drift";
import { clock, faultLabel } from "@/lib/labels";
import { faultMeans, PLAIN, pumpName } from "@/lib/plain";
import { TEST_PUMPS, type SiteState } from "@/lib/sitemap";
import type { MaintenanceNote, PumpData } from "@/lib/types";
import { lastDone } from "@/lib/worker";
import { useConcern } from "./concerns";
import { Evidence, namedChannels } from "./Evidence";
import { LIGHT_WORDS } from "./mapParts";
import { PumpReview } from "./PumpReview";

const RUNNING: Record<string, string> = {
  RUNNING: "Running",
  STOPPED: "Stopped",
  LOCKED_OUT: "Locked out",
  STOPPING: "Stopping",
  NO_DATA: "No data arriving",
};

const TRUST_HEAD = { good: "Usually right", mixed: "Right about half the time", weak: "Often wrong", few: "Too few past cases to say" } as const;
const ago = (h: number) => (h < 36 ? `${Math.max(1, Math.round(h))} h ago` : `${Math.round(h / 24)} days ago`);
const words = (s: string) => s.charAt(0) + s.slice(1).replaceAll("_", " ").toLowerCase();
/** "Vessel A (RoPax, fictional)" becomes "Vessel A, RoPax". The footer already says the names are fictional. */
const siteWords = (site: string) => site.replace(/,? ?fictional/, "").replace(/ \((.+)\)$/, ", $1").replace(/ \(\)$/, "");

type Now = {
  channel: string;
  label: string;
  unit: string;
  value: number;
  lo: number | null;
  hi: number | null;
  state: "below" | "above" | "normal" | "noband";
};

/** Each reading's latest value at or before `hour`, against its normal band at that moment. */
function readingsAt(pump: PumpData, meta: Record<string, { label: string; unit?: string }>, hour: number): Now[] {
  const last = Math.floor((hour * 60) / pump.stepMinutes);
  return pump.channels
    .map((ch) => {
      const s = pump.series[ch];
      if (!s) return null;
      let i = Math.min(last, s.obs.length - 1);
      while (i >= 0 && (s.obs[i] === null || s.obs[i] === undefined)) i--;
      if (i < 0) return null;
      const value = s.obs[i] as number;
      const lo = s.lo?.[i] ?? null;
      const hi = s.hi?.[i] ?? null;
      const state: Now["state"] = lo === null || hi === null || hi <= lo ? "noband" : value < lo ? "below" : value > hi ? "above" : "normal";
      return { channel: ch, label: meta[ch]?.label ?? ch, unit: meta[ch]?.unit ?? "", value, lo, hi, state };
    })
    .filter((r): r is Now => r !== null);
}

/** How far a reading sits outside its band, in band widths. 0 inside the band. */
const offBy = (r: Now) => (r.lo === null || r.hi === null || r.hi <= r.lo ? 0 : Math.max(r.lo - r.value, r.value - r.hi, 0) / (r.hi - r.lo));
const ORDER: Record<Now["state"], number> = { above: 0, below: 0, normal: 1, noband: 2 };

/** The newest entry in the maintenance log at or before `hour`, from this week or before it. */
function latestWork(pump: PumpData, hour: number): MaintenanceNote | null {
  return [...pump.history, ...pump.maintenance].filter((m) => m.startHour <= hour).sort((a, b) => b.startHour - a.startHour)[0] ?? null;
}

function Section({ title, children, inner = false }: { title: string; children: React.ReactNode; inner?: boolean }) {
  return (
    <section className={inner ? "py-2.5 first:pt-0 last:pb-0 sm:py-3.5" : "border-t border-mz-line py-4"}>
      <h3 className="mb-1.5 text-[13px] text-mz-muted">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A reading's normal band as the middle third of a bar, with a square at the value. A value past either end pins
 * there with an arrow, and the number beside it says how far.
 */
function RangeBar({ r }: { r: Now }) {
  if (r.lo === null || r.hi === null || r.hi <= r.lo) return null;
  const w = r.hi - r.lo;
  const pos = (r.value - (r.lo - w)) / (3 * w);
  const past = pos < 0 ? "left" : pos > 1 ? "right" : null;
  const off = r.state === "above" || r.state === "below";
  return (
    <span aria-hidden className="relative mt-1.5 block h-2.5">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgb(11_16_20/0.22)]" />
      <span className="absolute inset-y-0 left-1/3 w-1/3 bg-[var(--welcome-band)] shadow-[inset_0_0_0_1px_var(--welcome-band-edge)]" />
      {past === "left" && <ChevronLeft className="absolute top-1/2 -left-1 size-3.5 -translate-y-1/2 text-[#b42318]" strokeWidth={2.5} />}
      {past === "right" && <ChevronRight className="absolute top-1/2 -right-1 size-3.5 -translate-y-1/2 text-[#b42318]" strokeWidth={2.5} />}
      {!past && <span className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 ${off ? "bg-[#b42318]" : "bg-mz-ink"}`} style={{ left: `${pos * 100}%` }} />}
    </span>
  );
}

/** True on phone widths, where the card is a bottom sheet. Matches the md breakpoint in the card's classes. */
function useSheet() {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setSheet(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return sheet;
}

/** Where a flick comes to rest, as in iOS scroll deceleration (Apple, Designing Fluid Interfaces). */
const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);
/** Past the top, the sheet follows the finger less and less. */
const rubber = (over: number, dim: number) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));

export function PumpCard({ id, site, onClose }: { id: string | null; site: SiteState; onClose: () => void }) {
  const { fleet, pumps, record } = useApp();
  const cardRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const sheet = useSheet();

  // Focus moves to the card when it opens, and Escape closes it. Closing hands focus back to the pump's window.
  const close = () => {
    const from = id;
    onClose();
    requestAnimationFrame(() => [...document.querySelectorAll<HTMLElement>(`[data-pump="${from}"]`)].find((n) => n.getClientRects().length > 0)?.focus());
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!id) return;
    cardRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  const open = id !== null;
  const meta = id ? fleet?.pumps.find((p) => p.id === id) : undefined;
  const pump = id ? pumps[id] : undefined;
  const light = id ? site.lights[id] : "none";
  const c = useConcern(site, id && (light === "red" || light === "orange") ? id : null);
  const waiting = id ? site.lines[id] : undefined;
  const channelMeta = useMemo(() => fleet?.channelMeta ?? {}, [fleet]);
  const now = useMemo(() => (pump ? readingsAt(pump, channelMeta, site.hour) : []), [pump, channelMeta, site.hour]);
  const sorted = useMemo(() => [...now].sort((a, b) => ORDER[a.state] - ORDER[b.state] || offBy(b) - offBy(a)), [now]);
  const running = pump ? stateAt(pump, site.hour) : null;
  const alert = c?.lead.latest;
  const cannot = pump ? Object.keys(channelMeta).filter((ch) => !pump.channels.includes(ch)).map((ch) => channelMeta[ch].label.toLowerCase()) : [];
  const related = c && pump ? lastDone(pump, PLAIN[c.lead.faultType]?.lastWork, site.hour) : null;
  const work = pump ? latestWork(pump, site.hour) : null;
  const sensor = c?.lead.eventClass === "SENSOR";
  const out = now.filter((r) => r.state === "below" || r.state === "above").length;
  const past = c ? record?.[c.lead.faultType] : undefined;
  const named = useMemo(() => (c && alert && pump ? namedChannels(alert, pump, c.channel) : []), [c, alert, pump]);

  // A reading pointed at or picked under "Readings now" is added to the evidence as one more chart.
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lastId, setLastId] = useState(id);
  if (lastId !== id) {
    setLastId(id);
    setHovered(null);
    setPinned(null);
    setExpanded(false);
  }
  const extra = hovered ?? pinned;

  // Phone sheet: two stops, the top part (collapsed) and full height (expanded). y is the sheet's offset down.
  const y = useRef(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const moving = useRef(false);
  const drag = useRef<{ start: number; y0: number; hist: [number, number][] } | null>(null);
  const setY = (v: number) => {
    y.current = v;
    if (cardRef.current) cardRef.current.style.transform = `translateY(${v}px)`;
  };
  const stops = useCallback(() => {
    const el = cardRef.current;
    const top = topRef.current;
    if (!el || !top) return { collapsed: 0, closed: 0 };
    const h = el.offsetHeight;
    const peek = top.offsetTop + top.offsetHeight + 16;
    return { collapsed: Math.max(0, h - peek), closed: h };
  }, []);
  const settle = useCallback(
    (to: number, velocity = 0, expand?: boolean) => {
      anim.current?.stop();
      setExpanded(expand ?? to === 0);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setY(to);
      // Critically damped, unless a flick carried momentum into it.
      moving.current = true;
      anim.current = animate(y.current, to, {
        type: "spring",
        bounce: Math.abs(velocity) > 400 ? 0.15 : 0,
        duration: 0.4,
        velocity,
        onUpdate: setY,
        onComplete: () => (moving.current = false),
      });
    },
    [],
  );

  // Opening on a phone: the sheet rises to the top part. On wider screens the card keeps its own CSS motion.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (!sheet) {
      anim.current?.stop();
      el.style.transform = "";
      return;
    }
    // Closing fades the sheet where it is.
    if (!id) return;
    const { collapsed, closed } = stops();
    setY(closed);
    settle(collapsed, 0, false);
  }, [sheet, id, stops, settle]);

  // The content settles after charts lay out, so keep the collapsed stop in step with it.
  useEffect(() => {
    const el = cardRef.current;
    if (!sheet || !id || !el) return;
    const ro = new ResizeObserver(() => {
      if (!drag.current && !expanded && !moving.current) setY(stops().collapsed);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheet, id, expanded, stops]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!sheet || (e.target as HTMLElement).closest("button, a, input, select, label")) return;
    anim.current?.stop();
    moving.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { start: e.clientY, y0: y.current, hist: [[performance.now(), y.current]] };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const raw = d.y0 + (e.clientY - d.start);
    const next = raw < 0 ? -rubber(-raw, window.innerHeight) : raw;
    setY(next);
    d.hist = [...d.hist.slice(-4), [performance.now(), next]];
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const [t0, y0] = d.hist[0];
    const [t1, y1] = d.hist[d.hist.length - 1];
    const v = t1 > t0 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0;
    const { collapsed, closed } = stops();
    const landing = y.current + project(v);
    const target = [0, collapsed, closed].reduce((best, s) => (Math.abs(s - landing) < Math.abs(best - landing) ? s : best), 0);
    if (target === closed && closed > collapsed) return close();
    settle(target, v);
  };
  // While collapsed, a swipe up or a scroll inside the sheet opens it fully.
  const touch = useRef(0);
  const expandFromGesture = () => sheet && !expanded && !drag.current && settle(0);

  return (
    <aside
      ref={cardRef}
      tabIndex={-1}
      aria-label={id ? `${pumpName(id)} details` : undefined}
      aria-hidden={!open}
      inert={!open}
      data-open={open}
      data-sheet={sheet || undefined}
      data-expanded={expanded || undefined}
      onTouchStart={(e) => (touch.current = e.touches[0].clientY)}
      onTouchMove={(e) => touch.current - e.touches[0].clientY > 12 && expandFromGesture()}
      onWheel={(e) => e.deltaY > 0 && expandFromGesture()}
      className="pump-card fixed inset-x-0 bottom-0 z-40 max-h-[90svh] overflow-y-auto bg-white px-5 pb-2 shadow-[0_-12px_40px_-16px_rgb(11_16_20/0.35)] outline-none md:absolute md:inset-x-auto md:top-24 md:right-10 md:bottom-24 md:left-1/2 md:z-auto md:ml-8 md:max-h-none md:pt-5 md:shadow-[0_0_0_1px_var(--mz-line),0_24px_48px_-28px_rgb(11_16_20/0.3)]"
    >
      {id && (
        <>
          <div ref={topRef}>
            {/* On a phone the header is also the grip: drag it to pull the sheet up, down, or away. */}
            <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="sheet-grip">
              <span aria-hidden className="mx-auto mt-2 mb-3 block h-1 w-10 bg-mz-line md:hidden" />
              <header className="flex items-start gap-3 pb-3 sm:pb-4">
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[24px] sm:text-[26px] leading-tight font-normal tracking-[-0.025em]">
                    {pumpName(id)}
                    <span className="flex items-center gap-1.5 text-[13px] tracking-normal text-mz-muted">
                      <span aria-hidden className={`size-2 ${light === "none" ? "site-swatch-empty" : `site-${light}`}`} />
                      {LIGHT_WORDS[light].charAt(0).toUpperCase() + LIGHT_WORDS[light].slice(1)}
                    </span>
                  </h2>
                  {meta && (
                    <div className="mt-1 text-[14px] leading-snug text-mz-muted">
                      <p>{meta.system}</p>
                      <p>
                        {siteWords(meta.site)}. {clock(site.hour)}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close and show the pump"
                  className="press -mt-1 -mr-1 inline-flex size-10 shrink-0 items-center justify-center text-mz-muted hover:bg-mz-panel hover:text-mz-ink focus-visible:outline-2 focus-visible:outline-mz-accent"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </header>
            </div>

            {TEST_PUMPS.has(id) ? (
              <Section title="Data">
                <p className="text-[15px] leading-snug">This is a test pump. The organizers hold its answers, so the app shows no data for it until the submission is frozen.</p>
              </Section>
            ) : (
              // The answer first: what's wrong, what to do, and the review.
              <div className="bg-mz-panel px-4 py-3.5 sm:py-4">
                <Section title="What's wrong" inner>
                  {c && alert ? (
                    <>
                      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[19px] leading-tight tracking-[-0.015em] sm:text-[21px]">
                        {faultLabel(c.lead.faultType)}
                        <span className="inline-flex shrink-0 items-center gap-1.5 bg-white px-2 py-0.5 text-[13px] tracking-normal shadow-[inset_0_0_0_1px_var(--mz-line)]">
                          {sensor ? <Gauge aria-hidden className="size-3.5" strokeWidth={1.75} /> : <Cog aria-hidden className="size-3.5" strokeWidth={1.75} />}
                          {sensor ? "Sensor" : "Machine"}
                        </span>
                      </p>
                      <p className="mt-1.5 max-w-[60ch] text-[15px] leading-snug">{faultMeans(c.lead.faultType)}</p>
                      {alert.evidence?.summary && (
                        <p className="mt-2 max-w-[60ch] text-[14px] leading-snug">
                          <span className="font-medium">Why: </span>
                          {alert.evidence.summary}
                        </p>
                      )}
                      {alert.evidence?.sensor_check && <p className="mt-1 max-w-[60ch] text-[13.5px] leading-snug text-mz-muted">{alert.evidence.sensor_check}</p>}
                      <p className="mt-1.5 text-[13.5px] text-mz-muted">
                        First alert {c.firstNoticed}. {c.lead.alerts.length === 1 ? "One alert" : `${c.lead.alerts.length} alerts`} so far
                        {c.others > 0 ? `, and ${c.others} other ${c.others === 1 ? "concern" : "concerns"} on this pump` : ""}.
                      </p>
                    </>
                  ) : (
                    <p className="text-[15px]">
                      {waiting ? `An earlier alert can wait: ${faultLabel(waiting.lead.faultType).toLowerCase()}.` : "Nothing. No alerts on this pump so far this week."}
                    </p>
                  )}
                </Section>

                {c && alert && (
                  <Section title="What to do" inner>
                    <p className="text-[16px] leading-snug">{alert.recommended_action}</p>
                    {alert.what_would_settle_it && (
                      <p className="mt-1.5 max-w-[60ch] text-[14px] leading-snug">
                        <span className="font-medium">To settle it: </span>
                        {alert.what_would_settle_it}
                      </p>
                    )}
                    <p className="mt-1 text-[13px] text-mz-muted">{c.stop ? `${c.stop} ` : ""}Advice only. Nothing is sent to the pump.</p>
                  </Section>
                )}

                {c && alert && (
                  <Section title="Your review" inner>
                    <PumpReview c={c} />
                  </Section>
                )}
              </div>
            )}
            {sheet && !expanded && !TEST_PUMPS.has(id) && (
              <button type="button" onClick={() => settle(0)} className="press mt-1 flex min-h-10 w-full items-center justify-center text-[14px] text-mz-accent">
                Show the evidence and readings
              </button>
            )}
          </div>

          {!TEST_PUMPS.has(id) && (
            <>
              <Section title="State now">
                <p className="text-[16px]">
                  {running ? (RUNNING[running] ?? words(running)) : "Unknown"}
                  <span className="text-mz-muted">
                    {" "}
                    with {out === 0 ? "every reading inside its normal band" : `${out} of ${now.length} readings outside the normal band`}.
                  </span>
                </p>
              </Section>

              {c && alert && pump && (
                <Section title="Evidence">
                  <Evidence c={c} alert={alert} pump={pump} meta={channelMeta} shiftHour={site.hour} extra={extra && !named.includes(extra) ? extra : null} onRemoveExtra={() => setPinned(null)} />
                </Section>
              )}

              <Section title="Readings now">
                {c && <p className="mb-2 text-[12.5px] text-mz-muted">Outside the band first. The grey middle of each bar is normal. A blue edge marks a reading already charted above. Point at any other to add its chart, or click to keep it.</p>}
                <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2" onMouseLeave={() => setHovered(null)}>
                  {sorted.map((r) => {
                    const off = r.state === "below" || r.state === "above";
                    const isNamed = named.includes(r.channel);
                    const inner = (
                      <>
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={`min-w-0 truncate ${off ? "font-medium" : ""}`}>{r.label}</span>
                          <span className="shrink-0 text-[13px] tabular-nums">
                            {amount(r.value)} {r.unit}
                          </span>
                        </span>
                        <RangeBar r={r} />
                        <span className={`mt-1 block text-[12px] ${off ? "font-medium text-[#b42318]" : "text-mz-muted"}`}>
                          {r.state === "below" ? "Below normal" : r.state === "above" ? "Above normal" : r.state === "normal" ? "Normal" : "No normal range"}
                          {off && r.lo !== null && r.hi !== null ? `, normal ${amount(r.lo)} to ${amount(r.hi)}` : ""}
                        </span>
                      </>
                    );
                    const row = "block w-full py-2 text-left text-[13.5px]";
                    return (
                      <li key={r.channel} className="border-b border-mz-line/70">
                        {c && !isNamed ? (
                          <button
                            type="button"
                            aria-pressed={pinned === r.channel}
                            onMouseEnter={() => setHovered(r.channel)}
                            onFocus={() => setHovered(r.channel)}
                            onBlur={() => setHovered(null)}
                            onClick={() => setPinned(pinned === r.channel ? null : r.channel)}
                            className={`${row} reading-pick`}
                          >
                            {inner}
                          </button>
                        ) : (
                          <div className={`${row} ${isNamed ? "reading-named" : ""}`}>{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {cannot.length > 0 && <p className="mt-2 text-[12.5px] text-mz-muted">This pump cannot measure {cannot.join(", ")}.</p>}
              </Section>

              {c && alert && (
                <Section title="How sure">
                  {alert.fault_type === "UNKNOWN" ? (
                    <p className="text-[15px]">The detector could not name a cause.</p>
                  ) : past && past.total > 0 ? (
                    <>
                      <p className="text-[15px]">
                        {TRUST_HEAD[c.trust?.level ?? "few"]}: <span className="tabular-nums">{past.right} of {past.total}</span> past alerts naming this cause were correct.
                      </p>
                      {/* One square per past case, filled when the cause was right. */}
                      <span aria-hidden className="mt-2 flex flex-wrap gap-1">
                        {Array.from({ length: Math.min(past.total, 40) }, (_, i) => (
                          <span key={i} className={`size-2.5 ${i < past.right ? "bg-mz-ink" : "shadow-[inset_0_0_0_1px_rgb(11_16_20/0.35)]"}`} />
                        ))}
                      </span>
                    </>
                  ) : (
                    <p className="text-[15px]">No past cases of this cause yet.</p>
                  )}
                  {alert.fault_type !== "UNKNOWN" && (
                    <p className="mt-2 text-[12.5px] text-mz-muted">
                      {alert.confidence_calibrated
                        ? `Detector confidence ${Math.round(alert.confidence * 100)} %: how often this cause was right on the pumps it learned from.`
                        : `Detector score ${alert.confidence.toFixed(2)} (not a probability).`}
                    </p>
                  )}
                  {alert.hypotheses && alert.hypotheses.length > 1 && (
                    <ul className="mt-2 space-y-1 text-[13.5px]" aria-label="Causes the detector weighed">
                      {alert.hypotheses.map((h) => (
                        <li key={h.fault_type} className="flex items-center gap-2">
                          <span className="w-44 truncate">{faultLabel(h.fault_type)}</span>
                          <span className="h-1.5 w-28 bg-mz-line"><span className="block h-1.5 bg-mz-ink" style={{ width: `${Math.round(h.probability * 100)}%` }} /></span>
                          <span className="tabular-nums text-mz-muted">{Math.round(h.probability * 100)} %</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              {(related || work) && (
                <Section title="Latest work">
                  {related && <p className="text-[14px]">{related}</p>}
                  {work && (!related || !related.includes(work.observation)) && (
                    <p className={`text-[14px] ${related ? "mt-1 text-mz-muted" : ""}`}>
                      {words(work.workType)} {ago(site.hour - work.startHour)}: {work.observation}
                    </p>
                  )}
                </Section>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}
