# Retrofit Assist

Early, explainable warnings for existing cooling-water pumps, with a human deciding every action.

**Challenge:** Business Turku, RETROFIT AI: Make Existing Machines Intelligent (Since AI Hackathon 2026)

## The problem and who it helps

Old pumps on ships and in plants often give no warning until a fixed alarm limit is crossed, which can be too late to plan a repair. This app helps the duty engineer see a developing problem, understand the evidence, and decide what to check. It is advice only and has no way to control a machine.

**Live demo:** https://since-ai-hackathon.vercel.app

## Run it

Needs Node and [uv](https://docs.astral.sh/uv/). Keep the organizer data pack `RETROFIT_AI_PARTICIPANTS_2026` next to this repo, or set `RETROFIT_DATA_ROOT`.

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000. The generated data in `public/data` is committed, so the steps below are only needed to rebuild it.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python numpy pandas pyarrow scipy scikit-learn pyyaml
.venv/bin/python tools/build_ui_data.py
.venv/bin/python tools/build_what_if.py
.venv/bin/python tools/build_sensor_compare.py
```

Restart `npm run dev` after running `npm run build`. Building next to a running dev server can leave it serving old pages.

## Swap in new alerts

The app shows the organizers' B1 baseline until you give it a detector's alerts. Use the official prediction CSV, or JSON in the format in section 8 of `docs/spec.md`, which also carries ranked causes and calibrated confidence.

```bash
.venv/bin/python tools/build_ui_data.py --alerts team_alerts.csv --name "Team detector v3"
.venv/bin/python tools/build_what_if.py
```

Cases, lead times, the Review view and payback all update with no code change. Stored AI explanations belong to one detector, so they stay hidden until you run `npm run explain` again, which spends a small amount of paid credit. A bad file stops with a clear reason and leaves the app's data as it was.

## How it works

- `tools/build_ui_data.py` turns the organizer data into small JSON files for the browser.
- The app shows one fixed evening shift from the test week, set by `SHIFT_HOUR` in `lib/labels.ts`. All pumps are aligned to start together, because each pump's real 7-day window comes from a different month. After a detector swap, check that this shift still tells the story, then rerun `npm run handover`.
- Live screens only draw data up to that shift. Labelled faults are kept in `public/data/review`, and only the Review view may load them.
- Repeat alerts merge into one case, and a person approves, rejects or keeps watching.
- Workers start on Today: a short list in plain words, grouped into Needs you today, Check the reading and Can wait. The wording is hand-written per fault type in `lib/plain.ts`, and the list rule in `lib/today.ts` means newest first, not true urgency.
- The week overview shows only live pump data up to that shift: open cases, pumps flagged, cases per day and recent activity. `npm test` checks that it holds nothing from the future.
- The Review view scores alerts with the organizers' scorer, and the data build stops if their published baseline scores do not reproduce.
- The sensor comparison counts a fault as visible at a level when that level has a channel that carried the fault's earliest evidence. It comes from the labels, not a detector, because B1 cannot use wireless channels and its scoring credits unrelated alerts on long faults. Hardware totals come from the organizers' feasibility document, and the low-cost retrofit total is our own sum of its parts.
- The payback calculator ports the organizers' business case, and `npm test` checks it against their published figures. It defaults to results from all labelled pumps. Their worked example uses only the 2 validation pumps, which gives a shorter payback. Results are illustrative, not a realised or expected saving.
- Each line on Today shows how often that cause was right before. `tools/build_ui_data.py` works this out from all 9 labelled pumps and stores only totals in `track-record.json`, so the live screens never see a label. Those totals include the alerts the app shows, so they stand in for a real site history, which would come from recorded findings. Weak causes stop saying the pump may be fine.
- Job card steps and time estimates are hand-written from the organizers' sandbox assumptions, not site figures, and still need an engineer's review. The next chance to stop reads ahead in the operating context, which stands in for a published timetable.
- Corrective work done after the latest alert moves a pump to Can wait and says what was done. Routine work does not, and a new alert brings the pump back.
- The main page holds what the shift needs and three key results from `key-numbers.json`, which holds totals only, so it loads nothing labelled. Everything else is one click away.
- The spoken shift handover is recorded in advance with `npm run handover`, using a stock ElevenLabs voice, and stored in `public/audio`. It uses the same rules as the Today list, and only what was known at that shift.
- Ask about this pump uses an ElevenLabs Agent. It only receives that pump's facts up to that shift, never labels, and it only starts through `app/api/voice`, which checks an access code and keeps the key on the server. Conversations are capped at 90 seconds, 40 a day and 2 at a time. `npm run voice-agent` creates or updates it. It needs `ELEVENLABS_API_KEY` and `VOICE_ACCESS_CODE`, and internet.
- AI explanations are generated in advance by `npm run explain` and stored, so the app needs no key and works offline. The model sees one alert and its pump sheet, never labels or later data, and any text containing a number that is not in its input is rejected.
- The what-if panel shows pre-computed results from the organizers' sandbox, so it works offline. Its severity levels are our assumptions, not measurements, and it never touches a machine. An inspection is never shown as blocked, because it does not change the pump: a problem found there appears as a warning.

**Real and placeholder:** all pump data is synthetic. Alerts currently come from the organizers' B1 baseline, regenerated for training pumps, as a placeholder until the team's detector is connected. B1 confidence values are not calibrated, so the app does not show them as certainty.

See [docs/spec.md](docs/spec.md) for the full spec, including the alert format in section 8.

## Technology

| Component | Tool or library | Licence |
|---|---|---|
| Web app | Next.js, React | MIT |
| Styling | Tailwind CSS | MIT |
| Charts | uPlot | MIT |
| Isometric case board | react-isokit | MIT |
| 3D pump on the landing page | three.js | MIT |
| Pump model on the landing page | `pump.obj`, downloaded by the team, stored only as line work in `public/models/pump-edges.bin` | **Source and licence to confirm** |
| Icons | Lucide | ISC |
| Typeface | Barlow, Barlow Semi Condensed | SIL Open Font License |
| Landing page typefaces | Geist, JetBrains Mono | SIL Open Font License |
| AI explanations | Anthropic SDK, Claude Opus 5.5 | Apache-2.0 for the SDK |
| Voice | ElevenLabs SDK and client | MIT |
| Browser testing | Playwright CLI | Apache-2.0 |
| Data tools | pandas, NumPy, PyArrow, SciPy, scikit-learn, PyYAML | BSD-3, BSD-3, Apache-2.0, BSD-3, BSD-3, MIT |
| Simulator and baselines | `retrofit_sim` from the organizer pack | MIT |
| Data | RETROFIT AI 2026 synthetic pump benchmark, Since AI Hackathon 2026 | CC BY 4.0 |

## AI tools used

- Main AI tools: Claude Code
- Generative AI model or API used in the product: ElevenLabs for speech, and Claude Opus 5.5 through the Anthropic API for stored alert explanations

## Pre-existing work

Anything that existed before the event, kept separate from what was built there.

- This README and repo scaffolding were prepared before the event from a blank template.
- The organizer data pack and its `retrofit_sim` code are supplied by the challenge and are not stored in this repo.

## Data

Fully synthetic, produced by the organizers' simulator. No measurements from any vessel, plant, company or person. Test-pump labels are held by the organizers. Not evidence of field performance.
