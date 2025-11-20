# WhatsApp Webhooks Documentation

## Overview

Webhooks allow you to receive real-time notifications when messages arrive on your WhatsApp account. Your server will receive HTTP POST requests whenever someone sends a message to your WhatsApp number.

> **📎 Media Support:** For detailed information about handling media messages (images, videos, audio, documents) in webhooks, see **[MEDIA_WEBHOOKS.md](./MEDIA_WEBHOOKS.md)**

---

## 📋 Quick Start

### 1. Register Your Webhook

```bash
curl -X POST http://localhost:5000/api/webhooks/register \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "accountToken": "your_whatsapp_account_token",
    "url": "https://your-server.com/whatsapp-webhook",
    "secret": "your_secret_key_123",
    "events": ["message.received"]
  }'
```

### 2. Create Your Webhook Endpoint

Your server needs to handle POST requests at the URL you registered.

---

## 💡 Practical Examples

### Example 1: Auto-Reply Bot (Node.js + Express)

**Use Case:** Automatically respond to common customer questions

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Your WhatsApp API credentials
const API_KEY = 'your_api_key';
const API_URL = 'http://localhost:5000';

// Webhook endpoint
app.post('/whatsapp-webhook', async (req, res) => {
  const { event, message, accountToken } = req.body;

  console.log('Received webhook:', {
    from: message.from,
    body: message.body
  });

  // Auto-reply logic
  const lowerMessage = message.body.toLowerCase();

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    await sendMessage(message.from, accountToken,
      'Hello! 👋 How can I help you today?'
    );
  }
  else if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
    await sendMessage(message.from, accountToken,
      'Our pricing starts at $99/month. Visit example.com/pricing for details.'
    );
  }
  else if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
    await sendMessage(message.from, accountToken,
      'We\\'re open Monday-Friday, 9 AM - 6 PM EST.'
    );
  }
  else if (lowerMessage.includes('support') || lowerMessage.includes('help')) {
    await sendMessage(message.from, accountToken,
      'Our support team will contact you within 24 hours. For urgent issues, call: +1-234-567-8900'
    );
  }

  // Always respond 200 OK to acknowledge receipt
  res.status(200).send('OK');
});

// Helper function to send messages
async function sendMessage(to, accountToken, text) {
  try {
    await axios.post(`${API_URL}/api/send-message`, {
      to: to,
      message: text
    }, {
      headers: {
        'X-API-Key': API_KEY,
        'Authorization': `Bearer ${accountToken}`
      }
    });
    console.log(`Sent reply to ${to}`);
  } catch (error) {
    console.error('Failed to send message:', error.message);
  }
}

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

---

### Example 2: Lead Capture & CRM Integration

**Use Case:** Save all incoming messages to your database/CRM

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

app.post('/whatsapp-webhook', async (req, res) => {
  const { message } = req.body;

  // Save to database
  await prisma.lead.create({
    data: {
      phone: message.from,
      name: message.fromName,
      message: message.body,
      source: 'whatsapp',
      timestamp: new Date(message.timestamp)
    }
  });

  // Send to CRM (e.g., Salesforce, HubSpot)
  await sendToCRM({
    contact: message.from,
    message: message.body,
    timestamp: message.timestamp
  });

  // Auto-respond
  await sendMessage(message.from, req.body.accountToken,
    'Thank you for your message! Our team will get back to you soon.'
  );

  res.status(200).send('OK');
});
```

---

### Example 3: Order Status Bot

**Use Case:** Customers check order status by sending order number

```javascript
app.post('/whatsapp-webhook', async (req, res) => {
  const { message, accountToken } = req.body;

  // Check if message starts with /order
  if (message.body.startsWith('/order ')) {
    const orderId = message.body.split(' ')[1];

    // Look up order in database
    const order = await db.orders.findOne({ orderId });

    if (order) {
      const reply = `📦 Order ${orderId}
Status: ${order.status}
Expected Delivery: ${order.deliveryDate}
Tracking: ${order.trackingNumber}`;

      await sendMessage(message.from, accountToken, reply);
    } else {
      await sendMessage(message.from, accountToken,
        `Order ${orderId} not found. Please check your order number.`
      );
    }
  }

  res.status(200).send('OK');
});
```

**Customer Experience:**
```
Customer: /order 12345
Bot: 📦 Order 12345
     Status: Shipped
     Expected Delivery: Jan 25, 2025
     Tracking: 1Z999AA10123456784
```

---

### Example 4: Appointment Booking Bot

**Use Case:** Interactive appointment scheduling

```javascript
// Store conversation state (in production, use Redis/Database)
const conversationState = new Map();

app.post('/whatsapp-webhook', async (req, res) => {
  const { message, accountToken } = req.body;
  const userId = message.from;
  const userMessage = message.body.toLowerCase();

  // Get or initialize conversation state
  let state = conversationState.get(userId) || { step: 'initial' };

  if (userMessage === 'book appointment' || state.step === 'initial') {
    // Show available slots
    await sendMessage(userId, accountToken,
      `Available appointment slots:
1️⃣ Tomorrow 10:00 AM
2️⃣ Tomorrow 2:00 PM
3️⃣ Friday 11:00 AM
4️⃣ Friday 3:00 PM

Reply with the number (1-4) to book.`
    );
    conversationState.set(userId, { step: 'awaiting_slot' });
  }
  else if (state.step === 'awaiting_slot' && ['1', '2', '3', '4'].includes(userMessage)) {
    const slots = {
      '1': 'Tomorrow 10:00 AM',
      '2': 'Tomorrow 2:00 PM',
      '3': 'Friday 11:00 AM',
      '4': 'Friday 3:00 PM'
    };

    const selectedSlot = slots[userMessage];

    // Save appointment to database
    await db.appointments.create({
      phone: userId,
      slot: selectedSlot,
      bookedAt: new Date()
    });

    await sendMessage(userId, accountToken,
      `✅ Appointment booked for ${selectedSlot}!

You'll receive a confirmation email shortly.
To cancel or reschedule, send: /cancel`
    );

    conversationState.delete(userId);
  }

  res.status(200).send('OK');
});
```

---

### Example 5: Zapier/Make.com Integration

**Use Case:** No-code automation

Instead of building your own server, use automation platforms:

1. **Register webhook with Zapier URL:**
```bash
{
  "accountToken": "your_token",
  "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
}
```

2. **In Zapier, create a Zap:**
   - Trigger: Webhook (Catch Hook)
   - Action: Send to Google Sheets / Email / Slack / etc.

3. **Example Zap Flow:**
```
WhatsApp Message → Zapier Webhook → Add row to Google Sheets → Send Email to Team
```

---

### Example 6: Python Flask Webhook

**Use Case:** Python developers prefer Flask

```python
from flask import Flask, request
import requests

app = Flask(__name__)

API_KEY = 'your_api_key'
API_URL = 'http://localhost:5000'

@app.route('/whatsapp-webhook', methods=['POST'])
def whatsapp_webhook():
    data = request.json
    message = data['message']
    account_token = data['accountToken']

    # AI Chatbot using OpenAI
    if message['body'].startswith('?'):
        question = message['body'][1:]  # Remove '?'

        # Get AI response (pseudo-code)
        ai_response = get_openai_response(question)

        # Reply via WhatsApp
        send_message(message['from'], account_token, ai_response)

    return 'OK', 200

def send_message(to, account_token, text):
    requests.post(
        f'{API_URL}/api/send-message',
        json={'to': to, 'message': text},
        headers={
            'X-API-Key': API_KEY,
            'Authorization': f'Bearer {account_token}'
        }
    )

if __name__ == '__main__':
    app.run(port=5001)
```

---

### Example 7: Real Estate Bot

**Use Case:** Automated property inquiries

```javascript
app.post('/whatsapp-webhook', async (req, res) => {
  const { message, accountToken } = req.body;
  const userMessage = message.body.toLowerCase();

  // Property search by location
  if (userMessage.includes('property in') || userMessage.includes('homes in')) {
    const location = extractLocation(message.body);
    const properties = await searchProperties(location);

    if (properties.length > 0) {
      await sendMessage(message.from, accountToken,
        `🏠 Found ${properties.length} properties in ${location}:

1️⃣ ${properties[0].name} - $${properties[0].price}
2️⃣ ${properties[1].name} - $${properties[1].price}

Reply with the property number (1-2) for details.`
      );
    } else {
      await sendMessage(message.from, accountToken,
        `Sorry, no properties found in ${location}. Try searching nearby areas.`
      );
    }
  }
  // Property details request
  else if (userMessage.match(/^property \d+$/i)) {
    const propertyId = userMessage.split(' ')[1];
    const property = await getPropertyDetails(propertyId);

    await sendMessage(message.from, accountToken,
      `🏡 ${property.name}
💰 $${property.price}
🛏️ ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms
📍 ${property.address}

Reply "book tour" to schedule a viewing!`
    );
  }

  res.status(200).send('OK');
});
```

---

### Example 8: Food Ordering Bot

**Use Case:** Restaurant order taking

```javascript
const orderState = new Map();

app.post('/whatsapp-webhook', async (req, res) => {
  const { message, accountToken } = req.body;
  const userId = message.from;
  const userMessage = message.body.toLowerCase();

  let order = orderState.get(userId) || { items: [], step: 'initial' };

  if (userMessage === 'order' || order.step === 'initial') {
    const menu = await getMenu();
    await sendMessage(userId, accountToken,
      `🍔 Our Menu:
1️⃣ Burger - $10
2️⃣ Pizza - $15
3️⃣ Pasta - $12
4️⃣ Salad - $8
5️⃣ Dessert - $6

Reply with item number to add to order. Reply "done" when finished.`
    );
    order.step = 'ordering';
  }
  else if (order.step === 'ordering' && /^[1-5]$/.test(userMessage)) {
    const menuItems = {
      '1': { name: 'Burger', price: 10 },
      '2': { name: 'Pizza', price: 15 },
      '3': { name: 'Pasta', price: 12 },
      '4': { name: 'Salad', price: 8 },
      '5': { name: 'Dessert', price: 6 }
    };

    const item = menuItems[userMessage];
    order.items.push(item);

    await sendMessage(userId, accountToken,
      `✅ Added ${item.name} to order.
Current total: $${order.items.reduce((sum, item) => sum + item.price, 0)}

Add more items or reply "done" to checkout.`
    );
  }
  else if (userMessage === 'done' && order.step === 'ordering') {
    const total = order.items.reduce((sum, item) => sum + item.price, 0);
    const orderItems = order.items.map(item => item.name).join(', ');

    await sendMessage(userId, accountToken,
      `🧾 Order Summary:
${orderItems}

Total: $${total}

Reply "confirm" to place order or "cancel" to start over.`
    );
    order.step = 'confirming';
  }
  else if (userMessage === 'confirm' && order.step === 'confirming') {
    // Save order to database
    await createOrder(userId, order.items);

    await sendMessage(userId, accountToken,
      `🎉 Order confirmed!
Order ID: #${Math.random().toString(36).substr(2, 9)}
Estimated time: 30-45 minutes
Payment will be collected on delivery.

Thank you for your order! 🍔`
    );
    orderState.delete(userId);
  }

  orderState.set(userId, order);
  res.status(200).send('OK');
});
```

---

## 🔐 Webhook Security

### Verify Webhook Signatures

```javascript
const crypto = require('crypto');

app.post('/whatsapp-webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = 'your_secret_key_123';

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook...
  res.status(200).send('OK');
});
```

---

## 📊 Webhook Payload Structure

```json
{
  "event": "message.received",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "accountToken": "whatsapp_abc123",
  "message": {
    "id": "3EB0ABC123456789",
    "from": "919876543210",
    "fromName": "John Doe",
    "body": "Hello, I need help with my order",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "type": "text"
  }
}
```

**Field Descriptions:**
- `event`: Always "message.received" for incoming messages
- `timestamp`: When the webhook was triggered
- `accountToken`: Your WhatsApp account token (use this to reply)
- `message.from`: Sender's phone number (without @ symbol)
- `message.fromName`: Sender's WhatsApp display name
- `message.body`: Message text content
- `message.type`: "text", "image", "video", "audio", "document", etc.

---

## 🛠️ Webhook Management

### List All Webhooks

```bash
curl -X GET http://localhost:5000/api/webhooks/your_account_token \
  -H "X-API-Key: your_api_key"
```

### Disable/Enable Webhook

```bash
curl -X PATCH http://localhost:5000/api/webhooks/1 \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{ "isActive": false }'
```

### Delete Webhook

```bash
curl -X DELETE http://localhost:5000/api/webhooks/1 \
  -H "X-API-Key: your_api_key"
```

### Test Webhook

```bash
curl -X POST http://localhost:5000/api/webhooks/1/test \
  -H "X-API-Key: your_api_key"
```

---

## ⚠️ Best Practices

1. **Always respond with 200 OK quickly** (within 5 seconds)
   - Do heavy processing asynchronously
   - Queue jobs if needed

2. **Verify webhook signatures** for security

3. **Handle errors gracefully**
   - Log errors but don't crash
   - Invalid webhooks will be retried

4. **Use HTTPS in production**
   - Webhook URLs must use HTTPS

5. **Rate limit your replies**
   - Don't spam users with too many messages

6. **Store state externally**
   - Use Redis/Database for conversation state
   - Don't rely on in-memory storage

---

## 🌐 Deployment Options

### 1. **ngrok** (For Development/Testing)

```bash
# Install ngrok
npm install -g ngrok

# Start your webhook server
node webhook-server.js

# Expose to internet
ngrok http 3000

# Use the ngrok URL in webhook registration
# Example: https://abc123.ngrok.io/whatsapp-webhook
```

### 2. **Heroku** (Free hosting)

```bash
git push heroku main
# Use: https://your-app.herokuapp.com/whatsapp-webhook
```

### 3. **Vercel/Netlify** (Serverless)

Deploy as serverless functions.

### 4. **Your Own Server** (Production)

Ensure your server:
- Has a public IP or domain
- Uses HTTPS
- Is always online
- Can handle concurrent requests

---

## 🐛 Troubleshooting

**Webhook not receiving messages:**
- Check if webhook is active: `GET /api/webhooks/:accountToken`
- Verify URL is publicly accessible
- Check server logs for errors
- Test webhook: `POST /api/webhooks/:id/test`

**Signature verification failing:**
- Ensure you're using the exact same secret
- Check payload is stringified correctly
- Use `crypto.timingSafeEqual()` for comparison

**Messages arriving late:**
- Check your server response time
- Ensure you respond with 200 OK quickly
- Move heavy processing to background queue

**No response from webhook:**
- Check if your server is running
- Verify the port is open and accessible
- Test with ngrok for local development

---

## 📚 Full Example Repository Structure

```
whatsapp-webhook-bot/
├── server.js              # Main webhook server
├── handlers/
│   ├── autoReply.js      # Auto-reply logic
│   ├── leadCapture.js    # Save to database
│   └── orderStatus.js    # Order lookup
├── utils/
│   ├── whatsapp.js       # Send message helper
│   └── signature.js      # Verify signatures
├── .env                  # API keys, secrets
└── package.json
```

Start building your WhatsApp automation now! 🚀

---

## 🎯 Quick Start Checklist

1. ✅ **Create webhook server** (copy any example above)
2. ✅ **Test locally** (run `node server.js`)
3. ✅ **Expose to internet** (use `ngrok http 3000`)
4. ✅ **Register webhook** (use the ngrok URL)
5. ✅ **Test by sending a message** to your WhatsApp
6. ✅ **Start building your automation!**

Ready to build your WhatsApp bot? 🤖