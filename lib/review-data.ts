// Labelled faults and scores. Import this file from the Review view ONLY, so live replay screens cannot see the answers.
import type { EventClass } from "./types";

export type ReviewEvent = {
  id: string;
  eventClass: EventClass;
  faultType: string;
  severity: string;
  observable: boolean;
  onsetHour: number;
  detectableHour: number | null;
  deadlineHour: number | null;
  endHour: number | null;
};

export type ReviewPump = { events: ReviewEvent[] };

export type Scores = {
  composite_score: number;
  event_recall: number;
  fault_type_recall: number;
  false_alerts_per_asset_day: number;
  median_lead_time_h: number | null;
  early_warning_rate: number | null;
  events_scored: number;
  true_positive_events: number;
  false_alert_episodes: number;
  excess_repeat_episodes: number;
};

export type PerEvent = {
  eventId: string;
  detected: boolean;
  firstAlertHour: number | null;
  predictedType: string | null;
  typeCorrect: boolean;
  classCorrect: boolean;
  leadHours: number | null;
  repeats: number;
  plantDetected: boolean;
  plantLeadHours: number | null;
};

export type Scorecard = {
  alertSource: string;
  totals: Record<"plant" | "current", Record<"all" | "train" | "validation", Scores>>;
  pumps: Record<string, {
    perEvent: PerEvent[];
    falseAlertIds: string[];
    falseAlertEpisodes: number;
    excessRepeatEpisodes: number;
    currentCaught: number;
    plantCaught: number;
    eventsScored: number;
  }>;
};

const json = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json() as Promise<T>;
};

export const loadScorecard = () => json<Scorecard>("/data/review/scorecard.json");
export const loadReviewPump = (id: string) => json<ReviewPump>(`/data/review/${id}.json`);
