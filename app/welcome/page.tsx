"use client";

// Landing page, parts 1 and 2 of .plans/welcome-landing-spec.md, styled after meuze.ai: ink and white sections,
// Geist and JetBrains Mono, one accent blue. The pump zooms and turns as you scroll, then glides right while the
// page fades from ink to white. Then the site map appears, and further scrolling runs its clock to the shift.
// Part 3: clicking a pump on the map shrinks the 3D pump and opens that pump's card below it.
// The page opens in a realistic seawater pump room on a ferry. Scrolling walks in to Pump 8, which dissolves into the
// line-work pump.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PumpCard } from "@/components/welcome/PumpCard";
import { PumpStage } from "@/components/welcome/PumpStage";
import { RoomStage } from "@/components/welcome/RoomStage";
import { SiteMap, useSite } from "@/components/welcome/SiteMap";
import { useScrollPhases } from "@/components/welcome/useScrollPhases";
import { SHIFT_HOUR } from "@/lib/labels";

/** Small square marker on a frame line, as on meuze.ai. */
function Corner({ className }: { className: string }) {
  return <span aria-hidden className={`welcome-corner absolute size-1.5 ${className}`} />;
}

export default function Welcome() {
  const track = useRef<HTMLElement>(null);
  const { phases, hour, mapReady } = useScrollPhases(track, SHIFT_HOUR);
  const site = useSite(hour, SHIFT_HOUR);
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  // Scrolling back up to the pump closes any open card.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the scroll position, which lives outside React
    if (!mapReady) setSelected(null);
  }, [mapReady]);

  return (
    <div className="welcome min-h-full bg-white font-geist text-mz-ink">
      {/* Difference blending keeps the header readable on both ink and white. */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center px-6 text-white mix-blend-difference sm:px-10">
        <span className="text-lg font-medium tracking-[-0.02em]">Retrofit Assist</span>
        <nav className="ml-10 hidden gap-8 font-mono text-[12px] uppercase tracking-[0.14em] md:flex">
          <span>Pump</span>
          <span>Site map</span>
          <span>Results</span>
        </nav>
        <Link href="/" className="ml-auto font-mono text-[12px] uppercase tracking-[0.14em] underline-offset-4 hover:underline">
          Today&rsquo;s shift
        </Link>
      </header>

      {/* Tall section: its height is the scroll distance. The stage inside stays pinned. */}
      <section ref={track} className="relative h-[780vh]" style={{ "--r": 0, "--p": 0, "--t": 0 } as React.CSSProperties}>
        <div className="welcome-stage sticky top-0 h-svh overflow-hidden">
          <div aria-hidden className="welcome-grid pointer-events-none absolute inset-0" />
          {/* The realistic room covers the grid until it fades out at the hand-off. */}
          <RoomStage phases={phases} />
          <div aria-hidden className="welcome-frame pointer-events-none absolute inset-x-6 inset-y-20 border sm:inset-x-10">
            <Corner className="-left-[3.5px] -top-[3.5px]" />
            <Corner className="-right-[3.5px] -bottom-[3.5px]" />
          </div>

          <p className="welcome-label absolute left-6 top-24 font-mono text-[11px] uppercase tracking-[0.18em] sm:left-14">
            01 &middot; Engine room &middot; seawater cooling pumps
          </p>

          <PumpStage phases={phases} selected={selected !== null} />

          <p aria-hidden className="welcome-cue absolute bottom-10 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
            Scroll
          </p>

          {/* Left column: the site map. Scrolling on runs its clock to the shift. */}
          <div className="welcome-map absolute inset-y-0 left-0 flex w-1/2 flex-col justify-center px-10 pt-16 sm:px-16">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-mz-muted">02 &middot; Site map</p>
            <SiteMap site={site} shiftHour={SHIFT_HOUR} ready={mapReady} selected={selected} onSelect={setSelected} />
          </div>

          <PumpCard id={selected} site={site} onClose={close} />
        </div>
      </section>

      <footer className="border-t border-mz-line px-6 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-mz-muted sm:px-10">
        Advisory only and read-only &middot; Simulated data from the RETROFIT AI 2026 benchmark, not measured on any real ship or plant
      </footer>
    </div>
  );
}
