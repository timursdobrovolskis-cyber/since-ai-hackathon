"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";
import { ReplayBar } from "./ReplayBar";

const NAV = [
  { href: "/", label: "Fleet" },
  { href: "/log", label: "Decision log" },
  { href: "/review", label: "Review" },
];

const FACTS = ["Advisory only", "Read-only", "Simulated data"];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { error, fleet } = useApp();
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-panel px-4 py-2">
        <Link href="/" className="font-cond text-lg font-semibold">Retrofit Assist</Link>
        <nav className="flex gap-4" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path === n.href ? "page" : undefined}
              className={path === n.href ? "font-semibold" : "text-ink-2 hover:text-ink"}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <ul className="ml-auto flex gap-1.5 text-[13px] text-ink-2" aria-label="How this app works">
          {FACTS.map((f) => (
            <li key={f} className="border border-line bg-raised px-2 py-0.5">{f}</li>
          ))}
        </ul>
      </header>
      {/* Review shows the real answers, so it sits outside replay. */}
      {path !== "/review" && <ReplayBar />}
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
        RETROFIT AI 2026 synthetic pump benchmark, Since AI Hackathon 2026. Not measured on any real ship or plant.
      </footer>
    </div>
  );
}
