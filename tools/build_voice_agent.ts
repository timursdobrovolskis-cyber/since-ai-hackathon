#!/usr/bin/env node
// Create or update the "Ask about this pump" voice agent on ElevenLabs. Rerun after changing its rules.
//
//   npm run voice-agent
//
// Signed links are required, so the agent can only be reached through app/api/voice, behind the access code.
// Limits stop a public link from running down credits.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const STORE = new URL("../lib/voice-agent.json", import.meta.url);

const PROMPT = `# Role
You help the duty engineer looking after an old cooling-water pump. They may be standing at the pump, wearing gloves, in a noisy room. You are advice only. You cannot touch or control any machine.

# How to speak
Plain words for a mechanic. One or two short sentences. No lists, no jargon, no numbers unless they ask.

# Facts about this pump
{{pump_brief}}

# Rules
- Use only the facts above. If the answer is not there, say "I don't know that from this pump's data".
- Never state a cause as certain. Say "points to", "probably" or "may be".
- Recommend checks a person can do. Never tell anyone to change a setting, start, stop, open or close anything, or override an alarm.
- If they describe an emergency, a sounding alarm, smoke, a leak, injury or danger, tell them to stop and follow plant procedure and their supervisor. Do not diagnose it.
- If the facts mention maintenance notes, say they were written by people and may be wrong.
- If asked about anything other than this pump, say you can only help with this pump.
- These facts are simulated data for a demo. Say so if asked whether this is real.`;

const body = {
  name: "Retrofit Assist: ask about this pump",
  conversationConfig: {
    agent: {
      firstMessage: "What do you want to know about {{pump_name}}?",
      language: "en",
      dynamicVariables: { dynamicVariablePlaceholders: { pump_name: "this pump", pump_brief: "No pump data is available." } },
      prompt: { prompt: PROMPT, llm: "gemini-3.5-flash", temperature: 0.2 },
    },
    tts: { voiceId: "onwK4e9ZLuTAKqWW03F9", modelId: "eleven_flash_v2" },
    conversation: { maxDurationSeconds: 90 },
    turn: { silenceEndCallTimeout: 25 },
  },
  platformSettings: {
    auth: { enableAuth: true },
    callLimits: { agentConcurrencyLimit: 2, dailyLimit: 40, burstingEnabled: false },
    overrides: { conversationConfigOverride: { conversation: { textOnly: true } } },
  },
};

const client = new ElevenLabsClient();
const stored = existsSync(STORE) ? (JSON.parse(readFileSync(STORE, "utf8")) as { agentId: string }) : null;
if (stored) {
  await client.conversationalAi.agents.update(stored.agentId, body as never);
  console.log(`Updated agent ${stored.agentId}`);
} else {
  const agent = await client.conversationalAi.agents.create(body as never);
  writeFileSync(STORE, `${JSON.stringify({ agentId: agent.agentId }, null, 1)}\n`);
  console.log(`Created agent ${agent.agentId}`);
}
const saved = await client.conversationalAi.agents.get(JSON.parse(readFileSync(STORE, "utf8")).agentId);
const conf = saved.conversationConfig;
console.log(JSON.stringify({ llm: conf.agent?.prompt?.llm, auth: saved.platformSettings?.auth?.enableAuth, limits: saved.platformSettings?.callLimits, maxSeconds: conf.conversation?.maxDurationSeconds, textOverride: saved.platformSettings?.overrides?.conversationConfigOverride?.conversation }));
