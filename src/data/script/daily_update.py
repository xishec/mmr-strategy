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

def is_market_closed():
    """
    Check if US stock market is closed
    Market hours: 9:30 AM - 4:00 PM ET (Monday-Friday)
    """
    try:
        import pytz
        # Get current time in ET
        et_tz = pytz.timezone('US/Eastern')
        now_et = datetime.now(et_tz)
        
        # Market is closed on weekends
        if now_et.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return True
        
        # Market hours: 9:30 AM - 4:00 PM ET
        market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
        
        # Market is closed if current time is before 9:30 AM or after 4:00 PM ET
        return now_et < market_open or now_et >= market_close
        
    except ImportError:
        # If pytz is not available, use a simple heuristic
        # Assume script is run in a timezone close to ET
        now = datetime.now()
        
        # Weekend check
        if now.weekday() >= 5:
            return True
        
        # Simple time check (this assumes local time is close to ET)
        current_hour = now.hour
        return current_hour < 9 or current_hour >= 16

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

def calculate_metrics(existing_data, new_data, ticker=""):
    """Calculate rates and SMA200 for the combined dataset"""
    print("🔄 Calculating daily returns and SMA200...")
    
    # Combine all data
    all_data = existing_data.copy()
    all_data.update(new_data)
    
    # Sort by date
    sorted_dates = sorted(all_data.keys())
    
    # For new data, we'll calculate rates using API data directly
    # This ensures we get the correct overnight rates even with stock splits
    new_dates = set(new_data.keys())
    
    # Collect close prices for SMA calculation
    close_prices = [all_data[date]["close"] for date in sorted_dates]
    
    for i, date in enumerate(sorted_dates):
        # Only process new dates
        if date not in new_dates:
            continue
        
        close_value = all_data[date]["close"]
        open_value = all_data[date]["open"]
        
        # Calculate rates
        if i == 0:
            # First day - no previous data
            overnight_rate = 0
            combined_rate = 0
        else:
            prev_date = sorted_dates[i-1]
            
            # Check if yesterday's data is in the new_data (API data) - if so, use it
            # Otherwise use existing data
            if prev_date in new_data:
                # Both today and yesterday are from API - use directly
                prev_close = new_data[prev_date]["close"]
                print(f"📊 Using API data for {prev_date}: close=${prev_close:.2f}")
            else:
                # Yesterday is from existing data, today is from API
                # This could be a stock split situation
                prev_close = all_data[prev_date]["close"]
                
                # Check for potential stock split
                price_gap_ratio = abs(open_value - prev_close) / prev_close
                if price_gap_ratio > 0.3:  # More than 30% gap indicates potential split
                    print(f"⚠️  Stock split detected between {prev_date} and {date}")
                    print(f"   Existing prev_close: ${prev_close:.2f}, API open: ${open_value:.2f}")
                    print(f"   Need to get split-adjusted previous close from API...")
                    
                    # Get yesterday's split-adjusted close from API
                    try:
                        api_data = get_latest_data_twelvedata(ticker, prev_date)
                        if api_data and prev_date in api_data:
                            prev_close = api_data[prev_date]["close"]
                            print(f"   Using split-adjusted prev_close: ${prev_close:.2f}")
                        else:
                            print(f"   ❌ Could not get API data for {prev_date}")
                    except Exception as e:
                        print(f"   ❌ Error fetching API data: {e}")
            
            # Calculate rates using the correct previous close
            overnight_rate = (open_value - prev_close) / prev_close * 100
            combined_rate = (close_value - prev_close) / prev_close * 100
        
        # Day rate: current open to current close
        day_rate = (close_value - open_value) / open_value * 100
        
        # Calculate SMA200
        if i < 199:
            sma200 = None
        else:
            sma200 = sum(close_prices[i - 199 : i + 1]) / 200
        
        # Update data - ensure all fields exist for backward compatibility
        all_data[date].update({
            "overnight_rate": overnight_rate,
            "day_rate": day_rate,
            "rate": combined_rate,
            "sma200": sma200 if sma200 is not None else close_value
        })
    
    return all_data

def save_updated_data(ticker, data, file_path):
    """Save updated data back to JSON file with dates in chronological order"""
    try:
        # Ensure data is sorted by date before saving
        sorted_data = {}
        for date in sorted(data.keys()):
            sorted_data[date] = data[date]
        
        with open(file_path, 'w') as f:
            json.dump(sorted_data, f, indent=2)
        
        sorted_dates = sorted(sorted_data.keys())
        print(f"✅ Updated {ticker}: {sorted_dates[0]} to {sorted_dates[-1]} ({len(sorted_data)} days)")
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
    
    # Check market status
    market_closed = is_market_closed()
    today = datetime.now().strftime('%Y-%m-%d')
    
    print(f"🕐 Market Status: {'CLOSED' if market_closed else 'OPEN'}")
    print(f"📅 Last existing date: {last_date}, Today: {today}")
    
    # Only skip if last_date is in the future (which shouldn't happen)
    if last_date > today:
        print(f"✅ {ticker} data is from the future?! (last date: {last_date})")
        return True
    
    # Calculate the start date for new data (day after last existing date)
    last_dt = datetime.strptime(last_date, '%Y-%m-%d')
    start_date = (last_dt + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # If start_date is in the future, no data to fetch
    if start_date > today:
        print(f"✅ {ticker} is up to date (last date: {last_date}, today: {today})")
        return True
    
    # If today is the start_date and market is still open, don't fetch today's data
    if start_date == today and not market_closed:
        print(f"🕐 Market is still open - will not fetch today's incomplete data")
        print(f"   Run this script after market close (4:00 PM ET) for complete daily data")
        return True
    
    new_data = get_latest_data_twelvedata(ticker, start_date)
    
    if not new_data:
        print(f"✅ No new data available for {ticker}")
        return True
    
    # Filter new data based on market status
    filtered_new_data = {}
    
    for date, data in new_data.items():
        # Don't add today's data if market is still open
        if date == today and not market_closed:
            print(f"🕐 Skipping today's data ({date}) - market still open")
            continue
            
        if date not in existing_data:
            # Completely new date
            filtered_new_data[date] = data
            print(f"📅 Adding new date: {date}")
        elif date == today and market_closed:
            # Allow refreshing today's data only if market is closed
            print(f"🔄 Refreshing today's data for {ticker} ({date}) - market closed")
            filtered_new_data[date] = data
        # Skip dates that already exist
    
    if not filtered_new_data:
        print(f"✅ No new data to add for {ticker}")
        return True
    
    # Ensure dates are in chronological order
    sorted_new_dates = sorted(filtered_new_data.keys())
    print(f"📊 Adding {len(filtered_new_data)} new days to {ticker}: {sorted_new_dates[0]} to {sorted_new_dates[-1]}")
    
    # Calculate metrics for combined data
    updated_data = calculate_metrics(existing_data, filtered_new_data, ticker)
    
    # Save updated data
    return save_updated_data(ticker, updated_data, file_path)

def update_all_data():
    """Main function to update all stock data"""
    print("🔄 Daily Stock Data Updater")
    print("===========================")
    print(f"📅 Update Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check and display market status
    market_closed = is_market_closed()
    print(f"🕐 Market Status: {'CLOSED' if market_closed else 'OPEN'}")
    
    if not market_closed:
        print("⚠️  Market is currently open - today's data will not be fetched")
        print("   Run this script after market close (4:00 PM ET) for complete daily data")
    
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
