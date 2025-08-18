#!/usr/bin/env python3
"""
Test script for email notifications
Tests the email notification system with mock data to verify it's working correctly.
"""

import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def create_mock_data(scenario="above"):
    """Create richer mock stock data including a short window so SMA & pullback logic behave realistically.

    Scenarios:
        above: QQQ close above 1.05 * SMA200 equivalent (simulated with 20 lower closes then pop higher). No big pullback.
        below: QQQ close below threshold and large pullback (ratio < 0.75).
    """
    base_date = datetime(2025, 8, 14)

    mock_qqq_data = {}
    mock_tqqq_data = {}

    if scenario == "above":
        # 20 prior days around 460, last day jump to 486.75 ( > 460 * 1.05 )
        for i in range(20, 0, -1):
            d = (base_date - timedelta(days=i)).strftime("%Y-%m-%d")
            close_val = 460.0 + (i % 3) * 0.2  # small variation
            mock_qqq_data[d] = {"open": close_val, "close": close_val, "rate": 0}
            mock_tqqq_data[d] = {"open": 70.0, "close": 70.0, "rate": 0}
        latest = base_date.strftime("%Y-%m-%d")
        mock_qqq_data[latest] = {"open": 484.5, "close": 486.75, "rate": 0.64}
        mock_tqqq_data[latest] = {"open": 72.15, "close": 73.25, "rate": 2.48}
    else:
        # Create a prior peak at 640 then drift down to 476.75 (pullback ~ -25%+)
        for i in range(25, 5, -1):
            d = (base_date - timedelta(days=i)).strftime("%Y-%m-%d")
            # Simulate earlier high values (declining)
            close_val = 640.0 - (25 - i) * 5  # 640, 635, ...
            mock_qqq_data[d] = {"open": close_val, "close": close_val, "rate": 0}
            mock_tqqq_data[d] = {"open": 90.0, "close": 90.0, "rate": 0}
        # Some mid-range values closer to current
        for i in range(5, 0, -1):
            d = (base_date - timedelta(days=i)).strftime("%Y-%m-%d")
            close_val = 500.0 - i * 4
            mock_qqq_data[d] = {"open": close_val, "close": close_val, "rate": 0}
            mock_tqqq_data[d] = {"open": 75.0, "close": 75.0, "rate": 0}
        latest = base_date.strftime("%Y-%m-%d")
        mock_qqq_data[latest] = {"open": 475.20, "close": 476.75, "rate": -0.19}
        mock_tqqq_data[latest] = {"open": 68.15, "close": 68.25, "rate": -1.41}

    return mock_qqq_data, mock_tqqq_data


def preview_email_content(scenario):
    """Preview email content using production create_email_content with new SMA & pullback fields.

    We compute SMA200 and pullback on the mock dataset to mimic send_update_notifications output.
    """
    from daily_update import create_email_content, compute_sma, compute_recent_big_pullback

    mock_qqq_data, mock_tqqq_data = create_mock_data(scenario)
    latest_date = sorted(mock_qqq_data.keys())[-1]

    sma200 = compute_sma(mock_qqq_data, latest_date, 200, "close") or mock_qqq_data[latest_date]["close"]
    pullback_ratio, recent_big_pullback = compute_recent_big_pullback(
        mock_qqq_data, latest_date, 200, 0.75, "close"
    )

    qqq_data = {
        "close": mock_qqq_data[latest_date]["close"],
        "sma200": sma200,
        "rate": mock_qqq_data[latest_date]["rate"],
        "date": latest_date,
        "pullbackRatio": pullback_ratio,
        "recentBigPullback": recent_big_pullback,
    }

    tqqq_data = {
        "close": mock_tqqq_data[latest_date]["close"],
        "sma200": compute_sma(mock_tqqq_data, latest_date, 200, "close")
        or mock_tqqq_data[latest_date]["close"],
        "rate": mock_tqqq_data[latest_date]["rate"],
        "date": latest_date,
    }

    subject, email_body = create_email_content(qqq_data, tqqq_data, latest_date)
    return subject, email_body


def test_email_notification(scenario="above"):
    """Test the email notification system"""
    print(f"🧪 Testing Email Notification System - {scenario.upper()} scenario")
    print("=" * 60)

    # Check if environment variables are set
    email_user = os.getenv("EMAIL_USER")
    email_password = os.getenv("EMAIL_PASSWORD")
    recipient_email = os.getenv("RECIPIENT_EMAIL")

    if not all([email_user, email_password, recipient_email]):
        print("❌ Missing email configuration in .env file")
        print("   Required: EMAIL_USER, EMAIL_PASSWORD, RECIPIENT_EMAIL")
        return False

    print(f"📧 Email User: {email_user}")
    print(f"📧 Recipients: {recipient_email}")
    print()

    # Create mock data
    mock_qqq_data, mock_tqqq_data = create_mock_data(scenario)

    # Preview email content
    subject, body = preview_email_content(scenario)

    print("📧 EMAIL PREVIEW:")
    print("=" * 40)
    print(f"Subject: {subject}")
    print()
    print("Body:")
    print(body)
    print("=" * 40)
    print()

    # Determine latest date from mocks
    latest_date = sorted(mock_qqq_data.keys())[-1]

    # Create mock updates summary (ensure QQQ is processed by putting it last because production code only uses last element)
    mock_updates = [
        {"ticker": "TQQQ", "dates": [latest_date], "count": 1},
        {"ticker": "QQQ", "dates": [latest_date], "count": 1},
    ]

    try:
        # Temporarily save mock data to files so daily_update can read them
        with open("../QQQ.json", "r") as f:
            original_qqq = json.load(f)
        with open("../TQQQ.json", "r") as f:
            original_tqqq = json.load(f)

        # Backup and replace with mock data
        with open("../QQQ.json", "w") as f:
            json.dump(mock_qqq_data, f, indent=2)
        with open("../TQQQ.json", "w") as f:
            json.dump(mock_tqqq_data, f, indent=2)

        # Import the notification function
        from daily_update import send_update_notifications

        print("📤 Sending test email...")

        # Send the test notification
        send_update_notifications(mock_updates)

        print("✅ Test email sent successfully!")
        print("📬 Check your email inbox for the notification")

        # Restore original data
        with open("../QQQ.json", "w") as f:
            json.dump(original_qqq, f, indent=2)
        with open("../TQQQ.json", "w") as f:
            json.dump(original_tqqq, f, indent=2)

    except Exception as e:
        print(f"❌ Error sending test email: {str(e)}")
        # Try to restore original data
        try:
            with open("../QQQ.json", "w") as f:
                json.dump(original_qqq, f, indent=2)
            with open("../TQQQ.json", "w") as f:
                json.dump(original_tqqq, f, indent=2)
        except:
            pass
        return False

    return True


if __name__ == "__main__":
    print("📧 Email Notification Test Script")
    print("This script will show you mock email content and let you send test emails")
    print()

    # Choose scenario
    print("Choose test scenario:")
    print("1. 📈 QQQ ABOVE SMA200+5% (Bullish)")
    print("2. 📉 QQQ BELOW SMA200+5% (Bearish)")
    print()

    choice = input("Enter your choice (1 or 2): ").strip()

    if choice == "1":
        scenario = "above"
        print("\n🔸 Testing ABOVE SMA200+5% scenario...")
    elif choice == "2":
        scenario = "below"
        print("\n🔸 Testing BELOW SMA200+5% scenario...")
    else:
        print("❌ Invalid choice. Exiting.")
        exit(1)

    print()
    success = test_email_notification(scenario)

    if success:
        print("\n🎉 Test completed successfully!")
    else:
        print("\n❌ Test failed - check configuration")
