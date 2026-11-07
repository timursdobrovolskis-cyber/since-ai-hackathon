#!/usr/bin/env node
// Record the spoken shift handovers and store them with the app, so visitors use no credits and it works offline.
//
//   npm run handover            calls ElevenLabs, which uses credits
//   npm run handover -- --dry   prints every script and the character count, with no API call
//
// Rerun after swapping in new alerts. The app hides handovers made for a different detector.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildCases } from "../lib/cases.ts";
import { handoverScript, shiftLabel } from "../lib/handover.ts";
import type { Alert, Fleet } from "../lib/types.ts";

const VOICE = "onwK4e9ZLuTAKqWW03F9"; // Daniel, a stock ElevenLabs voice
const MODEL = "eleven_v4";
const HOURS = [30, 42, 54, 66, 78, 90, 102, 114, 126, 138, 150, 162]; // 06:00 and 18:00, from Day 2

const data = (path: string) => new URL(`../public/data/${path}`, import.meta.url);
const audio = (name = "") => new URL(`../public/audio/handover/${name}`, import.meta.url);
const { alerts, source } = JSON.parse(readFileSync(data("alerts.json"), "utf8")) as { alerts: Alert[]; source: string };
const fleet = JSON.parse(readFileSync(data("fleet.json"), "utf8")) as Fleet;

const scripts = HOURS.map((hour) => ({ hour, label: shiftLabel(hour), text: handoverScript(buildCases(alerts, hour), fleet.channelMeta, hour), file: `h${String(hour).padStart(3, "0")}.mp3` }));
const characters = scripts.reduce((sum, s) => sum + s.text.length, 0);

if (process.argv.includes("--dry")) {
  for (const s of scripts) console.log(`[${s.label}] ${s.text.length} chars, about ${Math.round(s.text.split(" ").length / 2.6)} s\n${s.text}\n`);
  console.log(`${scripts.length} handovers, ${characters} characters. No API call made.`);
  process.exit(0);
}

const client = new ElevenLabsClient();
rmSync(audio(), { recursive: true, force: true });
mkdirSync(audio(), { recursive: true });
for (const s of scripts) {
  const stream = await client.textToSpeech.convert(VOICE, { text: s.text, modelId: MODEL });
  const bytes = Buffer.from(await new Response(stream).arrayBuffer());
  writeFileSync(audio(s.file), bytes);
  console.log(`${s.file}: ${(bytes.length / 1000).toFixed(0)} kB, ${s.label}`);
}
writeFileSync(data("handover.json"), JSON.stringify({ detector: source, voice: VOICE, model: MODEL, items: scripts }, null, 1));
console.log(`Stored ${scripts.length} handovers, ${characters} characters.`);
