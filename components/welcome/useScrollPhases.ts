"use client";

// Turns the scroll position inside one tall section into two phases, each 0 to 1:
//   room  0 % to 49 %:  the engine room, walking in to Pump 8
//   pump  49 % to 84 %: the pump zooms, turns a quarter of the way round and glides right, and the page fades to white
// The last 16 % holds the alarm panel and the pump still, so there is time to use them before the page moves on.
// The panel shows the evening shift as it stands, with no clock running.
// Both phases are written to CSS variables on the section (--r, --p) on every scroll, so CSS can use them without
// React re-rendering. Whether the panel can be used is React state, but it changes rarely.
import { useEffect, useRef, useState } from "react";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (r: number, a: number, b: number) => clamp01((r - a) / (b - a));

// In scroll heights of the section's travel (385 viewport heights): room 190, pump 135, hold 60.
const ROOM = [0, 0.494] as const;
const PUMP = [0.494, 0.844] as const;

export type Phases = { room: number; pump: number };

export function useScrollPhases(track: React.RefObject<HTMLElement | null>) {
  const phases = useRef<Phases>({ room: 0, pump: 0 });
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
      const next = { room: span(r, ...ROOM), pump: span(r, ...PUMP) };
      phases.current = next;
      section.style.setProperty("--r", next.room.toFixed(4));
      section.style.setProperty("--p", next.pump.toFixed(4));
      // The panel fades in from pump 0.74. Below this it is too faint to click.
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
  }, [track]);

  return { phases, mapReady };
}
