#!/usr/bin/env python3
"""
Transform fear_greed_raw.json to fear_greed.json
Converts the daily Fear & Greed data from array format to a date-keyed map
"""

import json
import os
from pathlib import Path

def transform_fear_greed_data():
    """Transform fear_greed_raw.json to date-keyed format"""
    
    # Get script directory and data directory
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent
    
    raw_file_path = data_dir / "fear_greed_raw.json"
    output_file_path = data_dir / "fear_greed.json"
    
    # Check if raw file exists
    if not raw_file_path.exists():
        print(f"Error: {raw_file_path} not found")
        return False
    
    try:
        # Load the raw data
        print(f"Loading data from {raw_file_path}...")
        with open(raw_file_path, 'r') as f:
            raw_data = json.load(f)
        
        # Extract daily data and create date-keyed map
        daily_map = {}
        if 'daily' in raw_data:
            for entry in raw_data['daily']:
                date = entry['date']
                value = entry['value']
                daily_map[date] = {"value": value}
        
        print(f"Processed {len(daily_map)} daily entries")
        
        # Create the output structure
        output_data = daily_map
        
        # Write the transformed data
        print(f"Writing transformed data to {output_file_path}...")
        with open(output_file_path, 'w') as f:
            json.dump(output_data, f, indent=2, sort_keys=True)
        
        # Print summary
        print(f"✅ Successfully transformed fear_greed_raw.json")
        print(f"📊 Total daily entries: {len(daily_map)}")
        
        # Show sample of first and last entries
        dates = sorted(daily_map.keys())
        if dates:
            first_date = dates[0]
            last_date = dates[-1]
            print(f"📅 Date range: {first_date} to {last_date}")
            print(f"💡 Sample entries:")
            print(f"   {first_date}: {daily_map[first_date]['value']}")
            print(f"   {last_date}: {daily_map[last_date]['value']}")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {raw_file_path}: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    print("🔄 Transforming Fear & Greed data...")
    success = transform_fear_greed_data()
    if success:
        print("🎉 Transformation completed successfully!")
    else:
        print("❌ Transformation failed!")
        exit(1)
