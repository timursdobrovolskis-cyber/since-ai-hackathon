// What each sensor level adds and costs. Text and prices come from the organizers' RETROFIT_FEASIBILITY.md.
// List prices were seen on 30 Oct 2026. Assumptions are estimates from the same document, to be replaced with quotes.

export type LevelKey = "T0_LEGACY" | "T1_RETROFIT" | "T2_FULL";

export type Part = { item: string; price: string; basis: "List price" | "Assumption" };

export type Level = {
  key: LevelKey;
  name: string;
  total: string;
  totalNote: string;
  adds: string;
  sees: string[];
  cannotSee: string[];
  parts: Part[];
};

export const LEVELS: Level[] = [
  {
    key: "T0_LEGACY",
    name: "Legacy sensors",
    total: "about EUR 500-600",
    totalNote: "The edge computer alone, because the signals already exist.",
    adds: "No new sensors. Reads what the motor starter, drive and pressure gauge already report.",
    sees: ["Hydraulic changes such as restriction and impeller wear", "Stuck or offset transmitters", "Lost communication"],
    cannotSee: ["Early bearing damage", "Imbalance", "Misalignment"],
    parts: [{ item: "Edge computer", price: "EUR 497-602", basis: "List price" }],
  },
  {
    key: "T1_RETROFIT",
    name: "Low-cost retrofit",
    total: "about EUR 1.9-5.4 k",
    totalNote: "Our sum of the parts below. Mostly assumptions, because wireless platforms publish no prices.",
    adds: "A suction pressure transmitter, and a battery wireless vibration and temperature sensor on the bearing housing.",
    sees: ["Clogging and cavitation on the suction side", "Bearing damage from stage 2", "Imbalance and misalignment"],
    cannotSee: ["Short events between the 5-minute wireless updates", "Efficiency based on flow"],
    parts: [
      { item: "Suction pressure transmitter, industrial or class-approved", price: "EUR 145-288", basis: "List price" },
      { item: "Wireless vibration and temperature point", price: "EUR 300-1,500", basis: "Assumption" },
      { item: "Wireless gateway", price: "EUR 1,000-3,000", basis: "Assumption" },
      { item: "Edge computer", price: "EUR 497-602", basis: "List price" },
    ],
  },
  {
    key: "T2_FULL",
    name: "Full sensors",
    total: "about EUR 2.3-2.8 k",
    totalNote: "Option B plus indicative flow. Instrument-grade flow instead adds EUR 3-10 k. Valve feedback is not priced in the source.",
    adds: "Wired vibration at 1 s, a power meter, a flow meter, a winding temperature probe and valve feedback.",
    sees: ["The pump's operating point and efficiency", "Early and fast faults", "Better separation of sensor and machine problems"],
    cannotSee: ["Mechanical seal leaks, which are not in this benchmark"],
    parts: [
      { item: "Option B: 2 wired vibration sensors, 2 pressure transmitters, temperature probe, energy meter, edge computer", price: "EUR 2,100-2,400", basis: "Assumption" },
      { item: "Clamp-on flow meter, indicative grade", price: "EUR 200-400", basis: "List price" },
    ],
  },
];
