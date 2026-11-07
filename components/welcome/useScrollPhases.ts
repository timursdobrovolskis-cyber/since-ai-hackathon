"use client";

// Turns the scroll position inside one tall section into three phases, each 0 to 1:
//   room  0 % to 18 %:  the engine room, flying in to one pump
//   pump  18 % to 60 %: the pump zooms, turns and glides right, and the page fades to white
//   time  64 % to 92 %: the site map's clock runs from hour 0 to the shift, then it rests there
// They are written to CSS variables on the section (--r, --p, --t) on every scroll, so CSS can use them without
// React re-rendering. The hour and whether the map can be used are React state, but they change rarely.
import { useEffect, useRef, useState } from "react";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (r: number, a: number, b: number) => clamp01((r - a) / (b - a));

const ROOM = [0, 0.18] as const;
const PUMP = [0.18, 0.6] as const;
const TIME = [0.64, 0.92] as const;

export type Phases = { room: number; pump: number; time: number };

export function useScrollPhases(track: React.RefObject<HTMLElement | null>, shiftHour: number) {
  const phases = useRef<Phases>({ room: 0, pump: 0, time: 0 });
  const [hour, setHour] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = track.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      const r = clamp01(-rect.top / travel);
      const next = { room: span(r, ...ROOM), pump: span(r, ...PUMP), time: span(r, ...TIME) };
      phases.current = next;
      section.style.setProperty("--r", next.room.toFixed(4));
      section.style.setProperty("--p", next.pump.toFixed(4));
      section.style.setProperty("--t", next.time.toFixed(4));
      setHour(Math.round(next.time * shiftHour));
      // The map fades in from pump 0.74. Below this it is too faint to click.
      setMapReady(next.pump >= 0.85);
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

  return { phases, hour, mapReady };
}
