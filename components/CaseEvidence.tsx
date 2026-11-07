"use client";

import { useState } from "react";
import { certainty } from "@/lib/cases";
import { ago, faultLabel, formatUtc, TIER_LABEL } from "@/lib/labels";
import type { Case, PumpMeta } from "@/lib/types";
import { useApp } from "./AppProvider";
import { EvidenceChart } from "./EvidenceChart";
import { CaseMark } from "./Marks";
import { WhatIfPanel } from "./WhatIfPanel";

const MAX_CHARTS = 4;

/** The technical layer of a case: evidence, blind spots, plant alarms, maintenance notes and the simulator. */
export function CaseEvidence({ item, meta }: { item: Case; meta: PumpMeta }) {
  const { fleet, pumps, hour } = useApp();
  const [showAll, setShowAll] = useState(false);
  if (!fleet) return null;
  const pump = pumps[item.assetId];
  const alert = item.latest;
  const level = certainty(alert.confidence, alert.confidence_calibrated);
  const alertHours = item.alerts.map((a) => a.offset_hours);

  // Signals named by the alert come first, then the rest of what this pump measures.
  const named = item.alerts.flatMap((a) => a.evidence.channels.map((c) => c.channel));
  const order = [...new Set([...named, ...pump.channels])].filter((c) => pump.series[c]);
  const charts = showAll ? order : order.slice(0, MAX_CHARTS);
  const notes = [...pump.history, ...pump.maintenance].filter((n) => n.startHour <= hour).slice(-4).reverse();
  const alarms = pump.alarms.filter((a) => a.raisedHour <= hour);

  return (
    <>
      <section aria-labelledby="evidence">
        <h2 id="evidence" className="font-cond text-lg font-semibold">What the sensors show</h2>
        <p>{alert.evidence.sensor_check ?? alert.evidence.summary}</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          {charts.map((c, index) => (
            <EvidenceChart
              key={c}
              label={fleet.channelMeta[c].label}
              unit={fleet.channelMeta[c].unit}
              series={pump.series[c]}
              stepMinutes={pump.stepMinutes}
              hour={hour}
              alertHours={alertHours}
              eventClass={item.eventClass}
              phoneHidden={index > 0 && !showAll}
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          Grey band: normal for this pump, learned from its first 24 hours, so it starts after the first day. Coloured line: outside normal. Dashed line: alert.
        </p>
        {order.length > MAX_CHARTS && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 min-h-9 border border-line bg-raised px-3 text-[13px]">
            {showAll ? "Show fewer signals" : `Show all ${order.length} signals`}
          </button>
        )}
      </section>

      <section aria-labelledby="causes">
        <h2 id="causes" className="font-cond text-lg font-semibold">Technical detail</h2>
        <p className="text-ink-2">Detected as: {faultLabel(item.faultType)}{level ? `, ${level.toLowerCase()} certainty` : ". This detector gives no reliable certainty yet"}. First raised {formatUtc(item.first.alert_time_utc)}.</p>
        {alert.hypotheses.length > 0 && (
          <ul className="mt-1 space-y-1">
            {alert.hypotheses.map((h) => (
              <li key={h.fault_type} className="flex items-center gap-2">
                <CaseMark eventClass={h.event_class} faultType={h.fault_type} size={12} />
                <span className="w-60">{faultLabel(h.fault_type)}</span>
                <span className="h-2 w-40 bg-[var(--line-soft)]"><span className="block h-2 bg-ink" style={{ width: `${h.probability * 100}%` }} /></span>
                <span className="text-[13px] text-ink-2">{alert.confidence_calibrated ? certainty(h.probability, true) : "Not calibrated"}</span>
              </li>
            ))}
          </ul>
        )}
        {alert.what_would_settle_it && <p className="mt-1 text-ink-2">To settle it: {alert.what_would_settle_it}</p>}
        {alert.evidence.channels.length > 0 && (
          <table className="mt-2 w-full max-w-xl text-left">
            <thead className="text-[13px] text-ink-2">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">Signal at this alert</th>
                <th className="py-1 text-right font-medium">Measured</th>
                <th className="py-1 text-right font-medium">Expected</th>
                <th className="py-1 text-right font-medium">Deviation</th>
              </tr>
            </thead>
            <tbody>
              {alert.evidence.channels.map((c) => {
                const m = fleet.channelMeta[c.channel];
                return (
                  <tr key={c.channel} className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                    <td className="py-1">{m?.label ?? c.channel}</td>
                    <td className="py-1 text-right">{c.observed ?? "No reading"} {m?.unit}</td>
                    <td className="py-1 text-right">{c.expected ?? "Not known"} {m?.unit}</td>
                    <td className="py-1 text-right">{c.z > 0 ? "+" : ""}{c.z.toFixed(1)} sd</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="blind" className="grid gap-5 md:grid-cols-2">
        <div>
          <h2 id="blind" className="font-cond text-lg font-semibold">What this pump cannot see</h2>
          <p className="text-ink-2">{TIER_LABEL[meta.tier]}. Not measured here: {alert.evidence.blind_spots.length ? alert.evidence.blind_spots.map((c) => fleet.channelMeta[c]?.label.toLowerCase() ?? c).join(", ") : "nothing on the standard list"}.</p>
        </div>
        <div>
          <h2 className="font-cond text-lg font-semibold">Plant alarms so far</h2>
          {alarms.length === 0 ? (
            <p className="text-ink-2">None on this pump. Its fixed limits have not been crossed.</p>
          ) : (
            <ul className="text-ink-2">
              {alarms.slice(-3).map((a) => (
                <li key={`${a.tag}-${a.raisedHour}`}>{ago(hour - a.raisedHour)}: {a.type} on {fleet.channelMeta[a.tag]?.label.toLowerCase() ?? a.tag.toLowerCase()}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="notes">
        <h2 id="notes" className="font-cond text-lg font-semibold">Maintenance notes, as recorded</h2>
        <p className="text-[13px] text-ink-3">Written by people at the time, and may be wrong.</p>
        {notes.length === 0 ? (
          <p className="text-ink-2">No notes for this pump so far.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="text-[13px] text-ink-2">{formatUtc(n.startUtc)}, {n.diagnosisConfidence.toLowerCase()}</span>
                <p>{n.observation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WhatIfPanel key={item.latest.alert_id} item={item} />
    </>
  );
}
