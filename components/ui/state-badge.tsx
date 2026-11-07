import type { PumpState } from "@/lib/types";

// Normal and Stopped stay grey on purpose: colour only appears when something needs attention.
const STYLE: Record<PumpState, string> = {
  "Needs review": "border-machine text-machine font-semibold",
  "Data problem": "border-sensor text-sensor font-semibold",
  Watching: "border-ink text-ink font-medium",
  Stopped: "border-line text-ink-2",
  Normal: "border-line text-ink-2",
};

export function StateBadge({ state }: { state: PumpState }) {
  return <span className={`inline-block rounded-full border px-2 py-px text-[12px] whitespace-nowrap ${STYLE[state]}`}>{state}</span>;
}
