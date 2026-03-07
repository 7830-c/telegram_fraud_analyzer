"""
OTP Test Script - Debug Telegram OTP sending issues
Run: python test_otp.py <phone_number>
Example: python test_otp.py +919876543210
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env.local"
load_dotenv(env_path)

# Check if Telethon is installed
try:
    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError
    print("✓ Telethon imported successfully")
except ImportError as e:
    print(f"✗ Failed to import Telethon: {e}")
    sys.exit(1)

# Get configuration
API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")

print("\n" + "="*60)
print("TELEGRAM OTP TEST SCRIPT")
print("="*60)

# Validate API credentials
print("\n[1] Checking API Credentials:")
print(f"    API_ID: {API_ID}")
print(f"    API_HASH: {'*' * len(API_HASH) if API_HASH else 'NOT SET'}")

if not API_ID:
    print("    ✗ TELEGRAM_API_ID not set in .env.local")
    sys.exit(1)
if not API_HASH:
    print("    ✗ TELEGRAM_API_HASH not set in .env.local")
    sys.exit(1)

try:
    API_ID = int(API_ID)
    print(f"    ✓ API_ID is valid integer: {API_ID}")
except ValueError:
    print(f"    ✗ API_ID is not a valid integer: {API_ID}")
    sys.exit(1)

# Get phone number
if len(sys.argv) < 2:
    print("\n✗ Usage: python test_otp.py <phone_number>")
    print("  Example: python test_otp.py +919876543210")
    sys.exit(1)

phone_number = sys.argv[1].strip()

# Normalize phone number
if not phone_number.startswith('+'):
    phone_number = '+' + phone_number
    
print(f"\n[2] Phone Number:")
print(f"    Input: {sys.argv[1]}")
print(f"    Normalized: {phone_number}")

if not phone_number[1:].isdigit():
    print("    ✗ Phone number contains invalid characters")
    sys.exit(1)
print("    ✓ Phone number format is valid")

# Create session file path
session_dir = Path(__file__).parent / "telegram_sessions"
session_dir.mkdir(exist_ok=True)
session_file = session_dir / f"{phone_number.replace('+', '')}"

print(f"\n[3] Session File:")
print(f"    Path: {session_file}")
print(f"    Directory exists: {session_dir.exists()}")
print(f"    Session exists: {session_file.exists()}")

# Main async function
async def test_otp():
    print(f"\n[4] Initializing TelegramClient:")
    try:
        client = TelegramClient(str(session_file), API_ID, API_HASH)
        print(f"    ✓ Client created")
    except Exception as e:
        print(f"    ✗ Failed to create client: {e}")
        return False

    print(f"\n[5] Connecting to Telegram:")
    try:
        await client.connect()
        print(f"    ✓ Connected successfully")
    except Exception as e:
        print(f"    ✗ Connection failed: {e}")
        return False

    print(f"\n[6] Checking Authorization Status:")
    try:
        is_authorized = await client.is_user_authorized()
        if is_authorized:
            print(f"    ✓ User is already authorized (logged in)")
            await client.disconnect()
            return True
        else:
            print(f"    ℹ User is not authorized (need to login)")
    except Exception as e:
        print(f"    ✗ Authorization check failed: {e}")
        await client.disconnect()
        return False

    print(f"\n[7] Requesting OTP Code:")
    print(f"    Phone: {phone_number}")
    print(f"    Sending code request...")
    
    try:
        result = await client.send_code_request(phone_number)
        print(f"    ✓ OTP Request Successful!")
        print(f"    Phone Code Hash: {result.phone_code_hash}")
        print(f"\n    ► OTP should arrive via:")
        print(f"      - Telegram App (if installed)")
        print(f"      - SMS (if Telegram doesn't have your number)")
        print(f"      - Phone Call (as fallback)")
        
        # Now test OTP entry
        print(f"\n[8] Testing OTP Verification:")
        otp_code = input(f"    Enter the OTP code you received: ").strip()
        
        if not otp_code:
            print(f"    ✗ No OTP code entered")
            await client.disconnect()
            return False
        
        print(f"    Verifying OTP: {otp_code}")
        try:
            user = await client.sign_in(phone_number, otp_code, phone_code_hash=result.phone_code_hash)
            print(f"    ✓ OTP Verification Successful!")
            print(f"    User ID: {user.id}")
            print(f"    Username: {user.username or 'N/A'}")
            print(f"    Name: {user.first_name or ''} {user.last_name or ''}".strip())
            await client.disconnect()
            return True
        except SessionPasswordNeededError:
            print(f"    ⚠ Two-factor authentication required")
            print(f"    Enter your password:")
            password = input("    Password: ").strip()
            try:
                user = await client.sign_in(password=password)
                print(f"    ✓ 2FA Password Verified!")
                await client.disconnect()
                return True
            except Exception as e:
                print(f"    ✗ 2FA password failed: {e}")
                await client.disconnect()
                return False
        except Exception as e:
            print(f"    ✗ OTP verification failed: {e}")
            await client.disconnect()
            return False
            
    except Exception as e:
        error_msg = str(e)
        print(f"    ✗ OTP Request Failed!")
        print(f"    Error: {error_msg}")
        
        # Parse specific errors
        if "PHONE_NUMBER_INVALID" in error_msg:
            print(f"    → Phone number format is invalid")
        elif "PHONE_NUMBER_UNOCCUPIED" in error_msg:
            print(f"    → This phone number is not registered on Telegram")
        elif "PHONE_NUMBER_BANNED" in error_msg:
            print(f"    → This phone number is banned from Telegram")
        elif "FLOOD" in error_msg:
            print(f"    → Too many requests. Wait before trying again")
        elif "CONNECTION" in error_msg:
            print(f"    → Connection error. Check internet and firewall")
        
        await client.disconnect()
        return False

# Run the test
print("\n" + "="*60)
print("Starting async OTP test...")
print("="*60)

try:
    success = asyncio.run(test_otp())
    if success:
        print("\n" + "="*60)
        print("✓ OTP TEST PASSED")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("✗ OTP TEST FAILED")
        print("="*60)
except KeyboardInterrupt:
    print("\n\n✗ Test interrupted by user")
except Exception as e:
    print(f"\n✗ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
