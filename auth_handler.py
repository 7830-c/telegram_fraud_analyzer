"""
Authentication handler for Telethon
Handles OTP requests, verification, and auth check
"""
import sys
import json
import asyncio
from telethon_service import get_or_create_client, check_session_exists

async def handle_request_otp(phone_number: str):
    """Request OTP for a phone number"""
    client = get_or_create_client(phone_number)
    result = await client.send_otp_request()
    # Keep connection alive - DON'T disconnect
    # The hash will be stored in the client instance for verify_otp
    return result

async def handle_verify_otp(phone_number: str, otp_code: str, phone_code_hash: str = None):
    """Verify OTP and login"""
    client = get_or_create_client(phone_number)
    result = await client.verify_otp(otp_code, phone_code_hash=phone_code_hash)
    await client.disconnect()
    return result

async def handle_verify_password(phone_number: str, password: str):
    """Verify 2FA password"""
    client = get_or_create_client(phone_number)
    result = await client.verify_password(password)
    await client.disconnect()
    return result

async def handle_check_auth(phone_number: str):
    """Check if user is authorized"""
    try:
        client = get_or_create_client(phone_number)
        is_authorized = await client.is_authorized()
        await client.disconnect()
        return {
            "status": "success",
            "is_authorized": is_authorized,
            "message": "Currently authorized" if is_authorized else "Not authorized"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

async def main():
    """Main handler"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing arguments"}))
        return
    
    action = sys.argv[1]
    
    try:
        if action == "request_otp":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Missing phone_number"}))
                return
            phone_number = sys.argv[2]
            result = await handle_request_otp(phone_number)
        
        elif action == "verify_otp":
            if len(sys.argv) < 4:
                print(json.dumps({"error": "Missing phone_number or otp_code"}))
                return
            phone_number = sys.argv[2]
            otp_code = sys.argv[3]
            phone_code_hash = sys.argv[4] if len(sys.argv) > 4 else None
            result = await handle_verify_otp(phone_number, otp_code, phone_code_hash)
        
        elif action == "verify_password":
            if len(sys.argv) < 4:
                print(json.dumps({"error": "Missing phone_number or password"}))
                return
            phone_number = sys.argv[2]
            password = sys.argv[3]
            result = await handle_verify_password(phone_number, password)
        
        elif action == "check_auth":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Missing phone_number"}))
                return
            phone_number = sys.argv[2]
            result = await handle_check_auth(phone_number)
        
        else:
            result = {"error": f"Unknown action: {action}"}
        
        print(json.dumps(result))
    
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
