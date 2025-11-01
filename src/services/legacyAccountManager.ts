// Minimal account manager for backward compatibility
// This file only contains functions needed for WhatsApp session management

import { WhatsAppAccountService } from './WhatsAppAccountService.js';

// Temporary session storage for QR-based account creation
const pendingSessions = new Map<string, {
  sessionId: string;
  apiKey: string;
  createdAt: string;
}>();

// Initialize any existing accounts on startup
export async function initializeAccounts(): Promise<void> {
  // In the new architecture, WhatsApp accounts are managed by WhatsAppAccountService
  // This function is kept for backward compatibility with whatsappManager
  console.log('📱 WhatsApp accounts initialization handled by database service');
}

// Get pending session by session ID
export function getPendingSession(sessionId: string): { sessionId: string; apiKey: string; createdAt: string } | null {
  return pendingSessions.get(sessionId) || null;
}

// Create WhatsApp account from successful QR scan
export async function createAccountFromWhatsApp(sessionId: string, socket: any): Promise<any> {
  try {
    // Get the pending session
    const pendingSession = pendingSessions.get(sessionId);
    if (!pendingSession) {
      throw new Error('No pending session found');
    }

    // Get WhatsApp account details from socket
    const authInfo = socket.authState?.creds;
    if (!authInfo) {
      throw new Error('No authentication info found');
    }

    // Update WhatsApp account with connection details
    const phoneNumber = socket.user?.id?.split(':')[0] || '';
    const whatsappName = socket.user?.name || 'Unknown';

    // sessionId is actually the accountToken
    const accountToken = sessionId;

    // Update the WhatsApp account in database with connection details
    console.log(`[${accountToken}] 🔄 Updating database with phone: ${phoneNumber}, name: ${whatsappName}`);
    await WhatsAppAccountService.updateWhatsAppConnectionDetails(
      accountToken,
      phoneNumber,
      whatsappName
    );

    console.log(`✅ WhatsApp account connected in database: ${phoneNumber} (${whatsappName})`);

    // Clean up the pending session
    pendingSessions.delete(sessionId);

    // Return account details for logging
    return {
      token: accountToken,
      sessionId,
      phoneNumber,
      whatsappName,
      apiKey: pendingSession.apiKey,
      name: whatsappName,
      connected: true
    };

  } catch (error) {
    console.error('Error creating WhatsApp account:', error);
    throw error;
  }
}

// Store pending session (called from AuthController)
export function storePendingSession(sessionId: string, apiKey: string): void {
  pendingSessions.set(sessionId, {
    sessionId,
    apiKey,
    createdAt: new Date().toISOString()
  });
}