export const FAULT_LABEL: Record<string, string> = {
  BEARING_WEAR: "Bearing wear",
  SUCTION_STRAINER_CLOGGING: "Clogged suction strainer",
  CAVITATION: "Cavitation",
  DISCHARGE_RESTRICTION: "Discharge restriction",
  MISALIGNMENT: "Misalignment",
  IMBALANCE: "Imbalance",
  IMPELLER_WEAR: "Impeller wear",
  AIR_ENTRAINMENT: "Air in the water",
  SENSOR_DRIFT: "Sensor drift",
  SENSOR_STUCK: "Stuck sensor",
  SENSOR_CALIBRATION_SHIFT: "Sensor calibration shift",
  SENSOR_NOISE_SPIKES: "Noisy sensor",
  COMMUNICATION_LOSS: "Lost connection",
  UNKNOWN: "Something is wrong, cause unclear",
};

export const faultLabel = (type: string) => FAULT_LABEL[type] ?? type;

export const TIER_LABEL: Record<string, string> = {
  T0_LEGACY: "Legacy sensors",
  T1_RETROFIT: "Low-cost retrofit",
  T2_FULL: "Full sensors",
};

// The app shows one fixed shift from the test week: Day 3 evening. Change this one number after swapping in new alerts.
// Screens use only data at or before it.
export const SHIFT_HOUR = 66;

const whole = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** "5 hours ago" or "3 days ago". */
export function ago(hours: number) {
  if (hours < 1) return "less than an hour ago";
  return hours < 48 ? `${whole(Math.round(hours), "hour")} ago` : `${whole(Math.round(hours / 24), "day")} ago`;
}

/** Clock time a decision was recorded, on this device. */
export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Day and hour across the test week, for the Review timeline. Hour 0 is Day 1 00:00. */
export function clock(hour: number) {
  if (hour >= 168) return "End of week";
  const h = Math.max(0, hour);
  const day = Math.min(Math.floor(h / 24) + 1, 7);
  const inDay = h - (day - 1) * 24;
  const hh = Math.floor(inDay);
  const mm = Math.floor((inDay - hh) * 60);
  return `Day ${day}, ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatUtc(iso: string) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function age(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`;
  if (hours < 48) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
