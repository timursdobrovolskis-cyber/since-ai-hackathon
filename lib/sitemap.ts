// The site map on the landing page: 12 pumps on one fictional site, each with a light.
// Lights use the same rule as Today (groupByPump), so the map and Today never disagree at the shift.
import { buildCases } from "./cases.ts";
import { groupByPump, type PumpLine } from "./today.ts";
import type { TrackRecord } from "./trust.ts";
import type { Alert, Case, Decision, PumpData } from "./types.ts";

export type Light = "red" | "orange" | "green" | "none";

export type Zone = { id: string; label: string; pumps: string[] };

/**
 * Zones by system, from `profile` in the organizer assets file. The layout is fictional: in the data these pumps sit on
 * three ships and three plants. PUMP-10, 11 and 12 are the hidden test pumps and carry no data in the app.
 */
export const ZONES: Zone[] = [
  { id: "sw", label: "Seawater cooling", pumps: ["PUMP-01", "PUMP-02", "PUMP-07", "PUMP-08", "PUMP-10"] },
  { id: "fw", label: "Fresh-water cooling", pumps: ["PUMP-03"] },
  { id: "cw", label: "Cooling-water circulation", pumps: ["PUMP-04", "PUMP-05", "PUMP-09", "PUMP-11"] },
  { id: "pw", label: "Process water", pumps: ["PUMP-06", "PUMP-12"] },
];

export const TEST_PUMPS = new Set(["PUMP-10", "PUMP-11", "PUMP-12"]);


export type SiteState = {
  hour: number;
  lights: Record<string, Light>;
  /** The pump's line on Today at this hour, when it has one: the leading concern and any others. */
  lines: Record<string, PumpLine>;
  /** Pumps in Today's order: needs you today, then check the reading, newest first in each. */
  order: { red: string[]; orange: string[] };
  /** Alerts raised so far, and pumps in each group. */
  alerts: number;
  red: number;
  orange: number;
  /** Plant alarms raised so far, across the live pumps. */
  alarms: number;
};

/**
 * The site at `hour`, never later than `shiftHour`. Decisions are used only at the shift itself: they were recorded
 * then, so applying them earlier would let a later choice change an earlier picture.
 */
export function siteAt(
  alerts: Alert[],
  hour: number,
  shiftHour: number,
  decisions: Record<string, Decision>,
  record?: TrackRecord,
  pumps?: Record<string, PumpData>,
): SiteState {
  const h = Math.max(0, Math.min(hour, shiftHour));
  const cases: Case[] = buildCases(alerts, h);
  const { today, readings, wait } = groupByPump(cases, h === shiftHour ? decisions : {}, h, record, pumps);

  const lights: Record<string, Light> = {};
  for (const zone of ZONES) for (const id of zone.pumps) lights[id] = TEST_PUMPS.has(id) ? "none" : "green";
  const lines: Record<string, PumpLine> = {};
  for (const l of wait) [lights[l.assetId], lines[l.assetId]] = ["green", l];
  for (const l of readings) [lights[l.assetId], lines[l.assetId]] = ["orange", l];
  for (const l of today) [lights[l.assetId], lines[l.assetId]] = ["red", l];

  const alarms = Object.values(pumps ?? {}).reduce((n, p) => n + p.alarms.filter((a) => a.raisedHour <= h).length, 0);
  return {
    hour: h,
    lights,
    lines,
    order: { red: today.map((l) => l.assetId), orange: readings.map((l) => l.assetId) },
    alerts: alerts.filter((a) => a.offset_hours <= h).length,
    red: today.length,
    orange: readings.length,
    alarms,
  };
}
