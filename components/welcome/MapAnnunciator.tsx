"use client";

// Site map alternative 2: an alarm panel. Control rooms show plant alarms on an annunciator, a panel of windows that
// light up and flash when something needs attention. Here each pump is a window, grouped by system. A window lights
// when its pump has a concern, flashes three times when it first lights, then stays lit. It shows what is wrong and
// for how long.
import { ZONES } from "@/lib/sitemap";
import { MapHead, pickProps, STATUS_WORD, usePumpRows, type MapProps } from "./mapParts";

export function MapAnnunciator(props: MapProps) {
  const rows = usePumpRows(props.site);
  return (
    <div>
      <MapHead site={props.site} shiftHour={props.shiftHour} />
      <div className="space-y-4">
        {ZONES.map((z) => (
          <div key={z.id} role="group" aria-label={z.label}>
            <p className="mb-1.5 text-[13px] text-mz-muted">{z.label}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {rows
                .filter((r) => z.pumps.includes(r.id))
                .map((p) => {
                  const on = props.selected === p.id;
                  return (
                    <div
                      key={p.id}
                      {...pickProps(p.id, props, `${p.name}, ${STATUS_WORD[p.status].toLowerCase()}${p.fault ? `: ${p.fault}` : ""}. Show details.`)}
                      className={`ann-window ann-${p.status} ${on ? "ann-selected" : ""}`}
                    >
                      {/* Keyed on the status, so the flash replays whenever a window lights or changes. */}
                      <div key={p.status} className="ann-face flex h-full flex-col">
                        <p className="flex items-baseline justify-between gap-1 text-[14px] leading-tight font-medium">
                          {p.name}
                          {p.since !== null && <span className="font-mono text-[11.5px] font-normal tabular-nums">{p.since} h</span>}
                        </p>
                        <p className="mt-1 line-clamp-2 min-h-[2.3em] text-[12.5px] leading-[1.15]">{p.fault ?? (p.status === "nodata" ? "Test pump" : "Running normally")}</p>
                        <p className="ann-status mt-auto pt-1.5 text-[12px] font-medium">{STATUS_WORD[p.status]}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
