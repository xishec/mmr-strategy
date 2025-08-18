#!/usr/bin/env python3
"""Regenerate TQQQ.json using enhanced simulation logic for pre-launch period.

Workflow:
 1. Load existing QQQ.json (must exist) and ensure rates are present.
 2. Load existing TQQQ.json if available (used for real data from 2010-02-11 onward).
 3. Simulate pre-launch TQQQ (dates < LAUNCH_DATE) using simulate_tqqq_from_qqq with expense ratio + volatility drag.
 4. Scale real TQQQ segment so its first open matches the last simulated close (continuity) using adjust_real_tqqq_to_simulated.
 5. Merge simulated + adjusted real segments and recompute overnight/day/combined rates across full series.
 6. Overwrite TQQQ.json (backup optional via --backup flag).

Optional flags:
  --no-adjust   Skip scaling of real data to simulated close.
  --simulate-all  Ignore real data; produce a fully simulated series.
  --backup      Create a timestamped backup of existing TQQQ.json before overwriting.

Note: This script does NOT re-download any data; it only uses existing local JSON files.
"""
from __future__ import annotations
import argparse
import json
import os
from datetime import datetime

# Local imports from existing module
from download_complete_data import (
    simulate_tqqq_from_qqq,
    adjust_real_tqqq_to_simulated,
    merge_and_calculate,
)

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
DATA_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))  # src/data
ROOT_DIR = os.path.abspath(os.path.join(DATA_DIR, "..", ".."))
QQQ_PATH = os.path.join(DATA_DIR, "QQQ.json")
TQQQ_PATH = os.path.join(DATA_DIR, "TQQQ.json")
LAUNCH_DATE = "2010-02-11"  # Official TQQQ inception


def load_json(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)


def ensure_rates(data: dict) -> dict:
    """Ensure dataset has overnight/day/combined rates. If missing, compute."""
    if not data:
        return {}
    sample = next(iter(data.values()))
    needed = any(k not in sample for k in ("overnight_rate", "day_rate", "rate"))
    if not needed:
        return data
    # Compute using similar logic as merge_and_calculate (expects open/close)
    print("ℹ️  QQQ data missing rate fields – recalculating.")
    return merge_and_calculate(data)


def recalc_rates_full(data: dict) -> dict:
    if not data:
        return {}
    dates = sorted(data.keys())
    prev_close = None
    for d in dates:
        o = data[d]["open"]
        c = data[d]["close"]
        if prev_close is None:
            overnight = 0.0
            combined = 0.0
        else:
            overnight = (o / prev_close - 1) * 100 if prev_close > 0 else 0.0
            combined = (c / prev_close - 1) * 100 if prev_close > 0 else 0.0
        day_rate = (c / o - 1) * 100 if o > 0 else 0.0
        data[d]["overnight_rate"] = round(overnight, 6)
        data[d]["day_rate"] = round(day_rate, 6)
        data[d]["rate"] = round(combined, 6)
        prev_close = c
    return {d: data[d] for d in dates}


def main():
    parser = argparse.ArgumentParser(description="Regenerate TQQQ.json using enhanced simulation")
    parser.add_argument("--no-adjust", action="store_true", help="Do not scale real data to simulated close continuity")
    parser.add_argument("--simulate-all", action="store_true", help="Ignore real data; produce fully simulated series")
    parser.add_argument("--backup", action="store_true", help="Create backup of existing TQQQ.json")
    parser.add_argument("--starting-price", type=float, default=None, help="Override starting simulated close price")
    parser.add_argument("--leverage", type=float, default=3.0, help="Leverage multiple (default 3.0)")
    parser.add_argument("--expense-ratio", type=float, default=0.0095, help="Annual expense ratio (default 0.0095 = 0.95%)")
    parser.add_argument("--borrow-cost", type=float, default=0.01, help="Additional annual borrow/financing cost (default 0.01 = 1%)")
    parser.add_argument("--extra-drift", type=float, default=0.0, help="Extra daily drift adjustment (decimal, e.g. -0.00005)")
    args = parser.parse_args()

    print("🔄 Regenerating TQQQ dataset")
    print(f"📁 Data directory: {DATA_DIR}")

    # Load datasets
    qqq_data = load_json(QQQ_PATH)
    if not qqq_data:
        print(f"❌ QQQ data not found at {QQQ_PATH}. Aborting.")
        return 1
    qqq_data = ensure_rates(qqq_data)

    real_tqqq = load_json(TQQQ_PATH)
    if real_tqqq:
        print(f"📊 Loaded existing real TQQQ segment: {min(real_tqqq.keys())} → {max(real_tqqq.keys())} ({len(real_tqqq)} days)")
    else:
        print("⚠️  No existing real TQQQ data found.")

    # Partition QQQ for simulation
    early_qqq = {d: qqq_data[d] for d in qqq_data if d < LAUNCH_DATE}
    print(f"🛠  Simulating pre-launch period: {len(early_qqq)} days (< {LAUNCH_DATE})")

    simulated_pre = simulate_tqqq_from_qqq(
        early_qqq,
        leverage=args.leverage,
        annual_expense_ratio=args.expense_ratio,
        starting_price=args.starting_price,
        calibrate_with_real=real_tqqq if real_tqqq else None,
        calibration_method="trimmed",
        trim_fraction=0.05,
        max_abs_tracking_error=0.0002,
        additional_annual_borrow_cost=args.borrow_cost,
        extra_daily_drift=args.extra_drift,
    )
    if simulated_pre:
        print(f"✅ Simulated pre-launch TQQQ: {min(simulated_pre.keys())} → {max(simulated_pre.keys())} ({len(simulated_pre)} days)")
    else:
        print("❌ Simulation produced no data – aborting.")
        return 1

    # Decide on real portion usage
    if args.simulate_all or not real_tqqq:
        combined = simulated_pre
        print("ℹ️  Using purely simulated dataset (no real data appended).")
    else:
        # Use only post-launch real data
        real_post = {d: real_tqqq[d] for d in real_tqqq if d >= LAUNCH_DATE}
        print(f"📈 Real post-launch segment: {min(real_post.keys())} → {max(real_post.keys())} ({len(real_post)} days)")
        if args.no_adjust:
            adjusted_real = real_post
            print("ℹ️  Skipping continuity scaling (--no-adjust).")
        else:
            adjusted_real = adjust_real_tqqq_to_simulated(simulated_pre, real_post)
        combined = {**simulated_pre, **adjusted_real}

    # Recalculate rates across full combined series for consistency
    combined = recalc_rates_full(combined)

    # Optional backup
    if os.path.exists(TQQQ_PATH) and args.backup:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = TQQQ_PATH + f".backup.{ts}"
        with open(backup_path, "w") as f:
            json.dump(load_json(TQQQ_PATH), f, indent=2)
        print(f"💾 Backup created: {backup_path}")

    # Save
    with open(TQQQ_PATH, "w") as f:
        json.dump(combined, f, indent=2)
    print(f"✅ Regenerated TQQQ saved: {min(combined.keys())} → {max(combined.keys())} ({len(combined)} days)")

    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
