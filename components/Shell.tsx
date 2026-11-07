"use client";

import { Activity, Calculator, ClipboardCheck, ClipboardList, Gauge, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { ReplayBar } from "./ReplayBar";

const NAV: { href: string; label: string; title: string; icon: LucideIcon }[] = [
  { href: "/", label: "Fleet", title: "Fleet overview", icon: Gauge },
  { href: "/log", label: "Decision log", title: "Decision log", icon: ClipboardList },
  { href: "/review", label: "Review", title: "Review", icon: ClipboardCheck },
  { href: "/sensors", label: "Sensor levels", title: "Sensor levels", icon: Activity },
  { href: "/payback", label: "Payback", title: "Payback", icon: Calculator },
];

const OUTSIDE_REPLAY = new Set(["/review", "/sensors", "/payback"]);

const FACTS = ["Advisory only", "Read-only", "Simulated data"];

function Wordmark() {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-display text-[19px] leading-none font-semibold tracking-[0.04em] uppercase">Retrosense</span>
      <span aria-hidden className="size-1.5 bg-ink-3" />
    </span>
  );
}

function Sidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex-1 space-y-0.5 p-2" aria-label="Main">
        {NAV.map((n, i) => {
          const active = path === n.href || (n.href === "/" && path.startsWith("/cases"));
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-10 items-center gap-3 rounded-sm px-2.5 transition-colors duration-150 ${active ? "bg-raised font-medium text-ink" : "text-ink-2 hover:bg-raised hover:text-ink"}`}
            >
              {/* The one orange tick marks where you are. */}
              <span aria-hidden className={`absolute inset-y-2 left-0 w-0.5 ${active ? "bg-accent" : "bg-transparent"}`} />
              <span aria-hidden className={`font-mono text-[11px] tracking-[0.08em] ${active ? "text-ink" : "text-ink-3"}`}>{String(i + 1).padStart(2, "0")}</span>
              <n.icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <ul className="space-y-1.5 border-t border-line p-4" aria-label="How this app works">
        {FACTS.map((f) => <li key={f} className="label-mono">{f}</li>)}
      </ul>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { error, fleet } = useApp();
  const [open, setOpen] = useState(false);
  const title = NAV.find((n) => n.href === path)?.title ?? "Case";
  const Title = path === "/" ? "h1" : "p";

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <Link href="/" className="flex h-13 items-center border-b border-line px-4"><Wordmark /></Link>
        <Sidebar path={path} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-deck/70" />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col border-r border-line bg-panel">
            <div className="flex h-13 items-center justify-between border-b border-line px-4">
              <Wordmark />
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center"><X aria-hidden className="size-5" /></button>
            </div>
            <Sidebar path={path} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-13 items-center gap-2 border-b border-line bg-panel px-3 sm:px-4">
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex size-10 items-center justify-center lg:hidden"><Menu aria-hidden className="size-5" /></button>
          {/* Other pages carry their own main heading, so this bar is only the heading on Fleet. */}
          <Title className="truncate font-display text-lg font-semibold">{title}</Title>
          <p className="label-mono ml-auto hidden sm:block lg:hidden">Advisory only, simulated data</p>
        </header>
        {/* These screens use labelled faults, so they sit outside replay. */}
        {!OUTSIDE_REPLAY.has(path) && <ReplayBar />}
        <main className="flex-1">
          {error ? (
            <p className="p-6">{error}. Run tools/build_ui_data.py to create the data, then reload.</p>
          ) : fleet ? (
            children
          ) : (
            <p className="p-6 text-ink-2">Loading pump data</p>
          )}
        </main>
        <footer className="border-t border-line px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-3">
          RETROFIT AI 2026 synthetic pump benchmark, Since AI Hackathon 2026. Not measured on any real ship or plant.
        </footer>
      </div>
    </div>
  );
}
