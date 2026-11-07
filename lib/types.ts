// Shared data shapes. Change only by agreement: both UI builders and the detector team rely on these.
// The alert shape follows docs/spec.md section 8.

export type EventClass = "MACHINE" | "SENSOR";

export type Hypothesis = { event_class: EventClass; fault_type: string; probability: number };

export type EvidenceChannel = { channel: string; observed: number | null; expected: number | null; z: number };

export type Alert = {
  alert_id: string;
  asset_id: string;
  alert_time_utc: string;
  /** Hours since this pump's window start. Used for the aligned replay clock. */
  offset_hours: number;
  event_class: EventClass;
  fault_type: string;
  confidence: number;
  confidence_calibrated: boolean;
  detector_version: string;
  recommended_action: string;
  hypotheses: Hypothesis[];
  evidence: {
    summary: string;
    channels: EvidenceChannel[];
    sensor_check?: string;
    blind_spots: string[];
  };
  what_would_settle_it?: string;
  time_to_limit_h?: number;
};

export type PumpMeta = {
  id: string;
  site: string;
  system: string;
  profile: string;
  control: string;
  tier: "T0_LEGACY" | "T1_RETROFIT" | "T2_FULL";
  split: string;
  commissionedYear: number;
  windowStartUtc: string;
  windowEndUtc: string;
  ratedFlow: number;
  ratedHead: number;
  motorKw: number;
  vibrationAlarm: number | null;
  fluid: string;
};

export type Fleet = {
  pumps: PumpMeta[];
  channelMeta: Record<string, { label: string; unit: string }>;
  windowHours: number;
  stepMinutes: number;
};

export type Series = { obs: (number | null)[]; lo: (number | null)[] | null; hi: (number | null)[] | null };

export type PlantAlarm = {
  tag: string;
  type: string;
  priority: number;
  raisedHour: number;
  clearedHour: number | null;
  raisedUtc: string;
  value: number | null;
  limit: number | null;
};

export type MaintenanceNote = {
  id: string;
  workType: string;
  startHour: number;
  endHour: number;
  startUtc: string;
  observation: string;
  diagnosisConfidence: "CONFIRMED" | "PROBABLE" | "UNCERTAIN";
  planned: boolean;
};

export type PumpData = {
  id: string;
  stepMinutes: number;
  windowStartUtc: string;
  points: number;
  channels: string[];
  /** [startHour, endHour, operating state] */
  stateRuns: [number, number, string][];
  series: Record<string, Series>;
  alarms: PlantAlarm[];
  maintenance: MaintenanceNote[];
  history: MaintenanceNote[];
  /** Newest record of each kind of work from before the data window. */
  lastWork?: Record<string, { hour: number; observation: string }>;
  /** Times the schedule gives a chance to stop: [startHour, endHour, label]. */
  stops?: [number, number, string][];
};

export type Case = {
  id: string;
  assetId: string;
  faultType: string;
  eventClass: EventClass;
  alerts: Alert[];
  first: Alert;
  latest: Alert;
};

export type DecisionKind = "approved" | "rejected" | "watching";

export type Finding = "found" | "other" | "nothing";

export type Decision = {
  caseId: string;
  assetId: string;
  faultType: string;
  kind: DecisionKind;
  reason?: string;
  followUpHour?: number;
  /** What the worker found when they checked. */
  finding?: Finding;
  /** The shift hour when the decision was made. */
  atHour: number;
  decidedAt: string;
};

export type PumpState = "Normal" | "Watching" | "Needs review" | "Data problem" | "Stopped";
