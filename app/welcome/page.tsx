"use client";

// Landing page, part 1 of .plans/welcome-landing-spec.md: hero text, the line-work pump, and the
// scroll that zooms and turns it, then moves it to the right column. The map arrives in part 2.
import Link from "next/link";
import { useRef } from "react";
import { PumpStage } from "@/components/welcome/PumpStage";

export default function Welcome() {
  const track = useRef<HTMLElement>(null);

  return (
    <div className="welcome min-h-full bg-bt-bg text-bt-navy">
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center px-5 sm:px-8">
        <span className="font-cond text-xl font-semibold tracking-tight">Retrofit Assist</span>
        <Link href="/" className="ml-auto text-[15px] font-medium underline-offset-4 hover:underline">
          Today&rsquo;s shift
        </Link>
      </header>

      {/* Tall section: its height is the scroll distance. The stage inside stays pinned. */}
      <section ref={track} className="relative h-[320vh]" style={{ "--p": 0 } as React.CSSProperties}>
        <div className="sticky top-0 h-svh overflow-hidden">
          <PumpStage track={track} />

          <div className="welcome-hero pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-16 sm:px-8 sm:pb-20">
            <h1 className="max-w-[16ch] font-cond text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Early warning for the pumps you already have.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-snug text-bt-navy/80">
              Retrofit Assist reads the signals your pumps already send. It tells the person on shift what needs them,
              what to do, and how far to trust it. It only advises, and it never touches a machine.
            </p>
            <Link
              href="/"
              className="pointer-events-auto mt-7 inline-flex min-h-11 items-center rounded-full bg-bt-navy px-6 text-[15px] font-medium text-bt-bg transition-colors hover:bg-bt-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-blue"
            >
              Open today&rsquo;s shift
            </Link>
          </div>

          <p aria-hidden className="welcome-cue absolute bottom-6 left-1/2 -translate-x-1/2 text-[13px] uppercase tracking-[0.2em] text-bt-navy/60">
            Scroll
          </p>

          {/* Left column, where part 2 puts the site map. */}
          <div className="welcome-map absolute inset-y-0 left-0 flex w-1/2 items-center px-5 sm:px-8">
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-bt-navy/35">
              <p className="max-w-[28ch] text-center text-bt-navy/60">
                Site map of 12 pumps goes here in part 2. Fictional layout.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-5 py-4 text-[13px] text-bt-navy/60 sm:px-8">
        Advisory only and read-only. Simulated data from the RETROFIT AI 2026 benchmark, not measured on any real ship or plant.
      </footer>
    </div>
  );
}
