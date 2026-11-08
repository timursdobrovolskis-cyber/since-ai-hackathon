// Port of evaluate() from the organizers' examples/business_case.py. lib/payback.test.ts checks it against their output.
// Every result is illustrative: inputs are assumptions or benchmark measurements on synthetic data.

export type Inputs = {
  faultsPerYear: number;
  recall: number;
  falsePerPumpDay: number;
  unplannedStopH: number;
  plannedStopH: number;
  downtimeEurH: number;
  repairUnplannedEur: number;
  repairPlannedEur: number;
  falseAlertEur: number;
  installedEur: number;
  operatingEurYear: number;
};

export const BASE: Inputs = {
  faultsPerYear: 0.6,
  recall: 0.889,
  falsePerPumpDay: 0.071,
  unplannedStopH: 10,
  plannedStopH: 3,
  downtimeEurH: 1500,
  repairUnplannedEur: 9000,
  repairPlannedEur: 4000,
  falseAlertEur: 120,
  installedEur: 4500,
  operatingEurYear: 700,
};

export function evaluate(p: Inputs) {
  const caughtPerYear = p.faultsPerYear * p.recall;
  const benefit = caughtPerYear * ((p.unplannedStopH - p.plannedStopH) * p.downtimeEurH + p.repairUnplannedEur - p.repairPlannedEur);
  const falseAlertCost = p.falsePerPumpDay * 365 * p.falseAlertEur;
  const net = benefit - falseAlertCost - p.operatingEurYear;
  const paybackYears = net > 0 ? p.installedEur / net : Infinity;
  return { caughtPerYear, benefit, falseAlertCost, net, paybackYears };
}

/** Downtime cost per hour needed for payback within `years`. Same bisection as the organizers' script. */
export function breakEvenDowntime(p: Inputs, years = 5) {
  let lo = 0;
  let hi = 50000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (evaluate({ ...p, downtimeEurH: mid }).net > p.installedEur / years) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** False alerts per pump per day at which the net effect reaches zero. */
export function breakEvenFalseAlerts(p: Inputs) {
  const { benefit } = evaluate(p);
  return Math.max(0, (benefit - p.operatingEurYear) / (365 * p.falseAlertEur));
}

export const SWINGS: { key: keyof Inputs; label: string; low: number; high: number }[] = [
  { key: "faultsPerYear", label: "Developing faults per year", low: 0.2, high: 1.2 },
  { key: "recall", label: "Share caught early", low: 0.4, high: 0.95 },
  { key: "falsePerPumpDay", label: "False alerts per pump per day", low: 0, high: 0.5 },
  { key: "downtimeEurH", label: "Downtime cost, EUR per hour", low: 0, high: 5000 },
  { key: "repairUnplannedEur", label: "Unplanned repair, EUR", low: 5000, high: 15000 },
  { key: "installedEur", label: "Installed cost, EUR", low: 2500, high: 12000 },
];
