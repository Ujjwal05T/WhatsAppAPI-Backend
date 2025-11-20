# Media Support in Webhooks

This document describes how media messages (images, videos, audio, documents) are handled in webhook payloads.

## Overview

When your webhook receives a message containing media (image, video, audio, or document), the payload will include:
- **Media metadata** (filename, mimetype, file size, caption)
- **Download URL** to retrieve the actual media file
- **24-hour availability** - media is stored temporarily for download

---

## Webhook Payload Structure

### Text Message (No Media)

```json
{
  "event": "message.received",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "accountToken": "whatsapp_abc123",
  "message": {
    "id": "3EB0ABC123456789",
    "from": "919876543210",
    "fromName": "John Doe",
    "body": "Hello, how can I help you?",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "type": "text"
  }
}
```

### Image Message

```json
{
  "event": "message.received",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "accountToken": "whatsapp_abc123",
  "message": {
    "id": "3EB0ABC123456789",
    "from": "919876543210",
    "fromName": "Jane Smith",
    "body": "Check out this product!",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "type": "image",
    "media": {
      "mimetype": "image/jpeg",
      "filename": null,
      "fileSize": 45678,
      "caption": "Check out this product!",
      "url": "http://localhost:5000/api/media/3EB0ABC123456789"
    }
  }
}
```

### Video Message

```json
{
  "event": "message.received",
  "timestamp": "2025-01-15T10:31:00.000Z",
  "accountToken": "whatsapp_abc123",
  "message": {
    "id": "3EB0DEF987654321",
    "from": "919876543210",
    "fromName": "Jane Smith",
    "body": "Product demo video",
    "timestamp": "2025-01-15T10:31:00.000Z",
    "type": "video",
    "media": {
      "mimetype": "video/mp4",
      "filename": "demo.mp4",
      "fileSize": 1234567,
      "caption": "Product demo video",
      "url": "http://localhost:5000/api/media/3EB0DEF987654321"
    }
  }
}
```

### Audio Message

```json
{
  "event": "message.received",
  "timestamp": "2025-01-15T10:32:00.000Z",
  "accountToken": "whatsapp_abc123",
  "message": {
    "id": "3EB0GHI456789123",
    "from": "919876543210",
    "fromName": "Mike Johnson",
    "body": "[Media message]",
    "timestamp": "2025-01-15T10:32:00.000Z",
    "type": "audio",
    "media": {
      "mimetype": "audio/ogg; codecs=opus",
      "filename": null,
      "fileSize": 23456,
      "caption": null,
      "url": "http://localhost:5000/api/media/3EB0GHI456789123"
    }
  }
}
```

### Document Message

```json
{
  "event": "message.received",
  "timestamp": "2025-01-15T10:33:00.000Z",
  "accountToken": "whatsapp_abc123",
  "message": {
    "id": "3EB0JKL789456123",
    "from": "919876543210",
    "fromName": "Sarah Williams",
    "body": "Please review this contract",
    "timestamp": "2025-01-15T10:33:00.000Z",
    "type": "document",
    "media": {
      "mimetype": "application/pdf",
      "filename": "contract.pdf",
      "fileSize": 567890,
      "caption": "Please review this contract",
      "url": "http://localhost:5000/api/media/3EB0JKL789456123"
    }
  }
}
```

---

## Media Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `mimetype` | string | MIME type of the file (e.g., "image/jpeg", "video/mp4") |
| `filename` | string \| null | Original filename (available for videos and documents) |
| `fileSize` | number \| undefined | File size in bytes |
| `caption` | string \| null | Caption text sent with the media |
| `url` | string | Download URL for the media file (valid for 24 hours) |

---

## Downloading Media Files

### Method 1: Direct HTTP GET

Simply make a GET request to the provided URL:

```bash
curl -O http://localhost:5000/api/media/3EB0ABC123456789
```

### Method 2: Node.js Example

```javascript
const axios = require('axios');
const fs = require('fs');

async function downloadMedia(mediaUrl, outputPath) {
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(outputPath, response.data);
  console.log('Media downloaded to:', outputPath);
}

// Usage
const webhookPayload = /* received webhook */;
if (webhookPayload.message.media) {
  await downloadMedia(
    webhookPayload.message.media.url,
    './downloads/' + (webhookPayload.message.media.filename || webhookPayload.message.id)
  );
}
```

### Method 3: Python Example

```python
import requests

def download_media(media_url, output_path):
    response = requests.get(media_url)
    if response.status_code == 200:
        with open(output_path, 'wb') as f:
            f.write(response.content)
        print(f'Media downloaded to: {output_path}')
    else:
        print(f'Failed to download: {response.status_code}')

# Usage
webhook_payload = {}  # received webhook
if 'media' in webhook_payload['message']:
    media = webhook_payload['message']['media']
    filename = media.get('filename') or f"{webhook_payload['message']['id']}.jpg"
    download_media(media['url'], f'./downloads/{filename}')
```

---

## Important Considerations

### 1. **Media Expiration**
- Media files are stored in memory for **24 hours**
- After 24 hours, the download URL returns a 404 error
- Download media immediately upon receiving webhook if you need long-term storage

### 2. **No Authentication Required**
- Media download URLs are publicly accessible
- The message ID acts as authorization
- URLs are cryptographically random and hard to guess

### 3. **Production Deployment**
Make sure to set the `API_BASE_URL` environment variable in production:

```bash
# .env
API_BASE_URL=https://your-production-domain.com
```

Otherwise, the media URL will default to `http://localhost:5000`.

### 4. **Storage Recommendations**
For production systems, consider:
- **Download and store**: Save media to cloud storage (S3, Google Cloud Storage)
- **Database reference**: Store the cloud URL in your database
- **Cleanup**: Implement automatic cleanup of old files

### 5. **Large Files**
- Videos and documents can be large (several MB)
- Ensure your webhook endpoint can handle the download time
- Consider using background jobs for media processing

---

## Complete Webhook Handler Example

### Express.js (Node.js)

```javascript
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());

// Verify webhook signature
function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Download media file
async function downloadMedia(mediaUrl, messageId, filename) {
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer'
  });

  const path = `./media/${filename || messageId}`;
  fs.writeFileSync(path, response.data);
  return path;
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  const payload = req.body;
  const signature = req.headers['x-webhook-signature'];
  const secret = 'your_webhook_secret';

  // Verify signature
  if (signature && !verifySignature(payload, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Respond quickly (within 5 seconds)
  res.status(200).json({ success: true });

  // Process webhook asynchronously
  try {
    const { event, message, accountToken } = payload;

    console.log(`Received ${event} from ${message.fromName}: ${message.body}`);

    // Handle media messages
    if (message.media) {
      console.log(`Media type: ${message.type}`);
      console.log(`Filename: ${message.media.filename || 'N/A'}`);
      console.log(`Size: ${message.media.fileSize} bytes`);

      // Download the media
      const filePath = await downloadMedia(
        message.media.url,
        message.id,
        message.media.filename
      );

      console.log(`Media saved to: ${filePath}`);

      // Process based on media type
      if (message.type === 'image') {
        // Image processing logic
        console.log('Processing image...');
        // await processImage(filePath);
      } else if (message.type === 'document') {
        // Document processing logic
        console.log('Processing document...');
        // await processDocument(filePath);
      }
    } else {
      // Handle text message
      console.log('Text message:', message.body);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

### Flask (Python)

```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json
import requests

app = Flask(__name__)

WEBHOOK_SECRET = 'your_webhook_secret'

def verify_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected_signature)

def download_media(media_url, message_id, filename=None):
    response = requests.get(media_url)
    if response.status_code == 200:
        filepath = f'./media/{filename or message_id}'
        with open(filepath, 'wb') as f:
            f.write(response.content)
        return filepath
    return None

@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.json
    signature = request.headers.get('X-Webhook-Signature')

    # Verify signature
    if signature and not verify_signature(payload, signature, WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401

    # Respond quickly
    response = jsonify({'success': True})

    # Process webhook
    message = payload['message']
    print(f"Received message from {message['fromName']}: {message['body']}")

    # Handle media
    if 'media' in message:
        media = message['media']
        print(f"Media type: {message['type']}")
        print(f"Filename: {media.get('filename', 'N/A')}")
        print(f"Size: {media.get('fileSize')} bytes")

        # Download media
        filepath = download_media(
            media['url'],
            message['id'],
            media.get('filename')
        )

        if filepath:
            print(f"Media saved to: {filepath}")
            # Process media based on type
            if message['type'] == 'image':
                print('Processing image...')
                # process_image(filepath)
            elif message['type'] == 'document':
                print('Processing document...')
                # process_document(filepath)

    return response

if __name__ == '__main__':
    app.run(port=3000)
```

---

## Troubleshooting

### Media URL Returns 404

**Cause**: Media has expired (>24 hours old) or message ID is invalid

**Solution**:
- Download media immediately upon receiving webhook
- Check that the message ID matches the stored message

### Cannot Download Large Files

**Cause**: Network timeout or insufficient memory

**Solution**:
- Increase timeout settings in your HTTP client
- Use streaming downloads for large files
- Process media in background jobs

### Missing Media Object

**Cause**: Message is not a media message or extraction failed

**Solution**:
- Check `message.type` field (should be image/video/audio/document)
- Verify the message actually contains media
- Check server logs for extraction errors

---

## Security Recommendations

1. **Verify Signatures**: Always verify the `X-Webhook-Signature` header
2. **Download Limit**: Implement rate limiting on media downloads
3. **Scan Files**: Scan downloaded media for malware before processing
4. **Storage Quotas**: Implement storage quotas to prevent abuse
5. **HTTPS Only**: Use HTTPS in production for secure transmission

---

## API Reference

### Download Media Endpoint

**GET** `/api/media/:messageId`

Download a media file by message ID.

**Parameters:**
- `messageId` (path) - The WhatsApp message ID

**Response:**
- **200 OK** - Returns the media file with appropriate Content-Type
- **404 Not Found** - Media not found or expired
- **500 Internal Server Error** - Download failed

**Headers:**
- `Content-Type`: The media MIME type
- `Content-Disposition`: Suggested filename for download
- `Content-Length`: File size in bytes

**Example:**
```bash
curl -O http://localhost:5000/api/media/3EB0ABC123456789
```

### Get Media Statistics

**GET** `/api/media-stats`

Get statistics about the media service (requires API key).

**Headers:**
- `X-API-Key`: Your API key

**Response:**
```json
{
  "success": true,
  "stats": {
    "storedMessages": 42,
    "ttl": "24 hours"
  }
}
```

---

## Environment Variables

```bash
# API base URL for media download links (production)
API_BASE_URL=https://your-production-domain.com

# Server port
PORT=5000
```

---

## Changelog

### Version 2.1.0 (Current)
- ✅ Added media metadata extraction
- ✅ Added media download endpoint
- ✅ Added 24-hour in-memory storage
- ✅ Added caption support for images/videos/documents
- ✅ Added filename and mimetype detection
- ✅ Added file size reporting

### Version 2.0.0
- Initial webhook implementation
- Text message support only

---

## Support

For issues or questions:
- Check the main [WEBHOOKS.md](./WEBHOOKS.md) documentation
- Review the API documentation at `/api/docs`
- Check server logs for detailed error messages
