# Telegram API Setup & Telethon Integration Guide

## Step 1: Get Telegram API Credentials

1. Go to https://my.telegram.org/auth/login
2. Login with your Telegram account
3. Go to "API development tools"
4. Fill in the form:
   - **App title**: "TinyFish Fraud Analyzer"
   - **Short name**: "tinyfish_fraud_analyzer"
   - Leave other fields as default
5. Click "Create application"
6. Copy your **API ID** and **API Hash**

## Step 2: Set Environment Variables

Create a `.env.local` file in the root directory:

```env
# Existing TinyFish API
TINYFISH_API_KEY=sk-tinyfish-YOUR_KEY_HERE

# Telegram API (NEW)
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here

# Path to a Python executable with Telethon installed
# on Windows it might look like:
# PYTHON_PATH=C:\\Users\\hp\\AppData\\Local\\Programs\\Python\\Python312\\python.exe
PYTHON_PATH=
```

*Important:* the `python` command used by Next.js must match this interpreter. Also you can set `PYTHON_PATH` on the command line when launching the dev server:

```powershell
$env:PYTHON_PATH="C:\Users\hp\AppData\Local\Programs\Python\Python312\python.exe"
npm run dev
```

## Step 3: Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or individually:
```bash
pip install telethon python-dotenv requests
```

## Step 4: Understanding the Flow

### Two-Mode Analysis:

#### Mode 1: Public Channels (No Login Required)
- Uses existing TinyFish browser automation
- Works for any public channel
- Limited to visible metadata and preview content

#### Mode 2: Full Access via Telethon (Login Required)
- User logs in once with Telegram phone + OTP
- Persistent session stored locally
- Can access:
  - All messages in channel (public & private if member)
  - Complete channel metadata
  - Admin information
  - Full content analysis

### Authentication Flow:

1. **User provides phone number**
   - POST `/api/auth` with `action: "request_otp"` and `phone_number`
   - Server sends OTP to Telegram app/SMS

2. **User enters OTP**
   - POST `/api/auth` with `action: "verify_otp"`, `phone_number`, and `otp_code`
   - If 2FA enabled, you'll get password prompt
   - Session saved locally in `telegram_sessions/`

3. **Use for Analysis**
   - POST `/api/telethon-analyze` with `phone_number` and `channel_identifier`
   - Returns full channel data with messages

## Step 5: Using the API

### Check if Authorized:
```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "check_auth", "phone_number": "+1234567890"}'
```

### Request OTP:
```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "request_otp", "phone_number": "+1234567890"}'
```

### Verify OTP:
```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "verify_otp", "phone_number": "+1234567890", "otp_code": "12345"}'
```

### Verify 2FA Password (if needed):
```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "verify_password", "phone_number": "+1234567890", "password": "your_password"}'
```

### Analyze Channel:
```bash
curl -X POST http://localhost:3000/api/telethon-analyze \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+1234567890", "channel_identifier": "@channelname"}'
```

## Step 6: Session Management

Sessions are automatically saved to `telegram_sessions/` directory:
- Each phone number gets its own session file: `{phone}.session`
- Sessions persist across app restarts
- No re-authentication needed after first login
- **Delete session file to logout**

## Step 7: Frontend Integration

The UI will show two options:

1. **Quick Analysis** (Public channels)
   - Instant, no login needed
   - Limited data access

2. **Deep Analysis** (Requires login)
   - Click "Enable Full Access"
   - Enter phone number
   - Complete 2FA if prompted
   - Analyze any accessible channel

## Troubleshooting

### "PhoneNumberInvalidError"
- Ensure phone number format: `+1234567890` (with country code)

### "SessionPasswordNeededError"
- You have 2FA enabled on Telegram
- Call verify_password API with your password

### "ChannelPrivateError"
- You're not a member of the channel
- Can only analyze channels you have access to

### "Timeout Error"
- Channel has too many messages to process
- Telethon auto-limits to 100 recent messages

### "ApiIdInvalidError"
- Check TELEGRAM_API_ID in .env.local
- Must match credentials from my.telegram.org

## Security Notes

⚠️ **Important:**
- Sessions contain auth tokens - keep `telegram_sessions/` directory secure
- Don't commit `.env.local` to git
- Add to `.gitignore`: `telegram_sessions/`, `.env.local`
- Each user creates their own session - isolated access

## Rate Limiting

Telegram has rate limits:
- ~1-2 requests per second per session
- Analyze channels with adequate time between requests
- Telethon handles this automatically

## Next Steps

1. Add Telegram credentials to `.env.local`
2. Install Python packages: `pip install -r requirements.txt`
3. Start Next.js dev server: `npm run dev`
4. Frontend will show auth options for Telethon mode
