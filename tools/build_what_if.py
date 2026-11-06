#!/usr/bin/env python3
"""Pre-compute what-if results with the organizers' sandbox, so hosted and offline modes both work.

Run:  .venv/bin/python tools/build_what_if.py
Needs public/data/alerts.json from tools/build_ui_data.py. Rerun after swapping in new alerts.

Output (public/data/whatif/):
  index.json       which alerts have results, plus the sandbox caveats
  <alert_id>.json  results for each assumed severity

Severity levels below are OUR ASSUMPTIONS, chosen inside the sandbox's plausible ranges. They are not measurements
and not the simulator's hidden state. Sensor faults and UNKNOWN alerts are skipped: the sandbox models the machine,
so a sensor problem changes nothing in it, and an unclear cause gives it no condition to test.
"""
from __future__ import annotations

import json
import os
import sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("RETROFIT_DATA_ROOT", REPO.parent / "RETROFIT_AI_PARTICIPANTS_2026"))
sys.path.insert(0, str(ROOT / "src"))
DATA = str(ROOT / "data" / "full")
OUT = REPO / "public" / "data" / "whatif"

SEVERITIES = ("mild", "moderate", "severe")
# fault type: (sandbox key, plain name of that scale, mild, moderate, severe, condition-fixing or checking actions)
FAULTS = {
    "SUCTION_STRAINER_CLOGGING": ("clog", "clog level", 1.0, 2.5, 5.0, ["clean_strainer", "inspect"]),
    "CAVITATION": ("clog", "clog level", 2.5, 4.0, 5.5, ["clean_strainer", "inspect"]),
    "DISCHARGE_RESTRICTION": ("restriction", "resistance multiple", 1.3, 1.8, 2.6, ["inspect"]),
    "BEARING_WEAR": ("bearing_wear", "bearing wear level", 0.35, 0.6, 0.85, ["replace_bearing", "inspect"]),
    "MISALIGNMENT": ("misalignment", "misalignment level", 0.25, 0.5, 0.8, ["realign", "inspect"]),
    "IMBALANCE": ("unbalance", "imbalance level", 0.4, 0.9, 1.6, ["inspect"]),
    "IMPELLER_WEAR": ("impeller_wear", "head loss share", 0.03, 0.07, 0.12, ["inspect"]),
    "AIR_ENTRAINMENT": ("air_entrainment", "gas share", 0.005, 0.015, 0.035, ["inspect"]),
}
ACTION_LABEL = {
    "clean_strainer": "Clean the strainer",
    "replace_bearing": "Replace the bearing",
    "realign": "Realign the coupling",
    "inspect": "Inspect only",
}
KEEP = ["speed_ratio", "flow_m3h", "duty_satisfaction", "npsh_margin", "input_kw", "energy_eur_per_day", "risk_proxy",
        "vib_rms_mm_s", "bearing_temp_c"]


def keep(state: dict) -> dict:
    return {k: state.get(k) for k in KEEP}


def option(what_if, alert, action, value, label, hyp):
    r = what_if(DATA, alert["asset_id"], alert["alert_time_utc"], action, value, hyp, root=str(ROOT))
    i = r.get("intervention", {})
    allowed, reasons, warnings = r["accepted"], r["rejection_reasons"], r.get("warnings", [])
    if action == "inspect" and not allowed:
        # An inspection does not change the pump, so a problem the sandbox finds is the existing state, not a reason
        # to forbid looking at it. Show it as a warning instead of telling an engineer that inspecting is blocked.
        allowed, reasons, warnings = True, [], warnings + reasons
    return {
        "action": action, "label": label, "allowed": allowed, "reasons": reasons, "warnings": warnings,
        "proposed": keep(r["proposed"]) if "proposed" in r else None,
        "stopHours": i.get("stop_h"), "labourHours": i.get("labour_h"), "partsEur": i.get("parts_eur"), "costEur": i.get("estimated_cost_eur"),
    }


def run_alert(alert: dict) -> tuple[str, dict | None, list]:
    import retrofit_sim.sandbox as sandbox

    # Each sandbox call rereads the same large CSVs, so keep one copy per worker. The sandbox only filters them.
    if not hasattr(pd, "_uncached_read_csv"):
        pd._uncached_read_csv = pd.read_csv
        pd.read_csv = lru_cache(maxsize=4)(pd._uncached_read_csv)
    key, name, *levels, fixes = FAULTS[alert["fault_type"]]
    variable = None
    results, caveats = {}, []
    for severity, level in zip(SEVERITIES, levels):
        hyp = {key: level}
        now = sandbox.what_if(DATA, alert["asset_id"], alert["alert_time_utc"], "none", None, hyp, root=str(ROOT))
        if "baseline" not in now:
            return alert["alert_id"], {"unavailable": now["rejection_reasons"][0]}, []
        caveats = now["caveats"]
        speed = now["baseline"]["speed_ratio"] or 1.0
        variable = alert_control(alert)
        options = [option(sandbox.what_if, alert, a, None, ACTION_LABEL[a], hyp) for a in fixes]
        if variable:
            for step, verb in ((0.10, "Raise"), (0.30, "Raise"), (-0.15, "Lower")):
                target = round(speed + step, 2)
                options.append(option(sandbox.what_if, alert, "speed_setpoint", target, f"{verb} speed to {target * 100:.0f} %", hyp))
        else:
            options.append(option(sandbox.what_if, alert, "speed_setpoint", 0.8, "Slow the pump to 80 %", hyp))
        results[severity] = {"level": level, "now": keep(now["baseline"]), "warnings": now["warnings"], "options": options}
    return alert["alert_id"], {"assumption": {"name": name, "key": key}, "severities": results}, caveats


CONTROL = {}


def alert_control(alert: dict) -> bool:
    return CONTROL[alert["asset_id"]].startswith("VFD")


def init(control):
    CONTROL.update(control)


def main():
    alerts = json.loads((REPO / "public" / "data" / "alerts.json").read_text())["alerts"]
    assets = pd.read_csv(Path(DATA) / "assets.csv")
    control = dict(zip(assets.asset_id, assets.control))
    todo = [a for a in alerts if a["fault_type"] in FAULTS]
    print(f"{len(todo)} of {len(alerts)} alerts have a machine condition to test")
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    ids, caveats, blocked = [], [], 0
    with Pool(min(8, os.cpu_count() or 2), initializer=init, initargs=(control,)) as pool:
        for alert_id, result, cav in pool.imap_unordered(run_alert, todo):
            (OUT / f"{alert_id}.json").write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
            ids.append(alert_id)
            caveats = cav or caveats
            if result and "severities" in result:
                blocked += sum(not o["allowed"] for s in result["severities"].values() for o in s["options"])
    (OUT / "index.json").write_text(json.dumps({"alertIds": sorted(ids), "caveats": caveats}, indent=0, ensure_ascii=False), encoding="utf-8")
    size = sum(p.stat().st_size for p in OUT.glob("*.json"))
    print(f"wrote {len(ids)} alerts, {size / 1e3:.0f} kB, {blocked} options blocked by the sandbox")


if __name__ == "__main__":
    main()
