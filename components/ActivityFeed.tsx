"use client";

import { BellRing, CircleCheck, Wrench } from "lucide-react";
import { recentActivity, type Activity } from "@/lib/overview";
import { age } from "@/lib/labels";
import { useApp } from "./AppProvider";
import { CaseMark } from "./Marks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

function Mark({ item }: { item: Activity }) {
  if (item.eventClass) return <CaseMark eventClass={item.eventClass} faultType={item.faultType} size={13} />;
  const Icon = item.kind === "alarm" ? BellRing : item.kind === "work" ? Wrench : CircleCheck;
  return <Icon aria-hidden className="size-3.5 text-ink-3" />;
}

export function ActivityFeed() {
  const { cases, pumps, decisions, hour } = useApp();
  const items = recentActivity(cases, Object.values(pumps), decisions, hour, 5);
  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Alerts, plant alarms, work orders and your decisions.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-ink-2">Nothing yet. Press Play to run the week.</p>
        ) : (
          <ol className="space-y-2.5">
            {items.map((item) => (
              <li key={item.key} className="flex items-start gap-2.5">
                <span className="mt-1 flex w-4 justify-center"><Mark item={item} /></span>
                <div className="min-w-0 flex-1 leading-snug">
                  <p><span className="font-cond font-semibold">{item.assetId}</span> <span className="text-ink-2">{item.text}</span></p>
                  <p className="text-[13px] text-ink-3">{age(hour - item.hour)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
