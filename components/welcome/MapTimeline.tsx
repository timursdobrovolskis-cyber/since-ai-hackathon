"use client";

// Site map alternative 3: the week so far. Each pump is a row across the test week, from its start to the evening
// shift. Every alert is a tick where it happened, a bar runs from a concern's first alert to now, and a line marks the
// map's hour as scrolling runs the clock. It shows when each problem started, which is the early-warning story.
import { ZONES } from "@/lib/sitemap";
import { MapHead, pickProps, STATUS_WORD, usePumpRows, type MapProps, type PumpRow } from "./mapParts";

const LEFT = 36; // % of the row for the name column

function Track({ p, hour, shiftHour }: { p: PumpRow; hour: number; shiftHour: number }) {
  const x = (h: number) => `${(Math.min(h, shiftHour) / shiftHour) * 100}%`;
  return (
    <div className="relative h-full">
      <div className={`absolute inset-x-0 top-1/2 h-px -translate-y-1/2 ${p.status === "nodata" ? "tl-nodata" : "bg-mz-line"}`} />
      {p.from !== null && (
        <div
          className={`tl-bar tl-${p.status} absolute top-1/2 h-2 -translate-y-1/2 rounded-full`}
          style={{ left: x(p.from), width: `calc(${x(hour)} - ${x(p.from)})` }}
        />
      )}
      {p.alertHours.map((h, i) => (
        <span key={i} aria-hidden className="tl-tick absolute top-1/2 h-3.5 w-px -translate-y-1/2" style={{ left: x(h) }} />
      ))}
    </div>
  );
}

export function MapTimeline(props: MapProps) {
  const rows = usePumpRows(props.site);
  const { hour } = props.site;
  const days = [0, 24, 48].filter((h) => h < props.shiftHour);
  const pos = (h: number) => `${(h / props.shiftHour) * 100}%`;

  return (
    <div>
      <MapHead site={props.site} shiftHour={props.shiftHour} />
      <div className="relative">
        {/* Day scale over the tracks, and the line for the map's hour. */}
        <div className="flex text-[12px] text-mz-muted" style={{ paddingLeft: `${LEFT}%` }}>
          <div className="relative h-5 flex-1">
            {days.map((d) => (
              <span key={d} className="absolute top-0" style={{ left: pos(d) }}>
                Day {d / 24 + 1}
              </span>
            ))}
            <span className="absolute top-0 right-0">Shift</span>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute top-5 bottom-0" style={{ left: `${LEFT}%`, right: 0 }}>
          {days.map((d) => (
            <span key={d} className="absolute inset-y-0 w-px bg-mz-line/70" style={{ left: pos(d) }} />
          ))}
          <span className="tl-now absolute inset-y-0 w-px" style={{ left: pos(hour) }} />
        </div>

        {ZONES.map((z) => (
          <div key={z.id} role="group" aria-label={z.label} className="mt-1.5">
            <p className="pb-0.5 text-[12px] text-mz-muted">{z.label}</p>
            {rows
              .filter((r) => z.pumps.includes(r.id))
              .map((p) => (
                <div
                  key={p.id}
                  {...pickProps(p.id, props, `${p.name}, ${STATUS_WORD[p.status].toLowerCase()}${p.fault ? `: ${p.fault}` : ""}. Show details.`)}
                  className={`tl-row flex h-[34px] items-center rounded-md ${props.selected === p.id ? "tl-selected" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-2 pr-3 pl-2" style={{ width: `${LEFT}%` }}>
                    <span aria-hidden className={`tl-dot tl-${p.status} size-2 shrink-0 rounded-full`} />
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-tight">{p.name}</span>
                      <span className="block truncate text-[12px] leading-tight text-mz-muted">{p.fault ?? STATUS_WORD[p.status]}</span>
                    </span>
                  </div>
                  <div className="h-full flex-1">
                    <Track p={p} hour={hour} shiftHour={props.shiftHour} />
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
