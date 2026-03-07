"""
Telethon Telegram Service for Fraud Analysis
Handles authentication and channel data retrieval
"""
import os
import json
import sys
from pathlib import Path

# telethon import with diagnostic information if it fails
try:
    from telethon import TelegramClient, events
    from telethon.errors import SessionPasswordNeededError
except ImportError as e:
    raise ImportError(f"{e} (executed by {sys.executable})")

import asyncio
from datetime import datetime

# Configuration
API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "")

# Validate that API credentials are configured
if not API_ID or API_ID == 0 or not API_HASH:
    import warnings
    warnings.warn(
        f"Warning: TELEGRAM_API_ID or TELEGRAM_API_HASH not properly configured. "
        f"API_ID={API_ID}, API_HASH={'*' * len(API_HASH) if API_HASH else 'not set'}"
    )
SESSION_DIR = Path("./telegram_sessions")
SESSION_DIR.mkdir(exist_ok=True)

class TelethonService:
    def __init__(self, phone_number: str):
        # Normalize phone number - ensure it starts with +
        self.phone_number = self._normalize_phone_number(phone_number)
        self.session_file = SESSION_DIR / f"{self.phone_number.replace('+', '')}"
        self.client = TelegramClient(str(self.session_file), API_ID, API_HASH)
        self.otp_code = None
        self.phone_code_hash = None  # Store hash from OTP request
    
    @staticmethod
    def _normalize_phone_number(phone_number: str) -> str:
        """Normalize phone number to +XXX format"""
        # Remove any spaces, dashes, parentheses
        phone = phone_number.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        # Add + if not present
        if not phone.startswith('+'):
            phone = '+' + phone
        return phone
    
    async def start(self):
        """Initialize and connect client"""
        try:
            if not self.client.is_connected():
                await self.client.connect()
        except Exception as e:
            # Log connection error but allow it to propagate
            raise Exception(f"Failed to connect to Telegram: {str(e)}")
    
    async def is_authorized(self) -> bool:
        """Check if user is already authorized"""
        try:
            return await self.client.is_user_authorized()
        except Exception:
            return False
    
    async def send_otp_request(self) -> dict:
        """Request OTP for login"""
        try:
            # Validate API credentials
            if not API_ID or API_ID == 0:
                return {
                    "status": "error",
                    "error": "Telegram API not configured. Please set TELEGRAM_API_ID in .env.local"
                }
            if not API_HASH:
                return {
                    "status": "error",
                    "error": "Telegram API not configured. Please set TELEGRAM_API_HASH in .env.local"
                }
            
            await self.start()
            
            # Check if already authorized
            if await self.is_authorized():
                return {
                    "status": "already_authorized",
                    "message": "User already logged in"
                }
            
            # Request code with the normalized phone number
            try:
                result = await self.client.send_code_request(self.phone_number)
                # Store the hash for later verification
                self.phone_code_hash = result.phone_code_hash
                return {
                    "status": "otp_sent",
                    "message": f"OTP sent to {self.phone_number}. Check your Telegram app or SMS.",
                    "phone_code_hash": result.phone_code_hash
                }
            except Exception as send_error:
                error_msg = str(send_error)
                # Provide specific error messages
                if "PHONE_NUMBER_INVALID" in error_msg:
                    return {
                        "status": "error",
                        "error": f"Invalid phone number format: {self.phone_number}. Use format like +1234567890"
                    }
                elif "PHONE_NUMBER_UNOCCUPIED" in error_msg:
                    return {
                        "status": "error",
                        "error": "This phone number is not registered on Telegram. Please register first."
                    }
                elif "FLOOD" in error_msg:
                    return {
                        "status": "error",
                        "error": "Too many requests. Please wait a few minutes before trying again."
                    }
                else:
                    return {
                        "status": "error",
                        "error": f"Failed to send OTP: {error_msg}"
                    }
        except Exception as e:
            return {
                "status": "error",
                "error": f"Connection error: {str(e)}"
            }
    
    async def verify_otp(self, otp_code: str, phone_code_hash: str = None) -> dict:
        """Verify OTP and complete login"""
        try:
            await self.start()
            
            # Use stored hash if provided parameter is None
            hash_to_use = phone_code_hash or self.phone_code_hash
            
            # First attempt: direct sign-in with OTP
            try:
                user = await self.client.sign_in(self.phone_number, otp_code, phone_code_hash=hash_to_use)
                return {
                    "status": "success",
                    "message": "Successfully logged in",
                    "user": {
                        "id": user.id,
                        "username": user.username or "No username",
                        "first_name": user.first_name or "",
                        "phone": user.phone or ""
                    }
                }
            except SessionPasswordNeededError:
                # User has 2FA enabled
                return {
                    "status": "password_needed",
                    "message": "Two-factor authentication enabled. Please provide password."
                }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def verify_password(self, password: str) -> dict:
        """Verify 2FA password"""
        try:
            await self.start()
            user = await self.client.sign_in(password=password)
            return {
                "status": "success",
                "message": "Successfully logged in",
                "user": {
                    "id": user.id,
                    "username": user.username or "No username",
                    "first_name": user.first_name or "",
                    "phone": user.phone or ""
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def get_channel_info(self, channel_identifier: str) -> dict:
        """Fetch channel information and messages"""
        try:
            await self.start()
            
            # Normalize channel identifier
            if channel_identifier.startswith("@"):
                channel_identifier = channel_identifier[1:]
            if channel_identifier.startswith("https://t.me/"):
                channel_identifier = channel_identifier.replace("https://t.me/", "")
            
            # Get channel entity
            try:
                entity = await self.client.get_entity(channel_identifier)
            except ValueError:
                return {
                    "status": "error",
                    "error": f"Channel '{channel_identifier}' not found or not accessible"
                }
            
            # Extract channel info
            channel_data = {
                "channel_id": entity.id,
                "channel_name": entity.title if hasattr(entity, 'title') else "Unknown",
                "description": entity.description if hasattr(entity, 'description') else None,
                "member_count": entity.participants_count if hasattr(entity, 'participants_count') else None,
                "verified": entity.verified if hasattr(entity, 'verified') else False,
                "is_mega": entity.megagroup if hasattr(entity, 'megagroup') else False,
                "is_private": entity.broadcast if hasattr(entity, 'broadcast') else False,
            }
            
            # Fetch recent messages
            messages_data = []
            try:
                async for message in self.client.iter_messages(entity, limit=100):
                    if message.text:
                        messages_data.append({
                            "date": message.date.isoformat(),
                            "text": message.text[:1000],  # Limit text size
                            "sender_id": message.sender_id,
                            "views": message.views or 0,
                            "forwards": message.forwards or 0
                        })
            except Exception as msg_error:
                channel_data["message_fetch_error"] = str(msg_error)
            
            # Analyze for red flags
            red_flags = []
            
            # Check description for suspicious content
            if channel_data["description"]:
                description_lower = channel_data["description"].lower()
                suspicious_keywords = [
                    "giveaway", "free", "earn", "crypto", "bitcoin", "investment",
                    "guaranteed", "roi", "pump", "token", "airdrop", "limited time",
                    "click link", "join now", "profit"
                ]
                for keyword in suspicious_keywords:
                    if keyword in description_lower:
                        red_flags.append(f"Suspicious keyword in description: '{keyword}'")
            
            # Check messages for red flags
            for msg in messages_data:
                msg_lower = msg["text"].lower()
                if any(word in msg_lower for word in ["private key", "seed phrase", "password", "send crypto"]):
                    red_flags.append("Message contains requests for sensitive info")
                if any(word in msg_lower for word in ["buy now", "limited offer", "urgent"]):
                    red_flags.append("Message uses urgency/pressure tactics")
            
            # Calculate risk score
            risk_score = 0
            if red_flags:
                risk_score += min(len(red_flags) * 15, 50)
            if channel_data["member_count"] and channel_data["member_count"] < 100:
                risk_score += 10
            if not channel_data["verified"]:
                risk_score += 5
            
            return {
                "status": "success",
                "channel_metadata": channel_data,
                "messages": messages_data[:50],  # Return up to 50 messages
                "message_summary": f"Retrieved {len(messages_data)} recent messages",
                "red_flags": red_flags,
                "fraud_risk_score": min(risk_score, 100),
                "conclusion": "likely_fraud" if risk_score > 70 else "suspicious" if risk_score > 40 else "legitimate"
            }
        
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def disconnect(self):
        """Close connection"""
        await self.client.disconnect()


# Global client storage
_clients = {}

def get_or_create_client(phone_number: str) -> TelethonService:
    """Get existing or create new client"""
    if phone_number not in _clients:
        _clients[phone_number] = TelethonService(phone_number)
    return _clients[phone_number]

async def check_session_exists(phone_number: str) -> bool:
    """Check if session file exists for phone number"""
    session_file = SESSION_DIR / f"{phone_number.replace('+', '')}.session"
    return session_file.exists()
