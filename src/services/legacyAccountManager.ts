// Minimal account manager for backward compatibility
// This file only contains functions needed for WhatsApp session management

import { WhatsAppAccountService } from './WhatsAppAccountService.js';
import { WhatsAppAccountModel } from '../models/WhatsAppAccount.js';
import { initializeClient } from '../whatsapp/manager.js';
import { promises as fs } from 'fs';
import * as path from 'path';

// Temporary session storage for QR-based account creation
const pendingSessions = new Map<string, {
  sessionId: string;
  apiKey: string;
  createdAt: string;
}>();

// Initialize any existing accounts on startup
export async function initializeAccounts(): Promise<void> {
  console.log('\n🔄 Starting WhatsApp session restoration...');
  console.log('================================================');

  try {
    // Get all connected accounts from database
    const connectedAccounts = await WhatsAppAccountModel.findAllConnected();
    console.log(`📊 Found ${connectedAccounts.length} connected accounts in database`);

    if (connectedAccounts.length === 0) {
      console.log('✅ No accounts to restore');
      console.log('================================================\n');
      return;
    }

    // Check sessions directory
    const sessionsDir = path.join(process.cwd(), 'sessions');
    let sessionDirs: string[] = [];

    try {
      await fs.access(sessionsDir);
      const dirContents = await fs.readdir(sessionsDir);
      sessionDirs = dirContents;
      console.log(`📁 Found ${sessionDirs.length} session directories in sessions/`);
    } catch (error) {
      console.log('⚠️  Sessions directory not found or empty');
      console.log('================================================\n');
      return;
    }

    // Restore sessions
    let restored = 0;
    let failed = 0;

    for (const account of connectedAccounts) {
      const accountToken = account.accountToken;
      const hasSessionDir = sessionDirs.includes(accountToken);

      if (!hasSessionDir) {
        console.log(`\n❌ [${accountToken}] No session directory found`);
        console.log(`   Phone: ${account.phoneNumber || 'N/A'}`);
        console.log(`   Name: ${account.whatsappName || 'N/A'}`);
        console.log(`   Action: Marking as disconnected in database`);

        // Mark as disconnected in database since session files are missing
        try {
          await WhatsAppAccountService.markAsDisconnected(accountToken);
          console.log(`   ✓ Marked as disconnected`);
        } catch (error) {
          console.log(`   ✗ Failed to update database:`, error);
        }

        failed++;
        continue;
      }

      // Check if session directory has files
      const sessionPath = path.join(sessionsDir, accountToken);
      try {
        const sessionFiles = await fs.readdir(sessionPath);
        if (sessionFiles.length === 0) {
          console.log(`\n⚠️  [${accountToken}] Session directory is empty`);
          console.log(`   Action: Marking as disconnected`);
          await WhatsAppAccountService.markAsDisconnected(accountToken);
          failed++;
          continue;
        }
      } catch (error) {
        console.log(`\n❌ [${accountToken}] Cannot read session directory`);
        await WhatsAppAccountService.markAsDisconnected(accountToken);
        failed++;
        continue;
      }

      // Initialize the client
      try {
        console.log(`\n🔄 [${accountToken}] Restoring session...`);
        console.log(`   Phone: ${account.phoneNumber || 'N/A'}`);
        console.log(`   Name: ${account.whatsappName || 'N/A'}`);

        // Initialize Baileys client - this will restore the session
        await initializeClient(accountToken);

        console.log(`   ✅ Session restoration initiated`);
        restored++;

      } catch (error) {
        console.log(`   ❌ Failed to restore session:`, error);
        console.log(`   Action: Keeping as connected, will retry on reconnection`);
        failed++;
      }
    }

    // Summary
    console.log('\n================================================');
    console.log('📊 SESSION RESTORATION SUMMARY:');
    console.log(`   Total accounts in DB: ${connectedAccounts.length}`);
    console.log(`   ✅ Successfully restored: ${restored}`);
    console.log(`   ❌ Failed/Missing: ${failed}`);
    console.log('================================================\n');

  } catch (error) {
    console.error('❌ Error during session restoration:', error);
    console.log('================================================\n');
  }
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