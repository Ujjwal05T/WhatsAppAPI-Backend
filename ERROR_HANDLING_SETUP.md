# Server Crash Prevention - Error Handling Setup

## Problem
Your server was crashing with the error:
```
Error: Connection Closed
statusCode: 428
error: 'Precondition Required'
message: 'Connection Closed'
```

This happens when Baileys tries to send message acknowledgments after the WebSocket connection is already closed. It's an **unhandled promise rejection** that crashes Node.js.

## Solution Applied

### 1. Created Global Error Handlers (`src/errorHandlers.ts`)
✅ This file is already created and handles:
- **Uncaught Exceptions** - Prevents crashes from unexpected errors
- **Unhandled Promise Rejections** - Catches async errors like the Baileys socket error
- **Graceful Shutdown** - Handles SIGTERM and SIGINT signals properly

### 2. Enhanced WhatsApp Manager Error Handling (`src/whatsapp/manager.ts`)
✅ Already updated with:
- Wrapped `initializeClient()` in try-catch block
- Added error handling to `connection.update` event handler
- WebSocket error handler already exists

## REQUIRED: Manual Setup Step

Add these 2 lines to `src/app.ts`:

### Option 1: Add after imports (recommended)
```typescript
import { upload } from './middleware/upload.js';
import cors from 'cors'
import { setupGlobalErrorHandlers } from './errorHandlers.js';  // ADD THIS LINE

// Initialize global error handlers to prevent server crashes
setupGlobalErrorHandlers();  // ADD THIS LINE

const app = express();
```

### Option 2: Quick sed command (if you prefer automation)
Run this command from the `backend` directory:

```bash
# On Linux/Mac
sed -i "/import cors from 'cors'/a import { setupGlobalErrorHandlers } from './errorHandlers.js';" src/app.ts
sed -i "/^const app = express/i \\n// Initialize global error handlers to prevent server crashes\\nsetupGlobalErrorHandlers();\\n" src/app.ts

# On Windows (PowerShell)
(Get-Content src/app.ts) -replace "import cors from 'cors'", "import cors from 'cors'`nimport { setupGlobalErrorHandlers } from './errorHandlers.js';" | Set-Content src/app.ts
```

## Verification

After adding the import, restart your server:

```bash
npm run dev
```

You should see:
```
✅ Global error handlers initialized
```

## What This Fixes

### Before (Server crashes):
```
Error: Connection Closed
server stopped automatically with this error
```

### After (Server stays running):
```
🚨 UNHANDLED PROMISE REJECTION - Server will continue running
Reason: Error: Connection Closed
Baileys Error Code: 428
Baileys Error Message: Connection Closed
================================================

🚀 WhatsApp API Server is running on http://localhost:5000
```

## Additional Error Handling

The system now handles:

1. **Baileys Socket Errors** (428, 401, 403, etc.)
2. **Database Connection Errors**
3. **Async/Await Promise Rejections**
4. **Unexpected Exceptions**
5. **Graceful Shutdown on CTRL+C**

## Testing

To test that error handling works:

1. Force disconnect a WhatsApp account
2. Try sending messages to disconnected accounts
3. Kill the database connection temporarily
4. Press CTRL+C (should shutdown gracefully)

All of these should **NOT crash the server** anymore.

## Files Modified

- ✅ `src/errorHandlers.ts` (NEW - Global error handlers)
- ✅ `src/whatsapp/manager.ts` (Enhanced with try-catch blocks)
- ⏳ `src/app.ts` (YOU NEED TO ADD 2 LINES MANUALLY)

## Support

If you still encounter crashes after this setup, check:

1. Node.js version (should be v18+ for best error handling)
2. Look for logs starting with `🚨 UNHANDLED PROMISE REJECTION`
3. Check if the error handlers are initialized (should see the ✅ message)

---

**Important**: After adding the import to `app.ts`, the server will NOT crash on Baileys errors anymore!
