"use client";

// Scroll progress. Of four versions compared on 7 Nov, Jona kept two, used together:
//   rail   a thin rail on the right edge with a square point per section, filling down, and the points jump there
//   frame  the stage's drawing frame is traced round in the accent as you scroll the engine room and the pump
// useProgress writes the fills as CSS variables on <html> on every scroll frame, so nothing re-renders while scrolling:
//   --page  the whole page, 0 to 1
//   --t     the pinned stage, 0 to 1
import { useEffect, useState } from "react";
import type { Place } from "./TopBar";
import { ROOM } from "./useScrollPhases";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Where each section starts, as a share of the page's scroll, for the rail's points. */
export type Marks = [number, number, number];

export function useProgress(track: React.RefObject<HTMLElement | null>) {
  const [marks, setMarks] = useState<Marks>([0, 0.5, 0.9]);
  useEffect(() => {
    let frame = 0;
    let lastMarks = "";
    const update = () => {
      frame = 0;
      const el = track.current;
      const res = document.getElementById("results");
      if (!el || !res) return;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const top = el.getBoundingClientRect().top + y;
      const travel = Math.max(1, el.offsetHeight - window.innerHeight);
      // The alarm panel begins where the walk through the room ends, and the results once they fill half the screen.
      const b1 = top + travel * ROOM[1];
      const b2 = Math.min(max, res.getBoundingClientRect().top + y - window.innerHeight * 0.5);
      const root = document.documentElement.style;
      root.setProperty("--page", (y / max).toFixed(4));
      root.setProperty("--t", clamp01((y - top) / travel).toFixed(4));
      const m = `${b1 / max},${b2 / max}`;
      if (m !== lastMarks) {
        lastMarks = m;
        setMarks([0, b1 / max, b2 / max]);
      }
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    // The results load after the page, which changes the page height, so check again once things settle.
    const late = window.setTimeout(update, 1200);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(late);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [track]);
  return marks;
}

/** The rail on the right edge, with a point per section. A point's name shows on hover or focus only, so it never covers the page. */
export function ProgressRail({ marks, place, tone, onJump }: { marks: Marks; place: Place; tone: "ink" | "white"; onJump: (to: Place) => void }) {
  const points: { to: Place; label: string }[] = [
    { to: "top", label: "Engine room" },
    { to: "map", label: "Alarm panel" },
    { to: "results", label: "Results" },
  ];
  return (
    <nav aria-label="Page progress" data-tone={tone} className="progress-rail fixed top-1/2 right-2 z-30 hidden h-[44vh] w-6 -translate-y-1/2 md:block">
      <span aria-hidden className="progress-rail-track absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      <span aria-hidden className="progress-rail-fill absolute top-0 left-1/2 w-px -translate-x-1/2" />
      {points.map((p, i) => {
        const on = place === p.to;
        return (
          <button
            key={p.to}
            type="button"
            aria-current={on ? "location" : undefined}
            onClick={() => onJump(p.to)}
            style={{ top: `${marks[i] * 100}%` }}
            className="progress-rail-point group absolute left-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          >
            <span aria-hidden className="progress-rail-dot block size-2" />
            <span className="progress-rail-label pointer-events-none absolute right-7 whitespace-nowrap px-2 py-1 text-[12px] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
              {p.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** The frame trace: the stage's frame. Sits inside the stage, over the frame. */
export function ProgressFrame() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-4 inset-y-20 sm:inset-x-10">
      <svg className="absolute inset-0 size-full overflow-visible">
        <rect x="0" y="0" width="100%" height="100%" pathLength={1} className="progress-frame" fill="none" />
      </svg>
    </div>
  );
}

