# 🎯 New QR-Based WhatsApp Account Workflow

This is the **recommended** method for creating WhatsApp API accounts. Scan QR code first, then get your account token and API key.

## 🔄 Complete Workflow

### Step 1: Start QR Session

Begin the account creation process by generating a QR session:

```bash
curl -X POST http://localhost:3000/api/auth/start-qr \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Business Account"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "QR-based account creation started",
  "session": {
    "sessionId": "abc123def456...",
    "apiKey": "xyz789uvw456...",
    "name": "My Business Account"
  },
  "instructions": {
    "step1": "Scan QR code to connect your WhatsApp",
    "step2": "After successful scan, you will receive your account token",
    "step3": "Use the token + API key to send messages"
  },
  "qrCodeUrl": "/api/auth/qr/abc123def456...",
  "tokenCheckUrl": "/api/auth/token/abc123def456..."
}
```

### Step 2: Scan QR Code

Open the QR code URL in your browser:

```
http://localhost:3000/api/auth/qr/abc123def456...
```

**Features:**
- 📱 Mobile-friendly QR code display
- 🔄 Auto-refresh every 20 seconds
- 📋 Step-by-step instructions
- 🔗 Direct link to check token status

### Step 3: Connect WhatsApp

1. **Open WhatsApp** on your phone
2. **Go to Settings → Linked Devices**
3. **Tap "Link a device"**
4. **Scan the QR code** with your camera

**What happens during scanning:**
- 🔲 QR code appears in terminal and browser
- 🔄 WhatsApp connects automatically
- ✅ Account token is generated on success
- 📱 WhatsApp details (phone, name) are extracted

### Step 4: Get Your Account Token

After scanning, check if your account token is ready:

```bash
curl -X GET http://localhost:3000/api/auth/token/abc123def456...
```

**Success Response (Account Ready):**
```json
{
  "success": true,
  "message": "Account created successfully!",
  "status": "ready",
  "account": {
    "token": "final_token_789xyz...",
    "name": "My Business Account",
    "apiKey": "xyz789uvw456...",
    "phoneNumber": "919876543210",
    "whatsappName": "John Doe",
    "createdAt": "2025-11-01T12:00:00.000Z",
    "status": "connected"
  },
  "usage": {
    "sendMessages": "POST /api/send-message",
    "templates": "GET /api/templates",
    "checkStatus": "GET /api/account/final_token_789xyz.../status"
  },
  "instructions": {
    "step1": "Save your account token and API key securely",
    "step2": "Use token in X-API-Key header for authentication",
    "step3": "Include token in request body when sending messages"
  },
  "exampleMessage": {
    "url": "POST /api/send-message",
    "headers": {
      "Content-Type": "application/json",
      "X-API-Key": "xyz789uvw456..."
    },
    "body": {
      "to": "919876543210",
      "message": "Hello from my WhatsApp API!",
      "token": "final_token_789xyz..."
    }
  }
}
```

**Pending Response (Still Scanning):**
```json
{
  "success": false,
  "message": "Account creation in progress",
  "status": "pending",
  "instructions": "Please complete QR code scanning first"
}
```

**Expired Response (Session Lost):**
```json
{
  "success": false,
  "message": "Session not found or expired",
  "status": "expired",
  "instructions": "Please start a new QR session: POST /api/auth/start-qr"
}
```

### Step 5: Send Messages!

Now use your **account token** and **API key** to send messages:

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -H "X-API-Key: xyz789uvw456..." \
  -d '{
    "to": "919876543210",
    "message": "Hello from my WhatsApp API!",
    "token": "final_token_789xyz..."
  }'
```

## 🏗️ How It Works

### Technical Flow:

1. **Start Session** → Generate temporary `sessionId` + `apiKey`
2. **Initialize WhatsApp** → Create Baileys socket with temp session
3. **Display QR** → QR code appears in terminal + browser
4. **User Scans** → WhatsApp authenticates automatically
5. **Success Handler** → Extract WhatsApp user details
6. **Create Account** → Generate permanent `accountToken`
7. **Return Credentials** → User gets token + API key
8. **Ready to Use** → Send messages with new credentials

### Security Features:

- 🔐 **Temporary sessions** expire after 5 minutes
- 🔑 **Unique credentials** for each account
- 📱 **WhatsApp-verified** phone numbers
- ⏰ **Auto-cleanup** of expired sessions
- 🛡️ **Account isolation** - each token is separate

## 📱 Browser Experience

The QR code page provides:

- **Step-by-step instructions** for WhatsApp connection
- **Auto-refresh** QR codes every 20 seconds
- **Mobile-responsive** design
- **Direct token check** link
- **Visual feedback** for session status

## 🔄 Comparison with Legacy Method

| Feature | New QR Method | Legacy Method |
|---------|---------------|---------------|
| **Workflow** | Scan QR → Get Token | Get Token → Scan QR |
| **Security** | Temporary sessions | Permanent tokens upfront |
| **WhatsApp Integration** | Built-in verification | Manual setup |
| **User Experience** | One-click scan | Multiple steps |
| **Account Creation** | Automatic | Manual |

## 🛠️ Advanced Usage

### Multiple Accounts

Create multiple WhatsApp accounts easily:

```bash
# Account 1 - Business
curl -X POST http://localhost:3000/api/auth/start-qr \
  -H "Content-Type: application/json" \
  -d '{"name": "Business WhatsApp"}'

# Account 2 - Personal
curl -X POST http://localhost:3000/api/auth/start-qr \
  -H "Content-Type: application/json" \
  -d '{"name": "Personal WhatsApp"}'
```

### Template Messages

Once you have your token, use templates:

```bash
# Create template
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "name": "welcome",
    "template": "Hi {{name}}! Welcome to our service."
  }'

# Use template
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "to": "919876543210",
    "template": "welcome",
    "templateData": {"name": "Alice"},
    "token": "your_account_token"
  }'
```

## 🔧 Error Handling

### Common Issues:

#### QR Code Not Displaying
```
Status: 404 - QR Code Not Found
```
**Solution:** The session may have expired. Start a new session.

#### Session Not Found
```json
{
  "success": false,
  "message": "Session not found or expired",
  "status": "expired"
}
```
**Solution:** Start a new QR session with `/api/auth/start-qr`

#### WhatsApp Connection Failed
**Terminal shows:** Connection errors or timeouts
**Solution:**
- Check internet connection
- Ensure WhatsApp is updated
- Try scanning again with new QR

#### Account Creation Timeout
**Solution:** Sessions expire after 5 minutes. Start a new session.

## 📋 API Endpoints Summary

### QR-Based Workflow:
- `POST /api/auth/start-qr` - Start QR session
- `GET /api/auth/qr/:sessionId` - Display QR code
- `GET /api/auth/token/:sessionId` - Get account token

### Messaging (after getting token):
- `POST /api/send-message` - Send messages
- `GET /api/templates` - List templates
- `POST /api/templates` - Create templates
- `GET /api/account/:token/status` - Check status

### Utilities:
- `GET /api/health` - Server health check
- `GET /api/account/list` - List accounts (admin)

## 🎉 Benefits of New Workflow

✅ **Simpler Process** - Scan QR, get credentials instantly
✅ **Better Security** - Temporary sessions, verified accounts
✅ **Automatic Setup** - No manual configuration needed
✅ **WhatsApp Verified** - Real phone numbers only
✅ **Perfect UX** - Mobile-friendly, guided process
✅ **Production Ready** - Scalable and reliable

---

**Your WhatsApp API is now ready with the modern QR-based workflow! 🚀**

Start with: `POST /api/auth/start-qr` and follow the simple 4-step process.