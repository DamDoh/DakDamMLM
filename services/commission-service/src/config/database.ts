import { PrismaClient } from '@prisma/client';

class CommissionDatabaseConnection {
  private static instance: CommissionDatabaseConnection;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Graceful shutdown handling
    process.on('beforeExit', async () => {
      await this.prisma.$disconnect();
    });
  }

  public static getInstance(): CommissionDatabaseConnection {
    if (!CommissionDatabaseConnection.instance) {
      CommissionDatabaseConnection.instance = new CommissionDatabaseConnection();
    }
    return CommissionDatabaseConnection.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Commission database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const commissionDb = CommissionDatabaseConnection.getInstance().getClient();
export const commissionDatabaseConnection = CommissionDatabaseConnection.getInstance();