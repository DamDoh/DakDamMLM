import { PrismaClient } from '@prisma/client';

class NotificationDatabaseConnection {
  private static instance: NotificationDatabaseConnection;
  private prisma: PrismaClient;

  private constructor() {
    const databaseUrl = process.env.NOTIFICATION_DATABASE_URL || process.env.DATABASE_URL;
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

  public static getInstance(): NotificationDatabaseConnection {
    if (!NotificationDatabaseConnection.instance) {
      NotificationDatabaseConnection.instance = new NotificationDatabaseConnection();
    }
    return NotificationDatabaseConnection.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Notification database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const notificationDb = NotificationDatabaseConnection.getInstance().getClient();
export const notificationDatabaseConnection = NotificationDatabaseConnection.getInstance();