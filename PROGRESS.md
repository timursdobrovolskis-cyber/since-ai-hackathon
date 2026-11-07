# Progress: detector

Branch `detector`, cut from `dashboard`. The team's own fault detector, built in phases. Scores come from the organizers'
scorer (`python detector/score_all.py <predictions.csv>`), always on train and validation together, because validation
has only 9 events. Data pack stays outside git (`RETROFIT_DATA_ROOT`, or next to the repo).

Run with the repo venv: `.venv/bin/python detector/baseline_b1.py` and `.venv/bin/python detector/score_all.py ... --confusion`.

## Results (composite 0-100)

| Predictions | Split | Composite | F1 | Recall | Precision | Type recall | Class recall | Timeliness | False+excess/day | Events | Caught |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 baseline (reproduced) | train | 58.2 | 0.72 | 0.69 | 0.75 | 0.27 | 0.54 | 0.58 | 0.12 | 26 | 18 |
| B1 baseline (reproduced) | validation | 78.0 | 0.89 | 0.89 | 0.89 | 0.44 | 0.89 | 0.86 | 0.07 | 9 | 8 |
| B1 baseline (reproduced) | both | 63.4 | 0.76 | 0.74 | 0.79 | 0.31 | 0.63 | 0.65 | 0.11 | 35 | 26 |

## Phase 1: reproduce B1 (done)

- `detector/baseline_b1.py` reruns B1 with the organizers' chosen settings (k=6, 15 min) for all 12 pumps and checks the
  validation rows against the shipped file. Matches: 58.2 train, 78.0 validation, as published.
- `detector/score_all.py` scores any prediction CSV on train, validation and both, with a confusion table and per-event
  rows (`--confusion`, `--md`). Full B1 output: `detector/results/b1_scores.md`.
- Where B1 loses points (train + validation, 35 scored events, 26 caught):
  - Naming: only 11 of 26 caught events get the right type. SENSOR_CALIBRATION_SHIFT is named 8 times and right once
    (it is B1's default for "one channel deviates alone"). DISCHARGE_RESTRICTION is named 6 times, right 2.
  - Missed: all 4 PUMP-06 cavitation episodes (wireless vibration never persists 15 minutes in a row), PUMP-05 impeller
    wear, PUMP-04 restriction, PUMP-06 bearing-temperature drift, and 3 sensor faults (stuck, spikes).
  - Late: PUMP-02 bearing wear found after 118 h, PUMP-03 impeller wear after 102 h, PUMP-06 misalignment after 91 h.
  - Class: sensor-vs-machine is wrong on 7 of 26 caught events.

## Next

- Phase 2: physics residuals and sensor watchdog; keep B1's alert times, change only the diagnosis.
- Phase 3: earlier detection, fewer false alerts. Phase 4: calibrated confidence, final files, notes.
