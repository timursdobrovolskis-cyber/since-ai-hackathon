"use client";

import { faultLabel } from "@/lib/labels";
import type { ReviewEvent } from "@/lib/review-data";
import type { Alert, PumpData } from "@/lib/types";
import { CaseMark } from "./Marks";

const WINDOW = 168;
const pct = (hour: number) => `${(hour / WINDOW) * 100}%`;
const DAYS = [0, 1, 2, 3, 4, 5, 6];

function Lane({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[12rem_1fr] items-center border-b" style={{ borderColor: "var(--line-soft)" }}>
      <div className="py-1 pr-2 text-[13px] leading-tight">
        {label}
        {note && <span className="block text-ink-3">{note}</span>}
      </div>
      <div className="relative h-8 bg-raised">{children}</div>
    </div>
  );
}

type Props = {
  pump: PumpData;
  events: ReviewEvent[];
  firstAlerts: Record<string, number | null>;
  alerts: Alert[];
  falseIds: Set<string>;
};

export function ReviewTimeline({ pump, events, firstAlerts, alerts, falseIds }: Props) {
  const stops = pump.stateRuns.filter(([, , s]) => s === "STOPPED" || s === "LOCKED_OUT" || s === "NO_DATA");
  return (
    <div role="group" aria-label="Timeline of true faults, alerts, plant alarms, work orders and stops. The table below lists the same faults.">
      <div className="grid grid-cols-[12rem_1fr] border-b border-line pb-1 text-[13px] text-ink-3">
        <span>True faults</span>
        <div className="relative h-5">
          {DAYS.map((d) => <span key={d} className="absolute" style={{ left: pct(d * 24) }}>Day {d + 1}</span>)}
        </div>
      </div>
      {events.map((e) => {
        const first = firstAlerts[e.id];
        const end = e.endHour ?? WINDOW;
        return (
          <Lane key={e.id} label={faultLabel(e.faultType)} note={e.observable ? undefined : "Cannot be seen with these sensors"}>
            <span
              className="absolute inset-y-2"
              style={{
                left: pct(e.onsetHour),
                width: pct(Math.max(end - e.onsetHour, 0.5)),
                background: e.observable ? "var(--stop)" : "repeating-linear-gradient(45deg, var(--stop) 0 3px, transparent 3px 7px)",
              }}
            />
            {e.deadlineHour !== null && (
              <span title="Conventional limit reached" className="absolute inset-y-0.5 w-0.5 bg-ink" style={{ left: pct(e.deadlineHour) }} />
            )}
            {first !== null && first !== undefined && (
              <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(first) }}>
                <CaseMark eventClass={e.eventClass} size={15} />
              </span>
            )}
          </Lane>
        );
      })}
      <Lane label="All alerts raised">
        {alerts.map((a) => (
          <span key={a.alert_id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(a.offset_hours) }}>
            {falseIds.has(a.alert_id) ? (
              <svg width="13" height="13" viewBox="0 0 13 13" role="img" aria-label="False alert">
                <path d="M2 2 11 11M11 2 2 11" stroke="var(--ink)" strokeWidth="2.25" />
              </svg>
            ) : (
              <CaseMark eventClass={a.event_class} faultType={a.fault_type} size={12} />
            )}
          </span>
        ))}
      </Lane>
      <Lane label="Plant alarms">
        {pump.alarms.map((a) => (
          <span key={`${a.tag}-${a.raisedHour}`} className="absolute inset-y-2 w-0.5 bg-ink" style={{ left: pct(a.raisedHour) }} />
        ))}
      </Lane>
      <Lane label="Work orders">
        {pump.maintenance.map((m) => (
          <span
            key={m.id}
            title={m.workType.replaceAll("_", " ").toLowerCase()}
            className={`absolute inset-y-2.5 min-w-1 ${m.planned ? "bg-[var(--band)] outline-1 outline-[var(--stop)]" : "bg-ink"}`}
            style={{ left: pct(m.startHour), width: pct(m.endHour - m.startHour) }}
          />
        ))}
      </Lane>
      <Lane label="Stopped or no data">
        {stops.map(([start, end]) => (
          <span key={start} className="absolute inset-y-2.5 bg-[var(--stop)]" style={{ left: pct(start), width: pct(end - start) }} />
        ))}
      </Lane>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        <div className="flex items-center gap-1.5"><span className="h-2 w-5 bg-[var(--stop)]" /><dt>Fault active</dt></div>
        <div className="flex items-center gap-1.5"><CaseMark eventClass="MACHINE" size={12} /><CaseMark eventClass="SENSOR" size={12} /><dt>First alert on this fault</dt></div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" /><dt>Limit reached, or plant alarm</dt></div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 13 13" aria-hidden="true"><path d="M2 2 11 11M11 2 2 11" stroke="var(--ink)" strokeWidth="2.25" /></svg>
          <dt>False alert</dt>
        </div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-3 bg-ink" /><dt>Corrective work</dt></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-3 bg-[var(--band)] outline-1 outline-[var(--stop)]" /><dt>Planned work</dt></div>
      </dl>
    </div>
  );
}
