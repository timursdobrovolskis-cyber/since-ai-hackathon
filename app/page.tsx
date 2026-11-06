"use client";

import { CaseInbox } from "@/components/CaseInbox";
import { FleetStrips } from "@/components/FleetStrips";

export default function FleetPage() {
  return (
    <div className="grid min-h-full lg:grid-cols-[1fr_21rem]">
      <div className="order-2 min-w-0 overflow-x-auto p-4 lg:order-1">
        <div className="min-w-[44rem]"><FleetStrips /></div>
      </div>
      <aside className="order-1 border-b border-line bg-panel lg:order-2 lg:border-b-0 lg:border-l">
        <CaseInbox />
      </aside>
    </div>
  );
}
