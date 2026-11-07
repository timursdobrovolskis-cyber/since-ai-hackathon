#!/usr/bin/env python3
"""Run the team detector and write predictions for train, validation and test.

  python detector/run.py --mode b1times      Phase 2: keep B1's alert times, replace the diagnosis
  python detector/run.py --mode own          Phase 3+: our own detection from the residuals (default)

Writes detector/results/predictions_team_<mode>.csv (all pumps), team_alerts.csv (train + validation, for the app) and
predictions_test.csv (PUMP-10..12, for the submission).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

if os.environ.get("PYTHONHASHSEED") != "0":
    os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})

import pandas as pd  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from detector.baseline_b1 import B1_PARAMS, b1_frame  # noqa: E402
from detector.common import COLS, REPO, RESULTS, load_assets, load_features, write_predictions  # noqa: E402
from detector.detect import detect  # noqa: E402
from detector.diagnose import diagnose, state_at  # noqa: E402
from detector.features import physics_frame  # noqa: E402
from retrofit_sim import baselines as B  # noqa: E402

VERSION = "Team detector v3"


def build_frames(assets: pd.DataFrame, feat: pd.DataFrame) -> dict[str, pd.DataFrame]:
    zf = b1_frame(feat, assets)
    return {a["asset_id"]: physics_frame(zf[zf["asset_id"] == a["asset_id"]], a) for _, a in assets.iterrows()}


def rediagnose(times: pd.DataFrame, frames: dict, assets: pd.DataFrame) -> pd.DataFrame:
    """Re-diagnose alerts at the given (asset_id, alert_time_utc) using only data up to each time."""
    rows = []
    for aid, grp in times.groupby("asset_id", sort=True):
        a = assets[assets["asset_id"] == aid].iloc[0]
        g = frames[aid]
        recent: dict[str, pd.Timestamp] = {}
        for t in sorted(pd.to_datetime(grp["alert_time_utc"], utc=True, format="ISO8601")):
            s = state_at(g, t)
            if s is None:
                continue
            d = diagnose(s, a, recent)
            recent[d["fault_type"]] = t
            rows.append({"asset_id": aid, "alert_time_utc": t, **{k: d[k] for k in ("event_class", "fault_type", "confidence", "evidence", "recommended_action")}})
    return pd.DataFrame(rows, columns=COLS)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mode", choices=["b1times", "own"], default="own")
    a = p.parse_args(argv)
    assets = load_assets()
    feat = load_features()
    frames = build_frames(assets, feat)
    if a.mode == "b1times":
        zf = b1_frame(feat, assets)
        times = B.b1_threshold(zf, **B1_PARAMS)[["asset_id", "alert_time_utc"]]
        pred = rediagnose(times, frames, assets)
    else:
        pred = detect(frames, assets)
    out_all = RESULTS / f"predictions_team_{a.mode}.csv"
    write_predictions(pred, out_all)
    labelled = set(assets[assets["split"].isin(("train", "validation"))]["asset_id"])
    write_predictions(pred[pred["asset_id"].isin(labelled)], REPO / "team_alerts.csv")
    write_predictions(pred[~pred["asset_id"].isin(labelled)], REPO / "predictions_test.csv")
    print(f"{len(pred)} alerts -> {out_all}, team_alerts.csv ({int(pred['asset_id'].isin(labelled).sum())}), predictions_test.csv ({int((~pred['asset_id'].isin(labelled)).sum())})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
