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
import { createAccountFromWhatsApp, getPendingSession } from '../services/legacyAccountManager.js';
import { clients } from './manager.js';

// QR codes for pending sessions
const pendingQRCodes = new Map<string, string>();

// Track reconnection attempts to prevent infinite loops
const reconnectionAttempts = new Map<string, number>();
const MAX_RECONNECTION_ATTEMPTS = 5;

/**
 * Ensure temporary sessions directory exists
 */
async function ensureTempSessionsDir(): Promise<void> {
  const sessionsDir = path.join(process.cwd(), 'temp-sessions');
  try {
    await fs.access(sessionsDir);
  } catch (error) {
    console.log('Creating temp sessions directory...');
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
 * Initialize WhatsApp client for QR-based account creation
 */
export async function initializeQRClient(sessionId: string): Promise<void> {
  console.log(`[${sessionId}] Initializing QR WhatsApp client...`);

  // Ensure temp sessions directory exists
  await ensureTempSessionsDir();

  const sessionPath = path.join(process.cwd(), 'temp-sessions', sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['WhatsApp API', 'Chrome', '10.0'],
    connectTimeoutMs: 60000,
    qrTimeout: 60000,
    defaultQueryTimeoutMs: undefined,
    keepAliveIntervalMs: 25000,
  });

  // Enhanced connection event handling for QR-based creation
  sock.ev.on('connection.update', async (update: Partial<BaileysEventMap['connection.update']>) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    // QR Code handling
    if (qr) {
      console.log(`\n[${sessionId}] 🔲 QR Code Generated! Scan to create account:`);
      console.log('================================================');

      // Generate terminal QR code
      qrcode.generate(qr, { small: true });

      // Generate base64 QR for web display
      const qrBase64 = await generateQRBase64(qr);
      pendingQRCodes.set(sessionId, qrBase64);

      console.log(`[${sessionId}] 📱 Open WhatsApp -> Linked Devices -> Link a device`);
      console.log(`[${sessionId}] ⏱️  QR Code expires in 60 seconds`);
      console.log(`[${sessionId}] 🎯 After successful scan, your account token will be generated`);
      console.log('================================================\n');
    }

    // Connection state updates
    if (connection) {
      switch (connection) {
        case 'connecting':
          console.log(`[${sessionId}] 🔄 Connecting to WhatsApp...`);
          break;

        case 'open':
          console.log(`\n[${sessionId}] ✅ Successfully connected to WhatsApp!`);
          console.log(`[${sessionId}] 📱 Phone: ${sock.user?.id?.split(':')[0] || 'Unknown'}`);
          console.log(`[${sessionId}] 👤 Name: ${sock.user?.name || 'Unknown'}`);

          // Reset reconnection counter on successful connection
          reconnectionAttempts.delete(sessionId);

          try {
            // Create account from successful WhatsApp authentication
            const pendingSession = getPendingSession(sessionId);
            if (!pendingSession) {
              console.error(`[${sessionId}] ❌ No pending session found!`);
              await cleanupTempSession(sessionId);
              return;
            }

            console.log(`[${sessionId}] 🔐 Creating account from WhatsApp authentication...`);
            const account = await createAccountFromWhatsApp(sessionId, sock);

            console.log(`\n================================================`);
            console.log(`🎉 WHATSAPP ACCOUNT CONNECTED SUCCESSFULLY!`);
            console.log(`================================================`);
            console.log(`📋 Account Token: ${account.token}`);
            console.log(`🔑 API Key: ${account.apiKey}`);
            console.log(`👤 Name: ${account.name}`);
            console.log(`📱 Phone: ${account.phoneNumber}`);
            console.log(`================================================`);
            console.log(`\n✅ You can now send messages using:`);
            console.log(`   Account Token: ${account.token}`);
            console.log(`   API Key: ${account.apiKey}`);
            console.log(`================================================\n`);

            // Store the connected client with the account token
            // This will be used for message sending
            clients.set(account.token, sock);
            console.log(`[${account.token}] 💾 Client stored for message sending`);

            // We'll need to move the session from temp-sessions to the main sessions directory
            await moveToMainSessions(sessionId, account.token);

          } catch (error) {
            console.error(`[${sessionId}] ❌ Failed to create account:`, error);
          }

          // Clear QR code
          pendingQRCodes.delete(sessionId);
          break;

        case 'close':
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`\n[${sessionId}] ❌ Connection closed`);
          console.log(`[${sessionId}] 📊 Status Code: ${statusCode || 'Unknown'}`);
          console.log(`[${sessionId}] 🔁 Will reconnect: ${shouldReconnect ? 'Yes' : 'No'}`);

          if (lastDisconnect?.error) {
            console.log(`[${sessionId}] 💥 Error: ${lastDisconnect.error.message}`);
          }
          console.log('================================================\n');

          if (shouldReconnect) {
            // Check reconnection attempts
            const attempts = reconnectionAttempts.get(sessionId) || 0;
            if (attempts >= MAX_RECONNECTION_ATTEMPTS) {
              console.log(`[${sessionId}] ❌ Max reconnection attempts (${MAX_RECONNECTION_ATTEMPTS}) reached`);
              pendingQRCodes.delete(sessionId);
              reconnectionAttempts.delete(sessionId);
              await cleanupTempSession(sessionId);
              break;
            }

            // Increment reconnection counter
            reconnectionAttempts.set(sessionId, attempts + 1);

            // Reconnect after a short delay
            console.log(`[${sessionId}] 🔄 Reconnecting in 3 seconds... (Attempt ${attempts + 1}/${MAX_RECONNECTION_ATTEMPTS})`);
            setTimeout(() => {
              console.log(`[${sessionId}] 🔄 Attempting reconnection...`);
              initializeQRClient(sessionId).catch(err => {
                console.error(`[${sessionId}] ❌ Reconnection failed:`, err);
              });
            }, 3000);
          } else {
            console.log(`[${sessionId}] 🔒 Account creation failed or cancelled`);
            pendingQRCodes.delete(sessionId);
            reconnectionAttempts.delete(sessionId);
            await cleanupTempSession(sessionId);
          }
          break;
      }
    }

    // New login notification
    if (isNewLogin) {
      console.log(`[${sessionId}] 🎉 New login detected! Creating account...`);
    }
  });

  // Credentials update event
  sock.ev.on('creds.update', saveCreds);

  // Set up message handler for debugging
  sock.ev.on('messages.upsert', (m) => {
    const message = m.messages[0];
    if (message && !message.key.fromMe) {
      console.log(`[${sessionId}] 📨 Received message during setup:`,
        message.message?.conversation || 'Non-text message');
    }
  });

  // Add socket error handling
  if (sock.ws) {
    sock.ws.on('error', (error) => {
      console.error(`[${sessionId}] 🌐 WebSocket error:`, error.message);
    });
  }
}

/**
 * Move temporary session to main sessions directory
 */
async function moveToMainSessions(sessionId: string, accountToken: string): Promise<void> {
  try {
    const tempPath = path.join(process.cwd(), 'temp-sessions', sessionId);
    const mainPath = path.join(process.cwd(), 'sessions', accountToken);

    // Ensure main sessions directory exists
    const sessionsDir = path.join(process.cwd(), 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });

    // Copy files from temp to main
    try {
      const files = await fs.readdir(tempPath);
      for (const file of files) {
        const tempFile = path.join(tempPath, file);
        const mainFile = path.join(mainPath, file);
        await fs.copyFile(tempFile, mainFile);
      }

      // Clean up temp session
      await fs.rm(tempPath, { recursive: true, force: true });

      console.log(`[${sessionId}] 📁 Session moved to: ${accountToken}`);
    } catch (error) {
      console.log(`[${sessionId}] ⚠️  No session files to move, will create fresh session`);
    }
  } catch (error) {
    console.error(`[${sessionId}] ❌ Failed to move session:`, error);
  }
}

/**
 * Clean up temporary session
 */
async function cleanupTempSession(sessionId: string): Promise<void> {
  try {
    const tempPath = path.join(process.cwd(), 'temp-sessions', sessionId);
    await fs.rm(tempPath, { recursive: true, force: true });
    pendingQRCodes.delete(sessionId);
    console.log(`[${sessionId}] 🗑️  Cleaned up temporary session`);
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Get QR code for pending session
 */
export function getPendingQRCode(sessionId: string): string | undefined {
  return pendingQRCodes.get(sessionId);
}

