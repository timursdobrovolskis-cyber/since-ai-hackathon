import { nextStop, trendOf } from "@/lib/worker";
import type { Trust } from "@/lib/trust";
import type { Alert, PumpData } from "@/lib/types";

const TONE: Record<Trust["level"], string> = { good: "text-ink-2", few: "text-ink-3", mixed: "text-ink-2", weak: "font-medium text-machine" };

/** The three things that decide what to do next: how far to trust it, whether it is worsening, and when it can be done. */
export function TrustLine({ trust, alert, pump, hour, showStop = true }: { trust: Trust | null; alert: Alert; pump?: PumpData; hour: number; showStop?: boolean }) {
  const trend = trendOf(alert, pump, hour);
  const stop = showStop ? nextStop(pump, hour) : null;
  return (
    <p className="text-[13px]">
      {trend && <span className={trend === "Getting worse" ? "font-medium text-machine" : "text-ink-2"}>{trend}. </span>}
      {trust && <span className={TONE[trust.level]}>{trust.words}. </span>}
      {stop && <span className="text-ink-2">{stop}</span>}
    </p>
  );
}
