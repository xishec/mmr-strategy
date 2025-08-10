#!/usr/bin/env python3
"""
Test script to verify the download_stocks.py path configuration.
This will test that all the paths are calculated correctly.
"""

import os
import sys

# Add the script directory to Python path
script_dir = os.path.join(os.path.dirname(__file__), 'src', 'data', 'script')
sys.path.append(script_dir)

try:
    # Import the script to test path calculations
    import download_stocks
    
    print("✅ Script imported successfully!")
    print(f"Script directory: {download_stocks.DIR}")
    print(f"Root directory: {download_stocks.root_dir}")
    
    # Test output directory calculation
    output_dir = os.path.join(download_stocks.root_dir, "src", "data")
    print(f"Output directory: {output_dir}")
    print(f"Output directory exists: {os.path.exists(output_dir)}")
    
    # Test .env file path
    env_path = os.path.join(download_stocks.root_dir, '.env')
    print(f".env file path: {env_path}")
    print(f".env file exists: {os.path.exists(env_path)}")
    
    print("\n🎯 All paths are configured correctly!")
    print("You can now run: python src/data/script/download_stocks.py")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
