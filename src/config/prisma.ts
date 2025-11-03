import { PrismaClient } from '@prisma/client';

/**
 * PrismaService - Singleton class for managing Prisma Client instance
 *
 * This service ensures a single Prisma Client instance is used throughout the application
 * to avoid connection pool exhaustion and improve performance.
 */
class PrismaService {
  private static instance: PrismaClient | null = null;
  private static isInitialized = false;

  /**
   * Get the singleton Prisma Client instance
   */
  public static getClient(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
      });

      console.log('✓ Prisma Client initialized');
    }

    return PrismaService.instance;
  }

  /**
   * Initialize Prisma and verify database connection
   */
  public static async initialize(): Promise<void> {
    if (PrismaService.isInitialized) {
      console.log('Prisma already initialized');
      return;
    }

    try {
      const client = PrismaService.getClient();

      // Test the connection
      await client.$connect();
      console.log('✓ Successfully connected to PostgreSQL database');

      // Verify tables exist by running a simple query
      const userCount = await client.user.count();
      console.log(`✓ Database verified - Found ${userCount} users`);

      PrismaService.isInitialized = true;
    } catch (error) {
      console.error('✗ Failed to initialize Prisma:', error);
      throw new Error('Database connection failed');
    }
  }

  /**
   * Gracefully disconnect from the database
   */
  public static async disconnect(): Promise<void> {
    if (PrismaService.instance) {
      await PrismaService.instance.$disconnect();
      console.log('✓ Disconnected from database');
      PrismaService.instance = null;
      PrismaService.isInitialized = false;
    }
  }

  /**
   * Check if database connection is healthy
   */
  public static async healthCheck(): Promise<boolean> {
    try {
      const client = PrismaService.getClient();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

// Export the singleton instance getter
export const prisma = PrismaService.getClient();

// Export the service class for initialization and lifecycle management
export default PrismaService;
