import makeWASocket, {
  DisconnectReason,
  WASocket,
  BaileysEventMap,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import qrcodeGen from 'qrcode';
import { Boom } from '@hapi/boom';
import { useAuthStateFromDB } from './dbAuthState.js';
import { WebhookService } from '../services/WebhookService.js';

// This map will store active Baileys sockets, with the token as the key.
export const clients = new Map<string, WASocket>();
export const qrCodes = new Map<string, string>(); // Store QR codes for web display

/**
 * Generate QR code as base64 for web display
 */
async function generateQRBase64(qrString: string): Promise<string> {
  try {
    return await qrcodeGen.toDataURL(qrString);
  } catch (error) {
    console.error('Failed to generate QR code base64:', error);
    return '';
  }
}

/**
 * Initialize WhatsApp client with enhanced QR handling
 */
export async function initializeClient(token: string): Promise<WASocket> {
  console.log(`[${token}] Initializing WhatsApp client...`);

  // Use database-based auth state instead of file-based
  const { state, saveCreds } = await useAuthStateFromDB(token);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Enable built-in QR printing
    browser: ['WhatsApp API', 'Chrome', '10.0'], // Custom browser signature
    connectTimeoutMs: 60000, // 60 seconds timeout
    qrTimeout: 60000, // QR code timeout
    defaultQueryTimeoutMs: undefined, // No query timeout for better reliability
    keepAliveIntervalMs: 25000, // Keep alive every 25 seconds
  });

  // Enhanced connection event handling
  sock.ev.on('connection.update', async (update: Partial<BaileysEventMap['connection.update']>) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    // QR Code handling
    if (qr) {
      console.log(`\n[${token}] 🔲 QR Code Generated! Scan to login:`);
      console.log('================================================');

      // Generate terminal QR code
      qrcode.generate(qr, { small: true });

      // Generate base64 QR for web display
      const qrBase64 = await generateQRBase64(qr);
      qrCodes.set(token, qrBase64);

      console.log(`[${token}] 📱 Open WhatsApp -> Linked Devices -> Link a device`);
      console.log(`[${token}] ⏱️  QR Code expires in 60 seconds`);
      console.log('================================================\n');
    }

    // Connection state updates
    if (connection) {
      switch (connection) {
        case 'connecting':
          console.log(`[${token}] 🔄 Connecting to WhatsApp...`);
          break;

        case 'open':
          console.log(`\n[${token}] ✅ Successfully connected to WhatsApp!`);
          console.log(`[${token}] 📱 Phone: ${sock.user?.id?.split(':')[0] || 'Unknown'}`);
          console.log(`[${token}] 👤 Name: ${sock.user?.name || 'Unknown'}`);
          console.log('================================================\n');

          clients.set(token, sock);
          console.log(`[${token}] 📝 Client added to active clients map (Total: ${clients.size})`);
          qrCodes.delete(token); // Clear QR code after successful login
          break;

        case 'close':
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`\n[${token}] ❌ Connection closed`);
          console.log(`[${token}] 📊 Status Code: ${statusCode || 'Unknown'}`);
          console.log(`[${token}] 🔁 Will reconnect: ${shouldReconnect ? 'Yes' : 'No'}`);

          if (lastDisconnect?.error) {
            console.log(`[${token}] 💥 Error: ${lastDisconnect.error.message}`);
          }
          console.log('================================================\n');

          clients.delete(token);
          console.log(`[${token}] 📝 Client removed from active clients map (Total: ${clients.size})`);

          // Reconnect logic
          if (shouldReconnect) {
            console.log(`[${token}] 🔄 Attempting to reconnect in 5 seconds...`);
            setTimeout(() => {
              initializeClient(token);
            }, 5000);
          } else {
            console.log(`[${token}] 🔒 Logged out. Please scan QR code again.`);
            qrCodes.delete(token);
          }
          break;
      }
    }

    // New login notification
    if (isNewLogin) {
      console.log(`[${token}] 🎉 New login detected!`);
    }
  });

  // Credentials update event
  sock.ev.on('creds.update', saveCreds);

  // Set up message handler for debugging and webhooks
  sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0];
    if (message && !message.key.fromMe) {
      const messageText = message.message?.conversation ||
                          message.message?.extendedTextMessage?.text ||
                          '[Media message]';

      console.log(`[${token}] 📨 Received message from ${message.key.remoteJid}:`, messageText);

      // Trigger webhooks for incoming message
      try {
        // Handle messageTimestamp which can be number, Long, null, or undefined
        let messageTimestamp: number;
        if (typeof message.messageTimestamp === 'number') {
          messageTimestamp = message.messageTimestamp;
        } else if (message.messageTimestamp && typeof message.messageTimestamp === 'object' && 'toNumber' in message.messageTimestamp) {
          // Handle Long type from Baileys
          messageTimestamp = (message.messageTimestamp as any).toNumber();
        } else {
          messageTimestamp = Date.now() / 1000; // Fallback to current time
        }

        const webhookPayload = {
          event: 'message.received',
          timestamp: new Date().toISOString(),
          accountToken: token,
          message: {
            id: message.key.id || '',
            from: message.key.remoteJid?.replace('@s.whatsapp.net', '') || '',
            fromName: message.pushName || 'Unknown',
            body: messageText,
            timestamp: new Date(messageTimestamp * 1000).toISOString(),
            type: message.message?.conversation ? 'text' :
                  message.message?.extendedTextMessage ? 'text' :
                  message.message?.imageMessage ? 'image' :
                  message.message?.videoMessage ? 'video' :
                  message.message?.audioMessage ? 'audio' :
                  message.message?.documentMessage ? 'document' : 'unknown',
          },
        };

        // Trigger all registered webhooks for this account
        await WebhookService.triggerWebhooks(token, webhookPayload);
      } catch (error) {
        console.error(`[${token}] Failed to trigger webhooks:`, error);
      }
    }
  });

  // Add socket error handling
  if (sock.ws) {
    sock.ws.on('error', (error) => {
      console.error(`[${token}] 🌐 WebSocket error:`, error.message);
    });
  }

  return sock;
}

export function getClient(token: string): WASocket | undefined {
  return clients.get(token);
}