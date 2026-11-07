"""Our own alert times: a causal trigger on the residual frame, persistence, and an emitter with reminders.

Trigger (per minute, steady running only unless noted):
  physics residuals |pz_*| > k, NPSH margin < 1.3, vibration z > k_vib (held wireless readings count), temperatures
  |z| > k once the pump has run 2 h, B1's regime z > k + 2 as a fallback, and the watchdog (missing rows at any time,
  frozen or noisy readings).
Emission: the trigger must hold `persist` minutes in a row. The first 24 h (learning window) never alert, so every
alert only uses data before it. One alert per fault type; a reminder after 12 h while it persists; a new alert when the
condition disappears for 30 min and comes back (separate episodes). Alerts are at least 15 min apart, so no bursts.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from detector.diagnose import diagnose, hypotheses, state_at

P = dict(k=5.0, k_vib=4.0, k_regime=8.0, persist=15, learning_h=24, reminder_h=12.0, clear_min=30, gap_min=15,
         spike=3.0, cav_sigma=1.3, warm_min=120, step_min=5, unknown_min=180, max_open=3, after_cav_min=60)

PHYS = ("sys_ps", "sys_pd", "head", "q", "qx", "i", "pw", "apps")
VIB = ("v", "a", "c")
TEMP = ("bt", "wt", "tf")
REGIME = ("pd", "ps", "i", "pw", "q", "n", "vp")


def trigger_frame(g: pd.DataFrame, p: dict = P) -> pd.DataFrame:
    """Boolean trigger per minute and the strongest normalised deviation behind it."""
    steady = g["steady"].values
    warm = (g["since_stop"].values > p["warm_min"])
    score = np.zeros(len(g))
    for key in PHYS:
        c = f"pz_{key}"
        if c in g:
            score = np.maximum(score, np.nan_to_num(g[c].abs().values) / p["k"])
    for key in VIB:
        c = f"z_{key}"
        if c in g:
            score = np.maximum(score, np.nan_to_num(g[c].values) / p["k_vib"])      # one-sided: more vibration
    for key in TEMP:
        c = f"z_{key}"
        if c in g:
            score = np.maximum(score, np.nan_to_num(g[c].abs().values) * warm / p["k"])
    for key in REGIME:
        c = f"z_{key}"
        if c in g:
            score = np.maximum(score, np.nan_to_num(g[c].abs().values) / p["k_regime"])
    if "sigma" in g:
        sig = g["sigma"].values
        score = np.maximum(score, np.where(np.isnan(sig), 0.0, np.where(sig < p["cav_sigma"], 1.0 + (p["cav_sigma"] - sig), 0.0)))
    for key in ("pd", "ps", "q", "i", "pw", "bt", "tf", "wt"):
        if f"same_{key}" in g:
            score = np.maximum(score, np.where(g[f"same_{key}"].values > g[f"samelim_{key}"].values, 1.5, 0.0))
        if f"rng_{key}" in g:
            score = np.maximum(score, np.nan_to_num(g[f"rng_{key}"].values) / p["spike"])
    trig = (score >= 1.0) & steady
    gap = (g["rows"].values < 30)
    return pd.DataFrame({"trig": trig, "gap": gap, "score": score}, index=g.index)


EPISODIC = {"CAVITATION", "AIR_ENTRAINMENT", "COMMUNICATION_LOSS"}     # come and go; re-arm when the evidence clears
CAV_SEEN_SIGMA = 1.15   # the label's episode definition: margin below 1.15; between episodes it may hover below 1.3
PRESSURE_SENSOR_WORDS = ("suction pressure", "discharge pressure")


def detect_asset(g: pd.DataFrame, a: pd.Series, p: dict = P) -> list[dict]:
    from detector.diagnose import HYDRAULIC
    tf = trigger_frame(g, p)
    t0 = g["window_start_utc"].iloc[0]
    learn_end = t0 + pd.Timedelta(hours=p["learning_h"])
    times = list(g["window_start_utc"])
    trig, gap = tf["trig"].values, tf["gap"].values
    rows = []
    run = 0
    gap_run = 0
    recent: dict[str, pd.Timestamp] = {}       # fault -> last alert time (one clock per type)
    last_seen: dict[str, pd.Timestamp] = {}    # episodic fault -> last time its hypothesis was present
    bad_pressure_until = None                  # hydraulic diagnoses are unreliable while a pressure transmitter is bad
    last_alert = None
    reminder = pd.Timedelta(hours=p["reminder_h"])
    for j in range(len(g)):
        t = times[j]
        run = run + 1 if trig[j] else 0
        gap_run = gap_run + 1 if gap[j] else 0
        due = (run >= p["persist"] and (run - p["persist"]) % p["step_min"] == 0) or gap_run == p["gap_min"]
        if not due:
            continue
        t_alert = t + pd.Timedelta(minutes=1)
        if t < learn_end and gap_run == 0:
            continue
        s = state_at(g, t)
        if s is None:
            continue
        hyps = hypotheses(s, a)
        # episodic faults whose evidence has been absent for clear_min re-arm (a returning episode is a new alert)
        for f in list(last_seen):
            if (t - last_seen[f]) > pd.Timedelta(minutes=p["clear_min"]):
                recent.pop(f, None)
                last_seen.pop(f)
        sigma_now = g["sigma"].iloc[j] if "sigma" in g else np.nan
        for h in hyps:
            if h.fault in EPISODIC and h.strength >= 3.0 and not (h.fault == "CAVITATION" and not (sigma_now < CAV_SEEN_SIGMA)):
                last_seen[h.fault] = t
            if h.cls == "SENSOR" and h.extra.get("channel") in ("ps", "pd"):
                bad_pressure_until = t + reminder
        suppress = set(HYDRAULIC) if (bad_pressure_until is not None and t < bad_pressure_until) else set()
        if "CAVITATION" in last_seen and (t - last_seen["CAVITATION"]) < pd.Timedelta(minutes=p["after_cav_min"]):
            suppress |= HYDRAULIC | {"BEARING_WEAR"}      # residuals and wireless acceleration take a while to settle after cavitation
        d = diagnose(s, a, recent, reminder_h=p["reminder_h"], suppress=suppress)
        fault = d["fault_type"]
        key = d["case"]
        open_types = [f for f, when in recent.items() if (t - when) < reminder and f != "UNKNOWN"]
        if p.get("trace") is not None:
            p["trace"].append((t, fault, [h.fault[:8] + f":{h.strength:.1f}" for h in hyps[:3]], dict(open=open_types, seen=list(last_seen))))
        if key in recent and (t - recent[key]) < reminder:
            continue
        if last_alert is not None and (t_alert - last_alert) < pd.Timedelta(minutes=15):
            continue
        if fault == "UNKNOWN" and (open_types or run < p["unknown_min"]):
            continue        # UNKNOWN only when nothing is open and the deviation has lasted an hour
        if fault != "UNKNOWN" and len(open_types) >= p["max_open"] and key not in open_types:
            continue        # at most max_open different findings per pump per reminder period
        recent[key] = t
        last_alert = t_alert
        rows.append({"asset_id": a["asset_id"], "alert_time_utc": t_alert,
                     **{k: d[k] for k in ("event_class", "fault_type", "confidence", "evidence", "recommended_action", "hypotheses",
                                          "channels", "sensor_check", "what_would_settle_it")}})
    return rows


def detect(frames: dict[str, pd.DataFrame], assets: pd.DataFrame, p: dict = P) -> pd.DataFrame:
    rows = []
    for _, a in assets.iterrows():
        rows += detect_asset(frames[a["asset_id"]], a, p)
    from detector.common import COLS
    return pd.DataFrame(rows, columns=COLS + ["hypotheses", "channels", "sensor_check", "what_would_settle_it"])
