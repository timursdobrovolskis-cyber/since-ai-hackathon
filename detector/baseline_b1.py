#!/usr/bin/env python3
"""Reproduce the organizers' B1 baseline (k=6, 15 min persistence, chosen on train) for all 12 pumps.

  python detector/baseline_b1.py        -> detector/results/predictions_B1_all.csv

B1's diagnosis iterates a Python set, so PYTHONHASHSEED is fixed to 0 for repeatable output (as tools/build_ui_data.py does).
The validation rows are checked against the shipped file baselines/results/predictions_B1_mode_aware_z_validation.csv.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

if os.environ.get("PYTHONHASHSEED") != "0":
    os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})

import pandas as pd  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from detector.common import RESULTS, ROOT, load_assets, load_features, write_predictions  # noqa: E402
from retrofit_sim import baselines as B  # noqa: E402

B1_PARAMS = {"k": 6.0, "persist": 15}


def b1_frame(feat: pd.DataFrame | None = None, assets: pd.DataFrame | None = None) -> pd.DataFrame:
    """B1's regime z-score frame for all pumps (also the input Phase 2 re-diagnoses)."""
    feat = load_features() if feat is None else feat
    assets = load_assets() if assets is None else assets
    return B.zscores(B.regime_frame(feat, assets))


def main() -> int:
    zf = b1_frame()
    pred = B.b1_threshold(zf, **B1_PARAMS)
    shipped = pd.read_csv(ROOT / "baselines" / "results" / "predictions_B1_mode_aware_z_validation.csv")
    ours = pred[pred.asset_id.isin(shipped.asset_id.unique())]
    same = list(ours.alert_time_utc) == list(shipped.alert_time_utc) and list(ours.fault_type) == list(shipped.fault_type)
    print(f"B1 alerts: {len(pred)}; validation matches shipped file: {same} ({len(ours)} vs {len(shipped)})")
    if not same:
        raise SystemExit("B1 rerun differs from the shipped validation file")
    out = RESULTS / "predictions_B1_all.csv"
    write_predictions(pred, out)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
