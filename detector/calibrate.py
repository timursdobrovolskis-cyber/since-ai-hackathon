"""Calibrated confidence: how often an alert naming fault X on the TRAINING pumps fell inside a labelled event of type X.

confidence(X) = (hits + 1) / (alerts + 2)   (Laplace smoothing; types never named on train fall back to their class rate)
UNKNOWN gets the rate at which UNKNOWN alerts fell inside any scored event window.
Fitted on train only; validation is used to check the calibration, never to fit it.
"""
from __future__ import annotations

import json

import pandas as pd

from detector.common import load_assets, load_events

SOFT_END = {"CAVITATION", "AIR_ENTRAINMENT"}


def event_windows(events: pd.DataFrame, assets: pd.DataFrame) -> pd.DataFrame:
    """Scoring windows (same rules as retrofit_sim.scoring) for observable events."""
    ws = dict(zip(assets["asset_id"], assets["window_start_utc"]))
    we = dict(zip(assets["asset_id"], assets["window_end_utc"]))
    ev = events[events["observable"]].copy()
    starts, ends = [], []
    for e in ev.itertuples():
        s = max(e.onset_utc, ws[e.asset_id])
        if pd.notna(e.detectable_utc):
            s = max(s, e.detectable_utc - pd.Timedelta(hours=6))
        if pd.isna(e.end_utc):
            en = we[e.asset_id]
        else:
            soft = e.fault_type in SOFT_END or e.event_class == "SENSOR"
            en = min(e.end_utc + (pd.Timedelta(minutes=30) if soft else pd.Timedelta(0)), we[e.asset_id])
        starts.append(s)
        ends.append(en)
    ev["w_start"], ev["w_end"] = starts, ends
    return ev


def hits(pred: pd.DataFrame, windows: pd.DataFrame) -> pd.DataFrame:
    """Per alert: inside any event window, and inside a window of the same fault type."""
    p = pred.copy()
    p["t"] = pd.to_datetime(p["alert_time_utc"], utc=True)
    any_hit, type_hit = [], []
    for r in p.itertuples():
        w = windows[(windows["asset_id"] == r.asset_id) & (windows["w_start"] <= r.t) & (r.t <= windows["w_end"])]
        any_hit.append(len(w) > 0)
        type_hit.append(bool((w["fault_type"] == r.fault_type).any()))
    p["any_hit"], p["type_hit"] = any_hit, type_hit
    return p


def fit(pred_train: pd.DataFrame, assets: pd.DataFrame | None = None, events: pd.DataFrame | None = None) -> dict:
    assets = load_assets() if assets is None else assets
    events = load_events() if events is None else events
    windows = event_windows(events, assets)
    h = hits(pred_train, windows)
    table = {}
    for ft, g in h.groupby("fault_type"):
        ok = g["any_hit"] if ft == "UNKNOWN" else g["type_hit"]
        table[ft] = {"alerts": int(len(g)), "hits": int(ok.sum()), "confidence": round((ok.sum() + 1) / (len(g) + 2), 2)}
    by_class = {}
    for cls, g in h.groupby("event_class"):
        by_class[cls] = {"alerts": int(len(g)), "hits": int(g["type_hit"].sum()), "confidence": round((g["type_hit"].sum() + 1) / (len(g) + 2), 2)}
    return {"fitted_on": "train", "by_type": table, "by_class": by_class}


UNKNOWN_DEFAULT = 0.5   # "something is wrong, cause unclear": no training evidence to calibrate on


def confidence_for(fault: str, cls: str, calib: dict) -> float:
    if fault in calib["by_type"]:
        return calib["by_type"][fault]["confidence"]
    if fault == "UNKNOWN":
        return UNKNOWN_DEFAULT
    return calib["by_class"].get(cls, {}).get("confidence", 0.5)


def apply(pred: pd.DataFrame, calib: dict) -> pd.DataFrame:
    p = pred.copy()
    p["confidence"] = [confidence_for(f, c, calib) for f, c in zip(p["fault_type"], p["event_class"])]
    return p


def reliability(pred: pd.DataFrame, assets: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    """Stated confidence vs observed hit rate, per fault type, on whatever pumps `pred` covers."""
    h = hits(pred, event_windows(events, assets))
    h["ok"] = [(a if f == "UNKNOWN" else t) for f, a, t in zip(h["fault_type"], h["any_hit"], h["type_hit"])]
    out = h.groupby("fault_type").agg(alerts=("ok", "size"), observed=("ok", "mean"), stated=("confidence", "mean")).round(2)
    return out.sort_values("alerts", ascending=False)


def save(calib: dict, path) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(calib, fh, indent=2)
