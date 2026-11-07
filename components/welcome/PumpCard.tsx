"use client";

// Part 3 of .plans/welcome-landing-spec.md: the small dashboard for the pump picked on the site map. It shows the
// same moment as the map, so as you scroll the week on, the card changes with it. Wording comes from Today.
import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useApp } from "@/components/AppProvider";
import { ago, clock } from "@/lib/labels";
import { plainAlert, pumpName } from "@/lib/plain";
import { AMBIENT, TEST_PUMPS, type SiteState } from "@/lib/sitemap";
import { nextStop, trendOf } from "@/lib/worker";
import { LIGHT_WORDS } from "./SiteMap";

type Reading = { id: string; label: string; state: "flagged" | "has" | "missing" };

function Sensors({ readings }: { readings: Reading[] }) {
  const has = readings.filter((r) => r.state !== "missing").length;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">
        Measures {has} of {readings.length} kinds of reading
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] lg:grid-cols-3">
        {readings.map((r) => (
          <li key={r.id} className={`flex items-center gap-1.5 ${r.state === "missing" ? "text-mz-muted line-through decoration-mz-muted/50" : ""}`}>
            <span aria-hidden className={`card-sensor card-sensor-${r.state} size-2 shrink-0`} />
            <span className="truncate">{r.label}</span>
            <span className="sr-only">{r.state === "flagged" ? ", behind this alert" : r.state === "missing" ? ", cannot measure" : ""}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">
        <span className="flex items-center gap-1.5"><span aria-hidden className="card-sensor card-sensor-flagged size-2" />Behind this alert</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="card-sensor card-sensor-has size-2" />Measured</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="card-sensor card-sensor-missing size-2" />Cannot measure</span>
      </p>
    </div>
  );
}

export function PumpCard({ id, site, onClose }: { id: string | null; site: SiteState; onClose: () => void }) {
  const { fleet, pumps, record } = useApp();
  const cardRef = useRef<HTMLElement>(null);

  // Move focus to the card itself when it opens, so a mouse click draws no focus ring, and let Escape close it.
  // Closing hands focus back to the pump on the map.
  const close = () => {
    const from = id;
    onClose();
    requestAnimationFrame(() => document.querySelector<SVGElement>(`[data-pump="${from}"]`)?.focus());
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
  const line = id ? site.lines[id] : undefined;
  const lead = line?.lead;
  const concern = lead && (light === "red" || light === "orange");
  const words = lead ? plainAlert(lead.latest, fleet?.channelMeta ?? {}, record) : null;
  const trend = concern ? trendOf(lead.latest, pump, site.hour) : null;
  const stop = concern ? nextStop(pump, site.hour) : null;

  const flagged = new Set(concern ? lead.latest.evidence?.channels?.map((c) => c.channel) ?? [] : []);
  const readings: Reading[] = pump
    ? [
        ...Object.entries(fleet?.channelMeta ?? {}).map(([ch, m]) => ({
          id: ch,
          label: m.label,
          state: (flagged.has(ch) ? "flagged" : pump.channels.includes(ch) ? "has" : "missing") as Reading["state"],
        })),
        { ...AMBIENT, state: "has" as const },
      ]
    : [];

  return (
    <aside
      ref={cardRef}
      tabIndex={-1}
      aria-label={id ? `${pumpName(id)} details` : undefined}
      aria-hidden={!open}
      inert={!open}
      data-open={open}
      className="pump-card absolute top-[31svh] right-6 left-1/2 ml-6 max-h-[calc(69svh-96px)] overflow-y-auto border border-mz-line bg-white p-5 shadow-[0_24px_48px_-24px_rgb(11_16_20/0.25)] outline-none sm:right-10"
    >
      {id && (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mz-muted">
                03 &middot; {clock(site.hour)}
              </p>
              <h2 className="mt-1 flex items-center gap-2 text-[22px] leading-tight font-medium tracking-[-0.02em]">
                {pumpName(id)}
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-mz-muted">
                  <span aria-hidden className={`site-swatch size-2 ${light === "none" ? "site-swatch-empty" : `site-${light}`}`} />
                  {LIGHT_WORDS[light]}
                </span>
              </h2>
              {meta && <p className="mt-0.5 truncate text-[13px] text-mz-muted">{meta.system} &middot; {meta.site}</p>}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close details"
              className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center text-mz-muted hover:text-mz-ink focus-visible:outline-2 focus-visible:outline-mz-accent"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          {TEST_PUMPS.has(id) ? (
            <p className="mt-4 text-[15px] leading-snug text-mz-muted">
              This is a test pump. The organizers hold its answers, so the app shows no data for it until the submission is frozen.
            </p>
          ) : (
            <>
              <div className="mt-4 border-t border-mz-line pt-4">
                {concern && words ? (
                  <>
                    <p className="text-[17px] leading-snug">{words.what}</p>
                    <p className="mt-1 text-[15px] leading-snug text-mz-muted">
                      {words.check}
                      {line.others.length > 0 && ` Plus ${line.others.length} more on this pump.`}
                    </p>
                    <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-mz-line pt-3 text-[13px] leading-snug">
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">First noticed</dt>
                        <dd className="mt-1">{ago(site.hour - lead.first.offset_hours)}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">How sure</dt>
                        <dd className="mt-1">{words.trust ? words.trust.words : "No past cases yet"}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">Trend</dt>
                        <dd className={`mt-1 ${trend === "Getting worse" ? "font-medium text-site-red" : ""}`}>{trend ?? "Not measured"}</dd>
                      </div>
                    </dl>
                    {stop && <p className="mt-3 text-[13px] text-mz-muted">{stop}</p>}
                  </>
                ) : (
                  <p className="text-[15px] leading-snug text-mz-muted">
                    {line ? `An earlier concern can wait: ${words?.what}` : "No alerts on this pump so far this week."}
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-mz-line pt-4">
                <Sensors readings={readings} />
              </div>

              {concern && (
                <Link
                  href={`/cases/${lead.id}`}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 bg-mz-accent px-4 text-[14px] font-medium text-white hover:bg-mz-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent"
                >
                  Open the full job card <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}
