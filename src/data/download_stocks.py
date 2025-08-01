import json

import yfinance as yf
from datetime import datetime, timezone
import os

DIR = os.path.dirname(os.path.realpath(__file__))


def download_stock(ticker):
    print("*** Downloading TQQQ data to csv ***")

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
            rounding=False,
            # Removed session parameter to let yfinance handle it internally
        )

        if df.empty:
            print(f"No data found for {ticker}")
            return False

        output_dir = os.path.join(os.path.dirname(DIR), "./data")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{ticker}_raw.json")
        df.to_json(output_path)

        print(f"Successfully saved {ticker} data to {output_path}")
        print(f"Total rows: {len(df)}")

        # Inside download_stock function, after loading the JSON data
        with open(output_path, 'r') as f:
            data = json.load(f)

        # Extract only the Adj Close column for the specified ticker
        if f"('Adj Close', '{ticker}')" in data:
            # Create a new dictionary for percentage changes
            percent_changes = {}

            for k, v in data.items():
                if k.startswith(f"('Adj Close', '{ticker}')"):
                    # Get the values dictionary
                    values_dict = v

                    # Convert keys to dates and sort them chronologically
                    date_values = []
                    for timestamp_str, value in values_dict.items():
                        date_obj = datetime.fromtimestamp(int(timestamp_str) / 1000, tz=timezone.utc)
                        date_str = date_obj.strftime('%Y-%m-%d')
                        date_values.append((date_str, value))

                    # Sort by date
                    date_values.sort(key=lambda x: x[0])

                    # Calculate percentage changes
                    prev_value = None
                    for date_str, value in date_values:
                        if prev_value is None:
                            percent_changes[date_str] = 0
                        else:
                            pct_change = (value - prev_value) / prev_value * 100
                            percent_changes[date_str] = round(pct_change, 2)
                        prev_value = value

                    break

            output_path = os.path.join(output_dir, f"{ticker}.json")
            # Save the percentage changes to the JSON file
            with open(output_path, 'w') as f:
                json.dump(percent_changes, f)

            print(f"Saved daily percentage changes for {ticker} to {output_path}")

        return True

    except Exception as e:
        print(f"Error downloading {ticker} data: {str(e)}")
        return False


def simulate_TQQQ():
    print("*** Simulating TQQQ data ***")
    output_dir = os.path.join(os.path.dirname(DIR), "./data")
    TQQQ_path = os.path.join(output_dir, "TQQQ.json")
    QQQ_path = os.path.join(output_dir, "QQQ.json")

    if not os.path.exists(TQQQ_path):
        print(f"TQQQ data file not found at {TQQQ_path}. Please download it first.")
        return
    if not os.path.exists(QQQ_path):
        print(f"TQQQ data file not found at {QQQ_path}. Please download it first.")
        return

    with open(TQQQ_path, 'r') as f:
        TQQQ_data = json.load(f)
    with open(QQQ_path, 'r') as f:
        QQQ_data = json.load(f)

    sorted_dates = sorted(QQQ_data.keys())
    first_date = sorted_dates[0]
    QQQ_data.pop(first_date)

    for date, pct_change in sorted(QQQ_data.items()):
        TQQQ_data[date] = (pct_change) * 3

    sorted_TQQQ_data = {k: TQQQ_data[k] for k in sorted(TQQQ_data.keys())}

    with open(QQQ_path, 'w') as f:
        json.dump(QQQ_data, f)
    with open(TQQQ_path, 'w') as f:
        json.dump(sorted_TQQQ_data, f)


if __name__ == "__main__":
    download_stock("QQQ")
    download_stock("TQQQ")
    simulate_TQQQ()
