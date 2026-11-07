"use client";

import { clock } from "@/lib/labels";
import { SPEEDS, useApp } from "./AppProvider";

export function ReplayBar() {
  const { hour, setHour, playing, setPlaying, speed, setSpeed, resetDemo } = useApp();
  return (
    <section aria-label="Replay" className="sticky top-13 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel px-4 py-1.5">
      <span className="hidden text-[13px] text-ink-3 sm:inline">Demo replay</span>
      <button
        type="button"
        onClick={() => {
          if (hour >= 168) setHour(0);
          setPlaying(!playing);
        }}
        className="min-h-9 min-w-20 border border-ink bg-ink px-3 font-medium text-raised"
      >
        {playing ? "Pause" : hour >= 168 ? "Replay" : "Play"}
      </button>
      <output className="min-w-28 font-cond text-lg font-semibold" aria-live="off">{clock(hour)}</output>
      <input
        type="range"
        min={0}
        max={168}
        step={0.25}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        aria-label="Replay time"
        className="min-w-28 flex-1"
      />
      <div className="hidden sm:flex" role="group" aria-label="Replay speed">
        {SPEEDS.map((s) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={speed === s.hoursPerSecond}
            onClick={() => setSpeed(s.hoursPerSecond)}
            className={`-ml-px min-h-9 border border-line px-2 text-[13px] first:ml-0 ${speed === s.hoursPerSecond ? "bg-raised font-semibold" : "text-ink-2"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={resetDemo} className="hidden min-h-9 text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink sm:block">
        Reset demo
      </button>
    </section>
  );
}
