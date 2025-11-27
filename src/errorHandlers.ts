import { PrismaService } from './config/index.js';

/**
 * Global error handlers to prevent server crashes
 * This module sets up handlers for uncaught exceptions and unhandled promise rejections
 */

export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('🚨 UNCAUGHT EXCEPTION - Server will continue running');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Timestamp:', new Date().toISOString());
    console.error('================================================\n');
    // Don't exit the process, just log the error
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('🚨 UNHANDLED PROMISE REJECTION - Server will continue running');
    console.error('Reason:', reason);

    if (reason?.message) {
      console.error('Message:', reason.message);
    }

    if (reason?.stack) {
      console.error('Stack:', reason.stack);
    }

    // Check if it's a Baileys socket error
    if (reason?.isBoom) {
      console.error('Baileys Error Code:', reason?.output?.statusCode);
      console.error('Baileys Error Message:', reason?.output?.payload?.message);
    }

    console.error('Timestamp:', new Date().toISOString());
    console.error('================================================\n');
    // Don't exit the process, just log the error
  });

  // Handle termination signals gracefully
  process.on('SIGTERM', async () => {
    console.log('📴 SIGTERM received. Shutting down gracefully...');
    try {
      await PrismaService.disconnect();
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting database:', error);
    }
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('📴 SIGINT received. Shutting down gracefully...');
    try {
      await PrismaService.disconnect();
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting database:', error);
    }
    process.exit(0);
  });

  console.log('✅ Global error handlers initialized');
}
