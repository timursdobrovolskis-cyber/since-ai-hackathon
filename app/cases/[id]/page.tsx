"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CaseInbox } from "@/components/CaseInbox";
import { DecisionPanel } from "@/components/DecisionPanel";
import { EvidenceChart } from "@/components/EvidenceChart";
import { CaseMark, classLabel } from "@/components/Marks";
import { WhatIfPanel } from "@/components/WhatIfPanel";
import { certainty } from "@/lib/cases";
import { clock, faultLabel, formatUtc, TIER_LABEL } from "@/lib/labels";

const MAX_CHARTS = 4;

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { cases, fleet, pumps, hour } = useApp();
  const [showAll, setShowAll] = useState(false);
  const item = cases.find((c) => c.id === id);

  if (!fleet) return null;
  if (!item) {
    return (
      <div className="p-6">
        <p>This case does not exist yet at {clock(hour)}. Move the replay forward, or return to the fleet.</p>
        <Link href="/" className="underline underline-offset-2">Back to fleet</Link>
      </div>
    );
  }

  const meta = fleet.pumps.find((p) => p.id === item.assetId)!;
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
    <div className="grid lg:grid-cols-[1fr_21rem]">
      <article className="min-w-0 space-y-5 p-4">
        <p className="text-[13px] text-ink-2">
          <Link href="/" className="underline underline-offset-2">Fleet</Link> / {meta.id}, {meta.system}, {meta.site}
        </p>

        <header className="flex items-start gap-3">
          <span className="mt-1.5"><CaseMark eventClass={item.eventClass} faultType={item.faultType} size={22} /></span>
          <div>
            <h1 className="font-cond text-3xl leading-tight font-semibold">{faultLabel(item.faultType)}</h1>
            <p className="text-ink-2">
              {classLabel(item.eventClass)}. First raised {formatUtc(item.first.alert_time_utc)}
              {item.alerts.length > 1 ? `, ${item.alerts.length} updates since` : ""}.
            </p>
          </div>
        </header>

        <section aria-label="Recommended check" className="border-l-4 bg-raised px-4 py-3" style={{ borderColor: item.eventClass === "SENSOR" ? "var(--sensor)" : "var(--machine)" }}>
          <h2 className="text-[13px] text-ink-2">Recommended check</h2>
          <p className="text-lg font-medium">{alert.recommended_action}</p>
          {alert.what_would_settle_it && <p className="mt-1 text-ink-2">To settle it: {alert.what_would_settle_it}</p>}
        </section>

        <section aria-labelledby="causes">
          <h2 id="causes" className="font-cond text-lg font-semibold">Possible causes</h2>
          {alert.hypotheses.length > 0 ? (
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
          ) : (
            <p className="mt-1 text-ink-2">
              One cause named: {faultLabel(item.faultType)}. {level ? `${level} certainty.` : "Certainty not calibrated."} This placeholder detector does not rank alternatives yet.
            </p>
          )}
        </section>

        <section aria-labelledby="evidence">
          <h2 id="evidence" className="font-cond text-lg font-semibold">Evidence</h2>
          <p className="text-ink-2">{alert.evidence.sensor_check ?? alert.evidence.summary}</p>
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
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 xl:grid-cols-2">
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
            Grey band: this pump&rsquo;s normal range at this speed, learned from its first 24 hours, so it appears from Day 2. Coloured line: outside that range. Dashed line: alert.
          </p>
          {order.length > MAX_CHARTS && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 min-h-9 border border-line bg-raised px-3 text-[13px]">
              {showAll ? "Show fewer signals" : `Show all ${order.length} signals`}
            </button>
          )}
        </section>

        <section aria-labelledby="blind" className="grid gap-5 md:grid-cols-2">
          <div>
            <h2 id="blind" className="font-cond text-lg font-semibold">What this pump cannot see</h2>
            <p className="text-ink-2">{TIER_LABEL[meta.tier]}. Not measured here:</p>
            <p className="text-ink-2">
              {alert.evidence.blind_spots.length
                ? alert.evidence.blind_spots.map((c) => fleet.channelMeta[c]?.label.toLowerCase() ?? c).join(", ")
                : "nothing on the standard list"}.
            </p>
          </div>
          <div>
            <h2 className="font-cond text-lg font-semibold">Plant alarms so far</h2>
            {alarms.length === 0 ? (
              <p className="text-ink-2">None on this pump. Its fixed limits have not been crossed.</p>
            ) : (
              <ul className="text-ink-2">
                {alarms.slice(-3).map((a) => (
                  <li key={`${a.tag}-${a.raisedHour}`}>{formatUtc(a.raisedUtc)}: {a.type} on {fleet.channelMeta[a.tag]?.label.toLowerCase() ?? a.tag.toLowerCase()}</li>
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

        <DecisionPanel item={item} />
      </article>
      <aside className="hidden border-l border-line bg-panel lg:block">
        <CaseInbox activeId={item.id} />
      </aside>
    </div>
  );
}
