/**
 * Email Service Test Script
 *
 * This script tests the email notification service by sending a test email.
 *
 * Usage:
 *   npx tsx src/test-email.ts
 *
 * Or add to package.json:
 *   "test:email": "tsx src/test-email.ts"
 */

import dotenv from 'dotenv';
import { EmailService } from './services/EmailService.js';

// Load environment variables
dotenv.config();

async function testEmailService() {
  console.log('========================================');
  console.log('Email Service Test');
  console.log('========================================\n');

  // Check if email is configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Error: Email credentials not configured');
    console.log('\nPlease set the following in your .env file:');
    console.log('  EMAIL_USER=your-email@gmail.com');
    console.log('  EMAIL_PASSWORD=your-app-password\n');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Email User: ${process.env.EMAIL_USER}`);
  console.log(`  Dashboard URL: ${process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3000'}\n`);

  // Test email data
  const testData = {
    userEmail:'utamrakar648@gmail.com', // Send to yourself for testing
    userName: 'Test User',
    phoneNumber: '+1234567890',
    whatsappName: 'Test WhatsApp Account',
    accountToken: 'acc_test_123456789',
  };

  console.log('Test Data:');
  console.log(`  Recipient: ${testData.userEmail}`);
  console.log(`  User Name: ${testData.userName}`);
  console.log(`  Phone Number: ${testData.phoneNumber}`);
  console.log(`  WhatsApp Name: ${testData.whatsappName}`);
  console.log(`  Account Token: ${testData.accountToken}\n`);

  try {
    console.log('Verifying email service connection...');
    const isReady = await EmailService.verifyConnection();

    if (!isReady) {
      console.error('❌ Email service verification failed');
      process.exit(1);
    }

    console.log('✅ Email service is ready\n');

    console.log('Sending test disconnection notification...');
    const result = await EmailService.sendDisconnectionNotification(
      testData.userEmail,
      testData.userName,
      testData.phoneNumber,
      testData.whatsappName,
      testData.accountToken
    );

    if (result) {
      console.log('\n✅ Test email sent successfully!');
      console.log(`\nCheck your inbox at: ${testData.userEmail}`);
      console.log('\nEmail details:');
      console.log('  Subject: WhatsApp Account Disconnected - Action Required');
      console.log(`  Reconnection Link: ${process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3000'}/relink/${testData.accountToken}`);
    } else {
      console.log('\n❌ Failed to send test email');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during email test:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('Test completed successfully!');
  console.log('========================================\n');
}

// Run the test
testEmailService().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
