"use client";

// The case for a retrofit, as four cards in the style of meuze.ai's operations row: a mono label, a chart on a light
// panel, a title, a short text and a link to the full screen. Charts are bklit-ui. Every figure comes from the app's
// data: key-numbers.json (totals), the sensor level counts the Sensor levels screen shows, and the payback model.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { Ring } from "@/components/charts/ring";
import { RingChart } from "@/components/charts/ring-chart";
import { XAxis } from "@/components/charts/x-axis";
import { BASE, evaluate } from "@/lib/payback";
import type { LevelKey } from "@/lib/sensor-levels";
import type { SiteState } from "@/lib/sitemap";
import { useConcerns } from "./concerns";
import { useKeyNumbers, useSeen } from "./Results";
import { SignalChart } from "./SignalChart";

type SensorData = { faults: Record<string, Record<LevelKey, { seen: number; total: number }>> };

function Card({ label, title, text, href, link, children }: { label: string; title: string; text: string; href: string; link: string; children: React.ReactNode }) {
  return (
    <article className="flex flex-col border-mz-line py-6 md:border-l md:px-6 md:py-0 md:first:border-l-0 md:first:pl-0 lg:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mz-muted">{label}</p>
      <div className="mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden border border-mz-line bg-mz-panel p-3">{children}</div>
      <h3 className="mt-5 text-[18px] leading-snug font-medium tracking-[-0.01em]">{title}</h3>
      <p className="mt-2 flex-1 text-[14px] leading-snug text-mz-muted">{text}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-mz-accent hover:underline">
        {link} <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </article>
  );
}

export function MetricCards({ site }: { site: SiteState }) {
  const key = useKeyNumbers();
  const concerns = useConcerns(site);
  const [sensors, setSensors] = useState<SensorData | null>(null);
  const { ref, seen } = useSeen<HTMLDivElement>();
  // Which sensor ring is hovered. The centre shows the low-cost retrofit, the level we recommend, until one is.
  const [ring, setRing] = useState<number | null>(null);
  useEffect(() => {
    fetch("/data/review/sensors.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSensors)
      .catch(() => {});
  }, []);

  // The early-warning card shows the most reliable concern that needs you today, Pump 8 at the evening shift.
  const example = concerns.find((c) => c.id === "PUMP-08") ?? concerns[0];

  const rings = useMemo(() => {
    if (!sensors) return null;
    const types = Object.keys(sensors.faults);
    const seenAt = (k: LevelKey) => types.filter((f) => sensors.faults[f][k].seen > 0).length;
    return [
      { label: "Legacy sensors", value: seenAt("T0_LEGACY"), maxValue: types.length, color: "var(--mz-muted)" },
      { label: "Low-cost retrofit", value: seenAt("T1_RETROFIT"), maxValue: types.length, color: "var(--mz-accent)" },
      { label: "Full sensors", value: seenAt("T2_FULL"), maxValue: types.length, color: "#b3b7c2" },
    ];
  }, [sensors]);

  const payback = useMemo(() => {
    if (!key) return null;
    const p = { ...BASE, recall: key.recall, falsePerPumpDay: key.falsePerPumpDay };
    const r = evaluate(p);
    const years = Array.from({ length: 7 }, (_, y) => y);
    return {
      years: r.paybackYears,
      net: r.net,
      rows: years.map((y) => ({ date: new Date(Date.UTC(2026 + y, 0, 1)), value: Math.round(-p.installedEur + r.net * y) })),
      labels: years.map((y) => `Year ${y}`),
    };
  }, [key]);

  if (!key) return null;

  return (
    <section aria-label="The case for a retrofit" className="bg-white px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
      <div className="grid gap-8 border-b border-mz-line pb-12 md:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mz-muted">05 &middot; The case for a retrofit</p>
          <h2 className="mt-4 max-w-[20ch] text-[34px] leading-[1.08] font-light tracking-[-0.03em] lg:text-[44px]">Detection, warning, sensors and payback, from the same data.</h2>
        </div>
        <div className="self-end text-[15px] leading-relaxed text-mz-muted">
          <p>Retrofit Assist reads the signals the pumps already send, and adds one suction pressure transmitter and one wireless vibration point where they pay for themselves.</p>
          <p className="mt-3">It only advises. Plant alarms, trips and interlocks stay in charge, and a person decides every action.</p>
        </div>
      </div>

      <div ref={ref} className="mt-12 grid divide-y divide-mz-line md:grid-cols-2 md:divide-y-0 lg:grid-cols-4">
        <Card
          label="Detection"
          title="Catches what alarms miss"
          text={`Of ${key.faults} faults, the plant's own alarms caught ${key.alarmsCaught}. The alerts caught ${key.caught}.`}
          href="/review"
          link="See every fault"
        >
          {seen && (
            <div className="w-full">
              <BarChart data={[{ name: `Plant alarms \u00b7 ${key.alarmsCaught}`, value: key.alarmsCaught }, { name: `Alerts \u00b7 ${key.caught}`, value: key.caught }]} aspectRatio="4 / 3" barGap={0.45}>
                <Grid horizontal numTicksRows={3} />
                <Bar dataKey="value" fill="var(--mz-accent)" />
                <BarXAxis showAllLabels />
              </BarChart>
            </div>
          )}
        </Card>

        <Card
          label="Early warning"
          title={`Warns about ${Math.round(key.medianWarningH)} hours ahead`}
          text={`Median warning before a conventional limit. Here ${example?.name ?? "a pump"}'s ${example?.channelLabel.toLowerCase() ?? "reading"} leaves its expected band while the plant alarms stay silent.`}
          href={example ? `/cases/${example.lead.id}` : "/"}
          link="Open its job card"
        >
          {seen && example && <div className="w-full"><SignalChart rows={example.rows} unit={example.unit} alertHours={example.alertHours} replayKey="card" aspectRatio="4 / 3" axes={false} /></div>}
        </Card>

        <Card
          label="Sensor levels"
          title={rings ? `Sees all ${rings[1].maxValue} fault types for little cost` : "Sees more with cheap sensors"}
          text={rings ? `A low-cost retrofit shows evidence for ${rings[1].value} of ${rings[1].maxValue} fault types. Legacy signals alone show ${rings[0].value}, missing bearings, imbalance and misalignment.` : "What each sensor level can see."}
          href="/sensors"
          link="Compare sensor levels"
        >
          {seen && rings && (
            <div className="flex items-center gap-4">
              <div className="relative">
                <RingChart data={rings} size={150} strokeWidth={9} ringGap={5} baseInnerRadius={36} hoveredIndex={ring} onHoverChange={setRing}>
                  {rings.map((_, i) => (
                    <Ring key={i} index={i} />
                  ))}
                </RingChart>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[22px] leading-none tracking-[-0.02em] tabular-nums">
                    {rings[ring ?? 1].value}
                    <span className="text-[13px] text-mz-muted">/{rings[ring ?? 1].maxValue}</span>
                  </span>
                </div>
              </div>
              <ul className="space-y-2 font-mono text-[9.5px] uppercase leading-tight tracking-[0.12em] text-mz-muted">
                {rings.map((r, i) => (
                  <li key={r.label} className={`flex items-center gap-1.5 ${ring === i || (ring === null && i === 1) ? "text-mz-ink" : ""}`}>
                    <span aria-hidden className="size-2 shrink-0" style={{ background: r.color }} />
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card
          label="Payback"
          title={payback && Number.isFinite(payback.years) ? `Pays back in ${payback.years.toFixed(1)} years` : "Payback"}
          text={payback ? `About EUR ${Math.round(payback.net).toLocaleString("en")} a year per pump, after false alerts and running costs. Illustrative, with the organizers' cost assumptions.` : ""}
          href="/payback"
          link="Try your own numbers"
        >
          {seen && payback && (
            <div className="w-full">
              <AreaChart data={payback.rows} aspectRatio="4 / 3">
                <Grid horizontal numTicksRows={3} highlightRowValues={[0]} highlightRowStroke="var(--mz-ink)" />
                <Area dataKey="value" fill="var(--mz-accent)" stroke="var(--mz-accent)" />
                <XAxis labels={payback.labels} numTicks={4} />
              </AreaChart>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
