# Verify the detector yourself

Ten steps, each with the output you should see. Copy one command at a time into Terminal. Everything runs on your own
computer; nothing is sent anywhere. Expected run time is given where it is more than a few seconds.

## 0. What you need

- The repo checked out on the `detector` branch (or `dashboard` after the PR is merged).
- The organizer data pack `RETROFIT_AI_PARTICIPANTS_2026/` in the folder **next to** the repo folder. If it lives
  elsewhere, tell the scripts where: `export RETROFIT_DATA_ROOT=/path/to/RETROFIT_AI_PARTICIPANTS_2026`
- Python 3.10 to 3.13 and Node 20 or newer.

Open Terminal in the repo folder (`cd` into it). Every command below starts there.

## 1. One-time setup: Python environment

```bash
python3 -m venv .venv
```
```bash
.venv/bin/pip install -r ../RETROFIT_AI_PARTICIPANTS_2026/requirements.txt
```
Expected: a list of packages installing, ending without errors. Skip this if `.venv/` already exists.

## 2. Reproduce the organizers' baseline (proves the data and scorer are wired up)

```bash
.venv/bin/python detector/baseline_b1.py
```
Expected, last two lines:
```
B1 alerts: 87; validation matches shipped file: True (16 vs 16)
wrote .../detector/results/predictions_B1_all.csv
```
`True` means our rerun of the baseline is identical to the file the organizers shipped.

## 3. Run our detector (about 1 minute)

```bash
.venv/bin/python detector/run.py
```
Expected, last line:
```
113 alerts -> .../detector/results/predictions_team_own.csv, team_alerts.csv (85), predictions_test.csv (28)
```
This rewrites `team_alerts.csv`, `team_alerts.json` and `predictions_test.csv`. Run `git status`: if the files show
as unchanged, the run is identical to what is committed (it is deterministic).

## 4. Score it against the baseline, both splits in one table

```bash
.venv/bin/python detector/score_all.py detector/results/predictions_B1_all.csv team_alerts.csv
```
Expected (Composite is the official 0-100 score):

| Predictions | Split | Composite | F1 | Recall | Precision | Type recall | Class recall | Timeliness | False+excess/day |
|---|---|---|---|---|---|---|---|---|---|
| B1_all | train | 58.2 | 0.72 | 0.69 | 0.75 | 0.27 | 0.54 | 0.58 | 0.12 |
| B1_all | validation | 78.0 | 0.89 | 0.89 | 0.89 | 0.44 | 0.89 | 0.86 | 0.07 |
| team_alerts | train | 81.8 | 0.89 | 0.81 | 1.00 | 0.73 | 0.81 | 0.71 | 0.00 |
| team_alerts | validation | 91.8 | 0.94 | 0.89 | 1.00 | 0.89 | 0.89 | 0.89 | 0.00 |

Add `--confusion` to also see, event by event, what really happened and what we named.

## 5. Same result from the organizers' own scorer, no code of ours involved

```bash
PYTHONPATH=../RETROFIT_AI_PARTICIPANTS_2026/src .venv/bin/python -m retrofit_sim score --predictions team_alerts.csv --events ../RETROFIT_AI_PARTICIPANTS_2026/data/full/events_validation.csv --assets ../RETROFIT_AI_PARTICIPANTS_2026/data/full/assets.csv --benign ../RETROFIT_AI_PARTICIPANTS_2026/data/full/benign_windows_train_validation.csv --split validation
```
Expected, last line: `COMPOSITE = 91.8 / 100`. Swap `events_validation.csv` and `validation` for `events_train.csv`
and `train` to get `COMPOSITE = 81.8 / 100`. The published baseline numbers are 78.0 and 58.2 (BENCHMARK_RULES.md).

## 6. Check it never looks into the future (about 5 minutes)

```bash
.venv/bin/python detector/causality_check.py
```
Expected: one `OK` line per pump and cut (27 lines), then `causality check: PASSED`. The script cuts each pump's data
at three random times, reruns everything on the shortened data, and checks that the alerts before the cut are
identical. This is the test the organizers say they may run on finalists.

## 7. Look at the submission file

```bash
head -5 predictions_test.csv
```
Expected: a header `asset_id,alert_time_utc,event_class,fault_type,confidence,evidence,recommended_action` and rows
for PUMP-10, PUMP-11, PUMP-12 only. `wc -l predictions_test.csv` gives 29 (28 alerts plus the header). This is the
file to upload. Do not edit it by hand.

## 8. Read an alert like an operator would

Open `team_alerts.csv` in Numbers or Excel. Each row is one alert. Read the `evidence` column, for example:
"Suction pressure 9.1 kPa below normal for 294 m3/h (z=-6.7); head still on the pump curve; speed z=+0.1, power
z=+0.2; NPSH margin 11.2." and the `recommended_action`: "Inspect and clean the suction strainer at the next
opportunity." The `confidence` is how often that kind of call was right on the training pumps.

## 9. See it in the app (about 2 minutes the first time)

```bash
.venv/bin/python tools/build_ui_data.py --alerts team_alerts.json --name "Team detector v4"
```
Expected, among the output: `current train: composite 81.8`, `current validation: composite 91.8`, and
`baseline validation: composite 78.0 (published 78.0)`. Then:
```bash
npm ci
```
```bash
npm run dev
```
Open http://localhost:3000. The alerts shown are ours; the Review view compares them with the plant alarms and with
what really happened on the labelled pumps.

## 10. Run the app's own checks

```bash
npm test
```
Expected: `pass 31`, `fail 0`.
```bash
npm run build
```
Expected: a route list ending without errors.

## If something differs

- Step 2 says `False`: the data pack is a different version than ours, or `RETROFIT_DATA_ROOT` points elsewhere.
- Step 3 shows changed files in `git status`: the pack or the Python package versions differ; the scores in step 4 are
  what matter.
- A step cannot find `retrofit_sim` or `pandas`: step 1 was skipped or a different Python is being used; always call
  `.venv/bin/python`, not `python`.
