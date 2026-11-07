import type { TrackRecord } from "./trust";
import type { Alert, Fleet, PumpData } from "./types";

const json = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json() as Promise<T>;
};

export const loadFleet = () => json<Fleet>("/data/fleet.json");
export const loadAlerts = () => json<{ source: string; alerts: Alert[] }>("/data/alerts.json");
export const loadPump = (id: string) => json<PumpData>(`/data/pumps/${id}.json`);
/** Totals from the organizers' scorer, for the alerts and for the plant's own alarms. Totals only, so nothing labelled loads. */
export type KeyNumbers = {
  source: string;
  caught: number;
  faults: number;
  alarmsCaught: number;
  medianWarningH: number;
  recall: number;
  falsePerPumpDay: number;
  falsePerPumpDayAlarms: number;
  /** Faults whose detecting alert named the right fault type. */
  rightCause: number;
  rightCauseAlarms: number;
  /** Faults that reached a conventional limit within the test week, and how many each side warned about before it. */
  withLimit: number;
  beforeLimit: number;
  beforeLimitAlarms: number;
};
export const loadKeyNumbers = () => json<KeyNumbers>("/data/key-numbers.json");
export const loadTrackRecord = () => json<{ source: string; causes: TrackRecord }>("/data/track-record.json");

// Labelled events live in public/data/review. Only the Review view may fetch them.
