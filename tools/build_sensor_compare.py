#!/usr/bin/env python3
"""Work out what each sensor level can see, from the labels' own evidence channels.

Run:  .venv/bin/python tools/build_sensor_compare.py
Output: public/data/review/sensors.json. Built from labels, so only comparison screens may load it, never live replay.

Method: each labelled fault lists the channels that carried its earliest evidence. A level can see a fault when it has
at least one of those channels. This does not depend on any detector, so it shows what the sensors offer.
  - Faults that a pump's own sensors could not reveal are counted at that level, and left out of higher levels, where
    the labels say nothing about them.
  - A sensor fault on an instrument a level does not have is left out, because that instrument would not exist.
  - Only the earliest evidence is listed, so this is a cautious count: a fault may show on other channels later.

--detector also reruns B1 with channels hidden, as a check for the detector team. Do not show its results as they are:
  - Scoring matches any alert inside a fault's window, so a long bearing fault gets "caught" by an unrelated alert.
  - B1 needs 15 minutes in a row of deviation, but wireless channels report every 5 minutes, so it cannot use them.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("RETROFIT_DATA_ROOT", REPO.parent / "RETROFIT_AI_PARTICIPANTS_2026"))
sys.path.insert(0, str(ROOT / "src"))
from retrofit_sim import baselines as B  # noqa: E402
from retrofit_sim.scoring import score  # noqa: E402

DATA = ROOT / "data" / "full"
OUT = REPO / "public" / "data" / "review" / "sensors.json"
PARAMS = {"k": 6, "persist": 15}     # B1 values chosen on the training split
RANK = {"T0_LEGACY": 0, "T1_RETROFIT": 1, "T2_FULL": 2}
BASE = ["motor_current_a", "discharge_pressure_kpa", "fluid_temp_c"]
WIRELESS = ["vibration_rms_mm_s", "vibration_accel_rms_g", "vibration_crest_factor", "bearing_temp_c"]
ONLY_T2 = ["flow_m3_h", "motor_winding_temp_c", "valve_position_pct"]
ONLY_T1_UP = ["suction_pressure_kpa", *WIRELESS]
STATS = ("mean", "std", "min", "max", "count")


def removed(level: str, control: str) -> list:
    """Channels a pump would not have at this level. Drive speed and power come with a variable-speed drive."""
    if level == "T2_FULL":
        return []
    gone = list(ONLY_T2)
    if not control.startswith("VFD"):
        gone.append("motor_power_kw")
    if level == "T0_LEGACY":
        gone += ONLY_T1_UP
    return gone


def has_channel(channel: str, level: str, control: str) -> bool:
    if channel == "GATEWAY":
        return True      # a data connection exists at every level
    if channel in removed(level, control):
        return False
    return channel != "motor_speed_rpm" or control.startswith("VFD")


def visibility(assets: pd.DataFrame, events: pd.DataFrame) -> dict:
    control = dict(zip(assets.asset_id, assets.control))
    tier = dict(zip(assets.asset_id, assets.instrumentation_tier))
    table = {}
    for e in events.itertuples():
        row = table.setdefault(e.fault_type, {"eventClass": e.event_class, **{lv: {"seen": 0, "total": 0} for lv in RANK}})
        evidence = [] if pd.isna(e.evidence_channels) else str(e.evidence_channels).split(",")
        for level in RANK:
            above = RANK[level] > RANK[tier[e.asset_id]]
            if not bool(e.observable):
                if not above:
                    row[level]["total"] += 1
                continue
            if e.event_class == "SENSOR" and not has_channel(e.sensor_tag, level, control[e.asset_id]):
                continue
            row[level]["total"] += 1
            row[level]["seen"] += int(above or any(has_channel(c, level, control[e.asset_id]) for c in evidence))
    return table


def mask(feat: pd.DataFrame, assets: pd.DataFrame, level: str) -> pd.DataFrame:
    f = feat.copy()
    control = dict(zip(assets.asset_id, assets.control))
    numeric = {c: f[c].astype("float64") for c in f.columns if c.endswith(tuple(f"__{s}" for s in STATS))}
    f = f.assign(**numeric)
    for asset, idx in f.groupby("asset_id", observed=True).groups.items():
        for ch in removed(level, control[asset]):
            f.loc[idx, [f"{ch}__{s}" for s in STATS if f"{ch}__{s}" in f.columns]] = np.nan
    if level == "T1_RETROFIT":
        minute = pd.to_datetime(f["window_start_utc"], utc=True).dt.minute
        off_beat = (minute % 5 != 0).values
        for ch in WIRELESS:
            for s in ("mean", "min", "max"):
                f.loc[off_beat, f"{ch}__{s}"] = np.nan
            f[f"{ch}__std"] = np.nan
    return f


def detector_check(assets, events, benign):
    """Rerun B1 with channels hidden and print the result. See the warning at the top of this file."""
    ids = list(assets[(assets.instrumentation_tier == "T2_FULL")].asset_id)
    assets_t2 = assets[assets.asset_id.isin(ids)].copy()
    feat = pd.read_parquet(DATA / "features_1min.parquet")
    feat = feat[feat.asset_id.astype(str).isin(ids)].copy()
    feat["asset_id"] = feat["asset_id"].astype(str)
    control = dict(zip(assets.asset_id, assets.control))
    for level in RANK:
        zf = B.zscores(B.regime_frame(mask(feat, assets_t2, level), assets_t2))
        pred = B.b1_threshold(zf, k=PARAMS["k"], persist=PARAMS["persist"])
        ev = events[events.asset_id.isin(ids)]
        ev = ev[[not (e.event_class == "SENSOR" and e.sensor_tag in removed(level, control[e.asset_id])) for e in ev.itertuples()]]
        r = score(pred, ev, assets_t2, benign, None)
        print(level, f"caught {r['true_positive_events']} of {r['events_scored']}, cause right {r['fault_type_recall']:.2f}, false per pump-day {r['false_alerts_per_asset_day']:.2f}")


def main():
    assets = pd.read_csv(DATA / "assets.csv")
    assets = assets[assets.split.isin(["train", "validation"])].copy()
    events = pd.concat([pd.read_csv(DATA / "events_train.csv"), pd.read_csv(DATA / "events_validation.csv")], ignore_index=True)
    table = visibility(assets, events)
    for fault, row in sorted(table.items()):
        print(fault.ljust(27), *[f"{row[lv]['seen']}/{row[lv]['total']}".rjust(6) for lv in RANK])
    OUT.write_text(json.dumps({"faults": table, "events": len(events)}, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)} from {len(events)} labelled faults")
    if "--detector" in sys.argv:
        detector_check(assets, events, pd.read_csv(DATA / "benign_windows_train_validation.csv"))


if __name__ == "__main__":
    main()
