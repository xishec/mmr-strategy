# Stock Data Download Scripts

Two Python scripts for downloading and maintaining historical stock data for TQQQ and QQQ.

## Setup

1. **Install Dependencies**
   ```bash
   cd src/data/script
   pip install -r requirements.txt
   ```

2. **API Configuration (Optional)**
   Create a `.env` file in this directory:
   ```
   TWELVEDATA_API_KEY=your_api_key_here
   ```
   
   Get a free API key from [Twelve Data](https://twelvedata.com/) for better rate limits.
   If no API key is provided, Yahoo Finance will be used as fallback.

## Scripts

### 1. Initial Historical Download
```bash
python download_complete_data.py
```

**What it does:**
- Downloads complete historical data from 1998 to today
- Prioritizes Twelve Data for maximum date range possible
- Uses Yahoo Finance only for older data not available on Twelve Data
- For TQQQ: simulates early years (1998-2010) from QQQ, uses real data (2010+)
- Calculates adjusted open/close prices, daily returns, and SMA200
- Outputs: `QQQ.json` and `TQQQ.json` in `src/data/`

**Data Format:**
```json
{
  "2023-01-03": {
    "open": 267.22,
    "close": 268.30,
    "rate": 0.845123,
    "sma200": 285.45
  }
}
```

### 2. Daily Updates
```bash
python daily_update.py
```

**What it does:**
- Updates existing QQQ.json and TQQQ.json with latest data
- Detects missing dates and fills gaps
- Can be run multiple times safely (won't duplicate data)
- Recalculates SMA200 for affected periods

**Safe to run:**
- Multiple times per day
- Even if market is closed
- When data is already up-to-date

## Data Fields

- **open**: Adjusted opening price
- **close**: Adjusted closing price  
- **rate**: Daily return percentage (close-to-close)
- **sma200**: 200-day Simple Moving Average (null for first 199 days)

## Error Handling

Both scripts include robust error handling:
- Prioritizes Twelve Data API for better accuracy and coverage
- API failures → Falls back to Yahoo Finance automatically
- Missing historical data → Yahoo Finance fills the gaps
- Network issues → Retries with different data source
- File errors → Clear error messages

## Usage Examples

**Fresh install:**
```bash
# Download complete historical data (1998-today)
python download_complete_data.py

# Set up daily cron job for updates
# 0 18 * * 1-5 cd /path/to/script && python daily_update.py
```

**Regular maintenance:**
```bash
# Update with latest data (run daily after market close)
python daily_update.py
```

## Output

Data files will be created in `src/data/`:
- `QQQ.json` - QQQ historical data
- `TQQQ.json` - TQQQ historical data (simulated + real)

Each file contains ~6,500+ trading days from 1998 to present.
