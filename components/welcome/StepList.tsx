"use client";

// Part 4 of .plans/welcome-landing-spec.md: what needs you this evening. On wide screens the section pins, and each
// scroll step makes the next concern active: its reading draws in on the right, against its expected band, with its
// alerts marked. On phones the same content is a plain list. Order and wording come from Today.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SiteState } from "@/lib/sitemap";
import { useConcerns, type Concern } from "./concerns";
import { SignalChart } from "./SignalChart";

/** Scroll height given to each concern while the section is pinned. */
const STEP_VH = 38;

function Swatch({ light }: { light: Concern["light"] }) {
  return <span aria-hidden className={`site-swatch inline-block size-2 shrink-0 site-${light}`} />;
}

/** A metric in the style of the Meuze cards: a figure, then a small mono label with a swatch. */
export function Metric({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="min-w-0 border-l border-mz-line pl-4 first:border-l-0 first:pl-0 max-sm:odd:border-l-0 max-sm:odd:pl-0">
      <p className={`truncate text-[20px] leading-tight tracking-[-0.01em] ${accent ? "text-site-red" : ""}`}>{value}</p>
      <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">
        <span aria-hidden className="size-1.5 bg-mz-accent" />
        {label}
      </p>
    </div>
  );
}

const stopLine = (s: string | null) => (s ? s.replace(/\.$/, "") : "No stop in the timetable ahead");
/** "8 of 9 right", or "2 of 2, too few" when there are too few past cases to say. */
const trustShort = (c: Concern) => {
  if (!c.trust) return "No past cases";
  const counts = c.trust.words.match(/(\d+) of (\d+)/);
  if (!counts) return c.trust.words;
  return c.trust.level === "few" ? `${counts[0]}, too few` : `${counts[0]} right`;
};

function ConcernDetail({ c, replay }: { c: Concern; replay: string }) {
  return (
    <div className="border border-mz-line bg-white">
      <div className="flex items-center justify-between border-b border-mz-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-mz-muted">
        <span>
          {c.channelLabel}
          {c.unit && ` · ${c.unit}`} &middot; {c.name}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-3 bg-mz-accent" /> Reading
          <span aria-hidden className="ml-3 inline-block h-2 w-3 bg-[var(--welcome-band)]" /> Expected
        </span>
      </div>
      <div className="bg-mz-panel px-2 pt-2">
        <SignalChart rows={c.rows} unit={c.unit} alertHours={c.alertHours} replayKey={replay} aspectRatio="2.1 / 1" />
      </div>
      <div className="grid grid-cols-2 gap-y-4 border-t border-mz-line px-5 py-4 sm:grid-cols-4">
        <Metric value={c.firstNoticed.replace(" ago", "")} label="Since first alert" />
        <Metric value={String(c.lead.alerts.length)} label="Alerts so far" />
        <Metric value={trustShort(c)} label="How sure" />
        <Metric value={c.trend ?? "Not measured"} label="Trend" accent={c.trend === "Getting worse"} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mz-line px-5 py-3">
        <p className="text-[13px] text-mz-muted">{stopLine(c.stop)}</p>
        <Link
          href={`/cases/${c.lead.id}`}
          className="inline-flex min-h-10 items-center gap-2 bg-mz-accent px-4 text-[14px] font-medium text-white hover:bg-mz-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mz-accent"
        >
          Open the job card <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function Heading({ count }: { count: number }) {
  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mz-muted">03 &middot; What needs you</p>
      <h2 className="mt-4 max-w-[18ch] text-[34px] leading-[1.08] font-light tracking-[-0.03em] lg:text-[42px]">
        {count === 1 ? "One pump needs" : `${count} pumps need`} a look this evening.
      </h2>
      <p className="mt-3 max-w-[46ch] text-[15px] leading-snug text-mz-muted">
        The same list as Today, in the same order. Each reading is shown up to the evening shift, against what that pump
        normally does at its speed.
      </p>
    </>
  );
}

export function StepList({ site }: { site: SiteState }) {
  const concerns = useConcerns(site);
  const track = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const n = concerns.length;

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = track.current;
      if (!el || n === 0) return;
      const rect = el.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      const p = Math.min(0.9999, Math.max(0, -rect.top / travel));
      setActive(Math.floor(p * n));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [n]);

  /** Scrolls the pinned section so concern `i` becomes active. */
  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const travel = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((i + 0.5) / n) * travel, behavior: "smooth" });
  };

  if (n === 0) return null;
  const current = concerns[Math.min(active, n - 1)];
  const groups = [
    { title: "Needs you today", items: concerns.filter((c) => c.light === "red") },
    { title: "Check the reading", items: concerns.filter((c) => c.light === "orange") },
  ].filter((g) => g.items.length);

  return (
    <>
      {/* Wide screens: pinned, one concern per scroll step. */}
      <section ref={track} id="needs-you" aria-label="What needs you" className="relative hidden bg-white md:block" style={{ height: `${n * STEP_VH + 100}vh` }}>
        <div className="sticky top-0 flex h-svh items-center px-10 pt-14 lg:px-16">
          <div className="grid w-full grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 lg:gap-16">
            <div>
              <Heading count={n} />
              <div className="mt-7 space-y-5">
                {groups.map((g) => (
                  <div key={g.title}>
                    <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-mz-muted">
                      {g.title} &middot; {g.items.length}
                    </p>
                    <ul className="border-t border-mz-line">
                      {g.items.map((c) => {
                        const i = concerns.indexOf(c);
                        const on = i === active;
                        return (
                          <li key={c.id} className="border-b border-mz-line">
                            <button
                              type="button"
                              onClick={() => goTo(i)}
                              aria-current={on}
                              className={`flex w-full items-start gap-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-mz-accent ${on ? "text-mz-ink" : "text-mz-muted hover:text-mz-ink"}`}
                            >
                              <span className="pt-1.5"><Swatch light={c.light} /></span>
                              <span className="min-w-0 flex-1">
                                <span className={`text-[15px] ${on ? "font-medium" : ""}`}>{c.name}</span>
                                <span className="ml-2 text-[14px]">{c.what}</span>
                                {on && <span className="mt-0.5 block text-[13px] text-mz-muted">{c.check}</span>}
                              </span>
                              <span aria-hidden className={`mt-2 h-px w-4 shrink-0 bg-mz-accent transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="self-center">
              <ConcernDetail c={current} replay={current.id} />
            </div>
          </div>
        </div>
      </section>

      {/* Phones: the same concerns as a plain list. */}
      <section id="needs-you-list" aria-label="What needs you" className="bg-white px-5 py-14 md:hidden">
        <Heading count={n} />
        <ul className="mt-8 space-y-8">
          {concerns.map((c) => (
            <li key={c.id}>
              <p className="flex items-center gap-2 text-[16px] font-medium">
                <Swatch light={c.light} /> {c.name}
              </p>
              <p className="mt-1 text-[15px]">{c.what}</p>
              <p className="mb-3 text-[14px] text-mz-muted">{c.check}</p>
              <ConcernDetail c={c} replay={c.id} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
