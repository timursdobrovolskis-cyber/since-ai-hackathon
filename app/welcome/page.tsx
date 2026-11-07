"use client";

// The landing page from .plans/welcome-landing-spec.md, a dashboard you scroll through, styled after meuze.ai:
//   01  A ferry engine room in hidden-line work. The camera walks in to Pump 8, the room dims away, and Pump 8 zooms,
//       turns and moves aside while the page fades from ink to white.
//   02  The site map. Scrolling runs the week's clock to the evening shift, and each light follows Today's rule.
//       Clicking a pump opens its card and lights up the area of the 3D pump it concerns.
//   03  The pump dashboard: every pump at the shift, and one pump's report: what's wrong, the evidence, how sure, what
//       to do, and Acknowledge, Dismiss or Escalate.
// Results, the retrofit cards and the closing call to action are set aside for now (see the note in the page).
// Live parts only use data up to the shift. Results use totals only.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConcern } from "@/components/welcome/concerns";
import { PumpCard } from "@/components/welcome/PumpCard";
import { PumpStage } from "@/components/welcome/PumpStage";
import { RoomStage } from "@/components/welcome/RoomStage";
import { MapAnnunciator } from "@/components/welcome/MapAnnunciator";
import { MapSchematic } from "@/components/welcome/MapSchematic";
import { MapTimeline } from "@/components/welcome/MapTimeline";
import { SiteMap, useSite } from "@/components/welcome/SiteMap";
import { PumpDashboard } from "@/components/welcome/PumpDashboard";
import { useScrollPhases } from "@/components/welcome/useScrollPhases";
import { SHIFT_HOUR } from "@/lib/labels";

/** Small square marker on a frame line, as on meuze.ai. */
function Corner({ className }: { className: string }) {
  return <span aria-hidden className={`welcome-corner absolute size-1.5 ${className}`} />;
}

/** Site map alternatives to compare. `?map=` picks one; the switch at the bottom of the map changes it. */
const MAPS = [
  { key: "schematic", label: "Schematic", View: MapSchematic },
  { key: "panel", label: "Alarm panel", View: MapAnnunciator },
  { key: "timeline", label: "Timeline", View: MapTimeline },
  { key: "current", label: "Current", View: SiteMap },
] as const;
type MapKey = (typeof MAPS)[number]["key"];

/** True on phone-sized screens, where the pump ends above the map instead of beside it. */
function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setCompact(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return compact;
}

export default function Welcome() {
  const track = useRef<HTMLElement>(null);
  const { phases, hour, mapReady } = useScrollPhases(track, SHIFT_HOUR);
  const site = useSite(hour, SHIFT_HOUR);
  const compact = useCompact();
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const concern = useConcern(site, selected);
  const [mapKey, setMapKey] = useState<MapKey>("schematic");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("map");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address bar is only readable after mount
    if (MAPS.some((m) => m.key === wanted)) setMapKey(wanted as MapKey);
  }, []);
  const pickMap = (key: MapKey) => {
    setMapKey(key);
    const url = new URL(window.location.href);
    url.searchParams.set("map", key);
    window.history.replaceState(null, "", url);
  };
  const MapView = MAPS.find((m) => m.key === mapKey)!.View;
  // Past the pinned stage, the header gets a solid bar so it never runs over the sections' text.
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const el = track.current;
      if (el) setSolid(el.getBoundingClientRect().bottom <= 64);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Scrolling back up to the pump closes any open card.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the scroll position, which lives outside React
    if (!mapReady) setSelected(null);
  }, [mapReady]);

  /** Header links: the top, the map at the evening shift, and the sections below. */
  const jump = (to: "top" | "map" | "pumps") => {
    const el = track.current;
    if (to === "top") return window.scrollTo({ top: 0, behavior: "smooth" });
    if (to === "map" && el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      return window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * 0.95, behavior: "smooth" });
    }
    document.getElementById(to)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="welcome min-h-full bg-white font-geist text-mz-ink">
      {/* Over the stage, difference blending keeps the header readable on both ink and white. Below it, a solid bar. */}
      <header
        className={`fixed inset-x-0 top-0 z-30 flex h-16 items-center px-5 transition-colors sm:px-10 ${
          solid ? "border-b border-mz-line bg-white/92 text-mz-ink backdrop-blur" : "text-white mix-blend-difference"
        }`}
      >
        <button type="button" onClick={() => jump("top")} className="text-lg font-medium tracking-[-0.02em]">
          Retrofit Assist
        </button>
        <nav aria-label="Sections" className="ml-10 hidden gap-7 text-[15px] md:flex">
          <button type="button" onClick={() => jump("map")} className="hover:underline underline-offset-4">Site map</button>
          <button type="button" onClick={() => jump("pumps")} className="hover:underline underline-offset-4">Pumps</button>
        </nav>
        <Link href="/" className="ml-auto text-[15px] underline-offset-4 hover:underline">
          Today&rsquo;s shift
        </Link>
      </header>

      {/* Tall section: its height is the scroll distance. The stage inside stays pinned. */}
      <section ref={track} aria-label="Engine room and site map" className="relative h-[670vh]" style={{ "--r": 0, "--p": 0, "--t": 0 } as React.CSSProperties}>
        <div className="welcome-stage sticky top-0 h-svh overflow-hidden">
          <div aria-hidden className="welcome-grid pointer-events-none absolute inset-0" />
          {/* The engine room covers the grid until it fades out at the hand-off. */}
          <RoomStage phases={phases} />
          <div aria-hidden className="welcome-frame pointer-events-none absolute inset-x-4 inset-y-20 border sm:inset-x-10">
            <Corner className="-left-[3.5px] -top-[3.5px]" />
            <Corner className="-right-[3.5px] -bottom-[3.5px]" />
          </div>

          <p className="welcome-label absolute left-6 top-24 font-mono text-[11px] uppercase tracking-[0.18em] sm:left-14">
            01 &middot; Engine room &middot; seawater cooling pumps
          </p>

          <PumpStage phases={phases} selected={selected !== null} highlight={concern?.area?.x ?? null} compact={compact} />

          <p aria-hidden className="welcome-cue absolute bottom-10 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
            Scroll
          </p>

          {/* The site map: the left column on wide screens, below the pump on phones. Scrolling on runs its clock. */}
          <div className="welcome-map absolute inset-x-0 top-[34svh] bottom-0 flex flex-col px-5 pt-2 md:inset-y-0 md:top-0 md:right-auto md:w-1/2 md:justify-center md:px-10 md:pt-16 lg:px-16">
            <MapView site={site} shiftHour={SHIFT_HOUR} ready={mapReady} selected={selected} onSelect={setSelected} />
          </div>

          <PumpCard id={selected} site={site} onClose={close} />

          {/* Temporary: compare the site map alternatives, then keep one. */}
          <div
            role="group"
            aria-label="Site map style"
            className={`welcome-mapswitch absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-mz-line bg-white/95 p-1 text-[13px] shadow-[0_8px_24px_-12px_rgb(11_16_20/0.35)] backdrop-blur ${mapReady ? "" : "pointer-events-none"}`}
          >
            <span className="hidden px-2.5 text-mz-muted sm:inline">Map</span>
            {MAPS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mapKey === m.key}
                tabIndex={mapReady ? 0 : -1}
                onClick={() => pickMap(m.key)}
                className={`min-h-9 rounded-full px-2.5 whitespace-nowrap transition-colors sm:px-3.5 ${mapKey === m.key ? "bg-mz-ink text-white" : "hover:bg-mz-panel"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <PumpDashboard shiftHour={SHIFT_HOUR} />
      {/* Results, the retrofit cards and the closing call to action (Results.tsx, MetricCards.tsx, Closing.tsx) are
          set aside while the dashboard is reworked, and come back one step at a time. */}
      <footer className="border-t border-mz-line px-5 py-6 text-[13px] leading-relaxed text-mz-muted sm:px-10 lg:px-16">
        Advice only and read-only: nothing is ever sent to a pump, and plant alarms, trips and interlocks stay in charge. Simulated data from the
        RETROFIT AI 2026 benchmark, with baseline alerts until the team&rsquo;s detector is in. The site layout is fictional.
      </footer>
    </div>
  );
}
