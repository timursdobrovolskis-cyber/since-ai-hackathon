"use client";

// Scroll progress, in four versions to compare (7 Nov, night). Pick one with ?progress= on the page URL:
//   bar    a hairline in the accent along the bottom of the top bar, filling left to right over the whole page
//   nav    each section link in the top bar fills its own underline while you are in that section
//   rail   a thin rail on the right edge with a point per section, filling down, and the points jump there
//   frame  the stage's drawing frame is traced round in the accent as you scroll the engine room and the pump
// useProgress writes the fills as CSS variables on <html> on every scroll frame, so nothing re-renders while scrolling:
//   --page  the whole page, 0 to 1
//   --s0 --s1 --s2  the engine room, the alarm panel and the results, each 0 to 1
//   --t     the pinned stage, 0 to 1
import { useEffect, useState } from "react";
import type { Place } from "./TopBar";
import { ROOM } from "./useScrollPhases";

export type ProgressKind = "bar" | "nav" | "rail" | "frame";
export const PROGRESS_KINDS: ProgressKind[] = ["bar", "nav", "rail", "frame"];
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
      root.setProperty("--s0", clamp01(y / b1).toFixed(4));
      root.setProperty("--s1", clamp01((y - b1) / Math.max(1, b2 - b1)).toFixed(4));
      root.setProperty("--s2", clamp01((y - b2) / Math.max(1, max - b2)).toFixed(4));
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

/** The version chosen with ?progress=, else the default. */
export function useProgressKind(fallback: ProgressKind) {
  const [kind, setKind] = useState<ProgressKind>(fallback);
  const [compare, setCompare] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("progress") as ProgressKind | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after mount
    if (q && PROGRESS_KINDS.includes(q)) setKind(q);
    setCompare(q !== null);
  }, []);
  const choose = (k: ProgressKind) => {
    setKind(k);
    const url = new URL(window.location.href);
    url.searchParams.set("progress", k);
    window.history.replaceState(null, "", url);
  };
  return { kind, choose, compare };
}

/** Version "bar": a hairline under the top bar. */
export function ProgressBar() {
  return <div aria-hidden className="progress-bar pointer-events-none fixed inset-x-0 top-14 z-30 h-[2px] sm:top-16" />;
}

/** Version "rail": a rail on the right edge with a point per section. */
export function ProgressRail({ marks, place, tone, onJump }: { marks: Marks; place: Place; tone: "ink" | "white"; onJump: (to: Place) => void }) {
  const points: { to: Place; label: string }[] = [
    { to: "top", label: "Engine room" },
    { to: "map", label: "Alarm panel" },
    { to: "results", label: "Results" },
  ];
  return (
    <nav aria-label="Page progress" data-tone={tone} className="progress-rail fixed top-1/2 right-3 z-30 hidden h-[44vh] w-6 -translate-y-1/2 md:block lg:right-5">
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
            <span aria-hidden className="progress-rail-dot block size-2 rounded-full" />
            <span className={`progress-rail-label absolute right-7 whitespace-nowrap rounded-[4px] px-2 py-1 text-[12px] ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
              {p.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Version "frame": traces the stage's frame. Sits inside the stage, over the frame. */
export function ProgressFrame() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-4 inset-y-20 sm:inset-x-10">
      <svg className="absolute inset-0 size-full overflow-visible">
        <rect x="0" y="0" width="100%" height="100%" pathLength={1} className="progress-frame" fill="none" />
      </svg>
    </div>
  );
}

/** A small switch to compare the versions, shown only when the URL asks for one. Temporary. */
export function ProgressSwitch({ kind, choose }: { kind: ProgressKind; choose: (k: ProgressKind) => void }) {
  return (
    <div role="group" aria-label="Progress line version" className="fixed right-4 bottom-4 z-50 flex gap-1 rounded-full bg-white p-1 text-[13px] shadow-[0_0_0_1px_var(--mz-line),0_8px_24px_-12px_rgb(11_16_20/0.4)]">
      {PROGRESS_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={kind === k}
          onClick={() => choose(k)}
          className={`min-h-8 rounded-full px-3 capitalize ${kind === k ? "bg-mz-ink text-white" : "text-mz-ink hover:bg-mz-panel"}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
