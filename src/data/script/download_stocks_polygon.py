#!/usr/bin/env python3
"""
Stock data downloader using Polygon.io (free tier)
- 5 API calls per minute
- Adjusted prices included
- Professional-grade data
"""

import json
import requests
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

DIR = os.path.dirname(os.path.realpath(__file__))

# Load environment variables from .env file in the same directory as the script
load_dotenv(os.path.join(DIR, '.env'))

# Calculate root directory for output paths
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(DIR)))

# Polygon.io API key - get a free one at https://polygon.io/
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")

if not POLYGON_API_KEY or POLYGON_API_KEY == "your_api_key_here":
    raise ValueError("Please set your Polygon.io API key in the .env file. Get one at: https://polygon.io/")

def download_stock_polygon(ticker):
    """Download stock data using Polygon.io API"""
    print(f"*** Downloading {ticker} data from Polygon.io ***")
    
    try:
        # Polygon.io aggregates endpoint (adjusted prices)
        # Free tier: 5 calls/minute
        url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/1/day/1990-01-01/{datetime.now().strftime('%Y-%m-%d')}"
        
        params = {
            "adjusted": "true",  # Get adjusted prices
            "sort": "asc",       # Oldest first
            "limit": 50000,      # Max results
            "apikey": POLYGON_API_KEY
        }
        
        print(f"Downloading {ticker} data...")
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            print(f"HTTP Error {response.status_code} for {ticker}")
            if response.status_code == 429:
                print("Rate limit exceeded. Please wait before retrying.")
            return False
            
        data = response.json()
        
        # Check for API errors
        if "status" not in data:
            print(f"API Error: No status in response")
            print(f"Response: {data}")
            return False
            
        if data["status"] not in ["OK", "DELAYED"]:
            print(f"API Error: Status = {data['status']}")
            if "error" in data:
                print(f"Error: {data['error']}")
            if "message" in data:
                print(f"Message: {data['message']}")
            print(f"Full response: {data}")
            return False
        
        if "results" not in data:
            print(f"API Error: No results in response")
            print(f"Response: {data}")
            return False
            
        if not data["results"]:
            print(f"No data found for {ticker}")
            return False
        
        results = data["results"]
        print(f"Downloaded {len(results)} days of data for {ticker}")
        
        # Save raw data
        output_dir = os.path.join(root_dir, "src", "data")
        os.makedirs(output_dir, exist_ok=True)
        raw_output_path = os.path.join(output_dir, f"{ticker}_raw.json")
        
        with open(raw_output_path, "w") as f:
            json.dump(data, f, indent=2)
            
        print(f"Successfully saved {ticker} raw data to {raw_output_path}")
        
        # Process data into our format
        stock_data = {}
        prev_close = None
        close_prices = []
        
        for i, bar in enumerate(results):
            # Polygon.io bar data:
            # t: timestamp (milliseconds)
            # o: open price (adjusted)
            # h: high price (adjusted) 
            # l: low price (adjusted)
            # c: close price (adjusted)
            # v: volume
            
            # Convert timestamp to date string
            timestamp = bar["t"] / 1000  # Convert milliseconds to seconds
            date_obj = datetime.fromtimestamp(timestamp)
            date_str = date_obj.strftime('%Y-%m-%d')
            
            close_value = float(bar["c"])
            open_value = float(bar["o"])
            close_prices.append(close_value)
            
            # Calculate daily return
            if prev_close is None:
                daily_return = 0
            else:
                daily_return = (close_value - prev_close) / prev_close * 100
            
            # Calculate SMA200
            if i < 199:
                sma200 = None
            else:
                sma200 = sum(close_prices[i - 199 : i + 1]) / 200
            
            stock_data[date_str] = {
                "rate": daily_return,
                "close": close_value,
                "open": open_value,
                "sma200": sma200,
            }
            prev_close = close_value
        
        # Save processed data
        output_path = os.path.join(output_dir, f"{ticker}.json")
        with open(output_path, "w") as f:
            json.dump(stock_data, f, indent=2)
        
        print(f"✅ Saved {ticker} data to {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error downloading {ticker}: {e}")
        return False

def simulate_TQQQ():
    """Same TQQQ simulation as before"""
    print("*** Simulating TQQQ data ***")
    output_dir = os.path.join(root_dir, "src", "data")
    TQQQ_path = os.path.join(output_dir, "TQQQ.json")
    QQQ_path = os.path.join(output_dir, "QQQ.json")

    if not os.path.exists(QQQ_path):
        print(f"QQQ data file not found at {QQQ_path}. Please download it first.")
        return

    with open(QQQ_path, "r") as f:
        QQQ_data = json.load(f)

    sorted_dates = sorted(QQQ_data.keys())
    first_date = sorted_dates[0]
    QQQ_data.pop(first_date)

    simulated_TQQQ_data = {}
    
    if sorted_dates[1:]:
        first_remaining_date = sorted_dates[1]
        starting_close = QQQ_data[first_remaining_date]["close"]
    else:
        starting_close = 100

    tqqq_close = starting_close * 3
    tqqq_close_prices = []

    for i, (date, data_obj) in enumerate(sorted(QQQ_data.items())):
        qqq_daily_return = data_obj["rate"]
        tqqq_daily_return = qqq_daily_return * 3
        
        new_tqqq_close = tqqq_close * (1 + tqqq_daily_return / 100)
        
        # Estimate open price
        qqq_open = data_obj["open"]
        qqq_close = data_obj["close"]
        
        if qqq_open != 0:
            qqq_intraday_return = (qqq_close - qqq_open) / qqq_open * 100
            tqqq_intraday_return = qqq_intraday_return * 3
            tqqq_open = new_tqqq_close / (1 + tqqq_intraday_return / 100)
        else:
            tqqq_open = tqqq_close
        
        tqqq_close = new_tqqq_close
        tqqq_close_prices.append(tqqq_close)

        # Calculate SMA200 for TQQQ
        if i < 199:
            tqqq_sma200 = None
        else:
            tqqq_sma200 = sum(tqqq_close_prices[i - 199 : i + 1]) / 200

        simulated_TQQQ_data[date] = {
            "rate": round(tqqq_daily_return, 4),
            "close": round(tqqq_close, 4),
            "open": round(tqqq_open, 4),
            "sma200": round(tqqq_sma200, 4) if tqqq_sma200 is not None else None,
        }

    # Save simulated TQQQ data
    sorted_TQQQ_data = {k: simulated_TQQQ_data[k] for k in sorted(simulated_TQQQ_data.keys())}
    
    with open(QQQ_path, "w") as f:
        json.dump(QQQ_data, f, indent=2)
    with open(TQQQ_path, "w") as f:
        json.dump(sorted_TQQQ_data, f, indent=2)

    # Also write to CSV format
    import csv
    csv_path = os.path.join(output_dir, "TQQQ.csv")
    with open(csv_path, "w", newline="") as csvfile:
        csv_writer = csv.writer(csvfile)
        csv_writer.writerow(["Date", "Daily_Return", "Close_Price", "Open_Price", "SMA200"])
        for date, data_obj in sorted(sorted_TQQQ_data.items()):
            sma200_value = data_obj.get("sma200", "N/A")
            open_value = data_obj.get("open", "N/A")
            csv_writer.writerow([date, data_obj["rate"], data_obj["close"], open_value, sma200_value])

    print(f"✅ Simulated TQQQ data saved to {TQQQ_path}")

if __name__ == "__main__":
    print("🚀 Polygon.io Stock Data Downloader")
    print("===================================")
    print("✅ Free tier: 5 API calls per minute")
    print("✅ Adjusted prices included!")
    print("✅ Professional-grade data")
    print()
    
    # Retry logic for downloading QQQ data
    print("Starting QQQ download...")
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        if download_stock_polygon("QQQ"):
            print("✅ QQQ download successful!")
            break
        else:
            retry_count += 1
            if retry_count < max_retries:
                wait_time = 15  # Wait 15 seconds between retries
                print(f"❌ QQQ download failed (attempt {retry_count}/{max_retries})")
                print(f"⏳ Waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
            else:
                print(f"❌ QQQ download failed after {max_retries} attempts. Exiting.")
                exit(1)

    # Wait to respect rate limit (5 calls per minute = 12 seconds between calls)
    print("⏳ Waiting 15 seconds before downloading TQQQ...")
    time.sleep(15)

    # Retry logic for downloading TQQQ data
    print("Starting TQQQ download...")
    retry_count = 0
    
    while retry_count < max_retries:
        if download_stock_polygon("TQQQ"):
            print("✅ TQQQ download successful!")
            break
        else:
            retry_count += 1
            if retry_count < max_retries:
                wait_time = 15
                print(f"❌ TQQQ download failed (attempt {retry_count}/{max_retries})")
                print(f"⏳ Waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
            else:
                print(f"❌ TQQQ download failed after {max_retries} attempts. Exiting.")
                exit(1)

    print("🔄 Processing TQQQ simulation...")
    simulate_TQQQ()
    
    print("🎉 All done! Data saved to src/data/")
    print("📁 Files created:")
    print("   - QQQ.json (processed data)")
    print("   - TQQQ.json (simulated 3x leveraged data)")
    print("   - QQQ_raw.json (raw Polygon.io data)")
    print("   - TQQQ_raw.json (raw Polygon.io data)")
    print("   - TQQQ.csv (CSV export)")
