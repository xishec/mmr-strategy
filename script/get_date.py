import yfinance as yf
from datetime import datetime
import os
DIR = os.path.dirname(os.path.realpath(__file__))

def download_stock_to_csv(ticker):
    print("*** Downloading TQQQ data to CSV ***")

    # Set date range - using a longer period to get all available data
    start_date = "2000-01-01"  # TQQQ inception was in 2010
    end_date = datetime.today().strftime("%Y-%m-%d")

    try:
        # Download TQQQ data - letting yfinance handle the session
        print(f"Downloading {ticker} data from {start_date} to {end_date}...")
        df = yf.download(
            ticker,
            start=start_date,
            end=end_date,
            auto_adjust=False,
            progress=True,
            rounding=False
            # Removed session parameter to let yfinance handle it internally
        )

        if df.empty:
            print(f"No data found for {ticker}")
            return False

        # Save to CSV
        output_dir = os.path.join(os.path.dirname(DIR), 'data')
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f'{ticker}.csv')
        df.to_csv(output_path)

        print(f"Successfully saved {ticker} data to {output_path}")
        print(f"Total rows: {len(df)}")
        return True

    except Exception as e:
        print(f"Error downloading {ticker} data: {str(e)}")
        return False
if __name__ == "__main__":
    download_stock_to_csv("TQQQ")
    download_stock_to_csv("QQQ")