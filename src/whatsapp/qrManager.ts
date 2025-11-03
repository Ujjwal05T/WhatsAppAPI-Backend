import makeWASocket, {
  DisconnectReason,
  WASocket,
  BaileysEventMap,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import qrcodeGen from 'qrcode';
import { Boom } from '@hapi/boom';
import { createAccountFromWhatsApp, getPendingSession } from '../services/legacyAccountManager.js';
import { clients, initializeClient } from './manager.js';
import { useAuthStateFromDB, deleteAuthStateFromDB } from './dbAuthState.js';
import { prisma } from '../config/index.js';

// QR codes for pending sessions
const pendingQRCodes = new Map<string, string>();

// Track reconnection attempts to prevent infinite loops
const reconnectionAttempts = new Map<string, number>();
const MAX_RECONNECTION_ATTEMPTS = 5;

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

  // Track if account was successfully created to prevent reconnection after intentional closure
  let accountCreated = false;

  // Use database-based auth state with temporary session ID
  const { state, saveCreds } = await useAuthStateFromDB(`temp_${sessionId}`);

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

            // Migrate session from temp to permanent token
            console.log(`[${sessionId}] 🔄 Migrating session to permanent token...`);

            // Get temp session and copy to permanent token
            const tempSession = await prisma.session.findUnique({
              where: { accountToken: `temp_${sessionId}` }
            });

            if (tempSession) {
              // Create permanent session with the temp's auth state
              await prisma.session.create({
                data: {
                  accountToken: account.token,
                  authState: tempSession.authState
                }
              }).catch(async (err) => {
                // If already exists, update it
                if (err.code === 'P2002') {
                  await prisma.session.update({
                    where: { accountToken: account.token },
                    data: { authState: tempSession.authState }
                  });
                }
              });
              console.log(`[${account.token}] ✅ Session migrated successfully`);
            }

            // Delete the temporary session from database
            await deleteAuthStateFromDB(`temp_${sessionId}`);
            console.log(`[${sessionId}] 🗑️  Temporary session cleaned up from database`);

            // Close the temp socket
            console.log(`[${account.token}] 🔄 Closing temporary connection...`);
            sock.end(undefined);

            // Initialize new client with the permanent account token and wait for it to connect
            console.log(`[${account.token}] 🔄 Initializing client with permanent session...`);
            const permanentSocket = await initializeClient(account.token);

            // Wait for permanent client to connect (max 30 seconds)
            console.log(`[${account.token}] ⏳ Waiting for permanent client to connect...`);
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for permanent client to connect'));
              }, 30000);

              const connectionHandler = (update: Partial<BaileysEventMap['connection.update']>) => {
                if (update.connection === 'open') {
                  clearTimeout(timeout);
                  permanentSocket.ev.off('connection.update', connectionHandler);
                  console.log(`[${account.token}] ✅ Permanent client connected successfully!`);
                  resolve();
                } else if (update.connection === 'close') {
                  clearTimeout(timeout);
                  permanentSocket.ev.off('connection.update', connectionHandler);
                  reject(new Error('Permanent client connection closed before opening'));
                }
              };

              permanentSocket.ev.on('connection.update', connectionHandler);
            });

            console.log(`[${account.token}] ✅ Client ready for messaging!`);

            // Mark account as successfully created to prevent temp session reconnection
            accountCreated = true;

          } catch (error) {
            console.error(`[${sessionId}] ❌ Failed to create account:`, error);
          }

          // Clear QR code
          pendingQRCodes.delete(sessionId);
          break;

        case 'close':
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !accountCreated;

          console.log(`\n[${sessionId}] ❌ Connection closed`);
          console.log(`[${sessionId}] 📊 Status Code: ${statusCode || 'Unknown'}`);
          console.log(`[${sessionId}] 🔁 Will reconnect: ${shouldReconnect ? 'Yes' : 'No'}`);

          if (lastDisconnect?.error) {
            console.log(`[${sessionId}] 💥 Error: ${lastDisconnect.error.message}`);
          }
          console.log('================================================\n');

          // If account was created, don't reconnect the temp session
          if (accountCreated) {
            console.log(`[${sessionId}] ✅ Account created successfully, temp session closed normally`);
            pendingQRCodes.delete(sessionId);
            reconnectionAttempts.delete(sessionId);
            break;
          }

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
 * Clean up temporary session from database
 */
async function cleanupTempSession(sessionId: string): Promise<void> {
  try {
    await deleteAuthStateFromDB(`temp_${sessionId}`);
    pendingQRCodes.delete(sessionId);
    console.log(`[${sessionId}] 🗑️  Cleaned up temporary session from database`);
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

