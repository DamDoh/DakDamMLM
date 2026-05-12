/**
 * CONSOLIDATED DATABASE SERVICE
 *
 * This file now serves as a re-export wrapper to eliminate duplication.
 * All database logic is centralized in services/shared/database.ts
 *
 * Benefits:
 * - Single Prisma client instance (prevents connection pool exhaustion)
 * - Consistent error handling
 * - Better connection pooling
 * - Health check and monitoring capabilities
 * - Transaction utilities
 */

// Re-export the centralized database client
export { db as prisma, databaseConnection, DatabaseUtils } from '../../services/shared/database';

// For backward compatibility, provide additional utilities
import { db } from '../../services/shared/database';

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not configured');
      return false;
    }

    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.warn('Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export async function withDatabaseConnection<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Can't reach database server")) {
      console.warn('Database operation failed due to connection issues, using fallback');
      return fallback;
    }
    throw error;
  }
}