#!/usr/bin/env python3
"""
Complete Stock Data Downloader - From 1998 to Today
====================================================
- Prioritizes Twelve Data for maximum date range possible
- Uses Yahoo Finance only for older data not available on Twelve Data
- Merges datasets seamlessly
- Outputs: adjusted open, adjusted close, daily returns
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

# Simulation configuration for SPXL (v2 logic)
SPXL_ANNUAL_EXPENSE_RATIO = 0.0095  # 0.95%
SPXL_BORROW_COST = 0.004  # 0.4% additional financing cost
SPXL_MAX_DAILY_TRACKING_ERROR = 0.0002  # 0.02%
SPXL_CALIBRATION_METHOD = "trimmed"  # trimmed | mean | median | none
SPXL_TRIM_FRACTION = 0.05
SPXL_EXTRA_DAILY_DRIFT = 0.0  # keep zero unless intentionally biasing

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
                    "rate": 0  # Will calculate later (combined rate)
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
                    "rate": 0  # Will calculate later (combined rate)
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
    """Calculate rates for a dataset"""
    print("🔄 Calculating metrics...")
    
    # Sort by date
    sorted_dates = sorted(data_dict.keys())
    
    # Calculate daily returns
    prev_close = None
    
    for i, date in enumerate(sorted_dates):
        close_value = data_dict[date]["close"]
        open_value = data_dict[date]["open"]
        
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
        
        # Update data
        data_dict[date]["overnight_rate"] = round(overnight_rate, 6)
        data_dict[date]["day_rate"] = round(day_rate, 6)
        data_dict[date]["rate"] = round(combined_rate, 6)
        
        prev_close = close_value
    
    # Return sorted data
    return {date: data_dict[date] for date in sorted_dates}

def simulate_spxl_from_spy(
    spy_data: dict,
    leverage: float = 3.0,
    annual_expense_ratio: float = 0.0095,
    trading_days_per_year: int = 252,
    starting_price: float | None = None,
    tracking_error_daily: float | None = None,
    calibrate_with_real: dict | None = None,
    calibration_method: str = "trimmed",  # mean | median | trimmed | none
    trim_fraction: float = 0.05,  # fraction each tail removed if trimmed
    max_abs_tracking_error: float = 0.0002,  # 0.02% cap per day
    additional_annual_borrow_cost: float = 0.01,  # approximate financing/borrow cost
    extra_daily_drift: float = 0.0,  # manual additional daily negative drift (decimal), e.g. -0.00005
) -> dict:
    """Simulate leveraged ETF (SPXL) from SPY data with minimal bias.

    Changes (v2):
      • Removed explicit volatility drag adjustment (naturally emerges via compounding).
      • Apply leverage to overnight and intraday components separately but apply fee once per day (at close).
      • Optionally calibrate average daily tracking error from real overlapping data.
      • Scale starting price to underlying*leverage unless overridden.
    """
    print("🔄 Simulating SPXL from SPY data (v2)...")
    if not spy_data:
        return {}
    dates = sorted(spy_data.keys())
    first = dates[0]
    first_close_under = spy_data[first]["close"]
    if starting_price is None:
        start_close = first_close_under * leverage
    else:
        start_close = starting_price

    # Fee (daily simple approximation)
    fee_daily = annual_expense_ratio / trading_days_per_year
    borrow_fee_daily = additional_annual_borrow_cost / trading_days_per_year if additional_annual_borrow_cost > 0 else 0.0

    # Calibrate tracking error if real data provided
    if tracking_error_daily is None and calibrate_with_real and calibration_method != "none":
        overlaps = [d for d in dates if d in calibrate_with_real][1:]
        if overlaps:
            diffs = []
            prev_u = spy_data[first]["close"]
            prev_real_close = calibrate_with_real[overlaps[0]]["close"] if overlaps[0] in calibrate_with_real else None
            # Build mapping of close series for real
            # Iterate in date order
            prev_real = calibrate_with_real[first]["close"] if first in calibrate_with_real else None
            for d in overlaps:
                u_prev = prev_u
                u_now = spy_data[d]["close"]
                r_u = u_now / u_prev - 1
                if prev_real is not None and d in calibrate_with_real:
                    real_prev = prev_real
                    real_now = calibrate_with_real[d]["close"]
                    r_real = real_now / real_prev - 1
                    expected_no_te = leverage * r_u - fee_daily
                    diffs.append(r_real - expected_no_te)
                    prev_real = real_now
                prev_u = u_now
            if diffs:
                sorted_diffs = sorted(diffs)
                if calibration_method == "median":
                    mid = len(sorted_diffs)//2
                    tracking_error_daily = sorted_diffs[mid] if len(sorted_diffs)%2==1 else (sorted_diffs[mid-1]+sorted_diffs[mid])/2
                elif calibration_method == "trimmed":
                    k = int(len(sorted_diffs)*trim_fraction)
                    core = sorted_diffs[k:len(sorted_diffs)-k] if k>0 else sorted_diffs
                    tracking_error_daily = sum(core)/len(core) if core else 0.0
                elif calibration_method == "mean":
                    tracking_error_daily = sum(sorted_diffs)/len(sorted_diffs)
                else:
                    tracking_error_daily = 0.0
                # Cap magnitude
                if tracking_error_daily > max_abs_tracking_error:
                    tracking_error_daily = max_abs_tracking_error
                elif tracking_error_daily < -max_abs_tracking_error:
                    tracking_error_daily = -max_abs_tracking_error
                print(f"📐 Calibrated tracking error ({calibration_method} capped): {tracking_error_daily*100:.4f}% per day (n={len(diffs)})")
            else:
                tracking_error_daily = 0.0
        else:
            tracking_error_daily = 0.0
    elif tracking_error_daily is None:
        tracking_error_daily = 0.0

    out = {
        first: {
            "open": round(start_close, 6),
            "close": round(start_close, 6),
            "overnight_rate": 0.0,
            "day_rate": 0.0,
            "rate": 0.0,
        }
    }
    prev_close_t = start_close
    prev_close_u = first_close_under

    for d in dates[1:]:
        u = spy_data[d]
        o_u = u["open"]
        c_u = u["close"]
        if prev_close_u <= 0 or o_u <= 0 or c_u <= 0:
            out[d] = {"open": round(prev_close_t,6), "close": round(prev_close_t,6), "overnight_rate":0.0, "day_rate":0.0, "rate":0.0}
            continue
        r_o = o_u / prev_close_u - 1
        r_d = c_u / o_u - 1
        # Overnight leveraged move (no fee yet)
        t_open = prev_close_t * (1 + leverage * r_o + tracking_error_daily/2)
        # Intraday leveraged move
        t_close_raw = t_open * (1 + leverage * r_d + tracking_error_daily/2)
        # Apply daily fee at close
        # Apply fees & optional extra drift (drift is additive on return, approximate)
        total_fee_factor = 1 - fee_daily - borrow_fee_daily
        # Ensure not negative
        if total_fee_factor <= 0:
            total_fee_factor = 0.000001
        t_close = t_close_raw * total_fee_factor * (1 + extra_daily_drift)

        overnight_rate = (t_open / prev_close_t - 1) * 100
        day_rate = (t_close / t_open - 1) * 100
        combined = (t_close / prev_close_t - 1) * 100

        out[d] = {
            "open": round(t_open, 6),
            "close": round(t_close, 6),
            "overnight_rate": round(overnight_rate, 6),
            "day_rate": round(day_rate, 6),
            "rate": round(combined, 6),
        }
        prev_close_t = t_close
        prev_close_u = c_u

    return out

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

def adjust_real_spxl_to_simulated(simulated_spxl, raw_real_spxl_data):
    """Adjust real SPXL data to continue seamlessly from simulated data"""
    print("🔄 Adjusting real SPXL data to match simulated data levels...")
    
    if not simulated_spxl or not raw_real_spxl_data:
        return raw_real_spxl_data
    
    # Get the last simulated close price
    last_sim_date = max(simulated_spxl.keys())
    last_sim_close = simulated_spxl[last_sim_date]["close"]
    
    # Get the first real trading day data
    first_real_date = min(raw_real_spxl_data.keys())
    first_real_data = raw_real_spxl_data[first_real_date]
    first_real_open = first_real_data["open"]
    first_real_close = first_real_data["close"]
    
    print(f"📊 Last simulated close ({last_sim_date}): ${last_sim_close:.6f}")
    print(f"📊 First real data ({first_real_date}): open=${first_real_open:.6f}, close=${first_real_close:.6f}")
    
    # Calculate the scaling factor based on the opening price
    # We want the first real opening price to match our simulated closing price from previous day
    scaling_factor = last_sim_close / first_real_open
    
    print(f"📊 Scaling factor: {scaling_factor:.6f}")
    
    # Apply scaling to all real SPXL data
    adjusted_real_data = {}
    for date, data in raw_real_spxl_data.items():
        adjusted_real_data[date] = {
            "open": data["open"] * scaling_factor,
            "close": data["close"] * scaling_factor,
            "overnight_rate": data.get("overnight_rate", 0),  # Keep original rate (percentage change)
            "day_rate": data.get("day_rate", 0),  # Keep original rate (percentage change)
            "rate": data["rate"]  # Keep original rate (percentage change)
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
    print("🎯 Output: Adjusted OHLC, Daily Returns")
    print()
    print("⚠️  Note: This script includes delays to prevent rate limiting")
    print("    from data providers. Please be patient.")
    print("🛡️  Data protection: Existing data will not be overwritten with incomplete/invalid data")
    print()
    
    output_dir = os.path.join(root_dir, "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    # Download SPY data
    print("=" * 50)
    print("📈 DOWNLOADING SPY DATA")
    print("=" * 50)
    
    try:
        spy_data, spy_twelvedata_start = download_hybrid_data("SPY", "1998-01-01")
        
        if not spy_data:
            print("❌ Failed to download SPY data from all sources")
            print("🛡️  Checking if existing SPY data can be used...")
            
            # Check for existing SPY data
            existing_spy_path = os.path.join(output_dir, "SPY.json")
            if os.path.exists(existing_spy_path):
                try:
                    with open(existing_spy_path, 'r') as f:
                        spy_data = json.load(f)
                    print(f"✅ Using existing SPY data ({len(spy_data)} days)")
                    spy_path = existing_spy_path
                except Exception as e:
                    print(f"❌ Could not load existing SPY data: {e}")
                    print("🚫 Cannot proceed without SPY data")
                    return
            else:
                print("🚫 No existing SPY data found. Cannot proceed.")
                return
        else:
            spy_data = merge_and_calculate(spy_data)
            spy_path = save_data("SPY", spy_data, output_dir)
    
    except Exception as e:
        print(f"❌ Unexpected error downloading SPY data: {e}")
        print("🛡️  Checking if existing SPY data can be used...")
        
        # Try to use existing data
        existing_spy_path = os.path.join(output_dir, "SPY.json")
        if os.path.exists(existing_spy_path):
            try:
                with open(existing_spy_path, 'r') as f:
                    spy_data = json.load(f)
                print(f"✅ Using existing SPY data ({len(spy_data)} days)")
            except Exception as e2:
                print(f"❌ Could not load existing SPY data: {e2}")
                print("🚫 Cannot proceed without SPY data")
                return
        else:
            print("🚫 No existing SPY data found. Cannot proceed.")
            return
    
    # Add delay between different ticker downloads to avoid rate limiting
    smart_delay(base_delay=3)
    
    # Download SPXL data (real + simulated)
    print("\n" + "=" * 50)
    print("📈 DOWNLOADING SPXL DATA")
    print("=" * 50)
    
    try:
        # Step 1: Simulate SPXL for early years (1998-2008) from SPY data
        print("🔄 Simulating SPXL for early years (1998-2008)...")
        early_spy = {date: data for date, data in spy_data.items() if date < "2008-11-05"}
        simulated_spxl = simulate_spxl_from_spy(
            early_spy,
            annual_expense_ratio=SPXL_ANNUAL_EXPENSE_RATIO,
            additional_annual_borrow_cost=SPXL_BORROW_COST,
            calibration_method="none",  # calibrate after real data fetched
            max_abs_tracking_error=SPXL_MAX_DAILY_TRACKING_ERROR,
            trim_fraction=SPXL_TRIM_FRACTION,
            extra_daily_drift=SPXL_EXTRA_DAILY_DRIFT,
        )
        
        # Step 2: Get real SPXL data from launch date onwards using hybrid approach
        print("🔄 Downloading real SPXL data from launch date...")
        smart_delay(base_delay=2)  # Add delay before API call
        spxl_real_data, spxl_twelvedata_start = download_hybrid_data("SPXL", "2008-11-05")  # SPXL launch date
        
        if not spxl_real_data:
            print("❌ Failed to download real SPXL data from all sources")
            print("🛡️  Checking if existing SPXL data can be used...")
            
            # Check for existing SPXL data
            existing_spxl_path = os.path.join(output_dir, "SPXL.json")
            if os.path.exists(existing_spxl_path):
                try:
                    with open(existing_spxl_path, 'r') as f:
                        existing_spxl_data = json.load(f)
                    print(f"✅ Existing SPXL data found ({len(existing_spxl_data)} days)")
                    print("🛡️  Keeping existing SPXL data - not overwriting with incomplete data")
                    
                    # Still show final summary
                    print("\n" + "🎉" * 20)
                    print("✅ DATA DOWNLOAD COMPLETED (with existing data)")
                    print("🎉" * 20)
                    print(f"📁 SPY data: {len(spy_data)} days")
                    print(f"📁 SPXL data: {len(existing_spxl_data)} days (existing)")
                    return
                    
                except Exception as e:
                    print(f"❌ Could not load existing SPXL data: {e}")
                    print("⚠️  Will proceed with simulated data only")
                    
            # Use only simulated data if no existing data
            print("⚠️  Using simulated SPXL data only (no real data available)")
            spxl_data = simulated_spxl
        else:
            raw_real_spxl_data = merge_and_calculate(spxl_real_data)

            # Re-simulate early period WITH calibration now that real data is available
            print("🔄 Re-simulating pre-launch SPXL with calibration against real data...")
            if early_spy:
                simulated_spxl = simulate_spxl_from_spy(
                    early_spy,
                    annual_expense_ratio=SPXL_ANNUAL_EXPENSE_RATIO,
                    additional_annual_borrow_cost=SPXL_BORROW_COST,
                    calibration_method=SPXL_CALIBRATION_METHOD,
                    max_abs_tracking_error=SPXL_MAX_DAILY_TRACKING_ERROR,
                    trim_fraction=SPXL_TRIM_FRACTION,
                    extra_daily_drift=SPXL_EXTRA_DAILY_DRIFT,
                    calibrate_with_real=raw_real_spxl_data,
                )
            else:
                print("ℹ️  No pre-launch SPY data available for re-simulation calibration.")
            
            # Step 3: Adjust real SPXL data to continue seamlessly from simulated data
            adjusted_real_spxl = adjust_real_spxl_to_simulated(simulated_spxl, raw_real_spxl_data)
            
            # Step 4: Merge simulated and adjusted real SPXL data
            all_spxl_data = {}
            all_spxl_data.update(simulated_spxl)
            all_spxl_data.update(adjusted_real_spxl)
            
            # Step 5: Recalculate rates for the complete dataset
            print("🔄 Recalculating rates for complete SPXL dataset...")
            sorted_dates = sorted(all_spxl_data.keys())
            
            # Recalculate all rates
            for i, date in enumerate(sorted_dates):
                close_value = all_spxl_data[date]["close"]
                open_value = all_spxl_data[date]["open"]
                
                if i == 0:
                    # First day - no previous data
                    overnight_rate = 0
                    combined_rate = 0
                else:
                    prev_date = sorted_dates[i-1]
                    prev_close = all_spxl_data[prev_date]["close"]
                    
                    # Overnight rate: previous close to current open
                    overnight_rate = (open_value - prev_close) / prev_close * 100
                    
                    # Combined rate: previous close to current close
                    combined_rate = (close_value - prev_close) / prev_close * 100
                
                # Day rate: current open to current close
                day_rate = (close_value - open_value) / open_value * 100
                
                # Update rates
                all_spxl_data[date]["overnight_rate"] = round(overnight_rate, 6)
                all_spxl_data[date]["day_rate"] = round(day_rate, 6)
                all_spxl_data[date]["rate"] = round(combined_rate, 6)
            
            # Sort by date
            spxl_data = {date: all_spxl_data[date] for date in sorted_dates}
        
        spxl_path = save_data("SPXL", spxl_data, output_dir)
        
    except Exception as e:
        print(f"❌ Unexpected error processing SPXL data: {e}")
        print("🛡️  Checking if existing SPXL data should be preserved...")
        
        # Check for existing SPXL data
        existing_spxl_path = os.path.join(output_dir, "SPXL.json")
        if os.path.exists(existing_spxl_path):
            try:
                with open(existing_spxl_path, 'r') as f:
                    existing_spxl_data = json.load(f)
                print(f"✅ Existing SPXL data preserved ({len(existing_spxl_data)} days)")
                
                # Show final summary with existing data
                print("\n" + "🎉" * 20)
                print("✅ DATA DOWNLOAD COMPLETED (with existing data)")
                print("🎉" * 20)
                print(f"📁 SPY data: {len(spy_data)} days")
                print(f"📁 SPXL data: {len(existing_spxl_data)} days (existing)")
                return
                
            except Exception as e2:
                print(f"❌ Could not verify existing SPXL data: {e2}")
        
        print("🚫 SPXL data processing failed and no existing data available")
        return
    
    print("\n" + "🎉" * 20)
    print("✅ COMPLETE DATA DOWNLOAD FINISHED!")
    print("🎉" * 20)
    print(f"📁 SPY data saved to: {spy_path}")
    print(f"📁 SPXL data saved to: {spxl_path}")
    
    if spy_data:
        print(f"📊 SPY: {min(spy_data.keys())} to {max(spy_data.keys())} ({len(spy_data)} days)")
    if spxl_data:
        print(f"📊 SPXL: {min(spxl_data.keys())} to {max(spxl_data.keys())} ({len(spxl_data)} days)")

if __name__ == "__main__":
    download_complete_data()
