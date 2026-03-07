"""
Channel analyzer using Telethon
Fetches and analyzes channel data
"""
import sys
import json
import asyncio
from telethon_service import get_or_create_client

async def analyze_channel(phone_number: str, channel_identifier: str):
    """Analyze a Telegram channel"""
    client = get_or_create_client(phone_number)
    
    try:
        # Check if authorized
        if not await client.is_authorized():
            return {
                "status": "error",
                "error": "User not authorized. Please login first."
            }
        
        # Get channel info
        result = await client.get_channel_info(channel_identifier)
        await client.disconnect()
        return result
    
    except Exception as e:
        await client.disconnect()
        return {
            "status": "error",
            "error": str(e)
        }

async def main():
    """Main handler"""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        return
    
    phone_number = sys.argv[1]
    channel_identifier = sys.argv[2]
    
    try:
        result = await analyze_channel(phone_number, channel_identifier)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
