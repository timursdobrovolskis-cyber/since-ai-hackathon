"use client";

// The site as an alarm panel, like the annunciator in a control room: one window per pump, in pump number order so a
// pump is always in the same place and easy to find. A window lights when its pump has a concern and flashes three
// times when it first lights. Each window says only two things: which pump and for how long, and what is wrong.
// Solid red means it needs you today, amber means check the reading, and an icon marks both, so colour is never the
// only signal.
import { Gauge, TriangleAlert } from "lucide-react";
import { MapHead, pickProps, STATUS_WORD, usePumpRows, type MapProps, type PumpRow } from "./mapParts";

const byNumber = (a: PumpRow, b: PumpRow) => Number(a.id.slice(5)) - Number(b.id.slice(5));

function Icon({ status }: { status: PumpRow["status"] }) {
  if (status === "needs") return <TriangleAlert aria-hidden className="size-4 shrink-0" strokeWidth={2} />;
  if (status === "check") return <Gauge aria-hidden className="size-4 shrink-0" strokeWidth={2} />;
  return null;
}

const quiet: Partial<Record<PumpRow["status"], string>> = { normal: "Normal", nodata: "No data yet" };

/** `columns` 2 suits a phone at full width; the default is 3 on small screens and 4 from tablet width. */
export function AlarmPanel({ columns, ...props }: MapProps & { columns?: 2 }) {
  const rows = [...usePumpRows(props.site)].sort(byNumber);
  return (
    <div>
      <MapHead site={props.site} shiftHour={props.shiftHour} />
      <div role="group" aria-label="Alarm panel, one window per pump" className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-4"}`}>
        {rows.map((p) => (
          <div
            key={p.id}
            {...pickProps(p.id, props, `${p.name}, ${STATUS_WORD[p.status].toLowerCase()}${p.fault ? `: ${p.fault}` : ""}${p.since !== null ? `, for ${p.since} hours` : ""}. Show details.`)}
            className={`ann ann-${p.status} ${props.selected === p.id ? "ann-on" : ""}`}
          >
            {/* Keyed on the status, so the flash replays whenever a window lights or changes. */}
            <div key={p.status} className="ann-face flex h-full flex-col justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[15px] leading-none font-medium">
                <Icon status={p.status} />
                <span className="truncate">{p.name}</span>
                {p.since !== null && <span className="ann-since ml-auto font-mono text-[12px] font-normal tabular-nums">{p.since} h</span>}
              </p>
              <p className="ann-text line-clamp-3 text-[13px] leading-[1.2]">{p.fault ?? quiet[p.status]}</p>
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-mz-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="ann-key ann-key-needs"><TriangleAlert className="size-2.5" strokeWidth={2.5} /></span> Needs you today
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="ann-key ann-key-check"><Gauge className="size-2.5" strokeWidth={2.5} /></span> Check the reading
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="ann-key ann-key-normal" /> Normal or can wait
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="ann-key ann-key-nodata" /> Test pump, no data yet
        </li>
      </ul>
    </div>
  );
}
