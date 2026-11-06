#!/usr/bin/env python3
"""Build the JSON the app reads from the organizer data pack.

Run:  .venv/bin/python tools/build_ui_data.py
Data: set RETROFIT_DATA_ROOT, or keep the pack next to this repo.

Output (public/data/):
  fleet.json            pump list, safe for live screens
  pumps/<id>.json       5-min series, expected bands, states, alarms, maintenance (safe for live screens)
  alerts.json           alerts in the docs/spec.md section 8 format (safe for live screens)
  review/<id>.json      labelled events and benign windows. LOADED ONLY BY THE REVIEW VIEW.
  review/summary.json   baseline scores. LOADED ONLY BY THE REVIEW VIEW.

Test pumps (PUMP-10, 11, 12) are skipped until the submission is frozen. See docs/spec.md section 9.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("RETROFIT_DATA_ROOT", REPO.parent / "RETROFIT_AI_PARTICIPANTS_2026"))
sys.path.insert(0, str(ROOT / "src"))
from retrofit_sim import baselines as B  # noqa: E402

DATA = ROOT / "data" / "full"
OUT = REPO / "public" / "data"
SPLITS = ("train", "validation")
STEP_MIN = 5
BAND_SIGMA = 3.0      # half-width of the expected band, in robust standard deviations
B1_PARAMS = {"k": 6, "persist": 15}   # chosen on the training split: baselines/results/baseline_report.json

# Same per-channel floors as zscores() in retrofit_sim/baselines.py, needed to rebuild the band.
FLOOR = {"v": 0.05, "a": 0.01, "c": 0.05, "bt": 0.3, "ps": 1.0, "pd": 2.0, "i": 0.3, "pw": 0.2, "q": 2.0,
         "n": 5.0, "wt": 0.5, "tf": 0.3, "vp": 0.5}
CHANNEL_META = {
    "suction_pressure_kpa": ("Suction pressure", "kPa"),
    "discharge_pressure_kpa": ("Discharge pressure", "kPa"),
    "motor_current_a": ("Motor current", "A"),
    "motor_speed_rpm": ("Motor speed", "rpm"),
    "motor_power_kw": ("Motor power", "kW"),
    "flow_m3_h": ("Flow", "m³/h"),
    "fluid_temp_c": ("Liquid temperature", "°C"),
    "bearing_temp_c": ("Bearing temperature", "°C"),
    "motor_winding_temp_c": ("Winding temperature", "°C"),
    "vibration_rms_mm_s": ("Vibration velocity", "mm/s"),
    "vibration_accel_rms_g": ("Vibration acceleration", "g"),
    "vibration_crest_factor": ("Crest factor", ""),
    "valve_position_pct": ("Valve position", "%"),
}
# Everything a pump of any tier could measure, used to name its blind spots.
ALL_CHANNELS = list(CHANNEL_META)


def clean(v, digits=3):
    """JSON-safe rounded number, or None."""
    if v is None:
        return None
    v = float(v)
    if math.isnan(v) or math.isinf(v):
        return None
    return round(v, digits)


def iso(ts):
    return None if pd.isna(ts) else pd.Timestamp(ts).strftime("%Y-%m-%dT%H:%M:%SZ")


def hours_from(ts, start):
    return None if pd.isna(ts) else round((pd.Timestamp(ts) - start).total_seconds() / 3600, 4)


def write(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def add_bands(zf: pd.DataFrame) -> pd.DataFrame:
    """Add <col>__exp and <col>__sd per minute, from the first 24 h of steady running, by speed regime."""
    out = []
    for _, g in zf.groupby("asset_id", sort=False):
        g = g.copy()
        t0 = g["window_start_utc"].min()
        base = g[(g["window_start_utc"] < t0 + pd.Timedelta(hours=B.BASELINE_H)) & g["steady"]]
        for key, col in B.CH.items():
            m = f"{col}__mean"
            if m not in g or g[m].notna().sum() == 0:
                continue
            med = base.groupby("regime")[m].median()
            mad = base.groupby("regime")[m].apply(lambda s: (s - s.median()).abs().median())
            glob_med = base[m].median()
            glob_mad = (base[m] - glob_med).abs().median()
            g[f"{col}__exp"] = g["regime"].map(med).fillna(glob_med)
            g[f"{col}__sd"] = np.maximum(1.4826 * g["regime"].map(mad).fillna(glob_mad), FLOOR[key])
        out.append(g)
    return pd.concat(out, ignore_index=True)


def mode_runs(g: pd.DataFrame, start: pd.Timestamp) -> list:
    """Run-length encode per-minute state, as [startHour, endHour, state]."""
    runs = []
    states = g["operating_mode"].astype(str).values
    hours = ((g["window_start_utc"] - start).dt.total_seconds() / 3600).values
    i = 0
    for j in range(1, len(states) + 1):
        if j == len(states) or states[j] != states[i]:
            end = hours[j] if j < len(states) else hours[-1] + 1 / 60
            runs.append([round(float(hours[i]), 3), round(float(end), 3), str(states[i])])
            i = j
    return runs


def build_pump(a: pd.Series, g: pd.DataFrame, alarms: pd.DataFrame, maint: pd.DataFrame) -> dict:
    start = pd.Timestamp(a["window_start_utc"])
    g = g.sort_values("window_start_utc").reset_index(drop=True)
    runs = mode_runs(g, start)
    # Only show values while the pump runs steadily. Stopped readings would drown out the signal.
    g5 = g.copy()
    g5["bucket"] = ((g5["window_start_utc"] - start).dt.total_seconds() // (STEP_MIN * 60)).astype(int)
    g5["use"] = g5["steady"]
    series = {}
    channels = [c for c in str(a["channels_available"]).split("|") if c in CHANNEL_META]
    n = int(g5["bucket"].max()) + 1
    for col in channels:
        m = f"{col}__mean"
        if m not in g5:
            continue
        used = g5[g5["use"]]
        obs = used.groupby("bucket")[m].mean().reindex(range(n))
        exp = used.groupby("bucket")[f"{col}__exp"].mean().reindex(range(n)) if f"{col}__exp" in g5 else None
        sd = used.groupby("bucket")[f"{col}__sd"].mean().reindex(range(n)) if f"{col}__sd" in g5 else None
        series[col] = {
            "obs": [clean(v, 3) for v in obs.values],
            "lo": [clean(e - BAND_SIGMA * s, 3) for e, s in zip(exp.values, sd.values)] if exp is not None else None,
            "hi": [clean(e + BAND_SIGMA * s, 3) for e, s in zip(exp.values, sd.values)] if exp is not None else None,
        }
    al = alarms[alarms.asset_id == a.asset_id].sort_values("raised_utc")
    mt = maint[(maint.asset_id == a.asset_id)].sort_values("start_utc")
    in_w = mt[mt["in_window"].astype(str) == "True"]
    history = mt[mt["in_window"].astype(str) != "True"].tail(5)
    note = lambda r: {"id": r.record_id, "workType": r.work_type, "startHour": hours_from(r.start_utc, start),
                      "endHour": hours_from(r.end_utc, start), "startUtc": iso(r.start_utc),
                      "observation": r.operator_observation, "diagnosisConfidence": r.diagnosis_confidence,
                      "planned": str(r.planned) == "True"}
    return {
        "id": a.asset_id, "stepMinutes": STEP_MIN, "windowStartUtc": iso(start), "points": n,
        "channels": channels,
        "stateRuns": runs,
        "series": series,
        "alarms": [{"tag": r.tag, "type": r.alarm_type, "priority": int(r.priority), "raisedHour": hours_from(r.raised_utc, start),
                    "clearedHour": hours_from(r.cleared_utc, start), "raisedUtc": iso(r.raised_utc),
                    "value": clean(r.value_at_raise, 2), "limit": clean(r.limit, 2)} for r in al.itertuples()],
        "maintenance": [note(r) for r in in_w.itertuples()],
        "history": [note(r) for r in history.itertuples()],
    }


EV_RE = re.compile(r"([a-z0-9_]+) (?:deviates alone \()?z=([+-]?\d+(?:\.\d+)?)")


def plain(text: str) -> str:
    """Swap column names for words, and give the baseline's short phrases a readable form."""
    text = text.replace("missing rows", "Data stopped arriving from this pump")
    text = re.sub(r"^([a-z0-9_]+) frozen$", r"\1 reading is frozen", text)
    text = re.sub(r"^([a-z0-9_]+) deviates alone \(z=[^)]*\)$", r"\1 changed while related signals did not", text)
    for col, (label, _) in CHANNEL_META.items():
        text = text.replace(col, label.lower())
    return text[:1].upper() + text[1:]


def describe(channels: list) -> str | None:
    parts = []
    for c in channels:
        if c["observed"] is None or c["expected"] is None:
            continue
        label, unit = CHANNEL_META[c["channel"]]
        gap = c["observed"] - c["expected"]
        parts.append(f"{label} is {abs(gap):.1f} {unit} {'below' if gap < 0 else 'above'} expected".replace("  ", " "))
    return ". ".join(parts) + "." if parts else None


def to_alert(row: pd.Series, n: int, a: pd.Series, frame: pd.DataFrame) -> dict:
    """Convert one baseline CSV row to the section 8 format. Only uses the minute of the alert and earlier."""
    t = pd.Timestamp(row.alert_time_utc)
    start = pd.Timestamp(a["window_start_utc"])
    text = re.sub(r"^B1 mode-aware z:\s*", "", str(row.evidence))
    at = frame[frame["window_start_utc"] <= t].tail(1)
    channels = []
    for col, z in EV_RE.findall(text):
        if col not in CHANNEL_META or at.empty:
            continue
        r = at.iloc[0]
        channels.append({"channel": col, "observed": clean(r.get(f"{col}__mean"), 2), "expected": clean(r.get(f"{col}__exp"), 2), "z": float(z)})
    available = str(a["channels_available"]).split("|")
    summary = plain(text) if "alone" in text or "frozen" in text else (describe(channels) or plain(text))
    return {
        "alert_id": f"{row.asset_id}-A{n:04d}", "asset_id": row.asset_id, "alert_time_utc": iso(t),
        "offset_hours": hours_from(t, start), "event_class": row.event_class, "fault_type": row.fault_type,
        "confidence": clean(row.confidence, 3), "confidence_calibrated": False, "detector_version": "B1 baseline",
        "recommended_action": plain(str(row.recommended_action)).replace(" / ", " and "), "hypotheses": [],
        "evidence": {"summary": summary, "channels": channels, "blind_spots": [c for c in ALL_CHANNELS if c not in available]},
    }


def main():
    assets = pd.read_csv(DATA / "assets.csv", parse_dates=["window_start_utc", "window_end_utc"])
    assets = assets[assets["split"].isin(SPLITS)].reset_index(drop=True)
    ids = list(assets.asset_id)
    feat = pd.read_parquet(DATA / "features_1min.parquet")
    feat = feat[feat.asset_id.astype(str).isin(ids)].copy()
    feat["asset_id"] = feat["asset_id"].astype(str)
    print(f"features: {len(feat):,} rows for {len(ids)} pumps")

    zf = B.zscores(B.regime_frame(feat, assets))
    zf = add_bands(zf)

    alarms = pd.read_csv(DATA / "alarms.csv", parse_dates=["raised_utc", "cleared_utc"])
    maint = pd.read_csv(DATA / "maintenance.csv", parse_dates=["start_utc", "end_utc"])
    events = pd.concat([pd.read_csv(DATA / "events_train.csv"), pd.read_csv(DATA / "events_validation.csv")], ignore_index=True)
    for c in ("onset_utc", "detectable_utc", "action_deadline_utc", "end_utc"):
        events[c] = pd.to_datetime(events[c], utc=True, format="ISO8601")
    benign = pd.read_csv(DATA / "benign_windows_train_validation.csv", parse_dates=["start_utc", "end_utc"])

    pred = B.b1_threshold(zf, k=B1_PARAMS["k"], persist=B1_PARAMS["persist"])
    print(f"B1 alerts: {len(pred)}")
    # Our rerun must match the organizers' file for validation, or the numbers in the app are not theirs.
    shipped = pd.read_csv(ROOT / "baselines" / "results" / "predictions_B1_mode_aware_z_validation.csv")
    ours = pred[pred.asset_id.isin(shipped.asset_id.unique())]
    same = list(ours.alert_time_utc) == list(shipped.alert_time_utc) and list(ours.fault_type) == list(shipped.fault_type)
    print(f"validation alerts match shipped baseline: {same} ({len(ours)} vs {len(shipped)})")
    if not same:
        raise SystemExit("B1 rerun differs from the shipped validation file: investigate before using these numbers")

    fleet, alerts = [], []
    for _, a in assets.iterrows():
        g = zf[zf.asset_id == a.asset_id]
        write(OUT / "pumps" / f"{a.asset_id}.json", build_pump(a, g, alarms, maint))
        frame = g.sort_values("window_start_utc")
        rows = pred[pred.asset_id == a.asset_id].sort_values("alert_time_utc")
        for i, r in enumerate(rows.itertuples(), 1):
            alerts.append(to_alert(pd.Series(r._asdict()), i, a, frame))
        fleet.append({
            "id": a.asset_id, "site": a.site, "system": a.system, "profile": a.profile, "control": a.control, "tier": a.instrumentation_tier,
            "split": a.split, "commissionedYear": int(a.commissioned_year), "windowStartUtc": iso(a.window_start_utc),
            "windowEndUtc": iso(a.window_end_utc), "ratedFlow": clean(a.pump_rated_flow_m3_h), "ratedHead": clean(a.pump_rated_head_m),
            "motorKw": clean(a.motor_rated_kw), "vibrationAlarm": clean(a.vibration_alarm_mm_s), "fluid": a.fluid,
        })
        ev = events[events.asset_id == a.asset_id].sort_values("onset_utc")
        be = benign[benign.asset_id == a.asset_id]
        start = pd.Timestamp(a.window_start_utc)
        write(OUT / "review" / f"{a.asset_id}.json", {
            "events": [{"id": e.event_id, "eventClass": e.event_class, "faultType": e.fault_type, "severity": e.severity,
                        "observable": bool(e.observable), "onsetHour": hours_from(e.onset_utc, start),
                        "detectableHour": hours_from(e.detectable_utc, start), "deadlineHour": hours_from(e.action_deadline_utc, start),
                        "endHour": hours_from(e.end_utc, start), "sensorTag": None if pd.isna(e.sensor_tag) else e.sensor_tag,
                        "evidenceChannels": None if pd.isna(e.evidence_channels) else e.evidence_channels} for e in ev.itertuples()],
            "benign": [{"type": b.benign_type, "startHour": hours_from(b.start_utc, start), "endHour": hours_from(b.end_utc, start)}
                       for b in be.itertuples()],
        })

    write(OUT / "fleet.json", {"pumps": fleet, "channelMeta": {k: {"label": v[0], "unit": v[1]} for k, v in CHANNEL_META.items()},
                               "windowHours": 168, "stepMinutes": STEP_MIN})
    write(OUT / "alerts.json", {"source": "B1 baseline, placeholder until the team detector is ready", "alerts": alerts})
    report = json.loads((ROOT / "baselines" / "results" / "baseline_report.json").read_text())
    write(OUT / "review" / "summary.json", {"results": report["results"]})

    sizes = sorted(((p.stat().st_size, p.relative_to(OUT)) for p in OUT.rglob("*.json")), reverse=True)
    print(f"{len(sizes)} files, {sum(s for s, _ in sizes) / 1e6:.1f} MB total, largest {sizes[0][0] / 1e3:.0f} kB ({sizes[0][1]})")


if __name__ == "__main__":
    main()
