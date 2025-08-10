#!/usr/bin/env python3
"""
Complete Stock Data Downloader - From 1998 to Today
====================================================
- Uses Yahoo Finance for historical data (1998-2010) 
- Uses Twelve Data for recent data (2010-today)
- Merges datasets seamlessly
- Outputs: adjusted open, adjusted close, daily returns, SMA200
"""

import json
import yfinance as yf
import pandas as pd
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

def download_yahoo_finance_data(ticker, start_date="1998-01-01", end_date="2010-12-31"):
    """Download historical data from Yahoo Finance (1998-2010)"""
    print(f"📈 Downloading {ticker} from Yahoo Finance ({start_date} to {end_date})")
    
    try:
        stock = yf.Ticker(ticker)
        # Use auto_adjust=True to get split/dividend adjusted prices
        df = stock.history(start=start_date, end=end_date, auto_adjust=True)
        
        if df.empty:
            print(f"❌ No Yahoo Finance data found for {ticker}")
            return {}
            
        print(f"✅ Downloaded {len(df)} days from Yahoo Finance")
        
        # Convert to our format
        stock_data = {}
        for date, row in df.iterrows():
            date_str = date.strftime('%Y-%m-%d')
            
            # Verify we have valid data
            if pd.isna(row['Open']) or pd.isna(row['Close']) or row['Open'] <= 0 or row['Close'] <= 0:
                print(f"⚠️  Skipping {date_str} - invalid data: open={row['Open']}, close={row['Close']}")
                continue
                
            stock_data[date_str] = {
                "open": float(row['Open']),
                "close": float(row['Close']),
                "rate": 0,  # Will calculate later
                "sma200": None  # Will calculate later
            }
        
        return stock_data
        
    except Exception as e:
        print(f"❌ Error downloading {ticker} from Yahoo Finance: {e}")
        return {}

def download_twelvedata_data(ticker, start_date="2011-01-01"):
    """Download recent data from Twelve Data (2011-today)"""
    print(f"📊 Downloading {ticker} from Twelve Data ({start_date} to today)")
    
    if not TWELVEDATA_API_KEY or TWELVEDATA_API_KEY == "your_api_key_here":
        print("❌ Twelve Data API key not found. Using Yahoo Finance for all data.")
        return download_yahoo_finance_data(ticker, start_date, datetime.now().strftime('%Y-%m-%d'))
    
    try:
        url = "https://api.twelvedata.com/time_series"
        params = {
            "symbol": ticker,
            "interval": "1day",
            "start_date": start_date,
            "end_date": datetime.now().strftime('%Y-%m-%d'),
            "format": "JSON",
            "adjust": "all",  # Adjusted prices
            "apikey": TWELVEDATA_API_KEY
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            print(f"❌ HTTP Error {response.status_code}. Falling back to Yahoo Finance.")
            return download_yahoo_finance_data(ticker, start_date, datetime.now().strftime('%Y-%m-%d'))
            
        data = response.json()
        
        if "status" in data and data["status"] == "error":
            print(f"❌ API Error: {data.get('message')}. Falling back to Yahoo Finance.")
            return download_yahoo_finance_data(ticker, start_date, datetime.now().strftime('%Y-%m-%d'))
        
        if "values" not in data:
            print(f"❌ No values in response. Falling back to Yahoo Finance.")
            return download_yahoo_finance_data(ticker, start_date, datetime.now().strftime('%Y-%m-%d'))
        
        values = data["values"]
        print(f"✅ Downloaded {len(values)} days from Twelve Data")
        
        # Convert to our format
        stock_data = {}
        for bar in values:
            date_str = bar["datetime"]
            stock_data[date_str] = {
                "open": float(bar["open"]),
                "close": float(bar["close"]),
                "rate": 0,  # Will calculate later
                "sma200": None  # Will calculate later
            }
        
        return stock_data
        
    except Exception as e:
        print(f"❌ Error downloading {ticker} from Twelve Data: {e}")
        print("🔄 Falling back to Yahoo Finance...")
        return download_yahoo_finance_data(ticker, start_date, datetime.now().strftime('%Y-%m-%d'))

def merge_and_calculate(yahoo_data, twelvedata_data):
    """Merge datasets and calculate rates and SMA200"""
    print("🔄 Merging datasets and calculating metrics...")
    
    # Merge all data
    all_data = {}
    all_data.update(yahoo_data)
    all_data.update(twelvedata_data)
    
    # Sort by date
    sorted_dates = sorted(all_data.keys())
    
    # Calculate daily returns and SMA200
    prev_close = None
    close_prices = []
    
    for i, date in enumerate(sorted_dates):
        close_value = all_data[date]["close"]
        close_prices.append(close_value)
        
        # Calculate daily return (close-to-close)
        if prev_close is None:
            daily_return = 0
        else:
            daily_return = (close_value - prev_close) / prev_close * 100
        
        # Calculate SMA200
        if i < 199:  # Need 200 days for SMA200
            sma200 = None
        else:
            sma200 = sum(close_prices[i - 199 : i + 1]) / 200
        
        # Update data
        all_data[date]["rate"] = round(daily_return, 6)
        all_data[date]["sma200"] = round(sma200, 6) if sma200 is not None else None
        
        prev_close = close_value
    
    # Return sorted data
    return {date: all_data[date] for date in sorted_dates}

def simulate_tqqq_from_qqq(qqq_data):
    """Simulate TQQQ (3x leveraged) from QQQ data"""
    print("🔄 Simulating TQQQ from QQQ data...")
    
    sorted_dates = sorted(qqq_data.keys())
    
    # Remove first date for proper return calculation
    if len(sorted_dates) > 1:
        first_date = sorted_dates[0]
        qqq_data_copy = qqq_data.copy()
        del qqq_data_copy[first_date]
        sorted_dates = sorted_dates[1:]
    else:
        qqq_data_copy = qqq_data.copy()
    
    # Initialize TQQQ simulation
    tqqq_data = {}
    
    # Starting values
    if sorted_dates:
        first_date = sorted_dates[0]
        starting_close = qqq_data_copy[first_date]["close"]
        tqqq_close = starting_close * 3  # 3x initial price
    else:
        tqqq_close = 300  # Default starting price
    
    tqqq_close_prices = []
    
    for i, date in enumerate(sorted_dates):
        qqq_data_point = qqq_data_copy[date]
        
        # Apply 3x leverage to daily return
        qqq_daily_return = qqq_data_point["rate"]
        tqqq_daily_return = qqq_daily_return * 3
        
        # Calculate new TQQQ close price
        new_tqqq_close = tqqq_close * (1 + tqqq_daily_return / 100)
        
        # Estimate TQQQ open price based on QQQ intraday movement
        qqq_open = qqq_data_point["open"]
        qqq_close = qqq_data_point["close"]
        
        if qqq_open != 0:
            qqq_intraday_return = (qqq_close - qqq_open) / qqq_open * 100
            tqqq_intraday_return = qqq_intraday_return * 3
            tqqq_open = new_tqqq_close / (1 + tqqq_intraday_return / 100)
        else:
            tqqq_open = tqqq_close
        
        # Update for next iteration
        tqqq_close = new_tqqq_close
        tqqq_close_prices.append(tqqq_close)
        
        # Calculate TQQQ SMA200
        if i < 199:
            tqqq_sma200 = None
        else:
            tqqq_sma200 = sum(tqqq_close_prices[i - 199 : i + 1]) / 200
        
        # Store TQQQ data
        tqqq_data[date] = {
            "open": round(tqqq_open, 6),
            "close": round(tqqq_close, 6),
            "rate": round(tqqq_daily_return, 6),
            "sma200": round(tqqq_sma200, 6) if tqqq_sma200 is not None else None
        }
    
    return tqqq_data

def save_data(ticker, data, output_dir):
    """Save data to JSON file"""
    output_path = os.path.join(output_dir, f"{ticker}.json")
    
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    if data:
        start_date = min(data.keys())
        end_date = max(data.keys())
        print(f"✅ Saved {ticker} data: {start_date} to {end_date} ({len(data)} days)")
    
    return output_path

def adjust_real_tqqq_to_simulated(simulated_tqqq, raw_real_tqqq_data):
    """Adjust real TQQQ data to continue seamlessly from simulated data"""
    print("🔄 Adjusting real TQQQ data to match simulated data levels...")
    
    if not simulated_tqqq or not raw_real_tqqq_data:
        return raw_real_tqqq_data
    
    # Get the last simulated close price
    last_sim_date = max(simulated_tqqq.keys())
    last_sim_close = simulated_tqqq[last_sim_date]["close"]
    
    # Get the first real trading day data
    first_real_date = min(raw_real_tqqq_data.keys())
    first_real_data = raw_real_tqqq_data[first_real_date]
    first_real_open = first_real_data["open"]
    first_real_close = first_real_data["close"]
    
    print(f"📊 Last simulated close ({last_sim_date}): ${last_sim_close:.6f}")
    print(f"📊 First real data ({first_real_date}): open=${first_real_open:.6f}, close=${first_real_close:.6f}")
    
    # Calculate the scaling factor based on the opening price
    # We want the first real opening price to match our simulated closing price from previous day
    scaling_factor = last_sim_close / first_real_open
    
    print(f"📊 Scaling factor: {scaling_factor:.6f}")
    
    # Apply scaling to all real TQQQ data
    adjusted_real_data = {}
    for date, data in raw_real_tqqq_data.items():
        adjusted_real_data[date] = {
            "open": data["open"] * scaling_factor,
            "close": data["close"] * scaling_factor,
            "rate": data["rate"],  # Keep original rate (percentage change)
            "sma200": None  # Will recalculate later
        }
    
    # Verify the transition
    adjusted_first_open = adjusted_real_data[first_real_date]["open"]
    print(f"📊 Adjusted first real open: ${adjusted_first_open:.6f}")
    print(f"📊 Transition gap: {((adjusted_first_open - last_sim_close) / last_sim_close * 100):.2f}%")
    
    return adjusted_real_data

def download_complete_data():
    """Main function to download complete historical data"""
    print("🚀 Complete Stock Data Downloader")
    print("==================================")
    print("📅 Period: 1998 to Today")
    print("📊 Sources: Yahoo Finance + Twelve Data")
    print("🎯 Output: Adjusted OHLC, Daily Returns, SMA200")
    print()
    
    output_dir = os.path.join(root_dir, "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    # Download QQQ data
    print("=" * 50)
    print("📈 DOWNLOADING QQQ DATA")
    print("=" * 50)
    
    yahoo_qqq = download_yahoo_finance_data("QQQ", "1998-01-01", "2010-12-31")
    twelvedata_qqq = download_twelvedata_data("QQQ", "2011-01-01")
    
    qqq_data = merge_and_calculate(yahoo_qqq, twelvedata_qqq)
    qqq_path = save_data("QQQ", qqq_data, output_dir)
    
    # Download TQQQ data (real + simulated)
    print("\n" + "=" * 50)
    print("📈 DOWNLOADING TQQQ DATA")
    print("=" * 50)
    
    # Step 1: Simulate TQQQ for early years (1998-2010) from QQQ data
    print("🔄 Simulating TQQQ for early years (1998-2010)...")
    early_qqq = {date: data for date, data in qqq_data.items() if date < "2010-02-11"}
    simulated_tqqq = simulate_tqqq_from_qqq(early_qqq)
    
    # Step 2: Get real TQQQ data from launch date onwards
    yahoo_tqqq = download_yahoo_finance_data("TQQQ", "2010-02-11", "2010-12-31")  # TQQQ launch date
    twelvedata_tqqq = download_twelvedata_data("TQQQ", "2011-01-01")
    
    raw_real_tqqq_data = merge_and_calculate(yahoo_tqqq, twelvedata_tqqq)
    
    # Step 3: Adjust real TQQQ data to continue seamlessly from simulated data
    adjusted_real_tqqq = adjust_real_tqqq_to_simulated(simulated_tqqq, raw_real_tqqq_data)
    
    # Step 4: Merge simulated and adjusted real TQQQ data
    all_tqqq_data = {}
    all_tqqq_data.update(simulated_tqqq)
    all_tqqq_data.update(adjusted_real_tqqq)
    
    # Step 5: Recalculate rates and SMA200 for the complete dataset
    print("🔄 Recalculating rates and SMA200 for complete TQQQ dataset...")
    sorted_dates = sorted(all_tqqq_data.keys())
    
    # Recalculate rates
    for i, date in enumerate(sorted_dates):
        if i == 0:
            all_tqqq_data[date]["rate"] = 0
        else:
            prev_date = sorted_dates[i-1]
            current_close = all_tqqq_data[date]["close"]
            prev_close = all_tqqq_data[prev_date]["close"]
            daily_return = (current_close - prev_close) / prev_close * 100
            all_tqqq_data[date]["rate"] = round(daily_return, 6)
    
    # Recalculate SMA200
    close_prices = [all_tqqq_data[date]["close"] for date in sorted_dates]
    for i, date in enumerate(sorted_dates):
        if i < 199:
            all_tqqq_data[date]["sma200"] = None
        else:
            sma200 = sum(close_prices[i - 199 : i + 1]) / 200
            all_tqqq_data[date]["sma200"] = round(sma200, 6)
    
    # Sort by date
    tqqq_data = {date: all_tqqq_data[date] for date in sorted_dates}
    
    tqqq_path = save_data("TQQQ", tqqq_data, output_dir)
    
    print("\n" + "🎉" * 20)
    print("✅ COMPLETE DATA DOWNLOAD FINISHED!")
    print("🎉" * 20)
    print(f"📁 QQQ data saved to: {qqq_path}")
    print(f"📁 TQQQ data saved to: {tqqq_path}")
    
    if qqq_data:
        print(f"📊 QQQ: {min(qqq_data.keys())} to {max(qqq_data.keys())} ({len(qqq_data)} days)")
    if tqqq_data:
        print(f"📊 TQQQ: {min(tqqq_data.keys())} to {max(tqqq_data.keys())} ({len(tqqq_data)} days)")

if __name__ == "__main__":
    download_complete_data()
