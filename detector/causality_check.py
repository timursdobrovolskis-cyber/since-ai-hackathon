#!/usr/bin/env python3
"""Causality check: rerun the detector on telemetry truncated at random cut points and compare the alerts before the cut.

  python detector/causality_check.py [--cuts 3] [--assets PUMP-01,PUMP-08]

For every asset and cut time, the features and alerts are rebuilt from rows <= cut only. Every alert at or before the
cut must be identical (time, class, type, evidence) to the full run. Any difference means the detector peeked ahead.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from detector.baseline_b1 import b1_frame  # noqa: E402
from detector.common import load_assets, load_features  # noqa: E402
from detector.detect import detect_asset  # noqa: E402
from detector.features import physics_frame  # noqa: E402

KEYS = ("alert_time_utc", "event_class", "fault_type", "evidence")


def alerts_for(feat: pd.DataFrame, assets: pd.DataFrame, a: pd.Series, now: pd.Timestamp | None = None) -> pd.DataFrame:
    """Alerts from the rows given. `now` is the wall-clock time of the run: a live system knows that no rows have arrived
    between the last received row and now (a gateway outage), so the 1-min grid is extended to `now` with empty minutes."""
    f = feat[feat["asset_id"] == a["asset_id"]]
    if now is not None and f["window_start_utc"].max() < now.floor("min"):
        f = pd.concat([f, pd.DataFrame({"asset_id": [a["asset_id"]], "window_start_utc": [now.floor("min")], "rows": [0]})], ignore_index=True)
    zf = b1_frame(f, assets)
    g = physics_frame(zf, a)
    return pd.DataFrame(detect_asset(g, a))


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--cuts", type=int, default=3)
    p.add_argument("--assets", default=None, help="comma-separated asset ids (default: train + validation)")
    p.add_argument("--seed", type=int, default=0)
    a = p.parse_args(argv)
    assets = load_assets()
    feat = load_features()
    ids = a.assets.split(",") if a.assets else list(assets[assets["split"].isin(("train", "validation"))]["asset_id"])
    rng = np.random.default_rng(a.seed)
    bad = 0
    for aid in ids:
        row = assets[assets["asset_id"] == aid].iloc[0]
        fa = feat[feat["asset_id"] == aid]
        full = alerts_for(fa, assets, row)
        t0, t1 = row["window_start_utc"], row["window_end_utc"]
        cuts = [t0 + (t1 - t0) * float(x) for x in rng.uniform(0.2, 0.98, a.cuts)]
        for cut in cuts:
            part = alerts_for(fa[fa["window_start_utc"] <= cut], assets, row, now=cut)
            exp = full[full["alert_time_utc"] <= cut] if len(full) else full
            got = part[part["alert_time_utc"] <= cut] if len(part) else part
            same = len(exp) == len(got) and (len(exp) == 0 or all((exp[k].values == got[k].values).all() for k in KEYS))
            print(f"{aid} cut at {cut:%d %H:%M}: full={len(exp)} truncated={len(got)} {'OK' if same else 'MISMATCH'}")
            bad += 0 if same else 1
    print("causality check:", "PASSED" if bad == 0 else f"FAILED ({bad} mismatches)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
