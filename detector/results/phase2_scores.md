| Predictions | Split | Composite | F1 | Recall | Precision | Type recall | Class recall | Timeliness | False+excess/day | Events | Caught |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B1_all | train | 58.2 | 0.72 | 0.69 | 0.75 | 0.27 | 0.54 | 0.58 | 0.12 | 26 | 18 |
| B1_all | validation | 78.0 | 0.89 | 0.89 | 0.89 | 0.44 | 0.89 | 0.86 | 0.07 | 9 | 8 |
| B1_all | both | 63.4 | 0.76 | 0.74 | 0.79 | 0.31 | 0.63 | 0.65 | 0.11 | 35 | 26 |
| team_b1times | train | 70.4 | 0.73 | 0.73 | 0.73 | 0.62 | 0.73 | 0.64 | 0.14 | 26 | 19 |
| team_b1times | validation | 93.0 | 0.95 | 1.00 | 0.90 | 0.89 | 0.89 | 0.95 | 0.07 | 9 | 9 |
| team_b1times | both | 76.3 | 0.79 | 0.80 | 0.78 | 0.69 | 0.77 | 0.72 | 0.13 | 35 | 28 |

### B1_all: true fault type vs named type (train + validation)

| true \ named | BEARING | CLOG | RESTRICT | IMBAL | S_STUCK | S_CALIB | COMM | UNKNOWN | MISSED |
|---|---|---|---|---|---|---|---|---|---|
| BEARING | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 1 | 0 |
| CLOG | 0 | 3 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| CAVIT | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| RESTRICT | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 1 |
| MISALIGN | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 0 |
| IMBAL | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| IMPELLER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| AIR | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| S_DRIFT | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 1 |
| S_STUCK | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 1 |
| S_CALIB | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| S_SPIKE | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| COMM | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |

### B1_all: per event

| event_id | fault_type | named | ok | timeliness | delay_h | lead_h | repeats |
|---|---|---|---|---|---|---|---|
| PUMP-01-E01 | SUCTION_STRAINER_CLOGGING | SENSOR_CALIBRATION_SHIFT |  | 0.56 | +21.0 | - | 1 |
| PUMP-01-E03 | COMMUNICATION_LOSS | COMMUNICATION_LOSS | yes | 1.00 | +0.2 | - | 0 |
| PUMP-01-E02 | SUCTION_STRAINER_CLOGGING | SUCTION_STRAINER_CLOGGING | yes | 0.83 | +12.8 | - | 1 |
| PUMP-01-E04 | SENSOR_STUCK | MISSED |  | 0.00 | - | - | 0 |
| PUMP-02-E01 | BEARING_WEAR | BEARING_WEAR | yes | 0.12 | +118.1 | - | 0 |
| PUMP-02-E03 | SENSOR_DRIFT | SENSOR_CALIBRATION_SHIFT |  | 0.79 | +23.7 | - | 3 |
| PUMP-02-E02 | MISALIGNMENT | UNKNOWN |  | 1.00 | +4.9 | - | 0 |
| PUMP-03-E03 | IMPELLER_WEAR | UNKNOWN |  | 0.41 | +102.3 | - | 0 |
| PUMP-03-E01 | DISCHARGE_RESTRICTION | DISCHARGE_RESTRICTION | yes | 1.00 | +0.3 | -0.2 | 2 |
| PUMP-03-E02 | SENSOR_CALIBRATION_SHIFT | SENSOR_CALIBRATION_SHIFT | yes | 0.85 | +12.2 | - | 1 |
| PUMP-04-E02 | BEARING_WEAR | DISCHARGE_RESTRICTION |  | 1.00 | +0.6 | +119.6 | 4 |
| PUMP-04-E01 | IMBALANCE | DISCHARGE_RESTRICTION |  | 1.00 | -1.5 | +97.7 | 4 |
| PUMP-04-E03 | SENSOR_NOISE_SPIKES | SENSOR_CALIBRATION_SHIFT |  | 1.00 | +0.8 | - | 0 |
| PUMP-04-E04 | DISCHARGE_RESTRICTION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-05-E01 | IMPELLER_WEAR | MISSED |  | 0.00 | - | - | 0 |
| PUMP-05-E02 | SENSOR_STUCK | SENSOR_STUCK | yes | 1.00 | +0.1 | - | 0 |
| PUMP-06-E02 | MISALIGNMENT | SENSOR_CALIBRATION_SHIFT |  | 0.45 | +91.2 | - | 0 |
| PUMP-06-E03 | SUCTION_STRAINER_CLOGGING | SUCTION_STRAINER_CLOGGING | yes | 1.00 | +17.5 | +13.9 | 2 |
| PUMP-06-E05 | CAVITATION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E06 | CAVITATION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E07 | CAVITATION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E08 | CAVITATION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E04 | SENSOR_DRIFT | MISSED |  | 0.00 | - | - | 0 |
| PUMP-07-E01 | BEARING_WEAR | SENSOR_CALIBRATION_SHIFT |  | 1.00 | +5.8 | - | 1 |
| PUMP-07-E02 | SENSOR_CALIBRATION_SHIFT | DISCHARGE_RESTRICTION |  | 1.00 | +0.2 | - | 4 |
| PUMP-07-E03 | AIR_ENTRAINMENT | DISCHARGE_RESTRICTION |  | 1.00 | +0.8 | - | 0 |
| PUMP-08-E02 | BEARING_WEAR | UNKNOWN |  | 0.77 | +28.9 | - | 2 |
| PUMP-08-E01 | SUCTION_STRAINER_CLOGGING | SUCTION_STRAINER_CLOGGING | yes | 1.00 | +20.8 | +16.3 | 1 |
| PUMP-08-E03 | COMMUNICATION_LOSS | COMMUNICATION_LOSS | yes | 1.00 | +0.3 | - | 0 |
| PUMP-08-E04 | SENSOR_NOISE_SPIKES | MISSED |  | 0.00 | - | - | 0 |
| PUMP-09-E04 | SENSOR_DRIFT | SENSOR_CALIBRATION_SHIFT |  | 1.00 | +3.4 | - | 1 |
| PUMP-09-E01 | MISALIGNMENT | IMBALANCE |  | 1.00 | +0.4 | - | 2 |
| PUMP-09-E03 | SENSOR_STUCK | SENSOR_STUCK | yes | 1.00 | +1.9 | - | 0 |
| PUMP-09-E02 | DISCHARGE_RESTRICTION | DISCHARGE_RESTRICTION | yes | 1.00 | +0.4 | +0.3 | 1 |
| PUMP-09-E06 | AIR_ENTRAINMENT | SUCTION_STRAINER_CLOGGING |  | 1.00 | +5.9 | - | 0 |

### team_b1times: true fault type vs named type (train + validation)

| true \ named | BEARING | CLOG | CAVIT | RESTRICT | MISALIGN | AIR | S_DRIFT | S_STUCK | S_CALIB | S_SPIKE | COMM | UNKNOWN | MISSED |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BEARING | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| CLOG | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| CAVIT | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| RESTRICT | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MISALIGN | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| IMBAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| IMPELLER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| AIR | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| S_DRIFT | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 1 |
| S_STUCK | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| S_CALIB | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| S_SPIKE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| COMM | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |

### team_b1times: per event

| event_id | fault_type | named | ok | timeliness | delay_h | lead_h | repeats |
|---|---|---|---|---|---|---|---|
| PUMP-01-E01 | SUCTION_STRAINER_CLOGGING | SUCTION_STRAINER_CLOGGING | yes | 0.56 | +21.0 | - | 1 |
| PUMP-01-E03 | COMMUNICATION_LOSS | COMMUNICATION_LOSS | yes | 1.00 | +0.2 | - | 0 |
| PUMP-01-E02 | SUCTION_STRAINER_CLOGGING | SUCTION_STRAINER_CLOGGING | yes | 0.83 | +12.8 | - | 0 |
| PUMP-01-E04 | SENSOR_STUCK | SENSOR_STUCK | yes | 0.69 | +12.0 | - | 0 |
| PUMP-02-E01 | BEARING_WEAR | BEARING_WEAR | yes | 0.62 | +54.5 | - | 2 |
| PUMP-02-E03 | SENSOR_DRIFT | SENSOR_DRIFT | yes | 0.79 | +23.7 | - | 1 |
| PUMP-02-E02 | MISALIGNMENT | MISALIGNMENT | yes | 1.00 | +4.9 | - | 0 |
| PUMP-03-E03 | IMPELLER_WEAR | MISSED |  | 0.00 | - | - | 0 |
| PUMP-03-E01 | DISCHARGE_RESTRICTION | DISCHARGE_RESTRICTION | yes | 1.00 | +0.3 | -0.2 | 2 |
| PUMP-03-E02 | SENSOR_CALIBRATION_SHIFT | SENSOR_CALIBRATION_SHIFT | yes | 1.00 | +0.2 | - | 2 |
| PUMP-04-E02 | BEARING_WEAR | UNKNOWN |  | 1.00 | +0.6 | +119.6 | 6 |
| PUMP-04-E01 | IMBALANCE | UNKNOWN |  | 1.00 | -1.5 | +97.7 | 1 |
| PUMP-04-E03 | SENSOR_NOISE_SPIKES | SENSOR_NOISE_SPIKES | yes | 1.00 | +0.8 | - | 0 |
| PUMP-04-E04 | DISCHARGE_RESTRICTION | MISALIGNMENT |  | 0.39 | +25.7 | -22.7 | 0 |
| PUMP-05-E01 | IMPELLER_WEAR | MISSED |  | 0.00 | - | - | 0 |
| PUMP-05-E02 | SENSOR_STUCK | SENSOR_STUCK | yes | 1.00 | +0.1 | - | 0 |
| PUMP-06-E02 | MISALIGNMENT | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E03 | SUCTION_STRAINER_CLOGGING | SUCTION_STRAINER_CLOGGING | yes | 1.00 | +17.5 | +13.9 | 2 |
| PUMP-06-E05 | CAVITATION | CAVITATION | yes | 0.87 | +0.2 | -0.2 | 0 |
| PUMP-06-E06 | CAVITATION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E07 | CAVITATION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E08 | CAVITATION | MISSED |  | 0.00 | - | - | 0 |
| PUMP-06-E04 | SENSOR_DRIFT | MISSED |  | 0.00 | - | - | 0 |
| PUMP-07-E01 | BEARING_WEAR | BEARING_WEAR | yes | 1.00 | +5.8 | - | 1 |
| PUMP-07-E02 | SENSOR_CALIBRATION_SHIFT | SENSOR_CALIBRATION_SHIFT | yes | 1.00 | +0.2 | - | 4 |
| PUMP-07-E03 | AIR_ENTRAINMENT | AIR_ENTRAINMENT | yes | 1.00 | +0.8 | - | 0 |
| PUMP-08-E02 | BEARING_WEAR | BEARING_WEAR | yes | 0.96 | +9.6 | - | 2 |
| PUMP-08-E01 | SUCTION_STRAINER_CLOGGING | SUCTION_STRAINER_CLOGGING | yes | 1.00 | +20.8 | +16.3 | 0 |
| PUMP-08-E03 | COMMUNICATION_LOSS | COMMUNICATION_LOSS | yes | 1.00 | +0.3 | - | 0 |
| PUMP-08-E04 | SENSOR_NOISE_SPIKES | SENSOR_NOISE_SPIKES | yes | 0.62 | +7.8 | - | 0 |
| PUMP-09-E04 | SENSOR_DRIFT | UNKNOWN |  | 1.00 | +3.4 | - | 0 |
| PUMP-09-E01 | MISALIGNMENT | MISALIGNMENT | yes | 1.00 | +0.4 | - | 3 |
| PUMP-09-E03 | SENSOR_STUCK | SENSOR_STUCK | yes | 1.00 | +1.9 | - | 0 |
| PUMP-09-E02 | DISCHARGE_RESTRICTION | DISCHARGE_RESTRICTION | yes | 1.00 | +0.4 | +0.3 | 1 |
| PUMP-09-E06 | AIR_ENTRAINMENT | AIR_ENTRAINMENT | yes | 1.00 | +5.9 | - | 0 |
