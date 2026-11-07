"use client";

// The pump card: opens from the alarm panel in place of the 3D pump, which flickers away. Everything on it comes from
// the data, as the evening shift stands:
//   the pump and its running state now (stateRuns), what the alert says is wrong and since when, the evidence (the
//   alert's summary and readings, and the reading against its normal band), every reading now against its band, how
//   sure (past record, and the detector's score with its calibration), the detector's recommended action and the next
//   stop, the latest work from the maintenance log, and the readings this pump cannot measure.
// The fault names come from the app's labels for each fault type. Nothing here is an estimate of ours.
// On phones it opens as a sheet from the bottom.
import { Cog, Gauge, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { stateAt } from "@/lib/cases";
import { clock, faultLabel } from "@/lib/labels";
import { PLAIN, pumpName } from "@/lib/plain";
import { TEST_PUMPS, type SiteState } from "@/lib/sitemap";
import type { MaintenanceNote, PumpData } from "@/lib/types";
import { lastDone } from "@/lib/worker";
import { useConcern } from "./concerns";
import { PumpReview } from "./PumpReview";
import { LIGHT_WORDS } from "./mapParts";
import { Evidence } from "./Evidence";

const RUNNING: Record<string, string> = {
  RUNNING: "Running",
  STOPPED: "Stopped",
  LOCKED_OUT: "Locked out",
  STOPPING: "Stopping",
  NO_DATA: "No data arriving",
};

const num = (v: number) =>
  Math.abs(v) >= 100
    ? v.toFixed(0)
    : Math.abs(v) >= 10
      ? v.toFixed(1)
      : v.toFixed(2);
const ago = (h: number) =>
  h < 36
    ? `${Math.max(1, Math.round(h))} h ago`
    : `${Math.round(h / 24)} days ago`;
const words = (s: string) =>
  s.charAt(0) + s.slice(1).replaceAll("_", " ").toLowerCase();

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
function readingsAt(
  pump: PumpData,
  meta: Record<string, { label: string; unit?: string }>,
  hour: number,
): Now[] {
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
      const state: Now["state"] =
        lo === null || hi === null
          ? "noband"
          : value < lo
            ? "below"
            : value > hi
              ? "above"
              : "normal";
      return {
        channel: ch,
        label: meta[ch]?.label ?? ch,
        unit: meta[ch]?.unit ?? "",
        value,
        lo,
        hi,
        state,
      };
    })
    .filter((r): r is Now => r !== null);
}

/** The newest entry in the maintenance log at or before `hour`, from this week or before it. */
function latestWork(pump: PumpData, hour: number): MaintenanceNote | null {
  return (
    [...pump.history, ...pump.maintenance]
      .filter((m) => m.startHour <= hour)
      .sort((a, b) => b.startHour - a.startHour)[0] ?? null
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-mz-line py-4">
      <h3 className="mb-1.5 text-[13px] text-mz-muted">{title}</h3>
      {children}
    </section>
  );
}

export function PumpCard({
  id,
  site,
  onClose,
}: {
  id: string | null;
  site: SiteState;
  onClose: () => void;
}) {
  const { fleet, pumps, record } = useApp();
  const cardRef = useRef<HTMLElement>(null);

  // Focus moves to the card when it opens, and Escape closes it. Closing hands focus back to the pump's window.
  const close = () => {
    const from = id;
    onClose();
    requestAnimationFrame(() =>
      [...document.querySelectorAll<HTMLElement>(`[data-pump="${from}"]`)]
        .find((n) => n.getClientRects().length > 0)
        ?.focus(),
    );
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!id) return;
    cardRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  const open = id !== null;
  const meta = id ? fleet?.pumps.find((p) => p.id === id) : undefined;
  const pump = id ? pumps[id] : undefined;
  const light = id ? site.lights[id] : "none";
  const c = useConcern(
    site,
    id && (light === "red" || light === "orange") ? id : null,
  );
  const waiting = id ? site.lines[id] : undefined;
  const channelMeta = fleet?.channelMeta ?? {};
  const now = useMemo(
    () => (pump ? readingsAt(pump, channelMeta, site.hour) : []),
    [pump, channelMeta, site.hour],
  );
  const running = pump ? stateAt(pump, site.hour) : null;
  const alert = c?.lead.latest;
  const evidence = alert?.evidence?.channels?.find(
    (x) => x.observed !== null && x.expected !== null,
  );
  const cannot = pump
    ? Object.keys(channelMeta)
        .filter((ch) => !pump.channels.includes(ch))
        .map((ch) => channelMeta[ch].label.toLowerCase())
    : [];
  const related =
    c && pump
      ? lastDone(pump, PLAIN[c.lead.faultType]?.lastWork, site.hour)
      : null;
  const work = pump ? latestWork(pump, site.hour) : null;
  const sensor = c?.lead.eventClass === "SENSOR";
  const out = now.filter(
    (r) => r.state === "below" || r.state === "above",
  ).length;
  // The reading shown in the evidence chart: the one pointed at, else the one picked, else the alert's own.
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [lastId, setLastId] = useState(id);
  if (lastId !== id) {
    setLastId(id);
    setHovered(null);
    setPinned(null);
  }
  const shown = hovered ?? pinned ?? c?.channel ?? null;

  return (
    <aside
      ref={cardRef}
      tabIndex={-1}
      aria-label={id ? `${pumpName(id)} details` : undefined}
      aria-hidden={!open}
      inert={!open}
      data-open={open}
      className="pump-card fixed inset-x-0 bottom-0 z-40 max-h-[82svh] overflow-y-auto bg-white px-5 pt-5 pb-2 shadow-[0_-12px_40px_-16px_rgb(11_16_20/0.35)] outline-none md:absolute md:inset-x-auto md:top-24 md:right-10 md:bottom-24 md:left-1/2 md:z-auto md:ml-8 md:max-h-none md:shadow-[0_0_0_1px_var(--mz-line),0_24px_48px_-28px_rgb(11_16_20/0.3)]"
    >
      {id && (
        <>
          <header className="flex items-start gap-3 pb-4">
            <div className="min-w-0 flex-1">
              <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[26px] leading-tight font-normal tracking-[-0.025em]">
                {pumpName(id)}
                <span className="flex items-center gap-1.5 text-[13px] tracking-normal text-mz-muted">
                  <span
                    aria-hidden
                    className={`size-2 ${light === "none" ? "site-swatch-empty" : `site-${light}`}`}
                  />
                  {LIGHT_WORDS[light].charAt(0).toUpperCase() +
                    LIGHT_WORDS[light].slice(1)}
                </span>
              </h2>
              {meta && (
                <p className="mt-1 text-[14px] text-mz-muted">
                  {meta.system}, {meta.site.replace(" (fictional)", "")}.{" "}
                  {clock(site.hour)}.
                </p>
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

          {TEST_PUMPS.has(id) ? (
            <Section title="Data">
              <p className="text-[15px] leading-snug">
                This is a test pump. The organizers hold its answers, so the app
                shows no data for it until the submission is frozen.
              </p>
            </Section>
          ) : (
            <>
              <Section title="State now">
                <p className="text-[16px]">
                  {running ? (RUNNING[running] ?? words(running)) : "Unknown"}
                  <span className="text-mz-muted">
                    {" "}
                    with{" "}
                    {out === 0
                      ? "every reading inside its normal band"
                      : `${out} ${out === 1 ? "reading" : "readings"} outside the normal band`}
                    .
                  </span>
                </p>
              </Section>

              <Section title="What's wrong">
                {c && alert ? (
                  <>
                    <p className="flex flex-wrap items-center gap-2.5 text-[20px] leading-tight tracking-[-0.015em]">
                      {faultLabel(c.lead.faultType)}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[13px] tracking-normal shadow-[inset_0_0_0_1px_var(--mz-line)]">
                        {sensor ? (
                          <Gauge
                            aria-hidden
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        ) : (
                          <Cog
                            aria-hidden
                            className="size-3.5"
                            strokeWidth={1.75}
                          />
                        )}
                        {sensor ? "Sensor" : "Machine"}
                      </span>
                    </p>
                    <p className="mt-1 text-[14px] text-mz-muted">
                      First alert {c.firstNoticed}.{" "}
                      {c.lead.alerts.length === 1
                        ? "One alert"
                        : `${c.lead.alerts.length} alerts`}{" "}
                      so far
                      {c.others > 0
                        ? `, and ${c.others} other ${c.others === 1 ? "concern" : "concerns"} on this pump`
                        : ""}
                      .
                    </p>
                  </>
                ) : (
                  <p className="text-[15px]">
                    {waiting
                      ? `An earlier alert can wait: ${faultLabel(waiting.lead.faultType).toLowerCase()}.`
                      : "Nothing. No alerts on this pump so far this week."}
                  </p>
                )}
              </Section>

              {c && alert && (
                <Section title="Evidence">
                  <p className="text-[16px] leading-snug">
                    {alert.evidence?.summary}
                  </p>
                  {evidence && (
                    <p className="mt-1 font-mono text-[12.5px] text-mz-muted tabular-nums">
                      {channelMeta[evidence.channel]?.label} now{" "}
                      {num(evidence.observed!)}{" "}
                      {channelMeta[evidence.channel]?.unit}, expected{" "}
                      {num(evidence.expected!)}{" "}
                      {channelMeta[evidence.channel]?.unit}
                    </p>
                  )}
                  {pump && (
                    <Evidence
                      c={c}
                      pump={pump}
                      meta={channelMeta}
                      shiftHour={site.hour}
                      channel={shown}
                      onBack={() => setPinned(null)}
                    />
                  )}
                </Section>
              )}

              <Section title="Readings now">
                {c && (
                  <p className="mb-1.5 text-[12.5px] text-mz-muted">
                    Point at a reading to see it in the chart. Click to keep it
                    there.
                  </p>
                )}
                <ul
                  className="grid grid-cols-1 gap-x-6 sm:grid-cols-2"
                  onMouseLeave={() => setHovered(null)}
                >
                  {now.map((r) => {
                    const flagged = r.channel === c?.channel;
                    const off = r.state === "below" || r.state === "above";
                    const inner = (
                      <>
                        <span
                          className={`min-w-0 truncate ${flagged ? "font-medium" : ""}`}
                        >
                          {r.label}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <span className="font-mono text-[12.5px] tabular-nums">
                            {num(r.value)} {r.unit}
                          </span>
                          <span
                            className={`w-[5.5rem] text-right text-[12.5px] ${off ? "font-medium text-[#b42318]" : "text-mz-muted"}`}
                          >
                            {r.state === "below"
                              ? "Below normal"
                              : r.state === "above"
                                ? "Above normal"
                                : r.state === "normal"
                                  ? "Normal"
                                  : "No band"}
                          </span>
                        </span>
                      </>
                    );
                    const row =
                      "flex w-full items-baseline justify-between gap-3 py-1.5 text-left text-[13.5px]";
                    return (
                      <li
                        key={r.channel}
                        className="border-b border-mz-line/70 last:border-b-0"
                      >
                        {c ? (
                          <button
                            type="button"
                            aria-pressed={shown === r.channel}
                            onMouseEnter={() => setHovered(r.channel)}
                            onFocus={() => setHovered(r.channel)}
                            onBlur={() => setHovered(null)}
                            onClick={() =>
                              setPinned(
                                r.channel === c.channel ? null : r.channel,
                              )
                            }
                            className={`${row} reading-pick`}
                          >
                            {inner}
                          </button>
                        ) : (
                          <div className={row}>{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {cannot.length > 0 && (
                  <p className="mt-2 text-[12.5px] text-mz-muted">
                    This pump cannot measure {cannot.join(", ")}.
                  </p>
                )}
              </Section>

              {c && alert && (
                <Section title="How sure">
                  <p className="text-[15px]">
                    {c.trust
                      ? `${c.trust.words}.`
                      : "No past cases of this cause yet."}
                  </p>
                  <p className="mt-0.5 text-[13px] text-mz-muted">
                    {alert.fault_type === "UNKNOWN"
                      ? "The detector could not name a cause."
                      : `Detector score ${alert.confidence.toFixed(2)}${alert.confidence_calibrated ? "" : ", not calibrated, so it is not a probability"}.`}
                  </p>
                </Section>
              )}

              {c && alert && (
                <Section title="What to do">
                  <p className="text-[16px] leading-snug">
                    {alert.recommended_action}
                  </p>
                  <p className="mt-1 text-[13px] text-mz-muted">
                    {c.stop ? `${c.stop} ` : ""}Advice only. Nothing is sent to
                    the pump.
                  </p>
                </Section>
              )}

              {c && alert && (
                <Section title="Your review">
                  <PumpReview c={c} />
                </Section>
              )}

              {(related || work) && (
                <Section title="Latest work">
                  {related && <p className="text-[14px]">{related}</p>}
                  {work &&
                    (!related || !related.includes(work.observation)) && (
                      <p
                        className={`text-[14px] ${related ? "mt-1 text-mz-muted" : ""}`}
                      >
                        {words(work.workType)} {ago(site.hour - work.startHour)}
                        : {work.observation}
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
