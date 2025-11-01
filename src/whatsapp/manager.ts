import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import qrcodeGen from 'qrcode';
import { Boom } from '@hapi/boom';
import { promises as fs } from 'fs';
import * as path from 'path';

// This map will store active Baileys sockets, with the token as the key.
export const clients = new Map<string, WASocket>();
export const qrCodes = new Map<string, string>(); // Store QR codes for web display

/**
 * Ensure sessions directory exists
 */
async function ensureSessionsDir(): Promise<void> {
  const sessionsDir = path.join(process.cwd(), 'sessions');
  try {
    await fs.access(sessionsDir);
  } catch (error) {
    console.log('Creating sessions directory...');
    await fs.mkdir(sessionsDir, { recursive: true });
  }
}

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
export async function initializeClient(token: string): Promise<void> {
  console.log(`[${token}] Initializing WhatsApp client...`);

  // Ensure sessions directory exists
  await ensureSessionsDir();

  const sessionPath = path.join(process.cwd(), 'sessions', token);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

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

  // Set up message handler for debugging
  sock.ev.on('messages.upsert', (m) => {
    const message = m.messages[0];
    if (message && !message.key.fromMe) {
      console.log(`[${token}] 📨 Received message from ${message.key.remoteJid}:`,
        message.message?.conversation || 'Non-text message');
    }
  });

  // Add socket error handling
  if (sock.ws) {
    sock.ws.on('error', (error) => {
      console.error(`[${token}] 🌐 WebSocket error:`, error.message);
    });
  }
}

export function getClient(token: string): WASocket | undefined {
  return clients.get(token);
}