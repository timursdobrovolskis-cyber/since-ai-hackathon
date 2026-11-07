"""Rule-based diagnosis from physics residuals and the sensor watchdog, for one asset at one time.

The rules are deliberately few and readable. Each one that fires returns a hypothesis with a strength (roughly in
robust standard deviations) and an operator-readable evidence sentence. The strongest wins; a second hypothesis is
reported when the strongest has already been raised recently, so a new finding during a long fault still gets named.
UNKNOWN is returned when nothing is clear.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from detector.features import CH

LABEL = {"ps": "suction pressure", "pd": "discharge pressure", "i": "motor current", "pw": "motor power", "q": "flow",
         "n": "speed", "bt": "bearing temperature", "wt": "winding temperature", "tf": "liquid temperature",
         "v": "vibration velocity", "a": "vibration acceleration", "c": "crest factor", "vp": "valve position"}
UNIT = {"ps": "kPa", "pd": "kPa", "i": "A", "pw": "kW", "q": "m3/h", "n": "rpm", "bt": "C", "wt": "C", "tf": "C",
        "v": "mm/s", "a": "g", "c": "", "vp": "%"}
ACTION = {
    "SUCTION_STRAINER_CLOGGING": "Inspect and clean the suction strainer at the next opportunity.",
    "CAVITATION": "Reduce flow or speed if allowed; check the suction strainer, suction valve and liquid level now.",
    "DISCHARGE_RESTRICTION": "Check the discharge valve position and the heat exchanger for fouling.",
    "BEARING_WEAR": "Check the bearing for noise and heat; plan a bearing replacement and check lubrication.",
    "MISALIGNMENT": "Check the coupling alignment with a laser tool; pump was reassembled recently.",
    "IMBALANCE": "Inspect the impeller for fouling or damage; balance the rotor.",
    "IMPELLER_WEAR": "Run a performance check against the pump curve; inspect the impeller and wear rings.",
    "AIR_ENTRAINMENT": "Check the suction level, sea chest or basin for air draw; vent the pump.",
    "SENSOR_DRIFT": "Compare the transmitter with a local gauge; recalibrate.",
    "SENSOR_CALIBRATION_SHIFT": "Compare the transmitter with a local gauge; it stepped after maintenance or a knock.",
    "SENSOR_STUCK": "Check the sensor, its cable and the transmitter; the reading is frozen.",
    "SENSOR_NOISE_SPIKES": "Check the cable screen, grounding and connector of the transmitter.",
    "COMMUNICATION_LOSS": "Check the gateway, network switch and sensor power; data stopped arriving.",
    "UNKNOWN": "Walk down the pump and compare readings with local gauges; pattern is not clear yet.",
}
SENSOR_TYPES = {"SENSOR_DRIFT", "SENSOR_CALIBRATION_SHIFT", "SENSOR_STUCK", "SENSOR_NOISE_SPIKES", "COMMUNICATION_LOSS"}
# what an operator can do on the spot to confirm or dismiss the alert
SETTLE = {
    "SUCTION_STRAINER_CLOGGING": "Read the strainer differential-pressure gauge or open the basket at the next stop. A clean strainer with the same low suction pressure points to the inlet valve, the level, or the transmitter.",
    "CAVITATION": "Listen at the pump for a crackling, gravelly noise and check the suction valve is fully open and the tank or sea-chest level is normal.",
    "DISCHARGE_RESTRICTION": "Walk the discharge line: check the valve positions and the differential pressure over the heat exchanger.",
    "BEARING_WEAR": "Feel the bearing housing for heat and listen with a stethoscope or screwdriver; a spectrum reading will show the outer-race frequency.",
    "MISALIGNMENT": "Check the coupling alignment with a dial or laser tool; the vibration sits at one and two times running speed.",
    "IMBALANCE": "Inspect the impeller for fouling or damage; the vibration grows with the square of the speed.",
    "IMPELLER_WEAR": "Run a head-flow check against the data sheet and inspect the impeller and wear rings at the next opening.",
    "AIR_ENTRAINMENT": "Check the suction level for vortexing and the suction joints for an air leak; vent the pump.",
    "SENSOR_DRIFT": "Compare the transmitter with a local gauge; if they agree, the change is real and it is a pump problem.",
    "SENSOR_CALIBRATION_SHIFT": "Compare the transmitter with a local gauge; if they agree, the change is real and it is a pump problem.",
    "SENSOR_STUCK": "Watch whether the reading moves at all when the load changes; check the cable and connector.",
    "SENSOR_NOISE_SPIKES": "Check the cable screen, grounding and connector of the transmitter.",
    "COMMUNICATION_LOSS": "Check that the gateway and network switch have power and that the wireless sensor battery is not flat.",
    "UNKNOWN": "Walk past the pump: listen, look, feel, and compare the local gauges with the screen.",
}
# the signals each rule reads, for the evidence table in the app
FAULT_CHANNELS = {
    "SUCTION_STRAINER_CLOGGING": ["ps", "pd", "n", "pw", "q"], "CAVITATION": ["ps", "a", "v", "q", "tf"],
    "DISCHARGE_RESTRICTION": ["pd", "pw", "i", "q"], "AIR_ENTRAINMENT": ["ps", "pd", "q", "pw"],
    "IMPELLER_WEAR": ["ps", "pd", "q", "pw", "i"], "BEARING_WEAR": ["a", "c", "v", "bt"],
    "MISALIGNMENT": ["v", "a", "bt", "wt"], "IMBALANCE": ["v", "a", "bt"],
}
COUPLED = {"ps": ["pd", "q", "pw", "n"], "pd": ["ps", "q", "pw", "i"], "q": ["pw", "pd", "ps"], "i": ["pw", "pd"], "pw": ["i", "q"],
           "bt": ["v", "a", "wt"], "tf": ["bt", "pw"], "wt": ["i", "pw", "bt"]}


def channel_row(s: pd.Series, k: str) -> dict | None:
    """Observed, expected and deviation for one channel, from the residual the rules use."""
    col = f"{CH[k]}__mean"
    obs = s.get(col, np.nan)
    if pd.isna(obs):
        return None
    for zkey, rkey in ((f"pz_sys_{k}", f"res_sys_{k}"), (f"pz_{k}", f"res_{k}")):
        if zkey in s and pd.notna(s.get(zkey)) and pd.notna(s.get(rkey)):
            return {"channel": CH[k], "observed": round(float(obs), 2), "expected": round(float(obs - s[rkey]), 2), "z": round(float(s[zkey]), 1)}
    z = s.get(f"z_{k}", np.nan)
    exp = s.get(f"exp_{k}", np.nan)
    return {"channel": CH[k], "observed": round(float(obs), 2), "expected": None if pd.isna(exp) else round(float(exp), 2), "z": 0.0 if pd.isna(z) else round(float(z), 1)}


def evidence_channels(s: pd.Series, pick: "Hyp") -> list[dict]:
    chan = pick.extra.get("channel")
    if pick.fault in FAULT_CHANNELS:
        keys = FAULT_CHANNELS[pick.fault]
    elif chan:
        keys = [chan] + COUPLED.get(chan, [])
    else:
        keys = sorted((k for k in CH if pd.notna(s.get(f"z_{k}", np.nan)) or pd.notna(s.get(f"pz_{k}", np.nan))),
                      key=lambda k: -abs(_v(s, f"pz_{k}", _v(s, f"z_{k}"))))[:3]
    rows = [channel_row(s, k) for k in keys]
    return [r for r in rows if r is not None]


def sensor_check(s: pd.Series, pick: "Hyp", rows: list[dict]) -> str:
    names = {r["channel"]: r for r in rows}
    label = {CH[k]: LABEL[k] for k in CH}
    if pick.fault == "COMMUNICATION_LOSS":
        return "No readings are arriving, so nothing can be said about the pump itself until the link is back."
    chan = pick.extra.get("channel")
    if pick.cls == "SENSOR" and chan:
        others = [label[c] for c in names if c != CH[chan] and abs(names[c]["z"]) < 2.0]
        if others:
            return f"Only the {LABEL[chan]} moved. {', '.join(others).capitalize()} agree with each other, so the instrument is the likely cause, not the pump."
        return f"The {LABEL[chan]} reading misbehaves on its own; related signals were checked and are within normal."
    moved = [label[c] for c, r in names.items() if abs(r["z"]) >= 2.0]
    if len(moved) >= 2:
        return f"Related signals moved together ({', '.join(moved)}), so a single bad sensor is unlikely."
    return "The pattern spans more than one instrument, so a single bad sensor is unlikely."
# thresholds (robust standard deviations unless noted); chosen on the training split
T = dict(clog=3.0, restr=3.0, head=3.0, sudden_head_min=480, cav_sigma=1.3, accel=3.0, crest=3.0, vib=3.0,
         alone=4.0, promote=5.0, quiet=2.0, step_share=0.6, spike=3.0, lockout_h=36, flow_disagree=4.0, misalign_temp=1.5)


@dataclass
class Hyp:
    fault: str
    cls: str
    strength: float
    evidence: str
    extra: dict = field(default_factory=dict)


def state_at(g: pd.DataFrame, t: pd.Timestamp, minutes: int = 15) -> pd.Series | None:
    """Summary of the last `minutes` steady minutes up to t (inclusive). Uses only rows <= t."""
    w = g[(g["window_start_utc"] <= t) & (g["window_start_utc"] > t - pd.Timedelta(minutes=minutes))]
    if w.empty:
        return None
    last = w.iloc[-1]
    ws = w[w["steady"]]
    s = {"t": t, "gap": bool((w["rows"] < 30).any()), "n_steady": len(ws), "steady": bool(last["steady"]),
         "since_lockout": float(last["since_lockout"]), "since_stop": float(last["since_stop"])}
    num = w.select_dtypes(include=[np.number]).columns
    for c in num:
        if c.startswith(("pz_", "z_", "res_", "exp_", "sigma", "q_", "head_", "r")) or c in ("sigma",):
            s[c] = float(ws[c].mean()) if len(ws) and ws[c].notna().any() else np.nan
        elif c.startswith(("rise_", "same_", "samelim_", "since_", "jump_")):
            s[c] = float(last[c])
        elif c.startswith("rng_"):
            s[c] = float(ws[c].median()) if len(ws) and ws[c].notna().any() else np.nan
        elif c.endswith("__mean"):
            s[c] = float(ws[c].mean()) if len(ws) and ws[c].notna().any() else float(last[c])
    s["zmax"] = max((abs(v) for k, v in s.items() if k.startswith(("pz_", "z_")) and pd.notna(v)), default=0.0)
    return pd.Series(s)


def _v(s, key, default=0.0):
    v = s.get(key, np.nan)
    return default if v is None or pd.isna(v) else float(v)


def _val(s, k):
    return _v(s, f"{CH[k]}__mean", np.nan)


def _fmt(s, k, z):
    val = _val(s, k)
    unit = UNIT.get(k, "")
    return f"{LABEL[k]} {val:.1f} {unit} (z={z:+.1f})".replace("  ", " ")


def hypotheses(s: pd.Series, a: pd.Series) -> list[Hyp]:
    """All rules that fire, strongest first."""
    hyps: list[Hyp] = []
    has = {k: pd.notna(s.get(f"{CH[k]}__mean", np.nan)) for k in CH}
    z = {k: _v(s, f"z_{k}") for k in CH}
    pz = {k: _v(s, f"pz_{k}") for k in ("ps", "pd", "i", "pw", "q", "head", "qx", "qm", "sys_ps", "sys_pd", "apps")}
    sigma = _v(s, "sigma", np.nan)
    vfd = str(a["control"]).startswith("VFD")

    # ---- data and sensor watchdog -------------------------------------------------------------------------------------
    if s["gap"]:
        hyps.append(Hyp("COMMUNICATION_LOSS", "SENSOR", 100, "Data stopped arriving from this pump (rows missing in the last 30 min)."))
    for k in ("pd", "ps", "q", "i", "pw", "bt", "tf", "wt"):
        if has[k] and _v(s, f"same_{k}") > _v(s, f"samelim_{k}", 1e9) and s["steady"]:
            hyps.append(Hyp("SENSOR_STUCK", "SENSOR", 90 + _v(s, f"same_{k}") / 1000,
                            f"{LABEL[k]} reading frozen at {_val(s, k):.1f} {UNIT[k]} for {_v(s, f'same_{k}'):.0f} min while the pump runs and load varies.", {"channel": k}))
    cavitating = pd.notna(sigma) and sigma < T["cav_sigma"] and (z["a"] > T["accel"] or pz["head"] < -T["head"])
    for k in ("pd", "ps", "q", "i", "pw", "bt", "tf", "wt"):
        r = _v(s, f"rng_{k}", np.nan)
        if has[k] and pd.notna(r) and r > T["spike"] and not cavitating:
            hyps.append(Hyp("SENSOR_NOISE_SPIKES", "SENSOR", 40 + r,
                            f"{LABEL[k]} jumps within each minute {r:.1f}x more than normal while related signals are calm.", {"channel": k}))

    # ---- single-instrument deviations (sensor faults) first: a bad pressure transmitter corrupts every head residual -----
    sensor_hyps = _sensor_alone(s, a, has, z, pz)
    bad_pressure = any(h.extra.get("channel") in ("ps", "pd") for h in sensor_hyps)
    hyps += sensor_hyps

    # ---- hydraulics -----------------------------------------------------------------------------------------------------
    if cavitating:
        hyps.append(Hyp("CAVITATION", "MACHINE", 60 + z["a"],
                        f"NPSH margin {sigma:.2f} (below {T['cav_sigma']}): suction pressure {_val(s, 'ps'):.0f} kPa at {_v(s, 'q_best'):.0f} m3/h; "
                        f"head {-_v(s, 'res_head'):.1f} m below the curve; {_fmt(s, 'a', z['a'])}."))
    # clog: suction below its system curve at this flow, pump still on its curve
    if has["ps"] and pz["sys_ps"] < -T["clog"] and pz["head"] > -T["head"] and not cavitating and not bad_pressure:
        ev = f"suction pressure {-_v(s, 'res_sys_ps'):.1f} kPa below normal for {_v(s, 'q_best'):.0f} m3/h (z={pz['sys_ps']:+.1f}); head still on the pump curve"
        if vfd:
            ev += f"; speed z={z['n']:+.1f}, power z={z['pw']:+.1f}"
        if pd.notna(sigma):
            ev += f"; NPSH margin {sigma:.1f}"
        hyps.append(Hyp("SUCTION_STRAINER_CLOGGING", "MACHINE", -pz["sys_ps"], ev[0].upper() + ev[1:] + "."))
    # no suction transmitter but a drive: implied suction pressure falls while speed and power rise
    if not has["ps"] and vfd and pz["apps"] < -T["clog"] and (z["n"] > T["quiet"] or z["pw"] > T["quiet"]):
        hyps.append(Hyp("SUCTION_STRAINER_CLOGGING", "MACHINE", -pz["apps"],
                        f"Suction pressure implied by the pump curve {-_v(s, 'res_apps'):.1f} kPa below normal (z={pz['apps']:+.1f}) with speed z={z['n']:+.1f} and power z={z['pw']:+.1f}."))
    # restriction: discharge above its system curve at this flow, load down
    if has["pd"] and pz["sys_pd"] > T["restr"] and (pz["pw"] < -T["quiet"] or z["pw"] < -T["quiet"] or z["i"] < -T["quiet"] or z["q"] < -T["quiet"]) and not cavitating and not bad_pressure:
        hyps.append(Hyp("DISCHARGE_RESTRICTION", "MACHINE", pz["sys_pd"],
                        f"Discharge pressure {_v(s, 'res_sys_pd'):.1f} kPa above normal for {_v(s, 'q_best'):.0f} m3/h (z={pz['sys_pd']:+.1f}) while power z={z['pw']:+.1f}, current z={z['i']:+.1f}, flow z={z['q']:+.1f}."))
    # fixed speed with a flow meter: flow and power fall while the discharge pressure does not (system resistance up)
    if not vfd and has["q"] and has["pd"] and z["q"] < -T["clog"] and z["pw"] < -T["quiet"] and pz["sys_pd"] > 1.0 and pz["sys_ps"] > -T["quiet"] and pz["head"] > -T["quiet"] and not cavitating:
        hyps.append(Hyp("DISCHARGE_RESTRICTION", "MACHINE", -z["q"] / 2,
                        f"Flow {_val(s, 'q'):.0f} m3/h (z={z['q']:+.1f}) and power (z={z['pw']:+.1f}) fell at fixed speed while discharge pressure rose (z={pz['sys_pd']:+.1f}) and suction is normal: the system resistance has increased."))
    # fixed-speed legacy pump (discharge pressure and current only)
    if not has["ps"] and not vfd and has["pd"] and has["i"]:
        if z["pd"] > T["restr"] and z["i"] < -T["quiet"]:
            hyps.append(Hyp("DISCHARGE_RESTRICTION", "MACHINE", z["pd"], f"{_fmt(s, 'pd', z['pd'])} up while {_fmt(s, 'i', z['i'])} is down: flow is being throttled."))
        if z["pd"] < -T["quiet"] and z["i"] < -T["quiet"]:
            hyps.append(Hyp("IMPELLER_WEAR", "MACHINE", min(-z["pd"], -z["i"]), f"{_fmt(s, 'pd', z['pd'])} and {_fmt(s, 'i', z['i'])} both below normal at fixed speed: the pump delivers less head."))
    # head below the pump curve (or the meter and the head both say more flow than the power does), no cavitation:
    # sudden = air in the liquid, slow = impeller wear
    off_curve = pz["head"] < -T["head"]
    power_low = (pz["qx"] > T["flow_disagree"] and (not has["q"] or pz["q"] > T["flow_disagree"]) and abs(pz["i"]) < T["quiet"] and pz["head"] < -1.5)
    if has["ps"] and has["pd"] and (off_curve or power_low) and not cavitating and not bad_pressure:
        rise = _v(s, "rise_head", 1e6)
        sudden = rise < T["sudden_head_min"]
        ev = f"Head {-_v(s, 'res_head'):.1f} m below the pump curve at {_v(s, 'q_best'):.0f} m3/h (z={pz['head']:+.1f}); power says {-_v(s, 'res_qx'):+.0f} m3/h less flow than the head does; NPSH margin {sigma:.1f} is fine"
        ev += f"; suction pressure z={pz['sys_ps']:+.1f}; " if pz["sys_ps"] < -T["quiet"] else "; "
        ev += f"appeared {rise / 60:.1f} h ago" if sudden else f"has been growing for {rise / 60:.0f} h"
        hyps.append(Hyp("AIR_ENTRAINMENT" if sudden else "IMPELLER_WEAR", "MACHINE", max(-pz["head"], pz["qx"] / 2), ev + "."))

    # ---- vibration and temperature ------------------------------------------------------------------------------------------
    if not cavitating and (z["a"] > T["accel"] or z["c"] > T["crest"]):
        ev = f"{_fmt(s, 'a', z['a'])}, {_fmt(s, 'c', z['c'])}, {_fmt(s, 'v', z['v'])}, {_fmt(s, 'bt', z['bt'])}: high-frequency energy first, typical of a rolling-bearing defect."
        hyps.append(Hyp("BEARING_WEAR", "MACHINE", max(z["a"], z["c"]), ev))
    if z["v"] > T["vib"] and z["a"] < T["accel"] and not cavitating:
        rise = _v(s, "rise_v", 0.0)
        after_restart = (s["since_lockout"] - rise) < T["lockout_h"] * 60
        warm = z["bt"] > T["misalign_temp"] or z["wt"] > T["misalign_temp"]
        if after_restart:
            ev = f"{_fmt(s, 'v', z['v'])} stepped up {rise / 60:.1f} h ago, within {(s['since_lockout'] - rise) / 60:.0f} h of a maintenance restart, without acceleration rise (z={z['a']:+.1f}); bearing temp z={z['bt']:+.1f}."
            hyps.append(Hyp("MISALIGNMENT", "MACHINE", z["v"] + (2 if warm else 0), ev))
        else:
            ev = f"{_fmt(s, 'v', z['v'])} rising over {rise / 60:.1f} h with no acceleration rise (z={z['a']:+.1f}) and no recent reassembly: 1x unbalance, e.g. fouled impeller."
            hyps.append(Hyp("IMBALANCE", "MACHINE", z["v"], ev))

    hyps.sort(key=lambda h: -h.strength)
    return hyps


def _step_or_drift(s, k, strength):
    """A calibration shift arrives in one move; a drift creeps up over hours."""
    rise = _v(s, f"rise_{k}", 0.0)
    jump = _v(s, f"jump_{k}", 0.0)
    if jump >= T["step_share"] * strength and rise <= 180:
        return "SENSOR_CALIBRATION_SHIFT", f"stepped in one move {rise:.0f} min ago"
    return "SENSOR_DRIFT", f"has drifted for {rise / 60:.1f} h"


def _sensor_alone(s, a, has, z, pz) -> list[Hyp]:
    out = []
    machine_vib = z["a"] > T["accel"] or z["v"] > T["vib"] or z["c"] > T["crest"]
    warm = s["since_stop"] > 120           # temperatures need two hours after a restart before they mean anything
    # flow meter against the two physics estimates (head and power); heavy vibration adds friction power, so skip then
    if has["q"] and abs(pz["q"]) > T["flow_disagree"] and abs(pz["qx"]) < T["quiet"] and abs(pz["head"]) < T["head"] and not machine_vib:
        ft, how = _step_or_drift(s, "q", abs(pz["q"]))
        out.append(Hyp(ft, "SENSOR", abs(pz["q"]), f"Flow meter {_v(s, 'res_q'):+.0f} m3/h off the flow implied by power and by head, which agree with each other; it {how}.", {"channel": "q"}))
    # one pressure transmitter off its system curve while the load side is normal
    for k in ("ps", "pd"):
        key = f"sys_{k}"
        other = "sys_pd" if k == "ps" else "sys_ps"
        if has[k] and abs(pz[key]) > T["alone"] and abs(pz[other]) < T["quiet"] and abs(pz["pw"]) < T["quiet"] and abs(pz["q"]) < T["quiet"] and abs(z["n"]) < T["quiet"]:
            if k == "ps" and pz[key] < 0:
                continue        # low suction is a clog, handled above
            if k == "pd" and pz[key] > 0 and (z["pw"] < -T["quiet"] or z["i"] < -T["quiet"]):
                continue        # that is a restriction
            ft, how = _step_or_drift(s, k, abs(pz[key]))
            out.append(Hyp(ft, "SENSOR", abs(pz[key]), f"{LABEL[k].capitalize()} {_v(s, f'res_{key}'):+.1f} kPa from normal for this flow while flow, power, speed and the other pressure are normal; it {how}.", {"channel": k}))
    # legacy pump: discharge pressure moves while current does not
    if has["pd"] and not has["ps"] and abs(z["pd"]) > T["alone"] and abs(z["i"]) < 3.0 and abs(z["n"]) < T["quiet"]:
        ft, how = _step_or_drift(s, "pd", abs(z["pd"]))
        out.append(Hyp(ft, "SENSOR", abs(z["pd"]), f"{_fmt(s, 'pd', z['pd'])} moved while motor current (z={z['i']:+.1f}) did not; it {how}.", {"channel": "pd"}))
    # current against power, power against flow/head
    if has["i"] and has["pw"] and abs(pz["i"]) > T["alone"] and abs(pz["pw"]) < T["quiet"] and abs(z["pw"]) < T["quiet"] and not machine_vib:
        ft, how = _step_or_drift(s, "i", abs(pz["i"]))
        out.append(Hyp(ft, "SENSOR", abs(pz["i"]), f"Motor current {_v(s, 'res_i'):+.1f} A off the value implied by motor power, which is normal; it {how}.", {"channel": "i"}))
    if has["i"] and not has["pw"] and abs(z["i"]) > T["alone"] and abs(z["pd"]) < T["quiet"] and abs(pz["sys_pd"]) < T["quiet"] and not machine_vib:
        ft, how = _step_or_drift(s, "i", abs(z["i"]))
        out.append(Hyp(ft, "SENSOR", abs(z["i"]), f"{_fmt(s, 'i', z['i'])} moved while the pressures did not; it {how}.", {"channel": "i"}))
    if has["pw"] and abs(pz["qx"]) > T["flow_disagree"] and abs(pz["i"]) > T["alone"] and abs(pz["qm"]) < T["quiet"] and abs(pz["head"]) < 1.5 and not machine_vib:
        ft, how = _step_or_drift(s, "pw", abs(pz["pw"]))
        out.append(Hyp(ft, "SENSOR", abs(pz["pw"]), f"Motor power {_v(s, 'res_pw'):+.1f} kW off the value implied by flow and head while current disagrees with it too; it {how}.", {"channel": "pw"}))
    # temperatures: a lone temperature move with calm vibration and load is an instrument problem
    for k, coupled in (("bt", ("v", "a", "wt", "tf")), ("tf", ("bt", "pw", "i")), ("wt", ("i", "pw", "bt"))):
        thr = 8.0 if k == "tf" else T["alone"]      # liquid temperature follows the sea or basin, so demand more of it
        if has[k] and abs(z[k]) > thr and not machine_vib and warm and all(abs(z[c]) < T["quiet"] for c in coupled if has[c]):
            ft, how = _step_or_drift(s, k, abs(z[k]))
            out.append(Hyp(ft, "SENSOR", abs(z[k]) * 0.8, f"{_fmt(s, k, z[k])} moved while vibration and load stayed normal; it {how}.", {"channel": k}))
    return out


HYDRAULIC = {"SUCTION_STRAINER_CLOGGING", "DISCHARGE_RESTRICTION", "AIR_ENTRAINMENT", "IMPELLER_WEAR"}


def case_key(h: Hyp) -> str:
    """Alerts are tracked per case: a machine fault type, or one instrument (whatever it does: step, drift, noise)."""
    if h.cls == "SENSOR" and h.extra.get("channel"):
        return "SENSOR:" + h.extra["channel"]
    return h.fault


def diagnose(s: pd.Series, a: pd.Series, recent: dict | None = None, reminder_h: float = 24.0, suppress: set | None = None) -> dict:
    """Pick the alert to raise. `recent` maps fault_type -> last time it was named on this asset.
    `suppress` drops hypotheses of those types (e.g. hydraulic ones while a pressure transmitter is known to be bad)."""
    hyps = [h for h in hypotheses(s, a) if not suppress or h.fault not in suppress]
    pick = None
    if hyps:
        pick = hyps[0]
        if recent and case_key(pick) in recent and (s["t"] - recent[case_key(pick)]) < pd.Timedelta(hours=reminder_h):
            fresh = [h for h in hyps[1:] if case_key(h) not in recent or (s["t"] - recent[case_key(h)]) >= pd.Timedelta(hours=reminder_h)]
            if fresh and fresh[0].strength >= T["promote"] and fresh[0].strength >= 0.4 * hyps[0].strength:
                pick = fresh[0]
                pick.evidence = f"New finding while the {hyps[0].fault.replace('_', ' ').lower()} alert is still open: " + pick.evidence
    if pick is None:
        top = sorted(((abs(v), k) for k, v in s.items() if k.startswith(("pz_", "z_")) and pd.notna(v)), reverse=True)[:3]
        ev = "No clear physical pattern. Largest deviations: " + ", ".join(f"{k} z={v:.1f}" for v, k in top) + "."
        pick = Hyp("UNKNOWN", "MACHINE", min(s.get("zmax", 0.0), 6.0), ev)
    rows = evidence_channels(s, pick)
    conf = float(np.clip(0.35 + 0.06 * min(pick.strength, 10.0), 0.3, 0.95))
    if pick.fault == "UNKNOWN":
        conf = 0.3
    return {"event_class": pick.cls, "fault_type": pick.fault, "confidence": round(conf, 2), "evidence": pick.evidence,
            "recommended_action": ACTION[pick.fault], "case": case_key(pick),
            "channels": rows, "sensor_check": sensor_check(s, pick, rows), "what_would_settle_it": SETTLE[pick.fault],
            "hypotheses": [{"event_class": h.cls, "fault_type": h.fault, "strength": round(h.strength, 1)} for h in hyps[:3]]}
