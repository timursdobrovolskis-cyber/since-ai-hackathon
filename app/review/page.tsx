"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CaseMark } from "@/components/Marks";
import { ReviewTimeline } from "@/components/ReviewTimeline";
import { loadAlerts } from "@/lib/data";
import { clock, faultLabel } from "@/lib/labels";
import { loadReviewPump, loadScorecard, type ReviewPump, type Scorecard, type Scores } from "@/lib/review-data";
import type { Alert } from "@/lib/types";

const percent = (v: number | null) => (v === null ? "No data" : `${Math.round(v * 100)} %`);

const ROWS: { label: string; show: (s: Scores) => string }[] = [
  { label: "Faults caught", show: (s) => `${s.true_positive_events} of ${s.events_scored}` },
  { label: "Warned before the limit, where a limit was reached", show: (s) => percent(s.early_warning_rate) },
  { label: "Median warning before the limit", show: (s) => (s.median_lead_time_h === null ? "No data" : `${Math.abs(s.median_lead_time_h) < 0.05 ? "0.0" : s.median_lead_time_h.toFixed(1)} h`) },
  { label: "Faults with the exact cause named", show: (s) => percent(s.fault_type_recall) },
  { label: "False and excess alerts per pump per day", show: (s) => s.false_alerts_per_asset_day.toFixed(2) },
  { label: "Benchmark score, 0 to 100", show: (s) => s.composite_score.toFixed(1) },
];

function lead(hours: number | null) {
  if (hours === null) return "No limit reached";
  return hours >= 0 ? `${hours.toFixed(1)} h before the limit` : `${Math.abs(hours).toFixed(1)} h after the limit`;
}

export default function ReviewPage() {
  const { fleet, pumps, setPlaying } = useApp();
  const [card, setCard] = useState<Scorecard | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState("PUMP-08");
  const [review, setReview] = useState<{ id: string; data: ReviewPump } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlaying(false);
    const wanted = new URLSearchParams(window.location.search).get("pump");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only available after mount
    if (wanted) setSelected(wanted);
    Promise.all([loadScorecard(), loadAlerts()])
      .then(([c, a]) => {
        setCard(c);
        setAlerts(a.alerts);
      })
      .catch((e: Error) => setError(e.message));
  }, [setPlaying]);

  useEffect(() => {
    loadReviewPump(selected)
      .then((data) => setReview({ id: selected, data }))
      .catch((e: Error) => setError(e.message));
  }, [selected]);

  const score = card?.pumps[selected];
  const events = useMemo(() => review?.data.events ?? [], [review]);
  const pumpAlerts = useMemo(() => alerts.filter((a) => a.asset_id === selected), [alerts, selected]);

  if (error) return <p className="p-6">{error}. Run tools/build_ui_data.py, then reload.</p>;
  if (!fleet || !card || !score || review?.id !== selected) return <p className="p-6 text-ink-2">Loading results</p>;

  const pump = pumps[selected];
  const meta = fleet.pumps.find((p) => p.id === selected)!;
  const byEvent = Object.fromEntries(score.perEvent.map((r) => [r.eventId, r]));
  const firstAlerts = Object.fromEntries(score.perEvent.map((r) => [r.eventId, r.firstAlertHour]));
  const scored = events.filter((e) => e.observable);
  const hidden = events.filter((e) => !e.observable);
  const { plant, baseline, current } = card.totals;
  const placeholder = card.alertSource === "B1 baseline";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <header className="max-w-3xl">
        <h1 className="font-cond text-3xl font-semibold">Review: what really happened</h1>
        <p className="text-ink-2">
          This view opens the labelled faults, which the live screens never load. Every result comes from the challenge&rsquo;s official scorer, on the {fleet.pumps.length} labelled pumps.
        </p>
        <p className="mt-1 text-ink-2">
          {placeholder ? "Current alerts come from the B1 baseline, a placeholder until the team\u2019s detector is connected." : `Current alerts come from ${card.alertSource}.`} All data is simulated, so these results are not evidence of performance on real pumps.
        </p>
      </header>

      <section aria-labelledby="compare">
        <h2 id="compare" className="font-cond text-xl font-semibold">Plant alarms against current alerts</h2>
        <table className="mt-1 w-full max-w-3xl text-left">
          <thead className="text-[13px] text-ink-2">
            <tr className="border-b border-line">
              <th className="py-1 font-medium">All {current.all.events_scored} scored faults</th>
              <th className="py-1 text-right font-medium">Plant alarms today</th>
              {!placeholder && <th className="py-1 text-right font-medium">B1 baseline</th>}
              <th className="py-1 text-right font-medium">Current alerts</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b" style={{ borderColor: "var(--line-soft)" }}>
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right">{r.show(plant.all)}</td>
                {!placeholder && <td className="py-1.5 text-right">{r.show(baseline.all)}</td>}
                <td className="py-1.5 text-right font-semibold">{r.show(current.all)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 max-w-3xl text-[13px] text-ink-3">
          Benchmark score by split: training pumps {plant.train.composite_score.toFixed(1)} against {current.train.composite_score.toFixed(1)}, validation pumps {plant.validation.composite_score.toFixed(1)} against {current.validation.composite_score.toFixed(1)}. Validation has only {current.validation.events_scored} scored faults, so small differences there mean little.
        </p>
      </section>

      <section aria-labelledby="pump">
        <h2 id="pump" className="font-cond text-xl font-semibold">One pump&rsquo;s week</h2>
        <ul className="mt-1 flex flex-wrap gap-1" aria-label="Choose a pump">
          {fleet.pumps.map((p) => {
            const s = card.pumps[p.id];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={p.id === selected}
                  onClick={() => setSelected(p.id)}
                  className={`min-h-11 border px-2.5 py-1 text-left text-[13px] leading-tight ${p.id === selected ? "border-ink bg-ink text-raised" : "border-line bg-raised"}`}
                >
                  <span className="block font-cond text-[15px] font-semibold">{p.id}</span>
                  {s.currentCaught} of {s.eventsScored} caught
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 font-medium">
          {meta.system}, {meta.site}. Current alerts caught {score.currentCaught} of {score.eventsScored} faults. Plant alarms caught {score.plantCaught}.
          {score.plantCaught > score.currentCaught ? " Plant alarms did better on this pump." : ""}
          {score.falseAlertIds.length > 0 ? ` ${score.falseAlertIds.length} false ${score.falseAlertIds.length === 1 ? "alert" : "alerts"}.` : " No false alerts."}
        </p>

        <div className="mt-2 overflow-x-auto">
          <div className="min-w-[44rem]">
            <ReviewTimeline pump={pump} events={events} firstAlerts={firstAlerts} alerts={pumpAlerts} falseIds={new Set(score.falseAlertIds)} />
          </div>
        </div>
        <p className="mt-1 text-[13px] text-ink-3 sm:hidden">The timeline is easier to read on a larger screen.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead className="text-[13px] text-ink-2">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">True fault</th>
                <th className="py-1 font-medium">Plant alarms</th>
                <th className="py-1 font-medium">Current alerts</th>
                <th className="py-1 font-medium">Cause named</th>
                <th className="py-1 font-medium">Warning</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((e) => {
                const r = byEvent[e.id];
                return (
                  <tr key={e.id} className="border-b align-top" style={{ borderColor: "var(--line-soft)" }}>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5"><CaseMark eventClass={e.eventClass} size={12} />{faultLabel(e.faultType)}</span>
                    </td>
                    <td className="py-1.5">{r.plantDetected ? "Caught" : "Missed"}</td>
                    <td className={`py-1.5 ${r.detected ? "" : "font-semibold"}`}>{r.detected && r.firstAlertHour !== null ? clock(r.firstAlertHour) : "Missed"}</td>
                    <td className="py-1.5">
                      {!r.detected ? "No alert" : r.typeCorrect ? "Correct" : r.predictedType === "UNKNOWN" ? "Cause left unclear" : `Named as ${faultLabel(r.predictedType ?? "").toLowerCase()}`}
                    </td>
                    <td className="py-1.5">{r.detected ? lead(r.leadHours) : "None"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {hidden.length > 0 && (
          <p className="mt-2 text-[13px] text-ink-3">
            Not scored, because this pump&rsquo;s sensors cannot show it: {hidden.map((e) => faultLabel(e.faultType).toLowerCase()).join(", ")}.
          </p>
        )}
        <p className="mt-2 text-[13px] text-ink-3">Test pumps are not shown here. The organizers hold their answers and score them after submission.</p>
      </section>
    </div>
  );
}
