import type { PumpState } from "@/lib/types";

// Normal and Stopped stay grey on purpose: colour only appears when something needs attention.
// Orange is a machine problem, ice blue a sensor problem. Watching is a quiet orange outline, not a new hue.
const STYLE: Record<PumpState, string> = {
  "Needs review": "border-machine text-machine",
  "Data problem": "border-sensor text-sensor",
  Watching: "border-machine/50 text-ink",
  Stopped: "border-line text-ink-3",
  Normal: "border-line text-ink-3",
};

export function StateBadge({ state }: { state: PumpState }) {
  return (
    <span className={`inline-block rounded-sm border px-1.5 py-px font-mono text-[11px] font-medium tracking-[0.06em] whitespace-nowrap uppercase ${STYLE[state]}`}>
      {state}
    </span>
  );
}
