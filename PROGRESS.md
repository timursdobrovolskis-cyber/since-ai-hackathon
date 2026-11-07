# Progress: overview-rework

## Done

- New shell: icon sidebar, sticky header and a phone menu.
- Fleet overview: live stat cards, week strips beside the case list, a pumps-flagged chart, an isometric cases-per-day board and recent activity.
- `lib/overview.ts` holds the numbers, and `lib/overview.test.ts` checks they hold nothing after the replay time.

## In progress

Nothing.

## Next

- Run `npm run explain` once `ANTHROPIC_API_KEY` is in `.env`, which spends a small amount of paid credit.
- Run the swap steps in the README when the detector's alert file exists.
- Deploy, then test the live link with `playwright-cli`.

## Blockers

- `.env` has no Anthropic or ElevenLabs key yet.
