# Progress: voice-handover

## Done

- Spoken shift handover recorded and playing from Today.
- Ask about this pump, by voice or typing, behind an access code.
- Typed tests: it hedges causes, refuses machine commands, sends emergencies to plant procedure and says when it doesn't know.

## In progress

Nothing.

## Next

- A person tests hold-to-talk with a real microphone.
- Set `ELEVENLABS_API_KEY` and `VOICE_ACCESS_CODE` in Vercel before deploying.
- Run `npm run explain` once `ANTHROPIC_API_KEY` is available, which is optional now.
- After swapping in detector alerts, rerun `npm run handover`.

## Blockers

- No detector file yet.
