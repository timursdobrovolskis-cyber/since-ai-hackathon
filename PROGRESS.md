# Progress: detector

Branch `detector`, cut from `dashboard`. The team's own fault detector, built in phases. Scores come from the organizers'
scorer (`python detector/score_all.py <predictions.csv>`), always on train and validation together, because validation
has only 9 events. Data pack stays outside git (`RETROFIT_DATA_ROOT`, or next to the repo).

Run with the repo venv: `.venv/bin/python detector/run.py` writes everything (see Phase 3); `detector/score_all.py <csv> --confusion`
scores any file; `detector/causality_check.py` reruns the detector on truncated data.

## Results (composite 0-100)

| Predictions | Split | Composite | F1 | Recall | Precision | Type recall | Class recall | Timeliness | False+excess/day | Events | Caught |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 baseline (reproduced) | train | 58.2 | 0.72 | 0.69 | 0.75 | 0.27 | 0.54 | 0.58 | 0.12 | 26 | 18 |
| B1 baseline (reproduced) | validation | 78.0 | 0.89 | 0.89 | 0.89 | 0.44 | 0.89 | 0.86 | 0.07 | 9 | 8 |
| B1 baseline (reproduced) | both | 63.4 | 0.76 | 0.74 | 0.79 | 0.31 | 0.63 | 0.65 | 0.11 | 35 | 26 |
| Team v2: B1 times, our diagnosis | train | 70.4 | 0.73 | 0.73 | 0.73 | 0.62 | 0.73 | 0.64 | 0.14 | 26 | 19 |
| Team v2: B1 times, our diagnosis | validation | 93.0 | 0.95 | 1.00 | 0.90 | 0.89 | 0.89 | 0.95 | 0.07 | 9 | 9 |
| Team v2: B1 times, our diagnosis | both | 76.3 | 0.79 | 0.80 | 0.78 | 0.69 | 0.77 | 0.72 | 0.13 | 35 | 28 |
| Team v3: own alert times | train | 81.8 | 0.89 | 0.81 | 1.00 | 0.73 | 0.81 | 0.71 | 0.00 | 26 | 21 |
| Team v3: own alert times | validation | 91.8 | 0.94 | 0.89 | 1.00 | 0.89 | 0.89 | 0.89 | 0.00 | 9 | 8 |
| Team v3: own alert times | both | 84.4 | 0.91 | 0.83 | 1.00 | 0.77 | 0.83 | 0.75 | 0.00 | 35 | 29 |

Team v4 (final) = v3 alerts with calibrated confidence; the scorer ignores confidence, so the numbers are the same.
Full tables with confusion matrices: `detector/results/final_scores.md`. Notes, method and limitations: `detector/README.md`.

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

## Phase 3: our own alert times (done)

One command: `.venv/bin/python detector/run.py` (mode `own`) writes `detector/results/predictions_team_own.csv`,
`team_alerts.csv` and `predictions_test.csv`. `--mode b1times` still gives the Phase 2 file.

- `detector/detect.py`: a per-minute trigger (physics residual beyond 5 robust sd, NPSH margin below 1.3, vibration
  z above 4 on held wireless readings, temperatures beyond 5 sd once the pump has run 2 h, B1's regime z beyond 8 as
  a fallback, and the watchdog) that must hold 15 minutes of steady running. Nothing alerts in the 24 h learning
  window, so every alert uses only earlier data. Evaluated every 5 minutes while the trigger holds.
- Alert policy: one alert per case (a machine fault type, or one instrument whatever it does), a reminder after 12 h
  while it persists, at most three open cases per pump, alerts at least 15 min apart (no bursts), UNKNOWN only after
  3 h of unexplained deviation and never on top of an open case. Cavitation, air and communication loss re-arm when
  their evidence has been gone for 30 min, so the repeated cavitation episodes on PUMP-06 get their own alerts.
  Hydraulic diagnoses are suppressed for 12 h after a pressure transmitter is found bad, and for an hour after
  cavitation (residuals and the wireless acceleration need time to settle).
- The plant's suction level (operating_context.csv, cooling-tower and process pumps) enters the suction system curve
  at rho g per metre, so a basin-level drop is no longer read as a clogged strainer (PUMP-04, PUMP-09).
- Thresholds: k = 4/5/6 and persistence 10/15/20 min were swept on train; k = 5 and 15 min chosen (k = 4 adds false
  alerts on train, validation is flat). Validation was only looked at, not tuned on.
- Against Phase 2 (B1's times): train +11.4, validation -1.2, both +8.1. Precision is 1.00 on both splits (no false
  alerts, no excess repeats). The validation point lost is PUMP-09's tiny current drift, which B1 only "caught"
  with a winding-temperature alert 12.8 h into the window, inside its own learning period. Timeliness train 0.58 ->
  0.71: PUMP-02 bearing wear is now found at 36 h instead of 118 h, PUMP-04 bearing wear 86 h before its limit.
- Still missed: PUMP-03 and PUMP-05 impeller wear (legacy pumps, pre-existing wear is in the baseline), PUMP-06
  misalignment (vibration +1.6 sd only), PUMP-06 bearing-temperature drift and the 17-minute cavitation episode
  before the strainer cleaning, PUMP-09 current drift. Wrong type: PUMP-04 imbalance and restriction, both under
  extreme bearing vibration.
- `detector/causality_check.py`: reruns features and alerts on telemetry truncated at random cut points and compares
  the alerts before the cut with the full run (3 cuts per labelled pump).
- Test pumps: 28 alerts (PUMP-10: 8, PUMP-11: 6, PUMP-12: 14). Only counts were looked at.

## Phase 4: calibrated confidence, final files, notes (done)

- `detector/calibrate.py`: confidence(X) = (hits + 1) / (alerts + 2) over the TRAIN alerts that named X, hit = the alert
  fell inside a labelled event of type X. Fitted on train only, written to `detector/results/calibration.json`, applied
  to every pump. UNKNOWN is 0.5 and flagged as not calibrated. On validation the observed hit rate is at or above the
  stated confidence for every type (bearing 1.00 vs 0.95, misalignment 1.00 vs 0.43, restriction 1.00 vs 0.86,
  clog 1.00 vs 0.90, stuck 1.00 vs 0.86), so the numbers are conservative rather than flattering.
- `team_alerts.json`: the docs/spec.md section 8 format with ranked hypotheses (the named cause at its calibrated
  rate, alternatives sharing the rest in proportion to rule strength), `confidence_calibrated`, and the evidence
  sentence. `tools/build_ui_data.py --alerts team_alerts.json --name "Team detector v4"` rebuilt `public/data`.
- Final files: `team_alerts.csv` / `.json` (85 alerts, train + validation), `predictions_test.csv` (28 alerts,
  PUMP-10..12, official format, top cause only), `detector/results/predictions_team_v4.csv` (all pumps),
  `detector/results/final_scores.md`.
- Causality: `detector/causality_check.py --cuts 3` passes on all 9 labelled pumps (27 cuts).

## App mapping (done)

The detector now fills every field the case screen expects (docs/spec.md section 8): ranked hypotheses with calibrated
probabilities, `evidence.channels` (measured, expected, deviation for the signals the rule read), `evidence.sensor_check`
(whether related signals moved together or one instrument moved alone) and `what_would_settle_it` (what the operator can
check on the spot). The case page shows a "Why this alert" block with these, right above the operator's decision
(I'll check it / Remind me later / Not a problem, then "what did you find"), so every alarm is confirmed or dismissed
with the explanation in view. Checked in the browser on PUMP-08's strainer case at replay hour 90.

## Done = beats B1 on train + validation combined (84.4 vs 63.4), is causal, and the app runs with our alerts.
