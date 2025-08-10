#!/usr/bin/env python3
"""
Test script to verify Alpha Vantage API key setup.
Run this to make sure your API key is working before downloading stock data.

Run from the root directory: python test_alpha_vantage.py
"""

import os
from dotenv import load_dotenv
import requests

# Load environment variables from .env file in root directory
load_dotenv()

API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")

if not API_KEY or API_KEY == "your_api_key_here":
    print("❌ ERROR: Please set your Alpha Vantage API key in the .env file")
    print("Get a free API key at: https://www.alphavantage.co/support/#api-key")
    print("Then update the ALPHA_VANTAGE_API_KEY in your .env file")
    exit(1)

print("✅ API key found in .env file")
print(f"API key starts with: {API_KEY[:8]}...")

# Test API call
print("\n🔄 Testing API connection...")
url = "https://www.alphavantage.co/query"
params = {
    "function": "TIME_SERIES_DAILY_ADJUSTED",
    "symbol": "QQQ",
    "outputsize": "compact",  # Just get recent data for testing
    "apikey": API_KEY
}

try:
    response = requests.get(url, params=params, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ HTTP Error {response.status_code}")
        exit(1)
        
    data = response.json()
    
    if "Error Message" in data:
        print(f"❌ API Error: {data['Error Message']}")
        exit(1)
        
    if "Note" in data:
        print(f"⚠️  API Rate Limit: {data['Note']}")
        print("You may need to wait before making more requests")
        exit(1)
        
    if "Time Series (Daily)" in data:
        time_series = data["Time Series (Daily)"]
        dates = list(time_series.keys())
        print(f"✅ API connection successful!")
        print(f"Retrieved data for QQQ with {len(dates)} days")
        print(f"Latest date: {dates[0]}")
        print(f"Sample price: ${float(time_series[dates[0]]['4. close']):.2f}")
    else:
        print("❌ Unexpected response format")
        print(f"Response keys: {list(data.keys())}")
        
except requests.exceptions.RequestException as e:
    print(f"❌ Network error: {e}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
