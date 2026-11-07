"""Shared paths and loaders. The organizer pack is NOT in git: set RETROFIT_DATA_ROOT or keep it next to the repo."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("RETROFIT_DATA_ROOT", REPO.parent / "RETROFIT_AI_PARTICIPANTS_2026"))
DATA = ROOT / "data" / "full"
RESULTS = REPO / "detector" / "results"
if str(ROOT / "src") not in sys.path:
    sys.path.insert(0, str(ROOT / "src"))

SPLITS = ("train", "validation", "test")
LABELLED = ("train", "validation")
COLS = ["asset_id", "alert_time_utc", "event_class", "fault_type", "confidence", "evidence", "recommended_action"]


def _ts(s):
    return pd.to_datetime(s, utc=True, format="ISO8601")


def load_assets() -> pd.DataFrame:
    a = pd.read_csv(DATA / "assets.csv")
    a["window_start_utc"] = _ts(a["window_start_utc"])
    a["window_end_utc"] = _ts(a["window_end_utc"])
    return a


def load_events() -> pd.DataFrame:
    """Train and validation labels in one frame. Test labels do not exist here."""
    ev = pd.concat([pd.read_csv(DATA / "events_train.csv"), pd.read_csv(DATA / "events_validation.csv")], ignore_index=True)
    for c in ("onset_utc", "detectable_utc", "action_deadline_utc", "end_utc"):
        ev[c] = _ts(ev[c])
    ev["observable"] = ev["observable"].astype(str).str.lower().isin(["true", "1"])
    return ev


def load_benign() -> pd.DataFrame:
    b = pd.read_csv(DATA / "benign_windows_train_validation.csv")
    b["start_utc"], b["end_utc"] = _ts(b["start_utc"]), _ts(b["end_utc"])
    return b


def load_features() -> pd.DataFrame:
    f = pd.read_parquet(DATA / "features_1min.parquet")
    f["asset_id"] = f["asset_id"].astype(str)
    f["window_start_utc"] = _ts(f["window_start_utc"])
    return f.sort_values(["asset_id", "window_start_utc"]).reset_index(drop=True)


def write_predictions(df: pd.DataFrame, path: Path) -> None:
    out = df.copy()
    for c in COLS:
        if c not in out:
            out[c] = ""
    out["alert_time_utc"] = _ts(out["alert_time_utc"]).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    out = out[COLS].sort_values(["asset_id", "alert_time_utc"], kind="stable")
    path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(path, index=False)
