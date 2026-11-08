#!/usr/bin/env node
// Record the spoken shift handover and store it with the app, so visitors use no credits and it works offline.
//
//   npm run handover            calls ElevenLabs, which uses credits
//   npm run handover -- --dry   prints every script and the character count, with no API call
//
// Rerun after swapping in new alerts. The app hides handovers made for a different detector.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildCases } from "../lib/cases.ts";
import { handoverScript, shiftLabel } from "../lib/handover.ts";
import { SHIFT_HOUR } from "../lib/labels.ts";
import type { TrackRecord } from "../lib/trust.ts";
import type { Alert, Fleet, PumpData } from "../lib/types.ts";

const VOICE = "onwK4e9ZLuTAKqWW03F9"; // Daniel, a stock ElevenLabs voice
const MODEL = "eleven_v4";

const data = (path: string) => new URL(`../public/data/${path}`, import.meta.url);
const audio = (name = "") => new URL(`../public/audio/handover/${name}`, import.meta.url);
const { alerts, source } = JSON.parse(readFileSync(data("alerts.json"), "utf8")) as { alerts: Alert[]; source: string };
const fleet = JSON.parse(readFileSync(data("fleet.json"), "utf8")) as Fleet;

const { causes } = JSON.parse(readFileSync(data("track-record.json"), "utf8")) as { causes: TrackRecord };

const pumps = Object.fromEntries(fleet.pumps.map((p) => [p.id, JSON.parse(readFileSync(data(`pumps/${p.id}.json`), "utf8")) as PumpData]));

const scripts = [SHIFT_HOUR].map((hour) => ({ hour, label: shiftLabel(hour), text: handoverScript(buildCases(alerts, hour), fleet.channelMeta, hour, causes, pumps), file: `h${String(hour).padStart(3, "0")}.mp3` }));
const characters = scripts.reduce((sum, s) => sum + s.text.length, 0);

if (process.argv.includes("--dry")) {
  for (const s of scripts) console.log(`[${s.label}] ${s.text.length} chars, about ${Math.round(s.text.split(" ").length / 2.6)} s\n${s.text}\n`);
  console.log(`${scripts.length} handovers, ${characters} characters. No API call made.`);
  process.exit(0);
}

// Record everything first, so a failed call leaves the stored audio as it was.
const client = new ElevenLabsClient();
const recorded: Buffer[] = [];
for (const s of scripts) {
  const stream = await client.textToSpeech.convert(VOICE, { text: s.text, modelId: MODEL });
  recorded.push(Buffer.from(await new Response(stream).arrayBuffer()));
}
rmSync(audio(), { recursive: true, force: true });
mkdirSync(audio(), { recursive: true });
scripts.forEach((s, i) => {
  writeFileSync(audio(s.file), recorded[i]);
  console.log(`${s.file}: ${(recorded[i].length / 1000).toFixed(0)} kB, ${s.label}`);
});
writeFileSync(data("handover.json"), JSON.stringify({ detector: source, voice: VOICE, model: MODEL, items: scripts }, null, 1));
console.log(`Stored ${scripts.length} handovers, ${characters} characters.`);
