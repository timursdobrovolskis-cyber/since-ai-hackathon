"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildCases } from "@/lib/cases";
import { loadAlerts, loadFleet, loadPump, loadTrackRecord } from "@/lib/data";
import { SHIFT_HOUR } from "@/lib/labels";
import type { TrackRecord } from "@/lib/trust";
import type { Alert, Case, Decision, Finding, Fleet, PumpData } from "@/lib/types";

const STORE_KEY = "retrofit-assist-decisions-v1";

type App = {
  fleet: Fleet | null;
  pumps: Record<string, PumpData>;
  alertSource: string;
  error: string | null;
  /** The fixed shift the app shows. Nothing later than this is on a live screen. */
  hour: number;
  /** Cases known at `hour`. */
  cases: Case[];
  decisions: Record<string, Decision>;
  decide: (decision: Omit<Decision, "decidedAt" | "atHour">) => void;
  recordFinding: (caseId: string, finding: Finding) => void;
  /** How often each named cause has been right. Totals only. */
  record: TrackRecord | undefined;
  clearDecisions: () => void;
};

const Ctx = createContext<App | null>(null);

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [pumps, setPumps] = useState<Record<string, PumpData>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertSource, setAlertSource] = useState("");
  const [record, setRecord] = useState<TrackRecord>();
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  useEffect(() => {
    (async () => {
      try {
        const [f, a] = await Promise.all([loadFleet(), loadAlerts()]);
        const loaded = await Promise.all(f.pumps.map((p) => loadPump(p.id)));
        setFleet(f);
        setAlerts(a.alerts);
        setAlertSource(a.source);
        setPumps(Object.fromEntries(loaded.map((p) => [p.id, p])));
        // Trust wording is an extra. It only applies when it was built for these same alerts.
        loadTrackRecord().then((t) => t.source === a.source && setRecord(t.causes)).catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "The pump data could not be loaded.");
      }
    })();
    try {
      const saved = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after mount
      if (saved) setDecisions(JSON.parse(saved));
    } catch {
      // A damaged log should not stop the app. It starts empty instead.
    }
  }, []);

  const save = (next: Record<string, Decision>) => {
    setDecisions(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  };

  const decide: App["decide"] = (decision) => {
    save({ ...decisions, [decision.caseId]: { ...decision, atHour: SHIFT_HOUR, decidedAt: new Date().toISOString() } });
  };

  const recordFinding: App["recordFinding"] = (caseId, finding) => {
    save({ ...decisions, [caseId]: { ...decisions[caseId], finding } });
  };

  const clearDecisions = () => save({});

  const cases = useMemo(() => buildCases(alerts, SHIFT_HOUR), [alerts]);

  return (
    <Ctx.Provider value={{ fleet, pumps, alertSource, error, hour: SHIFT_HOUR, cases, decisions, decide, recordFinding, record, clearDecisions }}>
      {children}
    </Ctx.Provider>
  );
}
