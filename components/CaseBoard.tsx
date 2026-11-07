"use client";

import type { CSSProperties } from "react";
import { memo, useState } from "react";
import { Box, Glow, Plate, Press } from "react-isokit";
import { casesPerDay, type Filter } from "@/lib/overview";
import { useApp } from "./AppProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const BASE = { x: 0, y: 0, z: 0, w: 176, d: 132, h: 8 };
const FOOT = { x: 70, y: 7, z: BASE.h, w: 36, d: 15, h: 2.5 };
const NECK = { x: 82, y: 10, z: FOOT.z + FOOT.h, w: 12, d: 8, h: 34 };
const PANEL = { x: 8, y: 18, z: 40, w: 160, d: 8, h: 64 };
const SHELF = { x: 14, y: 44, z: BASE.h, w: 148, d: 26, h: 5 };
const COL = { y: SHELF.y + 7, w: 12, d: 12, h: 3.4, step: 4.2, gap: 20, inset: 7 };
const KEY = { y: 96, z: BASE.h, w: 38, d: 20, h: 5 };
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const KEYS: { id: Filter; label: string; words: string; x: number }[] = [
  { id: "all", label: "ALL", words: "all cases", x: 16 },
  { id: "MACHINE", label: "MACH", words: "machine problems", x: 69 },
  { id: "SENSOR", label: "SENS", words: "sensor problems", x: 122 },
];
const colX = (i: number) => SHELF.x + COL.inset + i * COL.gap;

type DrawingProps = { counts: number[]; filter: Filter; setFilter: (f: Filter) => void };

// Memoised on its numbers: replay updates every frame, and redrawing dozens of boxes each frame would make it stutter.
const Drawing = memo(
  function Drawing({ counts, filter, setFilter }: DrawingProps) {
    const total = counts.reduce((a, b) => a + b, 0);
    const key = KEYS.find((k) => k.id === filter)!;
    return (
      <Plate
        className="case-board"
        label={`Isometric board showing ${key.words}: ${total} so far. Columns for Day 1 to Day 7 hold ${counts.join(", ")}.`}
        fit={[BASE, PANEL, { ...PANEL, z: 0, h: PANEL.z + PANEL.h }]}
        aspect={1.15}
        pad={0.04}
        credit={false}
        theme="dark"
      >
          <Box {...BASE} r={10} />
          <Box {...FOOT} r={6} />
          <Box {...NECK} r={3} />
          <Box
            {...PANEL}
            r={3}
            front={
              <>
                <rect className="ik-screen" x={6} y={5} width={PANEL.w - 12} height={54} rx={4} />
                <text className="ik-screen-text" x={16} y={38} fontSize={26}>{total}</text>
                <text className="ik-screen-text" x={PANEL.w - 16} y={38} fontSize={10} textAnchor="end">{key.words}</text>
              </>
            }
          />
          <Box
            {...SHELF}
            r={4}
            top={DAYS.map((i) => (
              <rect key={i} className="ik-well" x={colX(i) - SHELF.x - 2} y={COL.y - SHELF.y - 2} width={COL.w + 4} height={COL.d + 4} rx={2} />
            ))}
          />
          {DAYS.map((i) =>
            LEVELS.map((level) => (
              <g key={`${i}-${level}`} className="slab" data-on={level < (counts.at(i) ?? 0)} style={{ "--day": i } as CSSProperties}>
                <Box x={colX(i)} y={COL.y} z={SHELF.z + SHELF.h + level * COL.step} w={COL.w} d={COL.d} h={COL.h} r={1.5} />
              </g>
            )),
          )}
          {KEYS.map((k) => (
            <Press key={k.id} label={`Show ${k.words}`} material="rubber" sound={false} onPress={() => setFilter(k.id)} className="board-key" data-on={filter === k.id}>
              <g>
                <Box
                  x={k.x}
                  y={KEY.y}
                  z={KEY.z}
                  w={KEY.w}
                  d={KEY.d}
                  h={KEY.h}
                  r={5}
                  top={
                    <>
                      <text className="ik-label" x={6} y={13.2}>{k.label}</text>
                      <Glow on={filter === k.id}><circle className="board-led" cx={KEY.w - 5} cy={KEY.d / 2} r={1.7} /></Glow>
                    </>
                  }
                />
              </g>
            </Press>
          ))}
      </Plate>
    );
  },
  (a, b) => a.filter === b.filter && a.counts.join() === b.counts.join(),
);

/** One column per day of the replay and one slab per case raised that day, so the week builds up as it plays. */
export function CaseBoard() {
  const { cases } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <CardTitle>Cases raised each day</CardTitle>
        <CardDescription>One column per day, one slab per case. Press a key to filter.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <Drawing counts={casesPerDay(cases, filter)} filter={filter} setFilter={setFilter} />
      </CardContent>
    </Card>
  );
}
