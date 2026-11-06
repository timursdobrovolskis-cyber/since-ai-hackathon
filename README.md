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

## How it works

- `tools/build_ui_data.py` turns the organizer data into small JSON files for the browser.
- The app replays each pump's week. All pumps are aligned to Day 1, because each pump's real 7-day window comes from a different month.
- Live screens only draw data up to the replay time. Labelled faults are kept in `public/data/review`, and only the Review view may load them.
- Repeat alerts merge into one case, and a person approves, rejects or keeps watching.
- The Review view scores alerts with the organizers' scorer, and the data build stops if their published baseline scores do not reproduce.
- The sensor comparison counts a fault as visible at a level when that level has a channel that carried the fault's earliest evidence. It comes from the labels, not a detector, because B1 cannot use wireless channels and its scoring credits unrelated alerts on long faults. Hardware totals come from the organizers' feasibility document, and the low-cost retrofit total is our own sum of its parts.
- The payback calculator ports the organizers' business case, and `npm test` checks it against their published figures. It defaults to results from all labelled pumps. Their worked example uses only the 2 validation pumps, which gives a shorter payback. Results are illustrative, not a realised or expected saving.
- The what-if panel shows pre-computed results from the organizers' sandbox, so it works offline. Its severity levels are our assumptions, not measurements, and it never touches a machine. An inspection is never shown as blocked, because it does not change the pump: a problem found there appears as a warning.

**Real and placeholder:** all pump data is synthetic. Alerts currently come from the organizers' B1 baseline, regenerated for training pumps, as a placeholder until the team's detector is connected. B1 confidence values are not calibrated, so the app does not show them as certainty.

See [docs/spec.md](docs/spec.md) for the full spec, including the alert format in section 8.

## Technology

| Component | Tool or library | Licence |
|---|---|---|
| Web app | Next.js, React | MIT |
| Styling | Tailwind CSS | MIT |
| Charts | uPlot | MIT |
| Typeface | Barlow, Barlow Semi Condensed | SIL Open Font License |
| Browser testing | Playwright CLI | Apache-2.0 |
| Data tools | pandas, NumPy, PyArrow, SciPy, scikit-learn, PyYAML | BSD-3, BSD-3, Apache-2.0, BSD-3, BSD-3, MIT |
| Simulator and baselines | `retrofit_sim` from the organizer pack | MIT |
| Data | RETROFIT AI 2026 synthetic pump benchmark, Since AI Hackathon 2026 | CC BY 4.0 |

## AI tools used

- Main AI tools: Claude Code
- Generative AI model or API used in the product: to be added with the AI explanation and voice features

## Pre-existing work

Anything that existed before the event, kept separate from what was built there.

- This README and repo scaffolding were prepared before the event from a blank template.
- The organizer data pack and its `retrofit_sim` code are supplied by the challenge and are not stored in this repo.

## Data

Fully synthetic, produced by the organizers' simulator. No measurements from any vessel, plant, company or person. Test-pump labels are held by the organizers. Not evidence of field performance.
