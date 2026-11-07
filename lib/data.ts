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
export type KeyNumbers = { source: string; caught: number; faults: number; alarmsCaught: number; medianWarningH: number; recall: number; falsePerPumpDay: number };
export const loadKeyNumbers = () => json<KeyNumbers>("/data/key-numbers.json");
export const loadTrackRecord = () => json<{ source: string; causes: TrackRecord }>("/data/track-record.json");

// Labelled events live in public/data/review. Only the Review view may fetch them.
