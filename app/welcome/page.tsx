"use client";

// Landing page, part 1 of .plans/welcome-landing-spec.md, drawn as a blueprint: white line work on a blue grid.
// The pump zooms and turns as you scroll, then moves to the right column. The site map arrives in part 2.
import Link from "next/link";
import { useRef } from "react";
import { PumpStage } from "@/components/welcome/PumpStage";

export default function Welcome() {
  const track = useRef<HTMLElement>(null);

  return (
    <div className="blueprint min-h-full text-white">
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center px-5 sm:px-8">
        <span className="font-cond text-xl font-semibold tracking-tight">Retrofit Assist</span>
        <Link href="/" className="ml-auto text-[15px] font-medium underline-offset-4 hover:underline">
          Today&rsquo;s shift
        </Link>
      </header>

      {/* Tall section: its height is the scroll distance. The stage inside stays pinned. */}
      <section ref={track} className="relative h-[320vh]" style={{ "--p": 0 } as React.CSSProperties}>
        <div className="sticky top-0 h-svh overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-3 border border-white/40 sm:inset-4" />

          <PumpStage track={track} />

          <p aria-hidden className="welcome-cue absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] uppercase tracking-[0.2em] text-white/70">
            Scroll
          </p>

          {/* Left column, where part 2 puts the site map. */}
          <div className="welcome-map absolute inset-y-0 left-0 flex w-1/2 items-center px-8 sm:px-12">
            <div className="flex aspect-[4/3] w-full items-center justify-center border border-dashed border-white/45">
              <p className="max-w-[28ch] text-center text-white/70">Site map of 12 pumps goes here in part 2. Fictional layout.</p>
            </div>
          </div>

          <dl className="welcome-title absolute bottom-7 right-7 hidden grid-cols-[auto_auto] border border-white/50 font-cond text-[11px] uppercase tracking-[0.12em] sm:grid sm:bottom-8 sm:right-8">
            <dt className="border-b border-r border-white/40 px-2.5 py-1.5 text-white/60">Project</dt>
            <dd className="border-b border-white/40 px-2.5 py-1.5">Retrofit Assist</dd>
            <dt className="border-b border-r border-white/40 px-2.5 py-1.5 text-white/60">Drawing</dt>
            <dd className="border-b border-white/40 px-2.5 py-1.5">Centrifugal pump</dd>
            <dt className="border-r border-white/40 px-2.5 py-1.5 text-white/60">Data</dt>
            <dd className="px-2.5 py-1.5">Simulated</dd>
          </dl>
        </div>
      </section>

      <footer className="px-5 py-4 text-[13px] text-white/65 sm:px-8">
        Advisory only and read-only. Simulated data from the RETROFIT AI 2026 benchmark, not measured on any real ship or plant.
      </footer>
    </div>
  );
}
