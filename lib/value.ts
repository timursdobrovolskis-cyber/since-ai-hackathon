// What the alerts are worth to the crew, in the organizers' own money terms (lib/payback.ts BASE, from their
// examples/business_case.py). Every figure is illustrative: the inputs are their assumptions on synthetic data.
import { BASE } from "./payback.ts";

/**
 * A pump opened for nothing because a lying sensor looked like a machine fault: at least a planned stop of the
 * organizers' length at their downtime cost. No repair cost is counted, so this is a floor.
 */
export const NEEDLESS_OPENING_EUR = BASE.plannedStopH * BASE.downtimeEurH;

/** Extra cost of letting a developing fault run into a breakdown instead of fixing it at a planned stop. */
export const BREAKDOWN_EXTRA_EUR =
  (BASE.unplannedStopH - BASE.plannedStopH) * BASE.downtimeEurH + (BASE.repairUnplannedEur - BASE.repairPlannedEur);

/** "EUR 45,000" in the app's style. */
export const euros = (v: number) => `€${Math.round(v).toLocaleString("en-GB")}`;
