import json

import yfinance as yf
from datetime import datetime, timezone
import os
import time

DIR = os.path.dirname(os.path.realpath(__file__))


def download_stock(ticker):
    print("*** Downloading TQQQ data to csv ***")

    start_date = "1995-01-01"
    end_date = datetime.today().strftime("%Y-%m-%d")

    try:
        print(f"Downloading {ticker} data from {start_date} to {end_date}...")
        df = yf.download(
            ticker,
            start=start_date,
            end=end_date,
            auto_adjust=False,
            progress=True,
            rounding=False,
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
        with open(output_path, "r") as f:
            data = json.load(f)

        # Extract only the Adj Close column for the specified ticker
        if f"('Adj Close', '{ticker}')" in data:
            # Create a new dictionary for both percentage changes and close prices
            stock_data = {}

            for k, v in data.items():
                if k.startswith(f"('Adj Close', '{ticker}')"):
                    # Get the values dictionary
                    values_dict = v

                    # Convert keys to dates and sort them chronologically
                    date_values = []
                    for timestamp_str, value in values_dict.items():
                        date_obj = datetime.fromtimestamp(
                            int(timestamp_str) / 1000, tz=timezone.utc
                        )
                        date_str = date_obj.strftime("%Y-%m-%d")
                        date_values.append((date_str, value))

                    # Sort by date
                    date_values.sort(key=lambda x: x[0])

                    # Calculate percentage changes, SMA200, and store data
                    prev_value = None
                    close_prices = [
                        item[1] for item in date_values
                    ]  # Extract close prices for SMA calculation

                    for i, (date_str, value) in enumerate(date_values):
                        if prev_value is None:
                            pct_change = 0
                        else:
                            pct_change = (value - prev_value) / prev_value * 100

                        # Calculate SMA200 (Simple Moving Average over 200 days)
                        if i < 199:  # Not enough data for 200-day SMA
                            sma200 = None
                        else:
                            sma200 = sum(close_prices[i - 199 : i + 1]) / 200

                        stock_data[date_str] = {
                            "rate": pct_change,
                            "close": value,
                            "sma200": sma200,
                        }
                        prev_value = value

                    break

            output_path = os.path.join(output_dir, f"{ticker}.json")
            # Save the stock data with both rate and close price to the JSON file
            with open(output_path, "w") as f:
                json.dump(stock_data, f)

            print(
                f"Saved daily percentage changes, close prices, and SMA200 for {ticker} to {output_path}"
            )

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

    with open(TQQQ_path, "r") as f:
        TQQQ_data = json.load(f)
    with open(QQQ_path, "r") as f:
        QQQ_data = json.load(f)

    sorted_dates = sorted(QQQ_data.keys())
    first_date = sorted_dates[0]
    QQQ_data.pop(first_date)

    # Initialize TQQQ simulation with starting values
    simulated_TQQQ_data = {}

    # Get the starting close price from QQQ's first remaining day
    if sorted_dates[1:]:  # After removing first date
        first_remaining_date = sorted_dates[1]
        if isinstance(QQQ_data[first_remaining_date], dict):
            starting_close = QQQ_data[first_remaining_date]["close"]
        else:
            starting_close = 100  # Default if old format
    else:
        starting_close = 100

    # Start TQQQ simulation with 3x the starting price of QQQ
    tqqq_close = starting_close * 3
    tqqq_close_prices = []  # Track TQQQ close prices for SMA calculation

    for i, (date, data_obj) in enumerate(sorted(QQQ_data.items())):
        # Extract the rate from QQQ data and multiply by 3 for TQQQ
        qqq_rate = data_obj["rate"] if isinstance(data_obj, dict) else data_obj
        tqqq_rate = qqq_rate * 3

        # Calculate new TQQQ close price based on the leveraged rate
        tqqq_close = tqqq_close * (1 + tqqq_rate / 100)
        tqqq_close_prices.append(tqqq_close)

        # Calculate SMA200 for TQQQ (Simple Moving Average over 200 days)
        if i < 199:  # Not enough data for 200-day SMA
            tqqq_sma200 = None
        else:
            tqqq_sma200 = sum(tqqq_close_prices[i - 199 : i + 1]) / 200

        simulated_TQQQ_data[date] = {
            "rate": round(tqqq_rate, 2),
            "close": round(tqqq_close, 2),
            "sma200": round(tqqq_sma200, 2) if tqqq_sma200 is not None else None,
        }

    # Replace TQQQ_data with simulated data
    TQQQ_data = simulated_TQQQ_data

    sorted_TQQQ_data = {k: TQQQ_data[k] for k in sorted(TQQQ_data.keys())}

    with open(QQQ_path, "w") as f:
        json.dump(QQQ_data, f)
    with open(TQQQ_path, "w") as f:
        json.dump(sorted_TQQQ_data, f)

    # Also write to CSV format
    import csv

    csv_path = os.path.join(output_dir, "TQQQ.csv")
    with open(csv_path, "w", newline="") as csvfile:
        csv_writer = csv.writer(csvfile)
        # Write header row
        csv_writer.writerow(["Date", "Percentage_Change", "Close_Price", "SMA200"])
        # Write data rows
        for date, data_obj in sorted(sorted_TQQQ_data.items()):
            if isinstance(data_obj, dict):
                sma200_value = data_obj.get("sma200", "N/A")
                csv_writer.writerow(
                    [date, data_obj["rate"], data_obj["close"], sma200_value]
                )
            else:
                # Handle old format if it exists
                csv_writer.writerow([date, data_obj, "N/A", "N/A"])

    print(f"Simulated TQQQ data saved to {csv_path}")


if __name__ == "__main__":
    # Retry logic for downloading QQQ data
    print("Starting QQQ download with retry logic...")
    while True:
        if download_stock("QQQ"):
            print("QQQ download successful!")
            break
        else:
            print("QQQ download failed, retrying in 2 seconds...")
            time.sleep(2)

    # Brief pause between downloads
    time.sleep(2)

    # Retry logic for downloading TQQQ data
    print("Starting TQQQ download with retry logic...")
    while True:
        if download_stock("TQQQ"):
            print("TQQQ download successful!")
            break
        else:
            print("TQQQ download failed, retrying in 2 seconds...")
            time.sleep(2)

    simulate_TQQQ()
