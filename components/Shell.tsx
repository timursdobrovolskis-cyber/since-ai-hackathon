"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

const TITLES: Record<string, string> = {
  "/log": "My decisions",
  "/week": "Week overview",
  "/review": "Review",
  "/sensors": "Sensor levels",
  "/payback": "Payback",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { error, fleet } = useApp();
  // The landing page brings its own header and footer.
  if (path === "/welcome") return <>{children}</>;
  const title = TITLES[path];
  // Other pages carry their own main heading, so this bar is only the heading on Week overview.
  const Title = path === "/week" ? "h1" : "p";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex h-13 items-center gap-3 border-b border-line bg-panel px-3 sm:px-4">
        <Link href="/" className="font-cond text-lg font-semibold">Retrofit Assist</Link>
        {title && <Title className="truncate border-l border-line pl-3 font-cond text-lg text-ink-2">{title}</Title>}
        {title && <Link href="/" className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1 text-ink-2 hover:text-ink"><ChevronLeft aria-hidden className="size-4" />Today</Link>}
      </header>
      <main className="flex-1">
        {error ? (
          <p className="p-6">{error}. Run tools/build_ui_data.py to create the data, then reload.</p>
        ) : fleet ? (
          children
        ) : (
          <p className="p-6 text-ink-2">Loading pump data</p>
        )}
      </main>
      <footer className="border-t border-line px-4 py-2 text-[13px] text-ink-3">
        Advisory only and read-only. Simulated data from the RETROFIT AI 2026 benchmark, not measured on any real ship or plant. Shows one evening shift from a test week.
      </footer>
    </div>
  );
}
