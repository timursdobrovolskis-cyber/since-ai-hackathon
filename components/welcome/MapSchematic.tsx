"use client";

// Site map alternative 1: the plant's own drawing. Each system is a piping schematic: the pumps stand in parallel
// between a suction main and a discharge header, drawn with the engineering symbol for a centrifugal pump. Each pump
// is labelled with its name and, when something is wrong, what it is. Columns line up across systems.
import { TEST_PUMPS, ZONES } from "@/lib/sitemap";
import { MapHead, pickProps, STATUS_WORD, usePumpRows, type MapProps, type PumpRow } from "./mapParts";

const W = 668;
const ROW = 150;
const GUTTER = 112;
const COL = 104;
const colX = (i: number) => GUTTER + 26 + i * COL;

/** Where each system draws from and to, in plain words. */
const FLOW: Record<string, [string, string]> = {
  sw: ["Sea chest", "Coolers"],
  fw: ["Fresh-water circuit", "Engine coolers"],
  cw: ["Tower basin", "Plant"],
  pw: ["Process tank", "Plant"],
};

function wrap(text: string, max = 15, most = 3) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, most);
}

function Pump({ p, x, y0, props }: { p: PumpRow; x: number; y0: number; props: MapProps }) {
  const header = y0 + 32;
  const pumpY = y0 + 58;
  const main = y0 + 82;
  const on = props.selected === p.id;
  const label = `${p.name}, ${STATUS_WORD[p.status].toLowerCase()}${p.fault ? `: ${p.fault}` : ""}. Show details.`;
  const fault = p.fault ? wrap(p.fault) : [];
  return (
    <g {...pickProps(p.id, props, label)} className={`schem-pump schem-${p.status}`}>
      <rect x={x - COL / 2 + 4} y={y0 + 22} width={COL - 8} height={ROW - 20} rx={6} className="site-hit" />
      {/* Branch from the suction main up through the pump to the header. */}
      <line x1={x} x2={x} y1={main} y2={pumpY + 11} className="schem-pipe" />
      <line x1={x + 11} x2={x + 11} y1={pumpY - 4} y2={header} className="schem-pipe" />
      {/* Centrifugal pump: a circle with its outlet leaving at a tangent. */}
      {on && <circle cx={x} cy={pumpY} r={18} className="schem-selected" />}
      <circle cx={x} cy={pumpY} r={11} className="schem-body" />
      <path d={`M ${x + 4} ${pumpY - 10.3} L ${x + 11} ${pumpY - 10.3} L ${x + 11} ${pumpY - 4}`} className="schem-pipe" />
      {(p.status === "needs" || p.status === "check") && (
        <text key={p.status} x={x} y={pumpY + 4} textAnchor="middle" className="schem-mark">
          !
        </text>
      )}
      <text x={x} y={main + 19} textAnchor="middle" className="schem-name">
        {p.name}
      </text>
      {fault.length > 0 ? (
        fault.map((l, i) => (
          <text key={i} x={x} y={main + 34 + i * 14} textAnchor="middle" className="schem-fault">
            {l}
          </text>
        ))
      ) : (
        <text x={x} y={main + 34} textAnchor="middle" className="schem-quiet">
          {TEST_PUMPS.has(p.id) ? "No data yet" : "Normal"}
        </text>
      )}
    </g>
  );
}

export function MapSchematic(props: MapProps) {
  const rows = usePumpRows(props.site);
  const H = ZONES.length * ROW + 4;
  return (
    <div>
      <MapHead site={props.site} shiftHour={props.shiftHour} />
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="group" aria-label="Piping schematic of the site's pumps">
        <defs>
          <marker id="schem-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" className="schem-arrowhead" />
          </marker>
        </defs>
        {ZONES.map((z, zi) => {
          const y0 = zi * ROW;
          const pumps = rows.filter((r) => z.pumps.includes(r.id));
          const last = colX(pumps.length - 1);
          const [from, to] = FLOW[z.id];
          return (
            <g key={z.id}>
              {zi > 0 && <line x1={0} x2={W} y1={y0 + 4} y2={y0 + 4} className="schem-rule" />}
              {/* System name over two lines in the gutter, so it never runs into the pumps. */}
              {wrap(z.label, 13).map((l, i) => (
                <text key={i} x={0} y={y0 + 30 + i * 17} className="schem-system">
                  {l}
                </text>
              ))}
              {wrap(`From ${from.toLowerCase()}`, 14, 2).map((l, i) => (
                <text key={i} x={0} y={y0 + 70 + i * 14} className="schem-quiet">
                  {l}
                </text>
              ))}
              {/* Discharge header, flowing on to where the water goes, named past the arrow. */}
              <line x1={colX(0)} x2={last + 40} y1={y0 + 32} y2={y0 + 32} className="schem-pipe schem-main" markerEnd="url(#schem-arrow)" />
              <text x={last + 48} y={y0 + 36} className="schem-quiet">
                {to}
              </text>
              {/* Suction main, fed from the source. */}
              <line x1={GUTTER - 4} x2={last} y1={y0 + 82} y2={y0 + 82} className="schem-pipe schem-main" />
              {pumps.map((p, i) => (
                <Pump key={p.id} p={p} x={colX(i)} y0={y0} props={props} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
