"use client";

import { AlertTriangle, BellRing, ClipboardList, Diamond, type LucideIcon } from "lucide-react";
import { overviewStats } from "@/lib/overview";
import { useApp } from "./AppProvider";
import { Card } from "./ui/card";

export function StatCards() {
  const { cases, pumps, decisions, hour } = useApp();
  const s = overviewStats(cases, Object.values(pumps), decisions, hour);
  const total = Object.keys(pumps).length;
  const stats: { label: string; value: number; hint: string; icon: LucideIcon; tone?: string }[] = [
    { label: "Cases to review", value: s.open, hint: `${s.newToday} raised in the last 24 h, ${s.decided} decided`, icon: ClipboardList },
    { label: "Machine problems", value: s.machine, hint: "Open cases on the pump itself", icon: AlertTriangle, tone: s.machine ? "text-machine" : undefined },
    { label: "Sensor problems", value: s.sensor, hint: "Check the instrument first", icon: Diamond, tone: s.sensor ? "text-sensor" : undefined },
    { label: "Plant alarms so far", value: s.alarms, hint: `On ${s.pumpsWithAlarms} of ${total} pumps`, icon: BellRing },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[13px] font-medium text-ink-2">{stat.label}</h2>
            <stat.icon aria-hidden className={`size-4 shrink-0 ${stat.tone ?? "text-ink-3"}`} />
          </div>
          <p className={`font-cond text-3xl leading-tight font-semibold ${stat.tone ?? ""}`}>{stat.value}</p>
          <p className="text-[13px] text-ink-3">{stat.hint}</p>
        </Card>
      ))}
    </div>
  );
}
