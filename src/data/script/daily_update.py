#!/usr/bin/env python3
"""
Daily Stock Data Updater
========================
- Updates existing QQQ.json and TQQQ.json files with latest data
- Can be run multiple times per day safely (detects existing data)
- Uses Twelve Data API as primary source
- Falls back to Yahoo Finance if needed
"""

import json
import yfinance as yf
import requests
import os
import time
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
        print("❌ Twelve Data API key not found. Using Yahoo Finance.")
        return get_latest_data_yahoo(ticker, start_date)
    
    try:
        url = "https://api.twelvedata.com/time_series"
        params = {
            "symbol": ticker,
            "interval": "1day",
            "start_date": start_date,
            "end_date": datetime.now().strftime('%Y-%m-%d'),
            "format": "JSON",
            "adjust": "all",
            "apikey": TWELVEDATA_API_KEY
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            print(f"❌ HTTP Error {response.status_code}. Using Yahoo Finance.")
            return get_latest_data_yahoo(ticker, start_date)
        
        data = response.json()
        
        if "status" in data and data["status"] == "error":
            print(f"❌ API Error: {data.get('message')}. Using Yahoo Finance.")
            return get_latest_data_yahoo(ticker, start_date)
        
        if "values" not in data:
            print(f"❌ No values in response. Using Yahoo Finance.")
            return get_latest_data_yahoo(ticker, start_date)
        
        values = data["values"]
        print(f"✅ Fetched {len(values)} new days from Twelve Data")
        
        # Convert to our format
        new_data = {}
        for bar in values:
            date_str = bar["datetime"]
            new_data[date_str] = {
                "open": float(bar["open"]),
                "close": float(bar["close"]),
                "rate": 0,  # Will calculate later
                "sma200": None  # Will calculate later
            }
        
        return new_data
        
    except Exception as e:
        print(f"❌ Error fetching from Twelve Data: {e}")
        return get_latest_data_yahoo(ticker, start_date)

def get_latest_data_yahoo(ticker, start_date):
    """Get latest data from Yahoo Finance"""
    print(f"🔄 Fetching latest {ticker} data from Yahoo Finance (since {start_date})")
    
    try:
        # Add one day to start_date to avoid duplicates
        start_dt = datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=1)
        end_dt = datetime.now()
        
        stock = yf.Ticker(ticker)
        df = stock.history(start=start_dt.strftime('%Y-%m-%d'), 
                          end=end_dt.strftime('%Y-%m-%d'), 
                          auto_adjust=True)
        
        if df.empty:
            print(f"✅ No new data available for {ticker}")
            return {}
        
        print(f"✅ Fetched {len(df)} new days from Yahoo Finance")
        
        # Convert to our format
        new_data = {}
        for date, row in df.iterrows():
            date_str = date.strftime('%Y-%m-%d')
            new_data[date_str] = {
                "open": float(row['Open']),
                "close": float(row['Close']),
                "rate": 0,  # Will calculate later
                "sma200": None  # Will calculate later
            }
        
        return new_data
        
    except Exception as e:
        print(f"❌ Error fetching from Yahoo Finance: {e}")
        return {}

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
        
        # Calculate daily return
        if i == 0:
            daily_return = 0
        else:
            prev_close = all_data[sorted_dates[i-1]]["close"]
            daily_return = (close_value - prev_close) / prev_close * 100
        
        # Calculate SMA200
        if i < 199:
            sma200 = None
        else:
            sma200 = sum(close_prices[i - 199 : i + 1]) / 200
        
        # Update data
        all_data[date]["rate"] = round(daily_return, 6)
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
    if last_date >= today:
        print(f"✅ {ticker} is already up to date (last date: {last_date})")
        return True
    
    # Get new data starting from the day after last_date
    last_dt = datetime.strptime(last_date, '%Y-%m-%d')
    start_date = (last_dt + timedelta(days=1)).strftime('%Y-%m-%d')
    
    new_data = get_latest_data_twelvedata(ticker, start_date)
    
    if not new_data:
        print(f"✅ No new data to add for {ticker}")
        return True
    
    # Remove any duplicate dates
    filtered_new_data = {date: data for date, data in new_data.items() 
                        if date not in existing_data}
    
    if not filtered_new_data:
        print(f"✅ No new unique data for {ticker}")
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
