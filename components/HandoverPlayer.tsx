"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppProvider";

type Item = { hour: number; label: string; text: string; file: string };
type Stored = { detector: string; items: Item[] };

/** Plays the newest recorded handover at or before the replay time. The words stay readable, so it works without sound. */
export function HandoverPlayer() {
  const { alertSource, hour } = useApp();
  const [stored, setStored] = useState<Stored | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showText, setShowText] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/data/handover.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => live && setStored(data))
      .catch(() => {
        // The handover is an extra. Today works without it.
      });
    return () => {
      live = false;
    };
  }, []);

  // Audio recorded for another detector would describe alerts that are no longer on screen.
  const item = stored && stored.detector === alertSource ? [...stored.items].reverse().find((i) => i.hour <= hour) : undefined;
  const file = item?.file;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new shift starts from the beginning
    setPlaying(false);
    setFailed(false);
  }, [file]);

  if (!item) return null;

  const toggle = async () => {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    try {
      setShowText(true);
      await el.play();
    } catch {
      setFailed(true);
    }
  };

  return (
    <section aria-label="Shift handover" className="rounded-md border border-line bg-panel px-3 py-1.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} aria-label={playing ? "Pause shift handover" : "Play shift handover"} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink">
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-2">Hear this as a 30-second handover ({item.label.toLowerCase()})</p>
        </div>
        <button type="button" aria-expanded={showText} onClick={() => setShowText(!showText)} className="min-h-9 shrink-0 text-[13px] text-ink-2 underline underline-offset-2">
          {showText ? "Hide words" : "Read it"}
        </button>
      </div>
      {failed && <p className="mt-2 text-[13px]">The audio could not play here. The words below say the same thing.</p>}
      {(showText || failed) && <p className="mt-2 border-t border-line pt-2 text-ink-2">{item.text}</p>}
      <audio
        ref={audio}
        src={`/audio/handover/${item.file}`}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
    </section>
  );
}
