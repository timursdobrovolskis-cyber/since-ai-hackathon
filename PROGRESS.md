# Progress: alert-swap

## Done

- `tools/build_ui_data.py --alerts <file> --name <name>` loads team alerts, as the official CSV or section 8 JSON.
- Bad files stop with a clear reason, before any data is written.
- B1 stays in the build, so Review can compare against it. Payback and Review wording updates with the detector.
- Stored AI explanations only show for the detector they were written for.
- Builds are now identical each run, because the hash seed is fixed.

## In progress

Nothing.

## Next

- Run `npm run explain` once `ANTHROPIC_API_KEY` is in `.env`, which spends a small amount of paid credit.
- Run the swap steps in the README when the detector's alert file exists.

## Blockers

- `.env` has no Anthropic or ElevenLabs key yet.
