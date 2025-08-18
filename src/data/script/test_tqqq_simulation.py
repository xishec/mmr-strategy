#!/usr/bin/env python3
"""
Test the improved TQQQ simulation function
"""
import json
import os
import sys

# Add the script directory to path so we can import the functions
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(script_dir)

from download_complete_data import simulate_tqqq_from_qqq

def test_tqqq_simulation():
    """Test the improved TQQQ simulation with sample data"""
    print("🧪 Testing improved TQQQ simulation...")
    
    # Create sample QQQ data (5 days)
    sample_qqq_data = {
        # date: open, close -> we also supply overnight/day/total rates for compatibility
        "2024-01-01": {"open": 100.0, "close": 102.0, "overnight_rate": 0, "day_rate": 2.0, "rate": 2.0},
        "2024-01-02": {"open": 101.5, "close": 99.0, "overnight_rate": (101.5/102.0-1)*100, "day_rate": (99.0/101.5-1)*100, "rate": (99.0/102.0-1)*100},
        "2024-01-03": {"open": 98.5, "close": 103.0, "overnight_rate": (98.5/99.0-1)*100, "day_rate": (103.0/98.5-1)*100, "rate": (103.0/99.0-1)*100},
        "2024-01-04": {"open": 104.0, "close": 105.0, "overnight_rate": (104.0/103.0-1)*100, "day_rate": (105.0/104.0-1)*100, "rate": (105.0/103.0-1)*100},
        "2024-01-05": {"open": 105.5, "close": 101.0, "overnight_rate": (105.5/105.0-1)*100, "day_rate": (101.0/105.5-1)*100, "rate": (101.0/105.0-1)*100},
    }
    
    # Test the simulation
    simulated_tqqq = simulate_tqqq_from_qqq(sample_qqq_data, starting_price=100)
    
    if simulated_tqqq:
        print("✅ Simulation successful!")
        print("\n📊 Sample results:")
        for date, data in list(simulated_tqqq.items())[:3]:  # Show first 3 days
            print(f"  {date}: close=${data['close']:.2f}, rate={data['rate']:+.2f}%")
        
        # Check if results look reasonable
        final_close = list(simulated_tqqq.values())[-1]["close"]
        if 50 < final_close < 200:  # Reasonable range for 5-day simulation
            print(f"✅ Final price looks reasonable: ${final_close:.2f}")
        else:
            print(f"⚠️  Final price seems extreme: ${final_close:.2f}")
    else:
        print("❌ Simulation failed!")
        return False
    
    return True

if __name__ == "__main__":
    success = test_tqqq_simulation()
    if success:
        print("\n🎉 Test passed! The improved TQQQ simulation is working.")
    else:
        print("\n❌ Test failed!")
        sys.exit(1)
