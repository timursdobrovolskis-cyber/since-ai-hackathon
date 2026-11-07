"use client";

import { Conversation } from "@elevenlabs/client";
import { Keyboard, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { pumpName } from "@/lib/plain";
import type { Case, PumpMeta } from "@/lib/types";
import { pumpBrief } from "@/lib/voice";
import { useApp } from "./AppProvider";

const CODE_KEY = "retrofit-assist-voice-code";

type Line = { who: "you" | "assistant"; text: string };
type Mode = "voice" | "text";

const PROBLEMS: Record<string, string> = {
  code: "That access code is not right.",
  "slow-down": "Too many tries. Wait a minute and try again.",
  off: "Asking needs an internet connection and is not available here. The check above still applies.",
  unavailable: "The voice service did not answer. Try again in a moment.",
  mic: "The microphone is blocked. Allow it in your browser, or use Type instead.",
  connect: "Could not connect. Check the connection and try again.",
};

/** Ask about the pump in view. Answers are spoken, and always shown as text so they work in a loud room. */
export function AskPump({ item, meta }: { item: Case; meta: PumpMeta }) {
  const { cases, fleet, pumps, hour } = useApp();
  const session = useRef<Conversation | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<"idle" | "code" | "connecting" | "ready">("idle");
  const [wanted, setWanted] = useState<Mode>("voice");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [holding, setHolding] = useState(false);
  const [typed, setTyped] = useState("");

  // Leaving the page must end the conversation, or it keeps using credits.
  useEffect(() => () => void session.current?.endSession(), []);

  const stop = async () => {
    const live = session.current;
    session.current = null;
    await live?.endSession();
    setState("idle");
    setMode(null);
    setHolding(false);
  };

  const start = async (how: Mode, given?: string) => {
    setWanted(how);
    setProblem(null);
    const access = given ?? sessionStorage.getItem(CODE_KEY);
    if (!access) {
      setState("code");
      return;
    }
    setState("connecting");
    if (how === "voice") {
      try {
        (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop());
      } catch {
        setProblem(PROBLEMS.mic);
        setState("idle");
        return;
      }
    }
    const res = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: access }) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { signedUrl?: string; error?: string } | null;
    if (!res?.ok || !data?.signedUrl) {
      if (data?.error === "code") sessionStorage.removeItem(CODE_KEY);
      setProblem(PROBLEMS[data?.error ?? "connect"] ?? PROBLEMS.connect);
      setState(data?.error === "code" ? "code" : "idle");
      return;
    }
    sessionStorage.setItem(CODE_KEY, access);
    try {
      const live = await Conversation.startSession({
        signedUrl: data.signedUrl,
        textOnly: how === "text",
        overrides: how === "text" ? { conversation: { textOnly: true } } : undefined,
        dynamicVariables: { pump_name: pumpName(meta.id), pump_brief: pumpBrief(item, cases, meta, pumps[meta.id], fleet?.channelMeta ?? {}, hour) },
        onMessage: ({ message, source }) => {
          if (source === "ai") setLines((l) => [...l, { who: "assistant", text: message }]);
          else if (how === "voice" && message.trim()) setLines((l) => [...l, { who: "you", text: message }]);
        },
        onDisconnect: () => {
          session.current = null;
          setState("idle");
          setMode(null);
        },
        onError: () => setProblem(PROBLEMS.connect),
      });
      session.current = live;
      if (how === "voice") live.setMicMuted(true);
      setMode(how);
      setState("ready");
    } catch {
      setProblem(PROBLEMS.connect);
      setState("idle");
    }
  };

  const hold = (down: boolean) => {
    session.current?.setMicMuted(!down);
    setHolding(down);
  };

  const send = () => {
    const text = typed.trim();
    if (!text || !session.current) return;
    setLines((l) => [...l, { who: "you", text }]);
    session.current.sendUserMessage(text);
    setTyped("");
  };

  return (
    <section aria-label="Ask about this pump" className="rounded-md border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Ask about this pump</h2>
          <p className="text-[13px] text-ink-2">Answers come only from this pump&rsquo;s data. Needs internet.</p>
        </div>
        {state === "idle" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => start("voice")} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-ink px-3 font-medium text-raised"><Mic aria-hidden className="size-4" />Talk</button>
            <button type="button" onClick={() => start("text")} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line bg-raised px-3"><Keyboard aria-hidden className="size-4" />Type instead</button>
          </div>
        )}
        {state === "ready" && <button type="button" onClick={stop} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line bg-raised px-3"><Square aria-hidden className="size-4" />End</button>}
      </div>

      {state === "code" && (
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void start(wanted, code.trim()); }}>
          <label className="flex flex-col text-[13px] text-ink-2">
            Access code
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" className="min-h-11 rounded-md border border-line bg-raised px-2 text-[15px] text-ink" />
          </label>
          <button type="submit" disabled={!code.trim()} className="min-h-11 rounded-md bg-ink px-4 font-medium text-raised disabled:opacity-50">Start</button>
        </form>
      )}
      {state === "connecting" && <p className="mt-2 text-ink-2">Connecting</p>}
      {problem && <p role="alert" className="mt-2 font-medium">{problem}</p>}

      {state === "ready" && mode === "voice" && (
        <button
          type="button"
          onPointerDown={() => hold(true)}
          onPointerUp={() => hold(false)}
          onPointerLeave={() => holding && hold(false)}
          onPointerCancel={() => hold(false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-pressed={holding}
          className={`mt-3 min-h-16 w-full touch-none rounded-md border-2 font-semibold select-none ${holding ? "border-machine bg-raised" : "border-ink bg-raised"}`}
        >
          {holding ? "Listening. Let go when you're done" : "Hold to talk"}
        </button>
      )}
      {state === "ready" && mode === "text" && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input aria-label="Your question" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="What should I check first?" className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-raised px-2" />
          <button type="submit" disabled={!typed.trim()} className="min-h-11 rounded-md bg-ink px-4 font-medium text-raised disabled:opacity-50">Ask</button>
        </form>
      )}

      {lines.length > 0 && (
        <ol aria-live="polite" className="mt-3 space-y-1.5 border-t border-line pt-2">
          {lines.map((line, i) => (
            <li key={`${i}-${line.who}`}><span className="text-[13px] text-ink-3">{line.who === "you" ? "You" : "Assistant"}: </span>{line.text}</li>
          ))}
        </ol>
      )}
      {lines.length > 0 && <p className="mt-2 text-[13px] text-ink-3">Advice only. In an emergency, follow plant procedure.</p>}
    </section>
  );
}
