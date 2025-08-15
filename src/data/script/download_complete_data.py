#!/usr/bin/env python3
"""
Complete Stock Data Downloader - From 1998 to Today
====================================================
- Prioritizes Twelve Data for maximum date range possible
- Uses Yahoo Finance only for older data not available on Twelve Data
- Merges datasets seamlessly
- Outputs: adjusted open, adjusted close, daily returns, SMA200, SMA3
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

def smart_delay(attempt=0, base_delay=1):
    """
    Add intelligent delays to prevent rate limiting
    - Base delay between requests
    - Exponential backoff for retries
    """
    delay_time = base_delay * (2 ** attempt) if attempt > 0 else base_delay
    if delay_time > 0:
        print(f"⏳ Waiting {delay_time} seconds to avoid rate limiting...")
        time.sleep(delay_time)

def download_yahoo_finance_data(ticker, start_date="1998-01-01", end_date="2010-12-31"):
    """Download historical data from Yahoo Finance (1998-2010)"""
    print(f"📈 Downloading {ticker} from Yahoo Finance ({start_date} to {end_date})")
    
    max_retries = 3
    retry_delay = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                print(f"🔄 Retry attempt {attempt + 1}/{max_retries} for {ticker}")
                time.sleep(retry_delay * attempt)  # Exponential backoff
            
            stock = yf.Ticker(ticker)
            # Use auto_adjust=True to get split/dividend adjusted prices
            df = stock.history(start=start_date, end=end_date, auto_adjust=True)
            
            # Check for empty dataframe
            if df.empty:
                print(f"❌ No Yahoo Finance data found for {ticker} (attempt {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    print(f"⏳ This could be due to rate limiting. Waiting {retry_delay * (attempt + 1)} seconds before retry...")
                    continue
                else:
                    print(f"❌ All attempts failed for {ticker}. This might be due to:")
                    print(f"   • Rate limiting from Yahoo Finance (too many requests)")
                    print(f"   • Invalid ticker symbol: {ticker}")
                    print(f"   • No data available for the requested date range")
                    return {}
            
            # Check data quality
            valid_rows = 0
            total_rows = len(df)
            
            for date, row in df.iterrows():
                if not (pd.isna(row['Open']) or pd.isna(row['Close']) or row['Open'] <= 0 or row['Close'] <= 0):
                    valid_rows += 1
            
            if valid_rows == 0:
                print(f"⚠️  No valid data rows found for {ticker} (all {total_rows} rows have invalid prices)")
                if attempt < max_retries - 1:
                    print(f"⏳ This might be due to rate limiting. Waiting {retry_delay * (attempt + 1)} seconds before retry...")
                    continue
                else:
                    print(f"❌ All attempts failed - no valid price data available")
                    return {}
            
            if valid_rows < total_rows * 0.5:  # Less than 50% valid data
                print(f"⚠️  Data quality warning: Only {valid_rows}/{total_rows} rows have valid data ({valid_rows/total_rows*100:.1f}%)")
                if attempt < max_retries - 1:
                    print(f"⏳ Poor data quality might indicate rate limiting. Retrying...")
                    continue
            
            print(f"✅ Downloaded {total_rows} days from Yahoo Finance ({valid_rows} valid, {total_rows-valid_rows} skipped)")
            
            # Convert to our format
            stock_data = {}
            skipped_count = 0
            
            for date, row in df.iterrows():
                date_str = date.strftime('%Y-%m-%d')
                
                # Verify we have valid data
                if pd.isna(row['Open']) or pd.isna(row['Close']) or row['Open'] <= 0 or row['Close'] <= 0:
                    if skipped_count < 5:  # Only log first 5 skipped entries to avoid spam
                        print(f"⚠️  Skipping {date_str} - invalid data: open={row['Open']}, close={row['Close']}")
                    skipped_count += 1
                    continue
                    
                stock_data[date_str] = {
                    "open": round(float(row['Open']), 6),
                    "close": round(float(row['Close']), 6),
                    "overnight_rate": 0,  # Will calculate later
                    "day_rate": 0,  # Will calculate later
                    "rate": 0,  # Will calculate later (combined rate)
                    "sma200": None,  # Will calculate later
                    "sma3": None  # Will calculate later
                }
            
            if skipped_count > 5:
                print(f"⚠️  ... and {skipped_count - 5} more rows with invalid data")
            
            return stock_data
            
        except Exception as e:
            error_msg = str(e).lower()
            print(f"❌ Error downloading {ticker} from Yahoo Finance (attempt {attempt + 1}/{max_retries}): {e}")
            
            # Check for common rate limiting indicators
            if any(indicator in error_msg for indicator in [
                'too many requests', 'rate limit', 'http 429', 'http 503', 
                'http 502', 'http 504', 'timeout', 'connection', 'server error'
            ]):
                print(f"🚫 Rate limiting or server error detected for {ticker}")
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (attempt + 1)
                    print(f"⏳ Waiting {wait_time} seconds before retry (rate limiting cooldown)...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"❌ All retry attempts exhausted. Suggestions:")
                    print(f"   • Wait longer before running the script again")
                    print(f"   • Use a VPN or different IP address")
                    print(f"   • Try downloading data in smaller chunks")
                    return {}
            else:
                # Non-rate-limiting error, don't retry
                print(f"❌ Non-recoverable error for {ticker}: {e}")
                return {}
    
    print(f"❌ Failed to download {ticker} after {max_retries} attempts")
    return {}

def download_twelvedata_data(ticker, start_date="1998-01-01", end_date=None):
    """Download data from Twelve Data - tries maximum range first"""
    if end_date is None:
        end_date = datetime.now().strftime('%Y-%m-%d')
        
    print(f"📊 Downloading {ticker} from Twelve Data ({start_date} to {end_date})")
    
    if not TWELVEDATA_API_KEY or TWELVEDATA_API_KEY == "your_api_key_here":
        print("❌ Twelve Data API key not found. Using Yahoo Finance instead.")
        return download_yahoo_finance_data(ticker, start_date, end_date)
    
    try:
        url = "https://api.twelvedata.com/time_series"
        params = {
            "symbol": ticker,
            "interval": "1day",
            "start_date": start_date,
            "end_date": end_date,
            "format": "JSON",
            "adjust": "all",  # Adjusted prices
            "apikey": TWELVEDATA_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 429:
            print(f"🚫 Rate limit exceeded for Twelve Data API (HTTP 429)")
            print(f"   • This is likely due to too many requests in a short period")
            print(f"   • Consider upgrading your Twelve Data plan for higher limits")
            print(f"   • Falling back to Yahoo Finance (which may also have rate limits)")
            return download_yahoo_finance_data(ticker, start_date, end_date)
        elif response.status_code == 403:
            print(f"🚫 API access forbidden (HTTP 403)")
            print(f"   • Check if your Twelve Data API key is valid")
            print(f"   • Verify you have access to the requested ticker: {ticker}")
            print(f"   • Falling back to Yahoo Finance...")
            return download_yahoo_finance_data(ticker, start_date, end_date)
        elif response.status_code != 200:
            print(f"❌ HTTP Error {response.status_code} from Twelve Data")
            if response.status_code >= 500:
                print(f"   • Server error - this is likely temporary")
                print(f"   • Try again in a few minutes")
            print(f"   • Falling back to Yahoo Finance...")
            return download_yahoo_finance_data(ticker, start_date, end_date)
            
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON response from Twelve Data: {e}")
            print(f"   • Response content: {response.text[:200]}...")
            print(f"   • Falling back to Yahoo Finance...")
            return download_yahoo_finance_data(ticker, start_date, end_date)
        
        if "status" in data and data["status"] == "error":
            error_msg = data.get('message', 'Unknown error')
            error_code = data.get('code', 'N/A')
            print(f"❌ Twelve Data API Error [{error_code}]: {error_msg}")
            
            # Check for specific error types
            if "start_date" in error_msg.lower() or "too early" in error_msg.lower():
                print("🔄 Date range too early for Twelve Data. Will use Yahoo Finance for older data.")
                return {}  # Return empty, let caller handle fallback
            elif "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                print("� Rate limit or quota exceeded:")
                print(f"   • Message: {error_msg}")
                print(f"   • Consider upgrading your Twelve Data plan")
                print(f"   • Falling back to Yahoo Finance (may also have limits)...")
                return download_yahoo_finance_data(ticker, start_date, end_date)
            elif "invalid" in error_msg.lower() and "symbol" in error_msg.lower():
                print(f"❌ Invalid ticker symbol '{ticker}' for Twelve Data")
                print(f"   • Verify the ticker symbol is correct")
                print(f"   • Trying with Yahoo Finance instead...")
                return download_yahoo_finance_data(ticker, start_date, end_date)
            else:
                print("�🔄 Falling back to Yahoo Finance...")
                return download_yahoo_finance_data(ticker, start_date, end_date)
        
        if "values" not in data:
            print(f"❌ No 'values' field in Twelve Data response")
            print(f"   • Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
            print(f"   • This might indicate an API structure change")
            print(f"   • Falling back to Yahoo Finance...")
            return download_yahoo_finance_data(ticker, start_date, end_date)
        
        values = data["values"]
        print(f"✅ Downloaded {len(values)} days from Twelve Data")
        
        # Convert to our format
        stock_data = {}
        for bar in values:
            date_str = bar["datetime"]
            
            # Verify we have valid data
            try:
                open_price = float(bar["open"])
                close_price = float(bar["close"])
                
                if open_price <= 0 or close_price <= 0:
                    print(f"⚠️  Skipping {date_str} - invalid prices: open={open_price}, close={close_price}")
                    continue
                    
                stock_data[date_str] = {
                    "open": open_price,
                    "close": close_price,
                    "overnight_rate": 0,  # Will calculate later
                    "day_rate": 0,  # Will calculate later
                    "rate": 0,  # Will calculate later (combined rate)
                    "sma200": None,  # Will calculate later
                    "sma3": None  # Will calculate later
                }
            except (ValueError, KeyError) as e:
                print(f"⚠️  Skipping {date_str} - data error: {e}")
                continue
        
        return stock_data
        
    except requests.exceptions.Timeout:
        print(f"⏱️  Timeout error downloading {ticker} from Twelve Data")
        print(f"   • The API request took too long to complete")
        print(f"   • This might indicate server overload or network issues")
        print(f"   • Falling back to Yahoo Finance...")
        return download_yahoo_finance_data(ticker, start_date, end_date)
    except requests.exceptions.ConnectionError:
        print(f"🔌 Connection error downloading {ticker} from Twelve Data")
        print(f"   • Unable to connect to the Twelve Data API")
        print(f"   • Check your internet connection")
        print(f"   • Falling back to Yahoo Finance...")
        return download_yahoo_finance_data(ticker, start_date, end_date)
    except requests.exceptions.RequestException as e:
        print(f"🌐 Network error downloading {ticker} from Twelve Data: {e}")
        print(f"   • This is likely a temporary network issue")
        print(f"   • Falling back to Yahoo Finance...")
        return download_yahoo_finance_data(ticker, start_date, end_date)
    except Exception as e:
        print(f"❌ Unexpected error downloading {ticker} from Twelve Data: {e}")
        print(f"   • Error type: {type(e).__name__}")
        print(f"   • This might be a code issue or API change")
        print(f"   • Falling back to Yahoo Finance...")
        return download_yahoo_finance_data(ticker, start_date, end_date)

def download_hybrid_data(ticker, target_start_date="1998-01-01"):
    """
    Download data using Twelve Data first, then Yahoo Finance for older data
    Returns: (combined_data, twelvedata_start_date)
    """
    print(f"\n🔄 Starting hybrid download for {ticker}")
    print(f"📅 Target date range: {target_start_date} to today")
    
    # Step 1: Try Twelve Data for maximum possible range
    twelvedata_data = download_twelvedata_data(ticker, target_start_date)
    
    # Step 2: Determine what date range Twelve Data actually provided
    if twelvedata_data:
        actual_start = min(twelvedata_data.keys())
        print(f"📊 Twelve Data provided: {actual_start} to {max(twelvedata_data.keys())}")
        
        # Step 3: Fill gap with Yahoo Finance if needed
        if actual_start > target_start_date:
            gap_end = (datetime.strptime(actual_start, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')
            print(f"🔄 Filling gap with Yahoo Finance: {target_start_date} to {gap_end}")
            
            yahoo_data = download_yahoo_finance_data(ticker, target_start_date, gap_end)
            
            # Combine datasets
            combined_data = {}
            combined_data.update(yahoo_data)
            combined_data.update(twelvedata_data)
            
            print(f"✅ Combined dataset: {len(yahoo_data)} from Yahoo + {len(twelvedata_data)} from Twelve Data")
            return combined_data, actual_start
        else:
            print(f"✅ Twelve Data covered full range - no Yahoo Finance needed")
            return twelvedata_data, actual_start
    else:
        # Twelve Data failed completely, use Yahoo Finance
        print(f"⚠️  Twelve Data unavailable, using Yahoo Finance for full range")
        yahoo_data = download_yahoo_finance_data(ticker, target_start_date)
        return yahoo_data, target_start_date

def merge_and_calculate(data_dict):
    """Calculate rates, SMA200, and SMA3 for a dataset"""
    print("🔄 Calculating metrics...")
    
    # Sort by date
    sorted_dates = sorted(data_dict.keys())
    
    # Calculate daily returns and SMA200
    prev_close = None
    close_prices = []
    
    for i, date in enumerate(sorted_dates):
        close_value = data_dict[date]["close"]
        open_value = data_dict[date]["open"]
        close_prices.append(close_value)
        
        # Calculate rates
        if prev_close is None:
            # First day - no previous data
            overnight_rate = 0
            combined_rate = 0
        else:
            # Overnight rate: previous close to current open
            overnight_rate = (open_value - prev_close) / prev_close * 100
            
            # Combined rate: previous close to current close (existing calculation)
            combined_rate = (close_value - prev_close) / prev_close * 100
        
        # Day rate: current open to current close
        day_rate = (close_value - open_value) / open_value * 100
        
        # Calculate SMA200
        if i < 199:  # Need 200 days for SMA200
            sma200 = None
        else:
            sma200 = sum(close_prices[i - 199 : i + 1]) / 200

        # Calculate SMA3
        if i < 2:  # Need 3 days for SMA3
            sma3 = None
        else:
            sma3 = sum(close_prices[i - 2 : i + 1]) / 3
        
        # Update data
        data_dict[date]["overnight_rate"] = round(overnight_rate, 6)
        data_dict[date]["day_rate"] = round(day_rate, 6)
        data_dict[date]["rate"] = round(combined_rate, 6)
        data_dict[date]["sma200"] = round(sma200, 6) if sma200 is not None else None
        data_dict[date]["sma3"] = round(sma3, 6) if sma3 is not None else None
        
        prev_close = close_value
    
    # Return sorted data
    return {date: data_dict[date] for date in sorted_dates}

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
        
        # Apply 3x leverage to daily returns
        qqq_combined_rate = qqq_data_point["rate"]
        qqq_overnight_rate = qqq_data_point.get("overnight_rate", 0)
        qqq_day_rate = qqq_data_point.get("day_rate", 0)
        
        tqqq_combined_rate = qqq_combined_rate * 3
        tqqq_overnight_rate = qqq_overnight_rate * 3
        tqqq_day_rate = qqq_day_rate * 3
        
        # Calculate new TQQQ close price
        new_tqqq_close = tqqq_close * (1 + tqqq_combined_rate / 100)
        
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

        # Calculate TQQQ SMA3
        if i < 2:
            tqqq_sma3 = None
        else:
            tqqq_sma3 = sum(tqqq_close_prices[i - 2 : i + 1]) / 3
        
        # Store TQQQ data
        tqqq_data[date] = {
            "open": round(tqqq_open, 6),
            "close": round(tqqq_close, 6),
            "overnight_rate": round(tqqq_overnight_rate, 6),
            "day_rate": round(tqqq_day_rate, 6),
            "rate": round(tqqq_combined_rate, 6),
            "sma200": round(tqqq_sma200, 6) if tqqq_sma200 is not None else None,
            "sma3": round(tqqq_sma3, 6) if tqqq_sma3 is not None else None
        }
    
    return tqqq_data

def save_data(ticker, data, output_dir):
    """Save data to JSON file with protection against overwriting good data with bad data"""
    output_path = os.path.join(output_dir, f"{ticker}.json")
    
    # Check if existing data file exists
    existing_data = {}
    existing_count = 0
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r') as f:
                existing_data = json.load(f)
            existing_count = len(existing_data)
            if existing_data:
                existing_start = min(existing_data.keys())
                existing_end = max(existing_data.keys())
                print(f"📋 Found existing {ticker} data: {existing_start} to {existing_end} ({existing_count} days)")
        except Exception as e:
            print(f"⚠️  Could not read existing {ticker} data: {e}")
    
    # Validate new data before saving
    if not data:
        print(f"❌ No new data to save for {ticker}")
        if existing_count > 0:
            print(f"🛡️  Keeping existing data ({existing_count} days) - not overwriting with empty data")
            return output_path
        else:
            print(f"⚠️  No existing data either - creating empty file")
    
    new_count = len(data)
    
    # Quality checks for new data
    if data:
        new_start = min(data.keys())
        new_end = max(data.keys())
        
        # Check if new data is significantly smaller than existing data (possible error)
        if existing_count > 0 and new_count < existing_count * 0.8:  # New data is less than 80% of existing
            print(f"⚠️  Data quality warning for {ticker}:")
            print(f"   • New data: {new_start} to {new_end} ({new_count} days)")
            print(f"   • Existing data: {existing_count} days")
            print(f"   • New data is {new_count/existing_count*100:.1f}% of existing data size")
            
            # Ask user for confirmation (in production, you might want to auto-reject)
            response = input(f"🤔 New data seems incomplete. Overwrite anyway? (y/N): ")
            if response.lower() != 'y':
                print(f"🛡️  Keeping existing data for {ticker} - not overwriting")
                return output_path
        
        # Check for data quality issues
        valid_entries = 0
        for date, entry in data.items():
            if (isinstance(entry.get('open'), (int, float)) and 
                isinstance(entry.get('close'), (int, float)) and 
                entry.get('open', 0) > 0 and 
                entry.get('close', 0) > 0):
                valid_entries += 1
        
        valid_percentage = valid_entries / new_count * 100 if new_count > 0 else 0
        
        if valid_percentage < 50:  # Less than 50% valid data
            print(f"❌ Data quality check failed for {ticker}:")
            print(f"   • Only {valid_entries}/{new_count} entries have valid prices ({valid_percentage:.1f}%)")
            if existing_count > 0:
                print(f"🛡️  Keeping existing data - not overwriting with poor quality data")
                return output_path
            else:
                print(f"⚠️  No existing data to preserve, but data quality is poor")
        
        print(f"✅ Data quality check passed for {ticker}: {valid_entries}/{new_count} valid entries ({valid_percentage:.1f}%)")
    
    # Create backup of existing data before overwriting
    if existing_count > 0:
        backup_path = output_path + f".backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        try:
            with open(backup_path, 'w') as f:
                json.dump(existing_data, f, indent=2)
            print(f"💾 Created backup: {backup_path}")
        except Exception as e:
            print(f"⚠️  Could not create backup: {e}")
    
    # Save new data
    try:
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        if data:
            start_date = min(data.keys())
            end_date = max(data.keys())
            print(f"✅ Saved {ticker} data: {start_date} to {end_date} ({len(data)} days)")
        else:
            print(f"✅ Saved empty {ticker} file")
    except Exception as e:
        print(f"❌ Failed to save {ticker} data: {e}")
        if existing_count > 0:
            print(f"🛡️  Original data should still be intact")
    
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
            "overnight_rate": data.get("overnight_rate", 0),  # Keep original rate (percentage change)
            "day_rate": data.get("day_rate", 0),  # Keep original rate (percentage change)
            "rate": data["rate"],  # Keep original rate (percentage change)
            "sma200": None,  # Will recalculate later
            "sma3": None  # Will recalculate later
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
    print("🎯 Output: Adjusted OHLC, Daily Returns, SMA200, SMA3")
    print()
    print("⚠️  Note: This script includes delays to prevent rate limiting")
    print("    from data providers. Please be patient.")
    print("🛡️  Data protection: Existing data will not be overwritten with incomplete/invalid data")
    print()
    
    output_dir = os.path.join(root_dir, "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    # Download QQQ data
    print("=" * 50)
    print("📈 DOWNLOADING QQQ DATA")
    print("=" * 50)
    
    try:
        qqq_data, qqq_twelvedata_start = download_hybrid_data("QQQ", "1998-01-01")
        
        if not qqq_data:
            print("❌ Failed to download QQQ data from all sources")
            print("🛡️  Checking if existing QQQ data can be used...")
            
            # Check for existing QQQ data
            existing_qqq_path = os.path.join(output_dir, "QQQ.json")
            if os.path.exists(existing_qqq_path):
                try:
                    with open(existing_qqq_path, 'r') as f:
                        qqq_data = json.load(f)
                    print(f"✅ Using existing QQQ data ({len(qqq_data)} days)")
                except Exception as e:
                    print(f"❌ Could not load existing QQQ data: {e}")
                    print("🚫 Cannot proceed without QQQ data")
                    return
            else:
                print("🚫 No existing QQQ data found. Cannot proceed.")
                return
        else:
            qqq_data = merge_and_calculate(qqq_data)
            qqq_path = save_data("QQQ", qqq_data, output_dir)
    
    except Exception as e:
        print(f"❌ Unexpected error downloading QQQ data: {e}")
        print("🛡️  Checking if existing QQQ data can be used...")
        
        # Try to use existing data
        existing_qqq_path = os.path.join(output_dir, "QQQ.json")
        if os.path.exists(existing_qqq_path):
            try:
                with open(existing_qqq_path, 'r') as f:
                    qqq_data = json.load(f)
                print(f"✅ Using existing QQQ data ({len(qqq_data)} days)")
            except Exception as e2:
                print(f"❌ Could not load existing QQQ data: {e2}")
                print("🚫 Cannot proceed without QQQ data")
                return
        else:
            print("🚫 No existing QQQ data found. Cannot proceed.")
            return
    
    # Add delay between different ticker downloads to avoid rate limiting
    smart_delay(base_delay=3)
    
    # Download TQQQ data (real + simulated)
    print("\n" + "=" * 50)
    print("📈 DOWNLOADING TQQQ DATA")
    print("=" * 50)
    
    try:
        # Step 1: Simulate TQQQ for early years (1998-2010) from QQQ data
        print("🔄 Simulating TQQQ for early years (1998-2010)...")
        early_qqq = {date: data for date, data in qqq_data.items() if date < "2010-02-11"}
        simulated_tqqq = simulate_tqqq_from_qqq(early_qqq)
        
        # Step 2: Get real TQQQ data from launch date onwards using hybrid approach
        print("🔄 Downloading real TQQQ data from launch date...")
        smart_delay(base_delay=2)  # Add delay before API call
        tqqq_real_data, tqqq_twelvedata_start = download_hybrid_data("TQQQ", "2010-02-11")  # TQQQ launch date
        
        if not tqqq_real_data:
            print("❌ Failed to download real TQQQ data from all sources")
            print("🛡️  Checking if existing TQQQ data can be used...")
            
            # Check for existing TQQQ data
            existing_tqqq_path = os.path.join(output_dir, "TQQQ.json")
            if os.path.exists(existing_tqqq_path):
                try:
                    with open(existing_tqqq_path, 'r') as f:
                        existing_tqqq_data = json.load(f)
                    print(f"✅ Existing TQQQ data found ({len(existing_tqqq_data)} days)")
                    print("🛡️  Keeping existing TQQQ data - not overwriting with incomplete data")
                    
                    # Still show final summary
                    print("\n" + "🎉" * 20)
                    print("✅ DATA DOWNLOAD COMPLETED (with existing data)")
                    print("🎉" * 20)
                    print(f"📁 QQQ data: {len(qqq_data)} days")
                    print(f"📁 TQQQ data: {len(existing_tqqq_data)} days (existing)")
                    return
                    
                except Exception as e:
                    print(f"❌ Could not load existing TQQQ data: {e}")
                    print("⚠️  Will proceed with simulated data only")
                    
            # Use only simulated data if no existing data
            print("⚠️  Using simulated TQQQ data only (no real data available)")
            tqqq_data = simulated_tqqq
        else:
            raw_real_tqqq_data = merge_and_calculate(tqqq_real_data)
            
            # Step 3: Adjust real TQQQ data to continue seamlessly from simulated data
            adjusted_real_tqqq = adjust_real_tqqq_to_simulated(simulated_tqqq, raw_real_tqqq_data)
            
            # Step 4: Merge simulated and adjusted real TQQQ data
            all_tqqq_data = {}
            all_tqqq_data.update(simulated_tqqq)
            all_tqqq_data.update(adjusted_real_tqqq)
            
            # Step 5: Recalculate rates and SMA200 for the complete dataset
            print("🔄 Recalculating rates and SMA200 for complete TQQQ dataset...")
            sorted_dates = sorted(all_tqqq_data.keys())
            
            # Recalculate all rates
            for i, date in enumerate(sorted_dates):
                close_value = all_tqqq_data[date]["close"]
                open_value = all_tqqq_data[date]["open"]
                
                if i == 0:
                    # First day - no previous data
                    overnight_rate = 0
                    combined_rate = 0
                else:
                    prev_date = sorted_dates[i-1]
                    prev_close = all_tqqq_data[prev_date]["close"]
                    
                    # Overnight rate: previous close to current open
                    overnight_rate = (open_value - prev_close) / prev_close * 100
                    
                    # Combined rate: previous close to current close
                    combined_rate = (close_value - prev_close) / prev_close * 100
                
                # Day rate: current open to current close
                day_rate = (close_value - open_value) / open_value * 100
                
                # Update rates
                all_tqqq_data[date]["overnight_rate"] = round(overnight_rate, 6)
                all_tqqq_data[date]["day_rate"] = round(day_rate, 6)
                all_tqqq_data[date]["rate"] = round(combined_rate, 6)
            
            # Recalculate SMA200 and SMA3
            close_prices = [all_tqqq_data[date]["close"] for date in sorted_dates]
            for i, date in enumerate(sorted_dates):
                if i < 199:
                    all_tqqq_data[date]["sma200"] = None
                else:
                    sma200 = sum(close_prices[i - 199 : i + 1]) / 200
                    all_tqqq_data[date]["sma200"] = round(sma200, 6)
                
                if i < 2:
                    all_tqqq_data[date]["sma3"] = None
                else:
                    sma3 = sum(close_prices[i - 2 : i + 1]) / 3
                    all_tqqq_data[date]["sma3"] = round(sma3, 6)
            
            # Sort by date
            tqqq_data = {date: all_tqqq_data[date] for date in sorted_dates}
        
        tqqq_path = save_data("TQQQ", tqqq_data, output_dir)
        
    except Exception as e:
        print(f"❌ Unexpected error processing TQQQ data: {e}")
        print("🛡️  Checking if existing TQQQ data should be preserved...")
        
        # Check for existing TQQQ data
        existing_tqqq_path = os.path.join(output_dir, "TQQQ.json")
        if os.path.exists(existing_tqqq_path):
            try:
                with open(existing_tqqq_path, 'r') as f:
                    existing_tqqq_data = json.load(f)
                print(f"✅ Existing TQQQ data preserved ({len(existing_tqqq_data)} days)")
                
                # Show final summary with existing data
                print("\n" + "🎉" * 20)
                print("✅ DATA DOWNLOAD COMPLETED (with existing data)")
                print("🎉" * 20)
                print(f"📁 QQQ data: {len(qqq_data)} days")
                print(f"📁 TQQQ data: {len(existing_tqqq_data)} days (existing)")
                return
                
            except Exception as e2:
                print(f"❌ Could not verify existing TQQQ data: {e2}")
        
        print("🚫 TQQQ data processing failed and no existing data available")
        return
    
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
