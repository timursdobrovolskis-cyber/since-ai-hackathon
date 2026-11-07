#!/usr/bin/env python3
"""Score any predictions CSV on train and validation (and both together) with the official scorer, in one table.

  python detector/score_all.py detector/results/predictions_B1_all.csv [more.csv ...] [--confusion] [--md out.md]

Each file may hold alerts for any pumps; test pumps are ignored because they have no labels. The confusion table shows,
for every scored event, the fault type that the detecting alert named (or MISSED).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from detector.common import LABELLED, load_assets, load_benign, load_events  # noqa: E402
from retrofit_sim.scoring import FAULT_TYPES, score  # noqa: E402

COLUMNS = [("composite_score", "Composite", 1), ("event_f1", "F1", 2), ("event_recall", "Recall", 2),
           ("alert_precision", "Precision", 2), ("fault_type_recall", "Type recall", 2), ("class_recall", "Class recall", 2),
           ("timeliness", "Timeliness", 2), ("false_alerts_per_asset_day", "False+excess/day", 2),
           ("events_scored", "Events", 0), ("true_positive_events", "Caught", 0)]
SHORT = {"SUCTION_STRAINER_CLOGGING": "CLOG", "DISCHARGE_RESTRICTION": "RESTRICT", "BEARING_WEAR": "BEARING", "CAVITATION": "CAVIT",
         "MISALIGNMENT": "MISALIGN", "IMBALANCE": "IMBAL", "IMPELLER_WEAR": "IMPELLER", "AIR_ENTRAINMENT": "AIR",
         "SENSOR_DRIFT": "S_DRIFT", "SENSOR_STUCK": "S_STUCK", "SENSOR_CALIBRATION_SHIFT": "S_CALIB", "SENSOR_NOISE_SPIKES": "S_SPIKE",
         "COMMUNICATION_LOSS": "COMM", "UNKNOWN": "UNKNOWN", "MISSED": "MISSED"}


def score_splits(pred: pd.DataFrame | str, assets=None, events=None, benign=None) -> dict:
    assets = load_assets() if assets is None else assets
    events = load_events() if events is None else events
    benign = load_benign() if benign is None else benign
    labelled = assets[assets["split"].isin(LABELLED)]
    out = {}
    for split in LABELLED:
        out[split] = score(pred, events, labelled, benign, split)
    out["both"] = score(pred, events, labelled, benign, None)
    return out


def table(results: dict[str, dict]) -> str:
    """results: {name: {split: report}} -> markdown table."""
    head = "| Predictions | Split | " + " | ".join(c[1] for c in COLUMNS) + " |"
    rows = [head, "|" + "---|" * (len(COLUMNS) + 2)]
    for name, by_split in results.items():
        for split in ("train", "validation", "both"):
            r = by_split[split]
            cells = []
            for key, _, nd in COLUMNS:
                v = r[key]
                cells.append("-" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) else str(v)))
            rows.append(f"| {name} | {split} | " + " | ".join(cells) + " |")
    return "\n".join(rows)


def confusion(by_split: dict) -> pd.DataFrame:
    """True fault type (rows) vs the type the detecting alert named (columns), over train + validation."""
    pe = pd.DataFrame(by_split["both"]["per_event"])
    pe["named"] = pe["predicted_fault_type"].fillna("MISSED")
    tab = pd.crosstab(pe["fault_type"].map(SHORT), pe["named"].map(lambda s: SHORT.get(s, s)))
    order = [SHORT[t] for t in ["BEARING_WEAR", "SUCTION_STRAINER_CLOGGING", "CAVITATION", "DISCHARGE_RESTRICTION", "MISALIGNMENT",
                                "IMBALANCE", "IMPELLER_WEAR", "AIR_ENTRAINMENT", "SENSOR_DRIFT", "SENSOR_STUCK",
                                "SENSOR_CALIBRATION_SHIFT", "SENSOR_NOISE_SPIKES", "COMMUNICATION_LOSS", "UNKNOWN", "MISSED"]]
    tab = tab.reindex(index=[o for o in order if o in tab.index], columns=[o for o in order if o in tab.columns]).fillna(0).astype(int)
    tab.index.name = "true \\ named"
    return tab


def md_table(tab: pd.DataFrame) -> str:
    cols = [str(tab.index.name or "")] + [str(c) for c in tab.columns]
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for idx, row in tab.iterrows():
        lines.append("| " + " | ".join([str(idx)] + [str(v) for v in row.values]) + " |")
    return "\n".join(lines)


def per_event_table(by_split: dict) -> str:
    pe = pd.DataFrame(by_split["both"]["per_event"])
    pe["named"] = pe["predicted_fault_type"].fillna("MISSED")
    pe["delay_h"] = pe["delay_after_detectable_h"].map(lambda v: "-" if pd.isna(v) else f"{v:+.1f}")
    pe["lead_h"] = pe["lead_time_to_deadline_h"].map(lambda v: "-" if pd.isna(v) else f"{v:+.1f}")
    pe["ok"] = pe["type_correct"].map({True: "yes", False: ""})
    cols = ["event_id", "fault_type", "named", "ok", "timeliness", "delay_h", "lead_h", "repeats"]
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for r in pe[cols].itertuples(index=False):
        lines.append("| " + " | ".join(f"{v:.2f}" if isinstance(v, float) else str(v) for v in r) + " |")
    return "\n".join(lines)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("predictions", nargs="+", help="Prediction CSV files (official submission format)")
    p.add_argument("--confusion", action="store_true", help="Also print the confusion table and per-event rows for each file")
    p.add_argument("--md", type=Path, help="Write the tables to this markdown file as well")
    a = p.parse_args(argv)
    assets, events, benign = load_assets(), load_events(), load_benign()
    results = {}
    blocks = []
    for path in a.predictions:
        name = Path(path).stem.replace("predictions_", "")
        results[name] = score_splits(path, assets, events, benign)
    blocks.append(table(results))
    if a.confusion:
        for name, by_split in results.items():
            blocks.append(f"\n### {name}: true fault type vs named type (train + validation)\n")
            blocks.append(md_table(confusion(by_split)))
            blocks.append(f"\n### {name}: per event\n")
            blocks.append(per_event_table(by_split))
    text = "\n".join(blocks)
    print(text)
    if a.md:
        a.md.write_text(text + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
