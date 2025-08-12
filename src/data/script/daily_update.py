#!/usr/bin/env python3
"""
Daily Stock Data Updater
========================
- Updates existing QQQ.json and TQQQ.json files with latest data
- Can be run multiple times per day safely (detects existing data)
- Uses Twelve Data API exclusively
"""

import json
import requests
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

DIR = os.path.dirname(os.path.realpath(__file__))
load_dotenv(os.path.join(DIR, '.env'))
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(DIR)))

# API Keys
TWELVEDATA_API_KEY = os.getenv("TWELVEDATA_API_KEY")

def load_existing_data(ticker):
    """Load existing data from JSON file"""
    data_dir = os.path.join(root_dir, "src", "data")
    file_path = os.path.join(data_dir, f"{ticker}.json")
    
    if not os.path.exists(file_path):
        print(f"❌ No existing data file found: {file_path}")
        return {}, None, None
    
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        if not data:
            print(f"❌ Empty data file: {file_path}")
            return {}, None, None
        
        sorted_dates = sorted(data.keys())
        last_date = sorted_dates[-1]
        
        print(f"📊 Loaded {ticker}: {sorted_dates[0]} to {last_date} ({len(data)} days)")
        return data, last_date, file_path
        
    except Exception as e:
        print(f"❌ Error loading {file_path}: {e}")
        return {}, None, None

def get_latest_data_twelvedata(ticker, start_date):
    """Get latest data from Twelve Data API"""
    print(f"🔄 Fetching latest {ticker} data from Twelve Data (since {start_date})")
    
    if not TWELVEDATA_API_KEY or TWELVEDATA_API_KEY == "your_api_key_here":
        raise Exception("Twelve Data API key not found. Please set TWELVEDATA_API_KEY in .env file.")
    
    try:
        url = "https://api.twelvedata.com/time_series"
        
        # First, try to get recent data without date constraints
        # This approach works better than specifying start/end dates
        params = {
            "symbol": ticker,
            "interval": "1day",
            "outputsize": "30",  # Get last 30 days to ensure we have enough
            "format": "JSON",
            "adjust": "all",
            "apikey": TWELVEDATA_API_KEY
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            raise Exception(f"HTTP Error {response.status_code}")
        
        data = response.json()
        
        if "status" in data and data["status"] == "error":
            error_msg = data.get('message', 'Unknown error')
            raise Exception(f"API Error: {error_msg}")
        
        if "values" not in data:
            print(f"✅ No data available for {ticker}")
            return {}
        
        values = data["values"]
        print(f"✅ Fetched {len(values)} days from Twelve Data")
        
        # Filter to only include dates >= start_date
        from datetime import datetime
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        
        # Convert to our format, filtering by date
        new_data = {}
        for bar in values:
            date_str = bar["datetime"]
            bar_dt = datetime.strptime(date_str, '%Y-%m-%d')
            
            # Only include dates on or after start_date
            if bar_dt >= start_dt:
                new_data[date_str] = {
                    "open": float(bar["open"]),
                    "close": float(bar["close"]),
                    "overnight_rate": 0,  # Will calculate later
                    "day_rate": 0,  # Will calculate later
                    "rate": 0,  # Will calculate later (combined rate)
                    "sma200": None  # Will calculate later
                }
        
        if new_data:
            filtered_dates = sorted(new_data.keys())
            print(f"📅 Filtered to {len(new_data)} new days: {filtered_dates[0]} to {filtered_dates[-1]}")
        
        return new_data
        
    except Exception as e:
        print(f"❌ Error fetching from Twelve Data: {e}")
        raise

def calculate_metrics(existing_data, new_data):
    """Calculate rates and SMA200 for the combined dataset"""
    print("🔄 Calculating daily returns and SMA200...")
    
    # Combine all data
    all_data = existing_data.copy()
    all_data.update(new_data)
    
    # Sort by date
    sorted_dates = sorted(all_data.keys())
    
    # Recalculate only for dates that need updating
    # (new data + enough previous data for SMA200 calculation)
    new_dates = set(new_data.keys())
    if new_dates:
        # Find earliest new date
        earliest_new_date = min(new_dates)
        earliest_index = sorted_dates.index(earliest_new_date)
        
        # Include previous 200 days for SMA200 calculation
        start_index = max(0, earliest_index - 200)
        dates_to_recalc = sorted_dates[start_index:]
    else:
        dates_to_recalc = []
    
    # Collect close prices for SMA calculation
    close_prices = [all_data[date]["close"] for date in sorted_dates]
    
    for i, date in enumerate(sorted_dates):
        if date not in dates_to_recalc:
            continue
        
        close_value = all_data[date]["close"]
        open_value = all_data[date]["open"]
        
        # Calculate rates
        if i == 0:
            # First day - no previous data
            overnight_rate = 0
            combined_rate = 0
        else:
            prev_close = all_data[sorted_dates[i-1]]["close"]
            
            # Overnight rate: previous close to current open
            overnight_rate = (open_value - prev_close) / prev_close * 100
            
            # Combined rate: previous close to current close (existing calculation)
            combined_rate = (close_value - prev_close) / prev_close * 100
        
        # Day rate: current open to current close
        day_rate = (close_value - open_value) / open_value * 100
        
        # Calculate SMA200
        if i < 199:
            sma200 = None
        else:
            sma200 = sum(close_prices[i - 199 : i + 1]) / 200
        
        # Update data - ensure all fields exist for backward compatibility
        if "overnight_rate" not in all_data[date]:
            all_data[date]["overnight_rate"] = 0
        if "day_rate" not in all_data[date]:
            all_data[date]["day_rate"] = 0
            
        all_data[date]["overnight_rate"] = round(overnight_rate, 6)
        all_data[date]["day_rate"] = round(day_rate, 6)
        all_data[date]["rate"] = round(combined_rate, 6)
        all_data[date]["sma200"] = round(sma200, 6) if sma200 is not None else None
    
    return all_data

def save_updated_data(ticker, data, file_path):
    """Save updated data back to JSON file"""
    try:
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        sorted_dates = sorted(data.keys())
        print(f"✅ Updated {ticker}: {sorted_dates[0]} to {sorted_dates[-1]} ({len(data)} days)")
        return True
        
    except Exception as e:
        print(f"❌ Error saving {file_path}: {e}")
        return False

def update_ticker(ticker):
    """Update data for a specific ticker"""
    print(f"\n📈 Updating {ticker}")
    print("-" * 30)
    
    # Load existing data
    existing_data, last_date, file_path = load_existing_data(ticker)
    
    if not existing_data or not last_date:
        print(f"❌ Cannot update {ticker} - no existing data found")
        print("💡 Run download_complete_data.py first to create initial data")
        return False
    
    # Check if we need to update
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Only skip if last_date is in the future (which shouldn't happen)
    if last_date > today:
        print(f"✅ {ticker} data is from the future?! (last date: {last_date})")
        return True
    
    # Always try to fetch data starting from the day after last_date
    # This will include today if last_date is yesterday, or it will try to update today if we already have partial data
    last_dt = datetime.strptime(last_date, '%Y-%m-%d')
    start_date = (last_dt + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # If start_date is in the future, no data to fetch
    if start_date > today:
        print(f"✅ {ticker} is up to date (last date: {last_date}, today: {today})")
        return True
    
    new_data = get_latest_data_twelvedata(ticker, start_date)
    
    if not new_data:
        print(f"✅ No new data available for {ticker}")
        return True
    
    # Allow updating today's data even if it already exists
    # (in case we got incomplete data earlier in the day)
    today = datetime.now().strftime('%Y-%m-%d')
    filtered_new_data = {}
    
    for date, data in new_data.items():
        if date not in existing_data:
            # Completely new date
            filtered_new_data[date] = data
        elif date == today:
            # Allow refreshing today's data
            print(f"🔄 Refreshing today's data for {ticker} ({date})")
            filtered_new_data[date] = data
        # Skip dates that already exist and are not today
    
    if not filtered_new_data:
        print(f"✅ No new data to add for {ticker}")
        return True
    
    print(f"📊 Adding {len(filtered_new_data)} new days to {ticker}")
    
    # Calculate metrics for combined data
    updated_data = calculate_metrics(existing_data, filtered_new_data)
    
    # Save updated data
    return save_updated_data(ticker, updated_data, file_path)

def update_all_data():
    """Main function to update all stock data"""
    print("🔄 Daily Stock Data Updater")
    print("===========================")
    print(f"📅 Update Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    success_count = 0
    total_count = 2
    
    # Update QQQ
    if update_ticker("QQQ"):
        success_count += 1
    
    # Update TQQQ
    if update_ticker("TQQQ"):
        success_count += 1
    
    print("\n" + "=" * 40)
    if success_count == total_count:
        print("✅ ALL UPDATES COMPLETED SUCCESSFULLY!")
    else:
        print(f"⚠️  COMPLETED WITH ISSUES: {success_count}/{total_count} successful")
    print("=" * 40)
    
    return success_count == total_count

if __name__ == "__main__":
    update_all_data()
