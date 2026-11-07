"use client";

import { Activity, Calculator, ClipboardCheck, ClipboardList, Gauge, ListChecks, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { ReplayBar } from "./ReplayBar";

const NAV: { href: string; label: string; title: string; icon: LucideIcon; group: "work" | "plan" }[] = [
  { href: "/", label: "Today", title: "Today", icon: ListChecks, group: "work" },
  { href: "/log", label: "My decisions", title: "My decisions", icon: ClipboardList, group: "work" },
  { href: "/week", label: "Week overview", title: "Week overview", icon: Gauge, group: "plan" },
  { href: "/review", label: "Review", title: "Review", icon: ClipboardCheck, group: "plan" },
  { href: "/sensors", label: "Sensor levels", title: "Sensor levels", icon: Activity, group: "plan" },
  { href: "/payback", label: "Payback", title: "Payback", icon: Calculator, group: "plan" },
];

const OUTSIDE_REPLAY = new Set(["/review", "/sensors", "/payback"]);

const FACTS = ["Advisory only", "Read-only", "Simulated data"];

function NavList({ items, path, onNavigate }: { items: typeof NAV; path: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map((n) => {
        const active = path === n.href || (n.href === "/" && path.startsWith("/cases"));
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-2.5 rounded-md px-2.5 ${active ? "bg-raised font-semibold text-ink" : "text-ink-2 hover:bg-raised hover:text-ink"}`}
            >
              <n.icon aria-hidden className="size-4 shrink-0" />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Sidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex-1 p-2" aria-label="Main">
        <NavList items={NAV.filter((n) => n.group === "work")} path={path} onNavigate={onNavigate} />
        <p className="mt-4 px-2.5 pb-1 text-[13px] text-ink-3">For planners</p>
        <NavList items={NAV.filter((n) => n.group === "plan")} path={path} onNavigate={onNavigate} />
      </nav>
      <ul className="space-y-1 border-t border-line p-3 text-[13px] text-ink-2" aria-label="How this app works">
        {FACTS.map((f) => <li key={f}>{f}</li>)}
      </ul>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { error, fleet } = useApp();
  const [open, setOpen] = useState(false);
  const title = NAV.find((n) => n.href === path)?.title ?? "Case";
  const Title = path === "/week" ? "h1" : "p";

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <Link href="/" className="flex h-13 items-center border-b border-line px-4 font-cond text-lg font-semibold">Retrofit Assist</Link>
        <Sidebar path={path} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40" />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col bg-panel">
            <div className="flex h-13 items-center justify-between border-b border-line px-4">
              <span className="font-cond text-lg font-semibold">Retrofit Assist</span>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center"><X aria-hidden className="size-5" /></button>
            </div>
            <Sidebar path={path} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-13 items-center gap-2 border-b border-line bg-panel px-3 sm:px-4">
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex size-10 items-center justify-center lg:hidden"><Menu aria-hidden className="size-5" /></button>
          {/* Other pages carry their own main heading, so this bar is only the heading on Week overview. */}
          <Title className="truncate font-cond text-lg font-semibold">{title}</Title>
          <p className="ml-auto hidden text-[13px] text-ink-2 sm:block lg:hidden">Advisory only, simulated data</p>
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
        <footer className="border-t border-line px-4 py-2 text-[13px] text-ink-3">
          RETROFIT AI 2026 synthetic pump benchmark, Since AI Hackathon 2026. Not measured on any real ship or plant.
        </footer>
      </div>
    </div>
  );
}
