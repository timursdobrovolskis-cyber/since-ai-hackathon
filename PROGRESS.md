# Progress: useful-for-workers

## Done

- Today shows one line per pump, with the most reliable concern first.
- Each line shows how often that cause was right before, whether the signal is getting worse, and the next chance to stop.
- The case screen is a job card: steps, what you'd expect to find, what to do if not, estimated time stopped and last done.
- After "I'll check it", the worker records what they found. It appears in My decisions and the CSV.
- Corrective work done since the alert moves a pump to Can wait, and says what was done.
- Voice is tucked away. Handovers are re-recorded with the new rules.

## In progress

Nothing.

## Next

- Joonas at Elomatic checks the job cards and time estimates.
- A person tests hold-to-talk and the app on a real phone.
- Merge the PRs in order, then set `ELEVENLABS_API_KEY` and `VOICE_ACCESS_CODE` in Vercel before deploying.
- After swapping in detector alerts, rerun `tools/build_ui_data.py --alerts` and `npm run handover`, because the track record and handovers change with the detector.

## Blockers

- No detector file yet.
