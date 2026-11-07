"use client";

// Turns the scroll position inside one tall section into two phases:
//   pump  0 to 1 over the first 55 % of the scroll: the pump zooms, turns, glides right, the page fades to white
//   time  0 to 1 from 60 % to 96 %: the site map's clock runs from hour 0 to the shift
// Both are written to CSS variables on the section (--p and --t) on every scroll, so CSS can use them without
// React re-rendering. The hour is React state, but it only changes on whole hours, 66 times in all.
import { useEffect, useRef, useState } from "react";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const PUMP_SHARE = 0.55;
const TIME_START = 0.6;
const TIME_END = 0.96;

export type Phases = { pump: number; time: number };

export function useScrollPhases(track: React.RefObject<HTMLElement | null>, shiftHour: number) {
  const phases = useRef<Phases>({ pump: 0, time: 0 });
  const [hour, setHour] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = track.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      const r = clamp01(-rect.top / travel);
      const pump = clamp01(r / PUMP_SHARE);
      const time = clamp01((r - TIME_START) / (TIME_END - TIME_START));
      phases.current = { pump, time };
      section.style.setProperty("--p", pump.toFixed(4));
      section.style.setProperty("--t", time.toFixed(4));
      setHour(Math.round(time * shiftHour));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [track, shiftHour]);

  return { phases, hour };
}
