"use client";

import { pumpState } from "@/lib/cases";
import { TIER_LABEL } from "@/lib/labels";
import { STATE_RANK } from "@/lib/overview";
import type { Case, PumpData, PumpMeta } from "@/lib/types";
import { useApp } from "./AppProvider";
import { CaseMark } from "./Marks";
import { StateBadge } from "./ui/state-badge";

const WINDOW = 168;
const pct = (hour: number) => `${(hour / WINDOW) * 100}%`;
const DAYS = [0, 1, 2, 3, 4, 5, 6];

function Strip({ pump, cases, hour }: { pump: PumpData; cases: Case[]; hour: number }) {
  return (
    <div className="relative h-9 bg-raised">
      {pump.stateRuns
        .filter(([start]) => start <= hour)
        .map(([start, end, state]) => {
          const shownEnd = Math.min(end, hour);
          const stopped = state === "STOPPED" || state === "LOCKED_OUT" || state === "STOPPING";
          const nodata = state === "NO_DATA";
          return (
            <span
              key={start}
              className="absolute inset-y-2.5"
              style={{
                left: pct(start),
                width: pct(shownEnd - start),
                background: nodata ? "none" : stopped ? "var(--stop)" : "var(--run)",
                borderBlock: nodata ? "1px dashed var(--sensor)" : undefined,
              }}
            />
          );
        })}
      {pump.alarms
        .filter((a) => a.raisedHour <= hour)
        .map((a) => (
          <span
            key={`${a.tag}-${a.raisedHour}`}
            title="Plant alarm"
            className="absolute bottom-0.5 h-1.5 w-px bg-ink"
            style={{ left: pct(a.raisedHour) }}
          />
        ))}
      {cases.flatMap((c) =>
        c.alerts.map((a) => (
          <span key={a.alert_id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(a.offset_hours) }}>
            <CaseMark eventClass={c.eventClass} faultType={c.faultType} size={13} />
          </span>
        )),
      )}
    </div>
  );
}

export function FleetStrips() {
  const { fleet, pumps, cases, decisions, hour } = useApp();
  if (!fleet) return null;
  const rows = fleet.pumps
    .map((meta: PumpMeta) => {
      const data = pumps[meta.id];
      const own = cases.filter((c) => c.assetId === meta.id);
      return { meta, data, own, state: pumpState(data, own, decisions, hour) };
    })
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.meta.id.localeCompare(b.meta.id));

  return (
    <section aria-label="Fleet">
      <div className="grid grid-cols-[13rem_1fr] border-b border-line pb-1 text-[13px] text-ink-3">
        <span>Each pump&rsquo;s week, aligned to Day 1</span>
        <div className="relative h-5">
          {DAYS.map((d) => (
            <span key={d} className="absolute" style={{ left: pct(d * 24) }}>Day {d + 1}</span>
          ))}
        </div>
      </div>
      <div className="relative">
        <ul>
          {rows.map(({ meta, data, own, state }) => (
            <li key={meta.id} className="grid grid-cols-[13rem_1fr] items-center gap-0 border-b border-line-soft py-1" style={{ borderColor: "var(--line-soft)" }}>
              <div className="pr-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-cond font-semibold">{meta.id}</span>
                  <StateBadge state={state} />
                </div>
                <div className="truncate text-[13px] text-ink-3" title={`${meta.site}, ${meta.system}`}>
                  {TIER_LABEL[meta.tier]}, {meta.site.split(" (")[0]}
                </div>
              </div>
              <Strip pump={data} cases={own} hour={hour} />
            </li>
          ))}
        </ul>
        {/* One replay line through every pump. It sits over the strip column only. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[13rem]">
          <span className="absolute inset-y-0 w-px bg-[var(--cursor)]" style={{ left: pct(hour) }} />
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        <div className="flex items-center gap-1.5"><CaseMark eventClass="MACHINE" size={12} /><dt>Machine problem</dt></div>
        <div className="flex items-center gap-1.5"><CaseMark eventClass="SENSOR" size={12} /><dt>Sensor problem</dt></div>
        <div className="flex items-center gap-1.5"><CaseMark eventClass="MACHINE" faultType="UNKNOWN" size={12} /><dt>Cause unclear</dt></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-5 bg-[var(--run)]" /><dt>Running</dt></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-5 bg-[var(--stop)]" /><dt>Stopped</dt></div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-px bg-ink" /><dt>Plant alarm</dt></div>
      </dl>
    </section>
  );
}
