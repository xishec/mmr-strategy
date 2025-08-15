#!/usr/bin/env python3
"""
Test script for email notifications
Tests the email notification system with mock data to verify it's working correctly.
"""

import json
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def create_mock_data(scenario="above"):
    """Create mock stock data for testing"""
    if scenario == "above":
        # QQQ above SMA200+5% scenario
        mock_qqq_data = {
            "2025-08-14": {
                "open": 485.20,
                "close": 486.75,  # Above 483.26 (460.25 * 1.05)
                "overnight_rate": 0.32,
                "day_rate": 0.32,
                "rate": 0.64,
                "sma200": 460.25,
                "sma3": 460.25,
            }
        }

        mock_tqqq_data = {
            "2025-08-14": {
                "open": 72.15,
                "close": 73.25,  # Positive performance
                "overnight_rate": 0.96,
                "day_rate": 1.52,
                "rate": 2.48,
                "sma200": 65.80,
                "sma3": 65.80,
            }
        }
    else:
        # QQQ below SMA200+5% scenario
        mock_qqq_data = {
            "2025-08-14": {
                "open": 475.20,
                "close": 476.75,  # Below 483.26 (460.25 * 1.05)
                "overnight_rate": -0.52,
                "day_rate": 0.33,
                "rate": -0.19,
                "sma200": 460.25,
                "sma3": 460.25,
            }
        }

        mock_tqqq_data = {
            "2025-08-14": {
                "open": 68.15,
                "close": 68.25,  # Negative performance
                "overnight_rate": -1.56,
                "day_rate": 0.15,
                "rate": -1.41,
                "sma200": 65.80,
                "sma3": 65.80,
            }
        }

    return mock_qqq_data, mock_tqqq_data


def preview_email_content(scenario):
    """Preview the email content that would be sent - using daily_update.py's exact function"""
    mock_qqq_data, mock_tqqq_data = create_mock_data(scenario)

    # Get the latest date's data (should be "2025-08-14")
    latest_date = "2025-08-14"
    qqq_latest = mock_qqq_data[latest_date]
    tqqq_latest = mock_tqqq_data[latest_date]

    # Prepare data in the format expected by daily_update.py
    qqq_data = {
        "close": qqq_latest["close"],
        "sma200": qqq_latest["sma200"],
        "day_rate": qqq_latest["day_rate"],
        "rate": qqq_latest["rate"],  # Added missing rate field
    }

    tqqq_data = {
        "close": tqqq_latest["close"], 
        "day_rate": tqqq_latest["day_rate"],
        "rate": tqqq_latest["rate"],  # Added missing rate field
    }

    # Import and use the exact email creation function from daily_update.py
    from daily_update import create_email_content

    # Generate email using the same function as production
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

    # Create mock updates summary
    mock_updates = [
        {"ticker": "QQQ", "dates": ["2025-08-14"], "count": 1},
        {"ticker": "TQQQ", "dates": ["2025-08-14"], "count": 1},
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
