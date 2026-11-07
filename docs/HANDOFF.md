# Handoff, 7 Nov 2026

Start here if you are continuing this project in a new Claude session. Then read `CLAUDE.md`, `AGENTS.md`, `PROGRESS.md` and `docs/spec.md`, where section 2a overrides older sections.

## The project

Since AI Hackathon 2026, Turku, Business Turku RETROFIT AI challenge. **Submit by Sunday 8 Nov, 10:00 EET, on sinceai.app.**

The app tells the person on shift, in plain words, which cooling pumps need them, what to do, and how far to trust it. It only advises, and it never touches a machine. Jona (GitHub `jonatqhan`) and Timur (`timursdobrovolskis-cyber`, repo owner) own the UI. Teammates build the detector. Jona has not read the challenge documents and relies on Claude for domain judgement, so give plain language and a clear pick.

The user's main goal is usefulness for the worker. Voice is a small optional extra, at most 10 seconds of the video.

## Where things stand

- **Live:** https://since-ai-hackathon.vercel.app, deployed by hand from `dashboard` with `vercel deploy --prod --yes`. It does not yet have PR 7.
- **`dashboard`:** holds PRs 1, 2, 3, 4 and 6.
- **PR 7, open:** https://github.com/timursdobrovolskis-cyber/since-ai-hackathon/pull/7, branch `one-home-screen`, which is checked out here. It removes the replay bar and sidebar, fixes the app on one evening shift (`SHIFT_HOUR` in `lib/labels.ts`), and puts everything on one main page. Tests, build and a local journey passed. Merging it was asked about and not yet answered.
- **PR 5, open, Timur's:** the dark Retrosense design. It is built on the older app and replaces the agreed calm grey look, so it needs a decision and rework.
- **Ask about this pump:** off on the live link, because `ELEVENLABS_API_KEY` and `VOICE_ACCESS_CODE` are not set in Vercel. The video does not use it.

## Still to do, most important first

1. Get the team's detector alerts. No detector work is on any branch. Every result so far comes from the placeholder B1 baseline.
2. Decide on PR 7 and PR 5, then merge, deploy and test the live link.
3. After the detector swap: run `tools/build_ui_data.py --alerts`, check `SHIFT_HOUR` still shows a good shift, run `npm run handover`, and update the numbers in the note and video script.
4. Produce the test-pump alert CSV. If the detector arrives, the detector team runs it on PUMP-10, 11 and 12 and writes the format in `submission_template/predictions_template.csv`, top cause only. If it does not, the organizer pack already holds B1's test predictions at `baselines/results/predictions_B1_mode_aware_z_test.csv` (27 rows: 3 on PUMP-10, 5 on PUMP-11, 19 on PUMP-12). Submit that file and say plainly that it is the baseline.
5. Ask Joonas Riekkinen at Elomatic to check the job cards and time estimates.
6. Test on a real phone, and test hold-to-talk if Ask goes live.
7. Record the video, make the source zip (`scripts/make-submission-zip.sh`), check the IP terms, and submit. A dry run of the zip script on 7 Nov gave 2 MB with no `.env`, no `data/restricted` content and no `node_modules`. It zips `HEAD` only, so commit first.

## Rules to keep

- Never read, quote or send anything in `data/restricted/`.
- Never print, log or commit secrets. Keys live in `.env.local`, which must not be opened or printed.
- Ask before running anything that spends paid credits. `npm run handover -- --dry` is free.
- Never invent numbers, and label mock data.
- One task per branch from `dashboard`, finish with a PR into it, and never push to `main` or `foundation`.
- Use `playwright-cli` for browser checks, and test the live link after every deploy. Restart the dev server after `npm run build`.
- Live screens use only data up to `SHIFT_HOUR`. Labels load only in the Review view. `track-record.json` and `key-numbers.json` hold totals only.
- Do not merge or deploy without asking.

## What is tied to the old Claude account

The technical note and video script are Claude docs on the old account:

- Technical note: https://claude.ai/artifact/C6ZLWVoBvBXrUqHehTkkdf
- Video script: https://claude.ai/artifact/XiuD4uqNd7rvBUTbqK9SYv

The committed copies in `docs/technical-note.md` and `docs/video-script.md` are the live versions from now on, together with this file. The deployment diagram was redrawn as a text block in the note. If the PDF is exported from the original Claude doc instead, check that its numbers match the committed copy.

Claude memory and any plugins or skills may also not carry over. GitHub, Vercel and ElevenLabs logins, and `.env.local`, stay on this laptop and do not depend on the Claude account.
