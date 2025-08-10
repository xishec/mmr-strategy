# Stock Data API Setup Instructions

This project can use either Alpha Vantage or Polygon.io to download QQQ and TQQQ stock data.

## Option 1: Polygon.io (Recommended - Better Free Tier)

### Setup Steps

1. **Get a free Polygon.io API key:**
   - Go to https://polygon.io/
   - Sign up for a free account  
   - Copy your API key

2. **Configure your environment:**
   - Open the `.env` file in `src/data/script/`
   - Add your Polygon.io API key:
     ```
     POLYGON_API_KEY=YOUR_ACTUAL_API_KEY_HERE
     ```

3. **Test your setup:**
   ```bash
   cd src/data/script
   python3 test_polygon.py
   ```

4. **Download stock data:**
   ```bash
   cd src/data/script
   python3 download_stocks_polygon.py
   ```

### Polygon.io Benefits:
- ✅ **5 API calls per minute (vs 5 per minute Alpha Vantage)**
- ✅ **Adjusted prices included for free**
- ✅ **Professional-grade data quality**
- ✅ **No daily limits on free tier**

## Option 2: Alpha Vantage (Backup Option)

1. **Get a free Alpha Vantage API key:**
   - Go to https://www.alphavantage.co/support/#api-key
   - Sign up for a free account
   - Copy your API key

2. **Configure your environment:**
   - Open the `.env` file in `src/data/script/`
   - Add your Alpha Vantage API key:
     ```
     ALPHA_VANTAGE_API_KEY=YOUR_ACTUAL_API_KEY_HERE
     ```

3. **Test your setup:**
   ```bash
   cd src/data/script
   python3 test_api.py
   ```

4. **Download stock data:**
   ```bash
   cd src/data/script  
   python3 download_stocks.py
   ```

### Alpha Vantage Limitations:
- ⚠️ **5 API calls per minute, 100 per day**
- ⚠️ **Adjusted prices require premium subscription**
- ⚠️ **Free tier only has unadjusted prices**

## Important Notes

- **Project structure:** 
  ```
  /
  ├── .env                         # API key configuration
  ├── test_alpha_vantage.py        # Test script
  ├── src/
  │   └── data/
  │       ├── script/
  │       │   ├── download_stocks.py   # Main download script
  │       │   └── requirements.txt     # Python dependencies
  │       ├── QQQ.json             # Output: processed QQQ data
  │       ├── TQQQ.json            # Output: processed TQQQ data
  │       ├── QQQ_raw.json         # Output: raw Alpha Vantage data
  │       ├── TQQQ_raw.json        # Output: raw Alpha Vantage data
  │       └── *.csv                # Output: CSV exports
  ```
- **Free tier limits:** Alpha Vantage free tier allows 5 API calls per minute and 100 calls per day
- **Rate limiting:** The script includes automatic retry logic and delays between requests
- **Data format:** The script downloads full historical data and processes it into the same format as before
- **Security:** Your API key is stored in `.env` which is ignored by git for security

## Troubleshooting

If you get rate limit errors:
- Wait a few minutes before retrying
- The script will automatically retry with delays

If you get API errors:
- Check that your API key is correct in the `.env` file
- Verify you haven't exceeded your daily limit
- Run the test script to diagnose the issue

## Generated Files

The script will create:
- `src/data/QQQ_raw.json` - Raw Alpha Vantage response for QQQ
- `src/data/TQQQ_raw.json` - Raw Alpha Vantage response for TQQQ
- `src/data/QQQ.json` - Processed QQQ data with daily returns, SMA200, etc.
- `src/data/TQQQ.json` - Processed/simulated TQQQ data
- `src/data/TQQQ.csv` - CSV export of TQQQ data
