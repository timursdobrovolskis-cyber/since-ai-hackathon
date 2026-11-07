# Team detector: notes

Advice-only fault detector for old cooling-water pumps, built on the organizers' synthetic RETROFIT AI data. It reads
the 1-minute features, the static pump data sheet (`assets.csv`) and the plant's suction level, and raises alerts with
a named cause, a calibrated confidence, readable evidence and a recommended check. It never controls anything.

## Run

Step-by-step verification with expected outputs: `detector/VERIFY.md`.

```bash
.venv/bin/python detector/run.py                       # all 12 pumps -> team_alerts.csv/.json, predictions_test.csv
.venv/bin/python detector/score_all.py team_alerts.csv --confusion   # official scorer, train + validation, one table
.venv/bin/python detector/causality_check.py           # rerun on truncated telemetry, alerts before the cut must match
.venv/bin/python detector/run.py --mode b1times        # Phase 2 variant: B1's alert times, our diagnosis
```

The organizer pack is not in git: set `RETROFIT_DATA_ROOT` or keep `RETROFIT_AI_PARTICIPANTS_2026/` next to the repo.
`PYTHONHASHSEED` is fixed to 0 by the scripts, so runs are repeatable.

## How it works

1. **Physics residuals** (`physics.py`, `features.py`). The data-sheet curve with the affinity laws gives the expected
   head, power and current at the current speed. Flow is estimated three ways (meter, from head, from power or
   current) and every channel is predicted from the *other* instruments, so a residual points at one channel. Each
   pressure is also checked against its own system curve (pressure versus flow squared, fitted on the first 24 h, with
   the suction level at rho g per metre). The NPSH margin comes from suction pressure, liquid temperature and flow.
2. **Sensor watchdog.** Frozen readings (run of identical values longer than twice the longest run seen while
   learning), noisy minutes (within-minute range 3x normal), a single instrument off its physics prediction while the
   others agree, split into a one-jump calibration step or a creeping drift, and missing rows (communication loss).
3. **Diagnosis** (`diagnose.py`): a dozen readable rules. Clog = suction below its system curve while the pump stays
   on its curve. Cavitation = NPSH margin below 1.3 with high acceleration or head loss. Restriction = discharge above
   its system curve with power or current down. Head below the curve with a fine margin = air if it appeared within
   8 h, impeller wear if slower. Acceleration or crest factor up = bearing. Velocity up without acceleration =
   misalignment if the rise began within 36 h after a locked-out restart, else imbalance. UNKNOWN when nothing fits.
4. **Alerting** (`detect.py`): trigger held 15 min of steady running, silent in the 24 h learning window, one alert
   per case with a 12 h reminder, episodes (cavitation, air, comm loss) re-arm when their evidence clears, UNKNOWN only
   after 3 h and never on top of an open case.
5. **Confidence** (`calibrate.py`): how often an alert naming fault X on the training pumps fell inside a labelled
   event of type X (Laplace-smoothed). Checked, not fitted, on validation.

## Results (official scorer)

| Predictions | Split | Composite | F1 | Type recall | Class recall | Timeliness | False+excess/day |
|---|---|---|---|---|---|---|---|
| B1 baseline | train | 58.2 | 0.72 | 0.27 | 0.54 | 0.58 | 0.12 |
| B1 baseline | validation | 78.0 | 0.89 | 0.44 | 0.89 | 0.86 | 0.07 |
| Team detector | train | 81.8 | 0.89 | 0.73 | 0.81 | 0.71 | 0.00 |
| Team detector | validation | 91.8 | 0.94 | 0.89 | 0.89 | 0.89 | 0.00 |

Validation has 9 events, so a few points there is noise; read train and validation together.

## What worked

- Naming the cause from physics instead of from which z-score is largest: type recall 0.27 -> 0.73 (train).
- The system-curve view of each pressure. It separates a clog (suction down, pump on its curve), a restriction
  (discharge up at the same flow) and a bad transmitter (one pressure off while flow and power are normal).
- Counting wireless persistence on held readings: all PUMP-06 cavitation episodes before the strainer cleaning are
  caught within 20 minutes; B1 missed every one.
- Maintenance context from the telemetry itself: all three misalignments follow a locked-out restart.
- A strict alert policy: zero false alerts and zero excess repeats on train and validation.

## What did not work, honest limitations

- Pre-existing impeller wear on legacy pumps (discharge pressure and current only) is absorbed into the learning
  baseline and never found. An absolute check against the data sheet would need a flow estimate those pumps lack.
- Faults under extreme vibration from another fault (PUMP-04: imbalance and a restriction during late bearing wear)
  get the wrong name. Imbalance and misalignment are not separated by speed dependence yet.
- Small drifts (a current transducer creeping a few tenths of an amp) are below the 5-sd trigger. Lowering it
  adds false alerts on train.
- The first 24 h of each pump are silent by design (learning). A fault present from the start is found later than
  B1 found it, but B1's early alerts there used future data.
- The suction level is used only where the plant measures it (cooling-tower and process pumps). On ships a basin
  level drop does not exist, but heavy weather does, and it is not modelled.
- Confidence is calibrated on 63 training alerts, so rare types (air, comm loss, spikes) carry 0.67 from one hit.
- Everything is tuned on one synthetic simulator. Results show the method works on a physically coherent benchmark,
  not field performance.
