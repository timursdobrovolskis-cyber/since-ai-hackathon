"use client";

// The end of the landing page: a blue call to action into the working app, then honest limits and sources.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { SiteState } from "@/lib/sitemap";
import { pumpName } from "@/lib/plain";

export function Closing({ site }: { site: SiteState }) {
  const first = site.order.red[0];
  const firstCase = first ? site.lines[first]?.lead.id : undefined;
  const count = site.order.red.length + site.order.orange.length;

  return (
    <>
      <section aria-label="Start the shift" className="bg-mz-accent px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">06 &middot; Evening shift</p>
        <h2 className="mt-4 max-w-[18ch] text-[40px] leading-[1.04] font-light tracking-[-0.035em] lg:text-[60px]">The evening shift is ready for you.</h2>
        <p className="mt-5 max-w-[52ch] text-[17px] leading-snug text-white/85">
          {count} {count === 1 ? "pump has" : "pumps have"} something to look at. Start with the list, or go straight to the job card of the
          first pump that needs you.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex min-h-12 items-center gap-2 bg-white px-6 text-[15px] font-medium text-mz-ink hover:bg-mz-ink hover:text-white">
            Open today&rsquo;s shift <ArrowRight aria-hidden className="size-4" />
          </Link>
          {firstCase && (
            <Link href={`/cases/${firstCase}`} className="inline-flex min-h-12 items-center gap-2 border border-white/60 px-6 text-[15px] hover:border-white hover:bg-white/10">
              {pumpName(first)} job card
            </Link>
          )}
          <Link href="/review" className="inline-flex min-h-12 items-center gap-2 border border-white/60 px-6 text-[15px] hover:border-white hover:bg-white/10">
            Review the results
          </Link>
        </div>
      </section>
      <footer className="grid gap-6 bg-mz-ink px-5 py-10 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-white/55 sm:px-10 md:grid-cols-3 lg:px-16">
        <p>Advisory only and read-only. It never sends anything to a machine. Plant alarms, trips and interlocks stay authoritative.</p>
        <p>Simulated data from the RETROFIT AI 2026 benchmark, CC BY 4.0. Baseline alerts until the team&rsquo;s detector is in. Site layout fictional.</p>
        <p>Built for the Business Turku RETROFIT AI challenge, Since AI Hackathon 2026. Charts by bklit-ui. 3D by three.js.</p>
      </footer>
    </>
  );
}
