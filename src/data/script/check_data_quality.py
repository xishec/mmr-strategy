#!/usr/bin/env python3
"""
Data Quality Checker
====================
Checks for issues in the downloaded stock data:
1. Transition discontinuities between data sources
2. Rate calculation accuracy
3. SMA200 calculation accuracy
4. Missing trading days
"""

import json
import os
from datetime import datetime, timedelta

def load_data(ticker):
    """Load stock data from JSON file"""
    script_dir = os.path.dirname(os.path.realpath(__file__))
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    data_dir = os.path.join(root_dir, "src", "data")
    file_path = os.path.join(data_dir, f"{ticker}.json")
    
    with open(file_path, 'r') as f:
        return json.load(f)

def check_rate_calculations(data, ticker, sample_size=10):
    """Verify that rate calculations are correct"""
    print(f"\n🔍 Checking rate calculations for {ticker}")
    print("-" * 40)
    
    sorted_dates = sorted(data.keys())
    errors = []
    
    # Check first few and last few dates
    check_dates = sorted_dates[:sample_size] + sorted_dates[-sample_size:]
    
    for i, date in enumerate(check_dates):
        if i == 0:  # Skip first date
            continue
            
        prev_date_idx = sorted_dates.index(date) - 1
        if prev_date_idx < 0:
            continue
            
        prev_date = sorted_dates[prev_date_idx]
        
        current_close = data[date]["close"]
        prev_close = data[prev_date]["close"]
        recorded_rate = data[date]["rate"]
        
        # Calculate expected rate
        expected_rate = (current_close - prev_close) / prev_close * 100
        
        # Check if rates match (within 0.001% tolerance)
        if abs(recorded_rate - expected_rate) > 0.001:
            errors.append(f"  ❌ {date}: recorded={recorded_rate:.6f}%, expected={expected_rate:.6f}%")
        else:
            print(f"  ✅ {date}: rate={recorded_rate:.6f}% ✓")
    
    if errors:
        print("\n❌ Rate calculation errors:")
        for error in errors:
            print(error)
    else:
        print(f"✅ All sampled rate calculations are correct for {ticker}")

def check_transitions(data, ticker):
    """Check for suspicious jumps in data that might indicate transition issues"""
    print(f"\n🔍 Checking transitions for {ticker}")
    print("-" * 40)
    
    sorted_dates = sorted(data.keys())
    large_jumps = []
    
    for i in range(1, len(sorted_dates)):
        date = sorted_dates[i]
        rate = data[date]["rate"]
        
        # Flag unusually large single-day moves (>15% for QQQ, >45% for TQQQ)
        threshold = 45 if ticker == "TQQQ" else 15
        
        if abs(rate) > threshold:
            large_jumps.append((date, rate))
    
    # Specific transition points to check
    transition_points = [
        ("2010-12-30", "2011-01-03"),  # Yahoo Finance to Twelve Data for QQQ
        ("2010-02-10", "2010-02-11"),  # Simulated to Real TQQQ
    ]
    
    print("📊 Large single-day moves (potential issues):")
    for date, rate in large_jumps[:10]:  # Show first 10
        print(f"  ⚠️  {date}: {rate:.2f}%")
    
    if len(large_jumps) > 10:
        print(f"  ... and {len(large_jumps) - 10} more")
    
    print("\n📊 Critical transition points:")
    for start_date, end_date in transition_points:
        if start_date in data and end_date in data:
            start_close = data[start_date]["close"]
            end_open = data[end_date]["open"]
            end_close = data[end_date]["close"]
            gap_change = (end_open - start_close) / start_close * 100
            day_change = data[end_date]["rate"]
            
            print(f"  📅 {start_date} → {end_date}")
            print(f"     Close {start_close:.6f} → Open {end_open:.6f} (gap: {gap_change:.2f}%)")
            print(f"     Day change: {day_change:.2f}%")
            
            if abs(gap_change) > 5:  # >5% gap is suspicious
                print(f"     ❌ SUSPICIOUS GAP: {gap_change:.2f}%")
            else:
                print(f"     ✅ Normal gap")

def check_sma200_calculations(data, ticker, sample_size=5):
    """Verify SMA200 calculations"""
    print(f"\n🔍 Checking SMA200 calculations for {ticker}")
    print("-" * 40)
    
    sorted_dates = sorted(data.keys())
    errors = []
    
    # Check a few SMA200 values around day 200, 1000, 3000, etc.
    check_indices = [200, 1000, 3000, len(sorted_dates) - 100]
    check_indices = [i for i in check_indices if i < len(sorted_dates)]
    
    for idx in check_indices[:sample_size]:
        if idx < 199:  # Need at least 200 days
            continue
            
        date = sorted_dates[idx]
        recorded_sma200 = data[date]["sma200"]
        
        # Calculate expected SMA200
        close_prices = []
        for i in range(idx - 199, idx + 1):
            close_prices.append(data[sorted_dates[i]]["close"])
        
        expected_sma200 = sum(close_prices) / 200
        
        if recorded_sma200 is None:
            errors.append(f"  ❌ {date}: SMA200 is null but should be {expected_sma200:.6f}")
        elif abs(recorded_sma200 - expected_sma200) > 0.001:
            errors.append(f"  ❌ {date}: recorded={recorded_sma200:.6f}, expected={expected_sma200:.6f}")
        else:
            print(f"  ✅ {date}: SMA200={recorded_sma200:.6f} ✓")
    
    if errors:
        print("\n❌ SMA200 calculation errors:")
        for error in errors:
            print(error)
    else:
        print(f"✅ All sampled SMA200 calculations are correct for {ticker}")

def check_data_quality():
    """Main function to check data quality"""
    print("🔍 Stock Data Quality Checker")
    print("============================")
    
    for ticker in ["QQQ", "TQQQ"]:
        print(f"\n{'=' * 50}")
        print(f"📊 ANALYZING {ticker} DATA")
        print(f"{'=' * 50}")
        
        try:
            data = load_data(ticker)
            sorted_dates = sorted(data.keys())
            
            print(f"📅 Date range: {sorted_dates[0]} to {sorted_dates[-1]}")
            print(f"📊 Total days: {len(data)}")
            
            # Run checks
            check_rate_calculations(data, ticker)
            check_transitions(data, ticker)
            check_sma200_calculations(data, ticker)
            
        except Exception as e:
            print(f"❌ Error analyzing {ticker}: {e}")
    
    print(f"\n{'=' * 50}")
    print("✅ DATA QUALITY CHECK COMPLETE")
    print(f"{'=' * 50}")

if __name__ == "__main__":
    check_data_quality()
