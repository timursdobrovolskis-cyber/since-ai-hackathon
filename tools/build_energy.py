#!/usr/bin/env python3
"""Energy watch: how far each pump runs from its best efficiency point (BEP), and what that costs in power.

Run:  .venv/bin/python tools/build_energy.py        (RETROFIT_DATA_ROOT as for build_ui_data.py)
Out:  public/data/energy.json

Method, per live pump, over running minutes up to the evening shift (the same moment the app shows, so nothing later
is used):
  - speed ratio r = measured speed / rated speed (fixed-speed pumps without a speed reading: r = 1)
  - flow Q from the flow meter, else from the measured head on the datasheet curve (detector/physics.py)
  - q = Q / (r Q_bep); efficiency relative to BEP at that speed = q (2 - q), the curve in TECHNICAL_MODEL.md section 2
  - wasted power = input power x (1 - relative efficiency): power a pump at its BEP would not need for the same duty
  - a throttled control valve (valve position under 70 %) is flagged: energy burnt across the valve, not in the pump
Money uses an assumed electricity price, stated in the output. Pumps that measure neither flow nor both pressures
cannot be placed on their curve; the output says so instead of guessing.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
from detector.physics import G, Pump, water_density  # noqa: E402

ROOT = Path(os.environ.get("RETROFIT_DATA_ROOT", REPO.parent / "RETROFIT_AI_PARTICIPANTS_2026"))
DATA = ROOT / "data" / "full"
OUT = REPO / "public" / "data" / "energy.json"
SHIFT_HOUR = 66          # lib/labels.ts SHIFT_HOUR
PRICE_EUR_KWH = 0.15     # assumption: industrial electricity; on a ship generated power usually costs more
TEST = {"PUMP-10", "PUMP-11", "PUMP-12"}


def col(df: pd.DataFrame, name: str) -> pd.Series | None:
    c = f"{name}__mean"
    return df[c] if c in df and df[c].notna().mean() > 0.5 else None


def main() -> None:
    assets = pd.read_csv(DATA / "assets.csv")
    feat = pd.read_parquet(DATA / "features_1min.parquet")
    feat["window_start_utc"] = pd.to_datetime(feat["window_start_utc"], utc=True)
    rows = []
    for _, a in assets.iterrows():
        if a.asset_id in TEST:
            continue
        pump = Pump.from_asset(a)
        start = pd.Timestamp(a.window_start_utc)
        f = feat[(feat.asset_id == a.asset_id) & (feat.window_start_utc < start + pd.Timedelta(hours=SHIFT_HOUR))]
        run = f[f.operating_mode == "RUNNING"]
        speed, flow, ps, pdis, power, temp, valve = (col(run, n) for n in (
            "motor_speed_rpm", "flow_m3_h", "suction_pressure_kpa", "discharge_pressure_kpa", "motor_power_kw", "fluid_temp_c", "valve_position_pct"))
        r = (speed / float(a.motor_rated_rpm)).clip(0.3, 1.2) if speed is not None else pd.Series(1.0, index=run.index)
        rho = water_density(temp if temp is not None else 20.0, pump.salinity)
        if flow is not None:
            q, method = flow, "flow meter"
        elif ps is not None and pdis is not None:
            q, method = pd.Series(pump.flow_from_head((pdis - ps) * 1000.0 / (rho * G), r), index=run.index), "pump curve, from pressures"
        else:
            rows.append({"id": a.asset_id, "method": None, "tier": a.instrumentation_tier,
                         "note": "Measures neither flow nor both pressures, so it cannot be placed on its curve. A suction pressure sensor would fix that."})
            continue
        ratio = (q / (r * pump.q_bep)).clip(0.0, 1.6)
        rel = (ratio * (2.0 - ratio)).clip(0.0, 1.0)
        p_in = power if power is not None else pd.Series(pump.input_power_kw(q, r, rho), index=run.index)
        waste_kw = (p_in * (1.0 - rel)).dropna()
        running_share = len(run) / max(len(f), 1)
        mean_waste = float(waste_kw.mean()) if len(waste_kw) else 0.0
        throttled = bool(valve is not None and float(valve.median()) < 70.0)
        rows.append({
            "id": a.asset_id, "method": method, "tier": a.instrumentation_tier,
            "bepShare": round(float(np.nanmedian(ratio)), 2),
            "efficiencyVsBest": round(float(np.nanmedian(rel)), 2),
            "powerKw": round(float(p_in.mean()), 1),
            "wasteKw": round(mean_waste, 1),
            "eurYear": round(mean_waste * 8760 * running_share * PRICE_EUR_KWH, -1),
            "runningShare": round(running_share, 2),
            "throttled": throttled,
            "valvePct": round(float(valve.median()), 0) if valve is not None else None,
        })
    rows.sort(key=lambda x: -(x.get("eurYear") or -1))
    OUT.write_text(json.dumps({"priceEurKwh": PRICE_EUR_KWH, "uptoHour": SHIFT_HOUR, "pumps": rows}, indent=1))
    for x in rows:
        print(x)


if __name__ == "__main__":
    main()
