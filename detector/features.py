"""Per-minute residuals for one pump: physics residuals, robust z-scores and sensor-watchdog flags.

Everything here is causal: a value at minute t uses rows <= t, except the learning baseline, which (as in B1) is the
first BASELINE_H hours of steady running. Phase 3 replaces that baseline by an expanding one so early alerts stay causal.

Columns added (x = channel short key, see CH):
  r, rho, q_meter, q_head, q_power, q_cur, q_best      flow estimates [m3/h] and the one used for predictions
  head_meas, head_curve                                 measured head and the datasheet head at the current speed/flow
  pred_<x>                                              physics prediction of a channel from the OTHER channels
  res_<x>                                               measured - predicted, baseline-centred
  pz_<x>                                                res_<x> in robust standard deviations (physics z)
  sigma                                                 NPSH margin NPSHa / NPSH3 (needs suction pressure)
  z_<x>                                                 B1's regime z (kept, used for channels without a physics prediction)
  rise_<x>                                              minutes since |pz_x| (or |z_x|) was last below 1.5
  jump_<x>                                              largest 10-min move of that z in the last 90 min (step vs drift)
  same_<x>                                              consecutive identical readings, in minutes (stuck sensor)
  rng_<x>                                               within-minute range / its baseline median (noise and spikes)
  steady, gap, readings_<x>                             as in B1, plus the count of new readings per channel
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from detector.physics import G, Pump, water_density

CH = {"v": "vibration_rms_mm_s", "a": "vibration_accel_rms_g", "c": "vibration_crest_factor", "bt": "bearing_temp_c",
      "ps": "suction_pressure_kpa", "pd": "discharge_pressure_kpa", "i": "motor_current_a", "pw": "motor_power_kw",
      "q": "flow_m3_h", "n": "motor_speed_rpm", "wt": "motor_winding_temp_c", "tf": "fluid_temp_c", "vp": "valve_position_pct"}
BASELINE_H = 24
# floors on the robust sd of a residual, in engineering units, so a very quiet channel cannot explode the z
FLOOR = {"ps": 1.0, "pd": 2.0, "i": 0.3, "pw": 0.2, "q": 2.0, "head": 0.3, "qx": 2.0, "qm": 2.0}
WIRELESS_FFILL = 6    # minutes: hold a sparse reading until the next one is due


def _ffill_sparse(g: pd.DataFrame, cols: list[str], limit: int) -> pd.DataFrame:
    for c in cols:
        for suf in ("__mean", "__std", "__min", "__max"):
            k = f"{c}{suf}"
            if k in g:
                g[k] = g[k].ffill(limit=limit)
    return g


def physics_frame(g: pd.DataFrame, a: pd.Series) -> pd.DataFrame:
    """g: one asset's B1 z frame (regime_frame + zscores), sorted by time. Returns g with the columns above."""
    g = g.copy().reset_index(drop=True)
    pump = Pump.from_asset(a)
    have = {k: f"{c}__mean" in g and g[f"{c}__mean"].notna().any() for k, c in CH.items()}
    sparse = str(a.get("instrumentation_tier")) == "T1_RETROFIT"
    if sparse:
        g = _ffill_sparse(g, [CH[k] for k in ("v", "a", "c", "bt")], WIRELESS_FFILL)
    m = lambda k: g[f"{CH[k]}__mean"].astype(float) if have[k] else pd.Series(np.nan, index=g.index)

    running = (g["operating_mode"] == "RUNNING") & (g["running_fraction"] >= 0.99)
    rated_rpm = float(a["motor_rated_rpm"])
    if have["n"]:
        r = (m("n") / rated_rpm).where(running)
    else:
        r = pd.Series(np.where(running, 1.0, np.nan), index=g.index)
    g["r"] = r
    tf = m("tf").fillna(m("tf").median() if have["tf"] else 20.0)
    rho = water_density(tf, pump.salinity)
    g["rho"] = rho

    # ---- flow three ways ---------------------------------------------------------------------------------------------
    g["q_meter"] = m("q") if have["q"] else np.nan
    if have["ps"] and have["pd"]:
        g["head_meas"] = (m("pd") - m("ps")) * 1000.0 / (rho * G)
        g["q_head"] = pump.flow_from_head(g["head_meas"], r)
    else:
        g["head_meas"] = np.nan
        g["q_head"] = np.nan
    g["q_power"] = pump.flow_from_power(m("pw"), r, rho) if have["pw"] else np.nan
    g["q_cur"] = pump.flow_from_current(m("i"), r, rho) if have["i"] else np.nan
    # the flow used to predict other channels: meter, else power, else current, else head
    q_best = g["q_meter"].copy()
    for alt in ("q_power", "q_cur", "q_head"):
        q_best = q_best.fillna(g[alt])
    g["q_best"] = q_best.where(running)
    g["head_curve"] = pump.head(g["q_best"], r)
    # load-side flow (from power or current, never from the meter or the pressures): the reference for cross-checks
    q_load = g["q_power"].fillna(g["q_cur"]).where(running)
    # pressure-side flow for load predictions; flow for the system curves (the meter when there is one)
    q_press = g["q_meter"].fillna(g["q_head"]).where(running)
    q_sys = g["q_meter"].fillna(q_load).where(running)

    # ---- predictions of each channel from the others -------------------------------------------------------------------
    pred = {}
    if have["pd"] and have["ps"]:
        pred["pd"] = m("ps") + pump.head(q_load, r) * rho * G / 1000.0
        pred["ps"] = m("pd") - pump.head(q_load, r) * rho * G / 1000.0
    if have["pw"]:
        pred["pw"] = pump.input_power_kw(q_press.fillna(g["q_cur"]), r, rho)
    if have["i"]:
        if have["pw"]:
            # current from the measured power: an independent instrument on the same motor
            lam = np.clip(m("pw") * 1000.0 / pump.p_rated_w, 0, 2)
            pf = np.clip(pump.pf_rated * (1 - np.exp(-lam / 0.3)) / (1 - np.exp(-1 / 0.3)), 0.05, 0.95)
            pred["i"] = m("pw") * 1000.0 / (np.sqrt(3) * pump.v_line * pf)
        else:
            pred["i"] = pump.current_a(q_press, r, rho)
    if have["q"]:
        pred["q"] = g["q_power"].fillna(g["q_cur"]).fillna(g["q_head"])
    for k, p in pred.items():
        g[f"pred_{k}"] = p
        g[f"res_{k}"] = (m(k) - p).where(running)
    # head residual: measured head against the curve at the load-side flow (impeller wear, air, cavitation push it down)
    g["res_head"] = (g["head_meas"] - pump.head(q_load, r)).where(running) if have["ps"] and have["pd"] else np.nan
    # cross-checks: head-side flow minus load-side flow, and head-side flow minus the meter
    g["res_qx"] = (g["q_head"] - q_load).where(running)
    g["res_qm"] = (g["q_head"] - g["q_meter"]).where(running) if have["q"] else np.nan
    if have["ps"]:
        sig, npsha, npsh3 = pump.npsh_margin(m("ps"), g["q_best"], r, tf, rho)
        g["sigma"] = pd.Series(sig, index=g.index).where(running)
        g["npsha"] = npsha
    else:
        g["sigma"] = np.nan

    # ---- centre the residuals on the learning baseline and scale them robustly -------------------------------------------
    t0 = g["window_start_utc"].min()
    base = (g["window_start_utc"] < t0 + pd.Timedelta(hours=BASELINE_H)) & g["steady"]
    for k in [c[4:] for c in g.columns if c.startswith("res_")]:
        s = g[f"res_{k}"]
        med = s[base].median()
        mad = 1.4826 * (s[base] - med).abs().median()
        g[f"res_{k}"] = s - med
        g[f"pz_{k}"] = g[f"res_{k}"] / max(mad if pd.notna(mad) else 0.0, FLOOR.get(k, 1.0))

    # ---- expected value for channels without a physics prediction: the regime median of the learning period (B1's recipe)
    for k in CH:
        if have[k] and f"pred_{k}" not in g:
            col = f"{CH[k]}__mean"
            med = g.loc[base].groupby("regime")[col].median()
            g[f"exp_{k}"] = g["regime"].map(med).fillna(g.loc[base, col].median())

    # ---- system curves: each pressure against a + b Q^2 fitted on the baseline, at the load-side flow --------------------
    # A clogged strainer pulls the suction pressure below its system curve while the pump stays on its own curve;
    # a discharge restriction pushes the discharge pressure above its system curve at the same flow.
    # where the plant measures the suction level, 1 m of level is rho g kPa of suction pressure (static head)
    level = g["level_m"].ffill() if "level_m" in g and g["level_m"].notna().any() else None
    for k, key in (("ps", "sys_ps"), ("pd", "sys_pd")):
        if not have[k]:
            continue
        y = m(k)
        if level is not None:
            y = y - rho * G * (level - level[base].median()) / 1000.0
        ok = base & y.notna() & q_sys.notna()
        if ok.sum() < 30:
            continue
        coef, *_ = np.linalg.lstsq(np.c_[np.ones(int(ok.sum())), q_sys[ok] ** 2], y[ok], rcond=None)
        res = (y - (coef[0] + coef[1] * q_sys ** 2)).where(running)
        med = res[ok].median()
        mad = 1.4826 * (res[ok] - med).abs().median()
        g[f"res_{key}"] = res - med
        g[f"pz_{key}"] = g[f"res_{key}"] / max(mad if pd.notna(mad) else 0.0, FLOOR[k])
    # pumps without a suction transmitter: the suction pressure implied by the discharge pressure and the pump curve
    if have["pd"] and not have["ps"] and q_load.notna().any():
        app = (m("pd") - pump.head(q_load, r) * rho * G / 1000.0).where(running)
        med = app[base].median()
        mad = 1.4826 * (app[base] - med).abs().median()
        g["res_apps"] = app - med
        g["pz_apps"] = g["res_apps"] / max(mad if pd.notna(mad) else 0.0, FLOOR["ps"])
    # minutes since the pump was last locked out (misalignment follows reassembly)
    g["since_lockout"] = _minutes_since(g["operating_mode"].eq("LOCKED_OUT").values)
    g["since_stop"] = _minutes_since(~running.values)
    # head residual timing (air entrainment is sudden, impeller wear is slow)
    if "pz_head" in g:
        g["rise_head"] = _minutes_since_normal(g["pz_head"].where(g["steady"]).values, 1.5)

    # ---- sensor watchdog: step/drift timing, stuck runs, noise ------------------------------------------------------------
    g = g.copy()      # defragment before adding the per-channel columns
    new = {}
    for k in CH:
        if not have[k]:
            continue
        zcol = f"pz_{k}" if f"pz_{k}" in g else f"z_{k}"
        if zcol in g:
            zz = g[zcol].where(g["steady"])
            new[f"rise_{k}"] = _minutes_since_normal(zz.values, 1.5)
            # largest 10-min-to-10-min move in the last 90 min: a calibration step arrives in one move, a drift creeps
            d10 = zz.rolling(10, min_periods=5).mean() - zz.shift(10).rolling(10, min_periods=5).mean()
            new[f"jump_{k}"] = d10.abs().rolling(90, min_periods=1).max()
        col = CH[k]
        raw = g[f"{col}__mean"]
        same = _same_run_minutes(raw.values)
        new[f"same_{k}"] = same
        # longest identical run seen during the learning period: a stuck reading must clearly exceed it
        new[f"samelim_{k}"] = max(2.0 * float(np.nanmax(same[base.values])) if base.any() else 0.0, 10.0)
        if f"{col}__max" in g:
            rng = (g[f"{col}__max"] - g[f"{col}__min"]).astype(float)
            b = rng[base].median()
            new[f"rng_{k}"] = rng / max(b if pd.notna(b) else 0.0, 1e-6)
    return pd.concat([g, pd.DataFrame(new, index=g.index)], axis=1)


def _minutes_since_normal(z: np.ndarray, thr: float) -> np.ndarray:
    """Minutes since |z| was last below thr (NaN counts as normal). Small for a step, large for a slow drift."""
    out = np.zeros(len(z), dtype=float)
    run = 0
    for j, v in enumerate(z):
        run = run + 1 if (not np.isnan(v) and abs(v) >= thr) else 0
        out[j] = run
    return out


def _minutes_since(flag: np.ndarray) -> np.ndarray:
    """Minutes since flag was last True (a large number if never)."""
    out = np.full(len(flag), 1e6)
    last = None
    for j, v in enumerate(flag):
        if v:
            last = j
        if last is not None:
            out[j] = j - last
    return out


def _same_run_minutes(x: np.ndarray) -> np.ndarray:
    """Length in minutes of the current run of identical non-NaN readings (held readings count once)."""
    out = np.zeros(len(x), dtype=float)
    last, start = np.nan, 0
    for j, v in enumerate(x):
        if np.isnan(v):
            out[j] = out[j - 1] if j else 0
            continue
        if np.isnan(last) or v != last:
            start = j
            last = v
        out[j] = j - start + 1
    return out
