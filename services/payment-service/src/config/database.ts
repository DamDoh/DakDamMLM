import { PrismaClient } from '@prisma/client';

class PaymentDatabaseConnection {
  private static instance: PaymentDatabaseConnection;
  private prisma: PrismaClient;

  private constructor() {
    const databaseUrl = process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL;
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

  public static getInstance(): PaymentDatabaseConnection {
    if (!PaymentDatabaseConnection.instance) {
      PaymentDatabaseConnection.instance = new PaymentDatabaseConnection();
    }
    return PaymentDatabaseConnection.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Payment database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const paymentDb = PaymentDatabaseConnection.getInstance().getClient();
export const paymentDatabaseConnection = PaymentDatabaseConnection.getInstance();