"use client";

import { useEffect, useState } from "react";
import type { Case } from "@/lib/types";
import { useApp } from "./AppProvider";

type Stored = { detector: string; items: Record<string, { text: string }> };

/**
 * Plain-language explanation stored by tools/build_explanations.ts. Most alerts have none, so the panel stays hidden.
 * A case only holds alerts up to this shift, so the newest match can never come from the future.
 */
export function ExplanationPanel({ item }: { item: Case }) {
  const { alertSource } = useApp();
  const [stored, setStored] = useState<Stored | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/data/explanations.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => live && setStored(data))
      .catch(() => {
        // The explanation is an extra. The case page works without it.
      });
    return () => {
      live = false;
    };
  }, []);

  // Alert ids restart when the alerts change, so text written for another detector must never attach to these alerts.
  if (!stored || stored.detector !== alertSource) return null;
  const match = [...item.alerts].reverse().find((a) => stored.items[a.alert_id]);
  if (!match) return null;

  return (
    <section aria-labelledby="plain">
      <h2 id="plain" className="font-cond text-lg font-semibold">In plain words</h2>
      <p className="max-w-3xl">{stored.items[match.alert_id].text}</p>
      <p className="mt-1 text-[13px] text-ink-3">Written by AI from this alert&rsquo;s data only. Check it against the evidence below.</p>
    </section>
  );
}
