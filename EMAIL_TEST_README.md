# Email Service Test Guide

This guide explains how to test the email notification service.

## Prerequisites

1. **Gmail Account** with App Password configured
2. **Environment Variables** set in `.env` file

## Setup

Make sure your `.env` file contains:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here

# Frontend URL
FRONTEND_DASHBOARD_URL=http://localhost:3000
```

### How to Get Gmail App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Sign in to your Google Account
3. Select app: **Mail**
4. Select device: **Other (Custom name)** → Enter "WhatsApp API"
5. Click **Generate**
6. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)
7. Paste it in your `.env` file as `EMAIL_PASSWORD` (remove spaces)

## Running the Test

### Method 1: Using npm script (Recommended)

```bash
cd d:\Whatsapp_API\backend
npm run test:email
```

### Method 2: Direct execution

```bash
cd d:\Whatsapp_API\backend
npx tsx src/test-email.ts
```

## What the Test Does

The test script will:

1. ✅ Verify email credentials are configured
2. ✅ Check email service connection
3. ✅ Send a test disconnection notification email to your configured email address
4. ✅ Display the reconnection link that would be included

## Expected Output

```
========================================
Email Service Test
========================================

Configuration:
  Email User: your-email@gmail.com
  Dashboard URL: http://localhost:3000

Test Data:
  Recipient: your-email@gmail.com
  User Name: Test User
  Phone Number: +1234567890
  WhatsApp Name: Test WhatsApp Account
  Account Token: acc_test_123456789

Verifying email service connection...
✅ Email service is ready

Sending test disconnection notification...
✅ Test email sent successfully!

Check your inbox at: your-email@gmail.com

Email details:
  Subject: WhatsApp Account Disconnected - Action Required
  Reconnection Link: http://localhost:3000/relink/acc_test_123456789

========================================
Test completed successfully!
========================================
```

## Email Preview

The test will send a professional email with:

- **Subject:** WhatsApp Account Disconnected - Action Required
- **Design:** Clean, minimal colors (dark gray/slate)
- **Content:**
  - Account details table
  - Reason for disconnection
  - Action required notice
  - Reconnect button (links to `/relink/:accountToken`)
  - Manual reconnection steps
  - Professional signature

## Troubleshooting

### Error: Email credentials not configured

**Solution:** Add `EMAIL_USER` and `EMAIL_PASSWORD` to your `.env` file

### Error: Invalid login credentials

**Solutions:**
- Make sure you're using an **App Password**, not your regular Gmail password
- Verify the app password is correct (no spaces)
- Check that 2-factor authentication is enabled on your Google account

### Error: Connection timeout

**Solutions:**
- Check your internet connection
- Verify firewall isn't blocking port 465 or 587
- Try again in a few minutes

### Email not received

**Check:**
- Spam/Junk folder
- Sent to correct email address
- Gmail quota (make sure you haven't exceeded daily sending limits)

## Customizing Test Data

You can modify the test data in `src/test-email.ts`:

```typescript
const testData = {
  userEmail: 'another-email@example.com', // Send to different email
  userName: 'Your Name',
  phoneNumber: '+9876543210',
  whatsappName: 'Your WhatsApp Account',
  accountToken: 'acc_custom_token',
};
```

## Production Usage

In production, the email service is automatically triggered when:
- A WhatsApp account is **permanently disconnected** (user logs out)
- The system will **NOT** send emails for temporary disconnections (network issues)

## Notes

- Test emails are sent to `EMAIL_USER` by default (yourself)
- The reconnection link format: `{FRONTEND_DASHBOARD_URL}/relink/{accountToken}`
- No emojis are used in the email (professional design)
- Minimal colors: Dark gray (#2c3e50) for headers and buttons
