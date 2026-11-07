"use client";

// One pump's concern at an hour, with everything the landing page shows about it: the plain words from Today, the
// reading behind it as chart rows, the alert times, trust, trend, next stop and the area of the pump it concerns.
// Shared by the step list, the pump card and the metric cards, so they always agree.
import { useMemo } from "react";
import { useApp } from "@/components/AppProvider";
import { ago } from "@/lib/labels";
import { plainAlert, pumpName } from "@/lib/plain";
import { areaFor, type PumpArea } from "@/lib/pumpArea";
import { concernWindow, evidenceChannel, signalRows, type SignalRow } from "@/lib/signal";
import type { Light, SiteState } from "@/lib/sitemap";
import type { Trust } from "@/lib/trust";
import type { Case } from "@/lib/types";
import { nextStop, trendOf, type Trend } from "@/lib/worker";

export type Concern = {
  id: string;
  name: string;
  light: Light;
  lead: Case;
  others: number;
  what: string;
  check: string;
  trust: Trust | null;
  trend: Trend | null;
  stop: string | null;
  firstNoticed: string;
  channel: string | null;
  channelLabel: string;
  unit: string;
  rows: SignalRow[];
  alertHours: number[];
  area: PumpArea | null;
};

type Sources = Pick<ReturnType<typeof useApp>, "fleet" | "pumps" | "record">;

function concernFor(site: SiteState, id: string, { fleet, pumps, record }: Sources): Concern | null {
  const line = site.lines[id];
  if (!line || !fleet) return null;
  const meta = fleet.channelMeta;
  const pump = pumps[id];
  const lead = line.lead;
  const words = plainAlert(lead.latest, meta, record);
  const channel = evidenceChannel(lead.latest, meta, pump);
  const window = concernWindow(lead.first.offset_hours, site.hour);
  return {
    id,
    name: pumpName(id),
    light: site.lights[id],
    lead,
    others: line.others.length,
    what: words.what,
    check: words.check,
    trust: words.trust,
    trend: trendOf(lead.latest, pump, site.hour),
    stop: nextStop(pump, site.hour),
    firstNoticed: ago(site.hour - lead.first.offset_hours),
    channel,
    channelLabel: channel ? meta[channel]?.label ?? channel : "Reading",
    unit: channel ? meta[channel]?.unit ?? "" : "",
    rows: pump && channel ? signalRows(pump, channel, window.from, window.to, site.hour) : [],
    alertHours: lead.alerts.map((a) => a.offset_hours),
    area: areaFor(lead.latest, channel),
  };
}

/** One pump's concern at the site's hour, or null when it has none. */
export function useConcern(site: SiteState, id: string | null): Concern | null {
  const { fleet, pumps, record } = useApp();
  return useMemo(() => (id ? concernFor(site, id, { fleet, pumps, record }) : null), [fleet, pumps, record, site, id]);
}

/** Every concern at the site's hour, in Today's order: needs you today first, then check the reading. */
export function useConcerns(site: SiteState): Concern[] {
  const { fleet, pumps, record } = useApp();
  return useMemo(
    () => [...site.order.red, ...site.order.orange].map((id) => concernFor(site, id, { fleet, pumps, record })).filter((c): c is Concern => c !== null),
    [fleet, pumps, record, site],
  );
}
