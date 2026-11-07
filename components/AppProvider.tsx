"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildCases } from "@/lib/cases";
import { loadAlerts, loadFleet, loadPump, loadTrackRecord } from "@/lib/data";
import type { TrackRecord } from "@/lib/trust";
import type { Alert, Case, Decision, Finding, Fleet, PumpData } from "@/lib/types";

const STORE_KEY = "retrofit-assist-decisions-v1";
const WINDOW_HOURS = 168;

export const SPEEDS = [
  { label: "1 h/s", hoursPerSecond: 1 },
  { label: "6 h/s", hoursPerSecond: 6 },
  { label: "24 h/s", hoursPerSecond: 24 },
];

type App = {
  fleet: Fleet | null;
  pumps: Record<string, PumpData>;
  alertSource: string;
  error: string | null;
  hour: number;
  setHour: (hour: number) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  speed: number;
  setSpeed: (hoursPerSecond: number) => void;
  /** Cases known at the current replay hour. Nothing later than `hour` is in here. */
  cases: Case[];
  decisions: Record<string, Decision>;
  decide: (decision: Omit<Decision, "decidedAt" | "atHour">) => void;
  recordFinding: (caseId: string, finding: Finding) => void;
  /** How often each named cause has been right. Totals only. */
  record: TrackRecord | undefined;
  resetDemo: () => void;
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
  const [hour, setHourRaw] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[1].hoursPerSecond);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const hourRef = useRef(0);

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
    // A link can open at a replay time, for example /cases/PUMP-08-A0001?h=90
    const start = Number(new URLSearchParams(window.location.search).get("h"));
    if (start > 0) {
      hourRef.current = Math.min(WINDOW_HOURS, start);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only available after mount
      setHourRaw(hourRef.current);
    }
    try {
      const saved = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after mount
      if (saved) setDecisions(JSON.parse(saved));
    } catch {
      // A damaged log should not stop the app. It starts empty instead.
    }
  }, []);

  const setHour = useCallback((next: number) => {
    const clamped = Math.min(WINDOW_HOURS, Math.max(0, next));
    hourRef.current = clamped;
    setHourRaw(clamped);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = hourRef.current + ((now - last) / 1000) * speed;
      last = now;
      setHour(next);
      if (next >= WINDOW_HOURS) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, setHour]);

  const save = (next: Record<string, Decision>) => {
    setDecisions(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  };

  const decide: App["decide"] = (decision) => {
    save({ ...decisions, [decision.caseId]: { ...decision, atHour: hourRef.current, decidedAt: new Date().toISOString() } });
  };

  const recordFinding: App["recordFinding"] = (caseId, finding) => {
    save({ ...decisions, [caseId]: { ...decisions[caseId], finding } });
  };

  const resetDemo = () => {
    save({});
    setPlaying(false);
    setHour(0);
  };

  const cases = useMemo(() => buildCases(alerts, hour), [alerts, hour]);

  return (
    <Ctx.Provider value={{ fleet, pumps, alertSource, error, hour, setHour, playing, setPlaying, speed, setSpeed, cases, decisions, decide, recordFinding, record, resetDemo }}>
      {children}
    </Ctx.Provider>
  );
}
