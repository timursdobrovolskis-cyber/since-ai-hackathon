"use client";

import { ActivityFeed } from "@/components/ActivityFeed";
import { CaseBoard } from "@/components/CaseBoard";
import { CaseInbox } from "@/components/CaseInbox";
import { FlaggedChart } from "@/components/FlaggedChart";
import { FleetStrips } from "@/components/FleetStrips";
import { StatCards } from "@/components/StatCards";
import { Card } from "@/components/ui/card";

// The fuller picture for planners and the jury. Workers start on the Today screen.
export default function WeekPage() {
  return (
    <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-12">
      <div className="order-1 min-w-0 lg:col-span-12"><StatCards /></div>
      <Card className="order-6 min-w-0 overflow-x-auto p-4 lg:order-2 lg:col-span-8">
        <div className="min-w-[44rem]"><FleetStrips /></div>
      </Card>
      <Card className="order-2 min-w-0 overflow-hidden lg:order-3 lg:col-span-4"><CaseInbox scroll /></Card>
      <div className="order-4 min-w-0 lg:col-span-5"><FlaggedChart /></div>
      <div className="order-5 min-w-0 lg:col-span-4"><CaseBoard /></div>
      <div className="order-3 min-w-0 lg:order-6 lg:col-span-3"><ActivityFeed /></div>
    </div>
  );
}
