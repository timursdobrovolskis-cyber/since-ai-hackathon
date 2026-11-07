"use client";

// The site, from .plans/welcome-landing-spec.md: a dashboard you scroll through, styled after meuze.ai:
//   01  A ferry engine room in hidden-line work. The camera walks in to Pump 8, the room dims away, and Pump 8 zooms,
//       turns and moves aside while the page fades from ink to white.
//   02  The alarm panel: one window per pump, as the evening shift stands, following Today's rule. Clicking a pump
//       flickers the 3D pump away and shows that pump's card in its place, built from real data only.
//       The card ends with the review: Acknowledge, Dismiss or Escalate.
//   03  How well it works: faults caught against plant alarms, warning time and false alerts.
// The retrofit cards and the closing call to action are set aside for now (see the note in the page).
// Live parts only use data up to the shift. Results use totals only.
import { useCallback, useEffect, useRef, useState } from "react";
import { PumpCard } from "@/components/welcome/PumpCard";
import { PumpStage } from "@/components/welcome/PumpStage";
import { RoomStage } from "@/components/welcome/RoomStage";
import { AlarmPanel } from "@/components/welcome/AlarmPanel";
import { MapHead, useSite } from "@/components/welcome/mapParts";
import { Results } from "@/components/welcome/Results";
import { CrewValue } from "@/components/welcome/CrewValue";
import { ProgressFrame, ProgressRail, useProgress } from "@/components/welcome/ScrollProgress";
import { TopBar, type Place } from "@/components/welcome/TopBar";
import { useScrollPhases } from "@/components/welcome/useScrollPhases";
import { SHIFT_HOUR } from "@/lib/labels";

/** Small square marker on a frame line, as on meuze.ai. */
function Corner({ className }: { className: string }) {
  return <span aria-hidden className={`welcome-corner absolute size-1.5 ${className}`} />;
}

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
  const { phases, mapReady, light } = useScrollPhases(track);
  // The panel and the pump card show the evening shift as it stands. There is no clock running.
  const site = useSite(SHIFT_HOUR, SHIFT_HOUR);
  const compact = useCompact();
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  // Past the pinned stage the bar turns white for good, and the section in view is marked in it.
  const [past, setPast] = useState(false);
  const [inResults, setInResults] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const el = track.current;
      if (el) setPast(el.getBoundingClientRect().bottom <= 64);
      const res = document.getElementById("results");
      setInResults(!!res && res.getBoundingClientRect().top < window.innerHeight * 0.5);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const place: Place = inResults ? "results" : mapReady || past ? "map" : "top";
  const tone = light || past ? "white" : "ink";
  // Scroll progress: the rail on the right edge and the trace round the stage frame (ScrollProgress.tsx).
  const marks = useProgress(track);
  // Scrolling back up to the pump closes any open card.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the scroll position, which lives outside React
    if (!mapReady) setSelected(null);
  }, [mapReady]);

  /** Header links: the top, the map at the evening shift, and the sections below. */
  const jump = (to: Place) => {
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
      <TopBar tone={tone} place={place} site={site} onJump={jump} />
      <ProgressRail marks={marks} place={place} tone={tone} onJump={jump} />

      {/* Tall section: its height is the scroll distance. The stage inside stays pinned. */}
      <section ref={track} aria-label="Engine room and site map" className="relative h-[440vh]" style={{ "--r": 0, "--p": 0 } as React.CSSProperties}>
        <div className="welcome-stage sticky top-0 h-svh overflow-hidden">
          <div aria-hidden className="welcome-grid pointer-events-none absolute inset-0" />
          {/* The engine room covers the grid until it fades out at the hand-off. */}
          <RoomStage phases={phases} />
          <div aria-hidden className="welcome-frame pointer-events-none absolute inset-x-4 inset-y-20 border sm:inset-x-10">
            <Corner className="-left-[3.5px] -top-[3.5px]" />
            <Corner className="-right-[3.5px] -bottom-[3.5px]" />
          </div>


          <ProgressFrame />
          <PumpStage phases={phases} gone={selected !== null} compact={compact} />


          {/* The site map: the left column on wide screens, below the pump on phones. Scrolling on runs its clock. */}
          <div className="welcome-map absolute inset-x-0 top-[34svh] bottom-0 flex flex-col px-5 pt-2 md:inset-y-0 md:top-0 md:right-auto md:w-1/2 md:justify-center md:px-10 md:pt-16 lg:px-16">
            {/* Phones show the ticking heading here, and the full panel right after the scroll section. */}
            {compact ? <MapHead site={site} shiftHour={SHIFT_HOUR} panelBelow /> : <AlarmPanel site={site} shiftHour={SHIFT_HOUR} ready={mapReady} selected={selected} onSelect={setSelected} />}
          </div>

          <PumpCard id={selected} site={site} onClose={close} />
        </div>
      </section>

      {compact && (
        <section id="panel" aria-label="Alarm panel" className="bg-white px-5 pt-4 pb-14">
          <AlarmPanel site={site} shiftHour={SHIFT_HOUR} ready selected={selected} onSelect={setSelected} columns={2} />
        </section>
      )}
      <Results />
      <CrewValue />
      {/* The retrofit cards and the closing call to action (MetricCards.tsx, Closing.tsx) are set aside for now. */}
      <footer className="border-t border-mz-line px-5 py-6 text-[13px] leading-relaxed text-mz-muted sm:px-10 lg:px-16">
        Advice only and read-only: nothing is ever sent to a pump, and plant alarms, trips and interlocks stay in charge. Simulated data from the
        RETROFIT AI 2026 benchmark, with alerts from the team&rsquo;s detector. The engine room is an illustration, and the vessel and plant names are fictional.
      </footer>
    </div>
  );
}
