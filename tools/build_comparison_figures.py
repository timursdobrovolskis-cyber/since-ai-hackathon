#!/usr/bin/env python3
"""Redraw the organizers' event figures with the baseline's alerts (orange) and ours (green) on top.

  .venv/bin/python tools/build_comparison_figures.py      -> docs/figures/cmp_*.png

Uses the organizers' own plotting helpers (examples/make_figures.py, MIT) so the pictures match the documentation.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("RETROFIT_DATA_ROOT", REPO.parent / "RETROFIT_AI_PARTICIPANTS_2026"))
sys.path.insert(0, str(ROOT / "examples"))
sys.path.insert(0, str(ROOT / "src"))
import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
from make_figures import ALARM, INK, INK2, S1, S2, S3, SURF, events, minute, shade, stamp, tele  # noqa: E402

D = str(ROOT / "data" / "full")
OUT = REPO / "docs" / "figures"
B1_COL, TEAM_COL = "#eb6834", "#0f6e56"
SHORT = {"SUCTION_STRAINER_CLOGGING": "clog", "DISCHARGE_RESTRICTION": "restr", "BEARING_WEAR": "bearing", "CAVITATION": "cavit",
         "MISALIGNMENT": "misalign", "IMBALANCE": "imbal", "IMPELLER_WEAR": "impeller", "AIR_ENTRAINMENT": "air",
         "SENSOR_DRIFT": "drift", "SENSOR_STUCK": "stuck", "SENSOR_CALIBRATION_SHIFT": "calib", "SENSOR_NOISE_SPIKES": "spikes",
         "COMMUNICATION_LOSS": "comm", "UNKNOWN": "unknown"}


def load_alerts():
    b1 = pd.read_csv(REPO / "detector" / "results" / "predictions_B1_all.csv")
    team = pd.read_csv(REPO / "team_alerts.csv")
    for p in (b1, team):
        p["t"] = pd.to_datetime(p["alert_time_utc"], utc=True)
    return b1, team


def overlay(ax, b1, team, aid, label_first_only=True):
    """Alert markers along the top of an axis: baseline row above, team row below it. Adds headroom so they clear the data."""
    lo, hi = ax.get_ylim()
    ax.set_ylim(lo, hi + 0.45 * (hi - lo))
    y1, y0 = 0.93, 0.80
    for p, col, y, name in ((b1, B1_COL, y1, "B1"), (team, TEAM_COL, y0, "team")):
        q = p[p.asset_id == aid].sort_values("t")
        seen = set()
        for r in q.itertuples():
            ax.annotate("", (r.t, y), xycoords=("data", "axes fraction"), xytext=(0, 0), textcoords="offset points",
                        arrowprops=None, annotation_clip=False)
            ax.plot([r.t], [y], marker="v", color=col, ms=7, transform=ax.get_xaxis_transform(), clip_on=False, zorder=5)
            key = r.fault_type
            if not label_first_only or key not in seen:
                ax.annotate(SHORT.get(r.fault_type, r.fault_type.lower()), (r.t, y), xycoords=("data", "axes fraction"), xytext=(0, 5),
                            textcoords="offset points", ha="center", va="bottom", fontsize=6.5, color=col, zorder=6, annotation_clip=False)
                seen.add(key)


def mark_detectable(ax, ev, aid):
    for e in ev[ev.asset_id == aid].itertuples():
        if pd.notna(e.detectable_utc):
            ax.axvline(e.detectable_utc, color=INK2, lw=0.6, ls=":", zorder=1)


def legend_text(fig):
    fig.text(0.01, 0.005, "triangles: alerts, orange = organizers' baseline B1, green = team detector (first alert of each cause labelled); dotted = earliest detectable per the labels",
             ha="left", va="bottom", fontsize=7, color=INK2)


def fig_clog(ev, b1, team):
    t = tele(D, "PUMP-06", ["suction_pressure_kpa", "discharge_pressure_kpa", "vibration_accel_rms_g"])
    wend = t.index.max()
    fig, axs = plt.subplots(3, 1, figsize=(9, 5.6), sharex=True)
    for ax, (c, lab, col) in zip(axs, [("suction_pressure_kpa", "Suction\n[kPa(g)]", S1), ("discharge_pressure_kpa", "Discharge\n[kPa(g)]", S2),
                                       ("vibration_accel_rms_g", "Accel. RMS [g]\n(wireless, 5 min)", S3)]):
        y = t[c].where(t["operating_mode"].astype(str) == "RUNNING")
        y = y.resample("10min").mean() if c != "vibration_accel_rms_g" else y.dropna()
        ax.plot(y.index, y.values, color=col, lw=1.2 if c != "vibration_accel_rms_g" else 0, marker="." if c == "vibration_accel_rms_g" else None, ms=3)
        ax.set_ylabel(lab)
        shade(ax, ev, "PUMP-06", ["SUCTION_STRAINER_CLOGGING"], wend)
        for e in ev[(ev.asset_id == "PUMP-06") & (ev.fault_type == "CAVITATION")].itertuples():
            ax.axvspan(e.onset_utc, e.end_utc, color="#a9a59a", alpha=0.55, lw=0, zorder=0)
    mark_detectable(axs[0], ev, "PUMP-06")
    overlay(axs[0], b1, team, "PUMP-06")
    axs[0].set_title("PUMP-06 hot process-water pump: strainer clogging develops into cavitation\n"
                     "light grey = clogging event, dark grey = cavitation episodes, red dashed = action deadline", loc="left")
    axs[-1].xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    legend_text(fig)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(OUT / "cmp02_clogging_to_cavitation_PUMP-06.png", dpi=150)
    plt.close(fig)


def fig_bearing(ev, b1, team):
    t = tele(D, "PUMP-04", ["vibration_rms_mm_s", "vibration_accel_rms_g", "bearing_temp_c"])
    a = pd.read_csv(os.path.join(D, "assets.csv")).set_index("asset_id").loc["PUMP-04"]
    al = pd.read_csv(os.path.join(D, "alarms.csv"))
    al = al[(al.asset_id == "PUMP-04") & al.tag.str.startswith("vibration")]
    wend = t.index.max()
    fig, axs = plt.subplots(3, 1, figsize=(9, 5.6), sharex=True)
    for ax, (c, lab, col) in zip(axs, [("vibration_rms_mm_s", "Velocity RMS\n[mm/s]", S1), ("vibration_accel_rms_g", "Accel. RMS\n[g]", S2),
                                       ("bearing_temp_c", "Bearing temp.\n[°C]", S3)]):
        y = minute(t, c)
        ax.plot(y.index, y.values, color=col)
        ax.set_ylabel(lab)
        shade(ax, ev, "PUMP-04", ["BEARING_WEAR"], wend)
    axs[0].axhline(a.vibration_alarm_mm_s, color=INK2, lw=0.8, ls=":")
    axs[0].set_ylim(top=a.vibration_alarm_mm_s * 1.15)
    axs[0].text(t.index.max(), a.vibration_alarm_mm_s, f"ISO 10816-7 Cat. II alarm {a.vibration_alarm_mm_s} mm/s ", ha="right", va="bottom", color=INK2, fontsize=8)
    for r in al.itertuples():
        axs[0].axvline(pd.Timestamp(r.raised_utc), color=ALARM, lw=0.8)
    overlay(axs[1], b1, team, "PUMP-04")
    axs[0].set_title("PUMP-04 cooling-tower pump: bearing wear (acceleration rises first), imbalance in parallel\n"
                     "grey = bearing-wear event, red dashed = action deadline, violet = SCADA vibration alarms", loc="left", fontsize=9.5)
    axs[-1].xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    legend_text(fig)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(OUT / "cmp03_bearing_wear_PUMP-04.png", dpi=150)
    plt.close(fig)


def fig_sensor_vs_machine(ev, b1, team):
    t = tele(D, "PUMP-03", ["discharge_pressure_kpa", "motor_current_a"])
    wend = t.index.max()
    fig, axs = plt.subplots(2, 1, figsize=(9, 5.0), sharex=True)
    for ax, (c, lab, col) in zip(axs, [("discharge_pressure_kpa", "Discharge\n[kPa(g)]", S1), ("motor_current_a", "Motor current\n[A]", S2)]):
        y = minute(t, c)
        ax.plot(y.index, y.values, color=col)
        ax.set_ylabel(lab)
        shade(ax, ev, "PUMP-03", ["DISCHARGE_RESTRICTION", "SENSOR_CALIBRATION_SHIFT"], wend)
    e = ev[(ev.asset_id == "PUMP-03")].set_index("fault_type")
    for ft, lab in (("DISCHARGE_RESTRICTION", "machine: restriction\npressure up, current down"), ("SENSOR_CALIBRATION_SHIFT", "sensor: calibration shift\npressure up, current unchanged")):
        x = e.loc[ft, "onset_utc"]
        axs[1].annotate(lab, (x, 0.04), xycoords=("data", "axes fraction"), xytext=(10, 0), textcoords="offset points", va="bottom", fontsize=8, color=INK,
                        bbox=dict(boxstyle="round,pad=0.3", fc=SURF, ec="#e4e3df", lw=0.6))
    mark_detectable(axs[0], ev, "PUMP-03")
    overlay(axs[0], b1, team, "PUMP-03")
    axs[0].set_title("PUMP-03 legacy (T0) fresh-water pump: machine fault vs instrument fault\nboth raise discharge pressure; only the machine fault moves motor current", loc="left")
    axs[-1].xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    legend_text(fig)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(OUT / "cmp04_sensor_vs_machine_PUMP-03.png", dpi=150)
    plt.close(fig)


def fig_timeline(ev, b1, team):
    aid = "PUMP-08"
    t = tele(D, aid, ["suction_pressure_kpa"])
    al = pd.read_csv(os.path.join(D, "alarms.csv")); al = al[al.asset_id == aid]
    mt = pd.read_csv(os.path.join(D, "maintenance.csv")); mt = mt[(mt.asset_id == aid) & mt.in_window]
    e = ev[ev.asset_id == aid]
    fig, axs = plt.subplots(2, 1, figsize=(9, 5.8), sharex=True, gridspec_kw={"height_ratios": [1.5, 2.5]})
    y = minute(t, "suction_pressure_kpa")
    axs[0].plot(y.index, y.values, color=S1)
    axs[0].set_ylabel("Suction pressure [kPa(g)]")
    ax = axs[1]
    es = e.sort_values("onset_utc").reset_index(drop=True)
    lanes = {"Team detector alerts": 4, "Baseline B1 alerts": 3, "SCADA alarms": 2, "Work orders": 1, "Pump stopped": 0}
    ev_lanes = {}
    for k, r in es.iterrows():
        y0 = 5 + (len(es) - 1 - k)
        ev_lanes[r.fault_type.replace("_", " ").lower()] = y0
        end = r.end_utc if pd.notna(r.end_utc) else t.index.max()
        ax.barh(y0, (end - r.onset_utc).total_seconds() / 86400, left=r.onset_utc, height=0.55, color="#b9b5aa", edgecolor=SURF)
        if pd.notna(r.action_deadline_utc):
            ax.plot(r.action_deadline_utc, y0, marker="|", color="#e34948", ms=12, mew=1.5)
    lanes = {**{f"event: {k}": v for k, v in ev_lanes.items()}, **lanes}
    for p, col, lane in ((b1, S2, "Baseline B1 alerts"), (team, TEAM_COL, "Team detector alerts")):
        seen = set()
        for r in p[p.asset_id == aid].sort_values("t").itertuples():
            ax.plot(r.t, lanes[lane], marker="v", color=col, ms=8)
            if r.fault_type not in seen:
                ax.annotate(SHORT.get(r.fault_type, "?"), (r.t, lanes[lane]), xytext=(0, 6), textcoords="offset points", ha="center", fontsize=6.5, color=col)
                seen.add(r.fault_type)
    for r in al.itertuples():
        ax.plot(pd.Timestamp(r.raised_utc), lanes["SCADA alarms"], marker="o", color=ALARM, ms=6)
    for r in mt.itertuples():
        ax.plot(pd.Timestamp(r.start_utc), lanes["Work orders"], marker="s", color=S3, ms=7)
    stopped = (t["operating_mode"].astype(str) != "RUNNING").resample("10min").mean() > 0.5
    ax.fill_between(stopped.index, -0.25, 0.25, where=stopped.values, color=INK2, step="post", lw=0)
    ax.set_yticks(list(lanes.values()), list(lanes.keys()))
    ax.set_ylim(-0.6, max(lanes.values()) + 0.8)
    ax.grid(axis="y", visible=False)
    axs[0].set_title(f"{aid} operator timeline (validation pump): events grey, red tick = deadline,\n"
                     "team alerts green, baseline orange, plant alarms violet, work orders squares", loc="left")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    stamp(fig, "validation split")
    fig.tight_layout()
    fig.savefig(OUT / "cmp06_operator_timeline_PUMP-08.png", dpi=150)
    plt.close(fig)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ev = events(D)
    b1, team = load_alerts()
    fig_clog(ev, b1, team)
    fig_bearing(ev, b1, team)
    fig_sensor_vs_machine(ev, b1, team)
    fig_timeline(ev, b1, team)
    print("figures written to", OUT)


if __name__ == "__main__":
    main()
