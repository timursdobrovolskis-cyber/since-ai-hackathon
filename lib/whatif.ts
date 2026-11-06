// Pre-computed sandbox results from tools/build_what_if.py. Contains no labels, so live screens may load it.

export type SimState = {
  speed_ratio: number | null;
  flow_m3h: number | null;
  duty_satisfaction: number | null;
  npsh_margin: number | null;
  input_kw: number | null;
  energy_eur_per_day: number | null;
  risk_proxy: number | null;
};

export type SimOption = {
  action: string;
  label: string;
  allowed: boolean;
  reasons: string[];
  warnings: string[];
  proposed: SimState | null;
  stopHours: number | null;
  labourHours: number | null;
  partsEur: number | null;
  costEur: number | null;
};

export type Severity = "mild" | "moderate" | "severe";

export type SimResult =
  | { unavailable: string }
  | {
      assumption: { name: string; key: string };
      severities: Record<Severity, { level: number; now: SimState; warnings: string[]; options: SimOption[] }>;
    };

export type SimIndex = { alertIds: string[]; caveats: string[] };

const json = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json() as Promise<T>;
};

export const loadSimIndex = () => json<SimIndex>("/data/whatif/index.json");
export const loadSimResult = (alertId: string) => json<SimResult>(`/data/whatif/${alertId}.json`);
