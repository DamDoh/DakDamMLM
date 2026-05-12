import { PrismaClient } from '@prisma/client';

// Database connection with connection pooling for scalability
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private prisma: PrismaClient;
  private connectionPromise: Promise<PrismaClient> | null = null;

  private constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Database URL not configured');
    }
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasourceUrl: databaseUrl,
    });

    // Graceful shutdown handling
    process.on('beforeExit', async () => {
      await this.prisma.$disconnect();
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  // Health check method for load balancers
  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Connection pool management
  public async getConnectionInfo(): Promise<{
    isConnected: boolean;
    connectionCount: number;
  }> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT COUNT(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
      ` as Array<{ connection_count: bigint }>;

      return {
        isConnected: true,
        connectionCount: Number(result[0]?.connection_count || 0),
      };
    } catch (error) {
      console.error('Failed to get connection info:', error);
      return {
        isConnected: false,
        connectionCount: 0,
      };
    }
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance().getClient();
export const databaseConnection = DatabaseConnection.getInstance();

// Utility functions for common database operations
export class DatabaseUtils {
  // Transaction wrapper with retry logic
  static async withTransaction<T>(
    operation: (tx: PrismaClient) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await db.$transaction(async (tx) => {
          return await operation(tx as PrismaClient);
        });
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain types of errors
        if (error instanceof Error &&
            (error.message.includes('unique constraint') ||
             error.message.includes('foreign key') ||
             error.message.includes('not null'))) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }

    throw lastError!;
  }

  // Batch operations for better performance
  static async batchInsert<T>(
    data: T[],
    batchSize: number = 100,
    insertFn: (batch: T[]) => Promise<any>
  ): Promise<void> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await insertFn(batch);
    }
  }

  // Safe query wrapper with timeout
  static async safeQuery<T>(
    queryFn: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    return Promise.race([
      queryFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      ),
    ]);
  }
}