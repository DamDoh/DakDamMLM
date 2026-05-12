import { PrismaClient } from '@prisma/client';

class OrderDatabaseConnection {
  private static instance: OrderDatabaseConnection;
  private prisma: PrismaClient;

  private constructor() {
    const databaseUrl = process.env.ORDER_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Database URL not configured');
    }
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Graceful shutdown handling
    process.on('beforeExit', async () => {
      await this.prisma.$disconnect();
    });
  }

  public static getInstance(): OrderDatabaseConnection {
    if (!OrderDatabaseConnection.instance) {
      OrderDatabaseConnection.instance = new OrderDatabaseConnection();
    }
    return OrderDatabaseConnection.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Order database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const orderDb = OrderDatabaseConnection.getInstance().getClient();
export const orderDatabaseConnection = OrderDatabaseConnection.getInstance();