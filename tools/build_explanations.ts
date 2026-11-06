#!/usr/bin/env node
// Write short plain-language explanations for the demo alerts and store them, so the app needs no key and works offline.
//
//   npm run explain            calls the API, which spends a small amount of paid credit
//   npm run explain -- --dry   prints the first prompt and the alert list, with no API call and no cost
//
// The model sees one alert, its evidence and the pump sheet. It never sees labels, later alerts or later data.
// Any explanation containing a number that is not in its input is rejected, so it cannot add invented figures.
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const DEMO_ALERTS = [
  "PUMP-08-A0001", // clogged strainer, the lead story
  "PUMP-08-A0002",
  "PUMP-08-A0003", // cause left unclear
  "PUMP-08-A0004", // lost connection
  "PUMP-03-A0001", // machine half of the machine or sensor story
  "PUMP-03-A0005", // sensor half
  "PUMP-04-A0006", // bearing wear
  "PUMP-04-A0005", // sensor problem on a fully instrumented pump
];

const SYSTEM = `You explain one alert to the duty engineer looking after an old cooling-water pump.

Write 2 or 3 plain sentences, under 70 words in all, as one paragraph with no heading.
Say what the sensors show, why that points to the named cause, and what the engineer should check, in that order.
Use only the facts in the alert data. Use no number that is not in it, and do not work out new numbers.
If the cause is unclear, or something is not measured on this pump and that matters, say so.
Never state the cause as certain: say "points to", "suggests" or "may be".
Do not mention confidence scores, z-scores, standard deviations or the detector.
Recommend human checks only. Never tell anyone to change a setting or operate the machine.`;

type Alert = {
  alert_id: string; asset_id: string; event_class: string; fault_type: string; offset_hours: number; recommended_action: string;
  evidence: { summary: string; channels: { channel: string; observed: number | null; expected: number | null }[]; blind_spots: string[] };
};
type Pump = { id: string; system: string; site: string; control: string; tier: string; commissionedYear: number };

const read = <T,>(path: string): T => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), "utf8"));

function promptFor(alert: Alert, pump: Pump, meta: Record<string, { label: string; unit: string }>) {
  const label = (c: string) => meta[c]?.label ?? c;
  return JSON.stringify({
    pump: { system: pump.system, site: pump.site, control: pump.control, sensorLevel: pump.tier, commissioned: pump.commissionedYear },
    alert: { kind: alert.event_class, namedCause: alert.fault_type, recommendedCheck: alert.recommended_action, evidence: alert.evidence.summary },
    signals: alert.evidence.channels.map((c) => ({ signal: label(c.channel), unit: meta[c.channel]?.unit, measured: c.observed, expected: c.expected })),
    notMeasuredOnThisPump: alert.evidence.blind_spots.map(label),
  }, null, 1);
}

/** Numbers in the output that do not appear in the input. Words like "2 or 3" cannot be used to smuggle in a figure. */
function unknownNumbers(text: string, input: string) {
  const inInput = new Set(input.match(/\d+(?:\.\d+)?/g) ?? []);
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => !inInput.has(n));
}

const { alerts } = read<{ alerts: Alert[] }>("alerts.json");
const fleet = read<{ pumps: Pump[]; channelMeta: Record<string, { label: string; unit: string }> }>("fleet.json");
const chosen = DEMO_ALERTS.map((id) => {
  const alert = alerts.find((a) => a.alert_id === id);
  if (!alert) throw new Error(`Alert ${id} is not in alerts.json`);
  return { alert, prompt: promptFor(alert, fleet.pumps.find((p) => p.id === alert.asset_id)!, fleet.channelMeta) };
});

if (process.argv.includes("--dry")) {
  console.log(`${chosen.length} alerts, model ${MODEL}. No API call made.\n\nSystem:\n${SYSTEM}\n\nFirst input:\n${chosen[0].prompt}`);
  process.exit(0);
}

const client = new Anthropic();
const items: Record<string, { text: string }> = {};
let input = 0;
let output = 0;

for (const { alert, prompt } of chosen) {
  let text = "";
  for (let attempt = 1; attempt <= 2 && !text; attempt++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1000,
      betas: ["server-side-fallback-2026-07-01"],
      // @ts-expect-error The server-side "default" form is newer than some SDK type definitions.
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    input += response.usage.input_tokens;
    output += response.usage.output_tokens;
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.error(`${alert.alert_id}: stopped with ${response.stop_reason}, attempt ${attempt}`);
      continue;
    }
    const draft = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ").trim();
    const unknown = unknownNumbers(draft, prompt);
    if (unknown.length) console.error(`${alert.alert_id}: rejected, numbers not in its data: ${unknown.join(", ")}`);
    else text = draft;
  }
  if (text) {
    items[alert.alert_id] = { text };
    console.log(`${alert.alert_id}: ${text}\n`);
  } else {
    console.error(`${alert.alert_id}: no explanation stored`);
  }
}

writeFileSync(new URL("../public/data/explanations.json", import.meta.url),
  JSON.stringify({ model: MODEL, detector: "B1 baseline", items }, null, 1));
const cost = (input * 4 + output * 20) / 1e6;
console.log(`Stored ${Object.keys(items).length} of ${chosen.length}. ${input} input and ${output} output tokens, about USD ${cost.toFixed(3)} at list price.`);
