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
| Team v2: B1 times, our diagnosis | train | 70.4 | 0.73 | 0.73 | 0.73 | 0.62 | 0.73 | 0.64 | 0.14 | 26 | 19 |
| Team v2: B1 times, our diagnosis | validation | 93.0 | 0.95 | 1.00 | 0.90 | 0.89 | 0.89 | 0.95 | 0.07 | 9 | 9 |
| Team v2: B1 times, our diagnosis | both | 76.3 | 0.79 | 0.80 | 0.78 | 0.69 | 0.77 | 0.72 | 0.13 | 35 | 28 |

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

## Phase 2: physics residuals and sensor watchdog (done)

One command: `.venv/bin/python detector/run.py --mode b1times` writes `detector/results/predictions_team_b1times.csv`
(all pumps), `team_alerts.csv` (train + validation, for the app) and `predictions_test.csv` (PUMP-10..12). The app's
`tools/build_ui_data.py --alerts team_alerts.csv --name "Team detector v2"` accepts the file and reports the same scores.

- `detector/physics.py`: the datasheet pump curve with affinity laws, motor and drive model, NPSH margin. Flow is
  estimated three ways: meter, from head (discharge minus suction), from power or current.
- `detector/features.py`: per-minute residuals. Each channel is predicted from the other instruments (physics z,
  `pz_*`), each pressure is also checked against its own system curve (`pz_sys_ps`, `pz_sys_pd`, fitted on the first
  24 h), plus the NPSH margin, stuck runs, within-minute noise ratio, time since the channel left normal, and the
  largest 10-min jump (step vs drift). Sparse wireless readings are held until the next one is due.
- `detector/diagnose.py`: readable rules. Clog = suction below its system curve while the head stays on the pump
  curve. Cavitation = NPSH margin below 1.3 with acceleration or head loss. Restriction = discharge above its system
  curve with power or current down. Head below the curve with a fine NPSH margin = air if it appeared within 8 h,
  impeller wear if slower. Acceleration or crest factor up = bearing. Velocity up without acceleration = misalignment
  if the rise began within 36 h after a locked-out restart, else imbalance. A single instrument off its physics
  prediction while the others agree = sensor fault; one jump = calibration shift, creeping = drift; frozen = stuck;
  noisy minutes = spikes; missing rows = communication loss. Nothing clear = UNKNOWN.
- Alert times are still B1's. Only the diagnosis changed, and it lifted type recall from 0.27 to 0.62 on train and
  0.44 to 0.89 on validation. Class (machine vs sensor) recall went from 0.54 to 0.73 and 0.89 to 0.89.
- Still wrong or missed (train): PUMP-04's three alerts in the first 24 h (B1's non-causal learning-period alerts)
  decide the bearing and imbalance events before any evidence exists; PUMP-04's restriction during extreme vibration;
  PUMP-03 and PUMP-05 impeller wear on legacy pumps (pre-existing wear is absorbed into the baseline); PUMP-06's
  three later cavitation episodes, its misalignment and bearing-temperature drift (B1 never alerted, wireless
  persistence); PUMP-09's current drift is first "caught" by a winding-temperature false alert after a restart.
- Confidence is a placeholder from rule strength, not calibrated yet (Phase 4).

## Next

- Phase 3: our own alert times from the residuals (persistence counted in readings for wireless sensors, silence in
  the 24 h learning window, merge bursts, one reminder per 12 h), fewer false alerts (temperature transients after
  restarts, benign load changes).
- Phase 4: calibrated confidence, final files, notes.
