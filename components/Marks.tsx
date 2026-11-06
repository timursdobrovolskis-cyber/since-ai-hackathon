import type { EventClass } from "@/lib/types";

/** Shape and colour both carry meaning, so a mark still reads for colour-blind users and in greyscale. */
export function CaseMark({ eventClass, faultType, size = 14 }: { eventClass: EventClass; faultType?: string; size?: number }) {
  if (faultType === "UNKNOWN") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" role="img" aria-label="Cause unclear" className="shrink-0">
        <circle cx="7" cy="7" r="5.25" fill="none" stroke="var(--unknown)" strokeWidth="2" />
      </svg>
    );
  }
  if (eventClass === "SENSOR") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" role="img" aria-label="Sensor problem" className="shrink-0">
        <path d="M7 0.8 13.2 7 7 13.2 0.8 7Z" fill="var(--sensor)" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" role="img" aria-label="Machine problem" className="shrink-0">
      <path d="M7 1 13.5 13H0.5Z" fill="var(--machine)" />
    </svg>
  );
}

export const classLabel = (eventClass: EventClass) => (eventClass === "SENSOR" ? "Sensor problem" : "Machine problem");
