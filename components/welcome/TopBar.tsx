"use client";

// The bar across the top of the site, with the Vahti logo on the left. It is always a solid bar, so the drawing and the sections never run under its
// words: ink over the engine room, white once the stage has faded to white and over the sections below. The section
// you are in is marked, and on wider screens the right side says how many pumps need you at the shift, from the same
// site state as the alarm panel, and jumps there.
import { TriangleAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SiteState } from "@/lib/sitemap";

export type Place = "top" | "map" | "results";

const LINKS: { to: Place; label: string }[] = [
  { to: "top", label: "Engine room" },
  { to: "map", label: "Alarm panel" },
  { to: "results", label: "Results" },
];

export function TopBar({ tone, place, site, onJump }: { tone: "ink" | "white"; place: Place; site: SiteState; onJump: (to: Place) => void }) {
  const ink = tone === "ink";
  return (
    <header data-tone={tone} className="top-bar fixed inset-x-0 top-0 z-30 h-14 sm:h-16">
      <div className="flex h-full items-stretch justify-between gap-4 px-5 sm:px-10">
        <div className="flex items-stretch gap-5 sm:gap-10">
        <button type="button" onClick={() => onJump("top")} aria-label="Vahti, back to the engine room" className="flex items-center">
          <Logo className="h-[17px] w-auto sm:h-[21px]" />
        </button>
        <nav aria-label="Sections" className="flex items-stretch gap-4 text-[15px] sm:gap-8">
          {LINKS.map((l) => {
            const on = place === l.to;
            return (
              <button
                key={l.to}
                type="button"
                aria-current={on ? "location" : undefined}
                onClick={() => onJump(l.to)}
                className={`top-bar-link relative flex items-center transition-colors ${on ? "top-bar-on" : ""}`}
              >
                {l.label}
              </button>
            );
          })}
        </nav>
        </div>
        {site.red > 0 && (
          <button
            type="button"
            onClick={() => onJump("map")}
            className={`press my-auto hidden min-h-9 items-center gap-2 px-3.5 text-[14px] transition-colors sm:inline-flex ${
              ink ? "bg-white/10 text-white hover:bg-white/16" : "bg-mz-panel text-mz-ink hover:bg-[#ececf0]"
            }`}
          >
            <span aria-hidden className="ann-key ann-key-needs">
              <TriangleAlert className="size-2.5" strokeWidth={2.5} />
            </span>
            {site.red} {site.red === 1 ? "pump needs" : "pumps need"} you this evening
          </button>
        )}
      </div>
    </header>
  );
}
