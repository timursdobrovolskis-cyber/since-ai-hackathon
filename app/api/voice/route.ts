import { timingSafeEqual } from "node:crypto";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import agent from "@/lib/voice-agent.json";

// Live voice spends credits, so a signed link is only issued for the right access code.
// The key stays here on the server. Wrong guesses are slowed down per visitor.
const WINDOW_MS = 60_000;
const MAX_TRIES = 6;
const tries = new Map<string, { count: number; since: number }>();

function tooMany(ip: string) {
  const now = Date.now();
  const entry = tries.get(ip);
  if (!entry || now - entry.since > WINDOW_MS) {
    tries.set(ip, { count: 1, since: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_TRIES;
}

function matches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.VOICE_ACCESS_CODE;
  if (!expected || !process.env.ELEVENLABS_API_KEY) return Response.json({ error: "off" }, { status: 503 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooMany(ip)) return Response.json({ error: "slow-down" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  if (typeof body?.code !== "string" || !matches(body.code.trim(), expected)) return Response.json({ error: "code" }, { status: 401 });

  try {
    const { signedUrl } = await new ElevenLabsClient().conversationalAi.conversations.getSignedUrl({ agentId: agent.agentId });
    return Response.json({ signedUrl });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
