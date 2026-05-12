import { PrismaClient } from '@prisma/client';

class UserDatabaseConnection {
  private static instance: UserDatabaseConnection;
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

  public static getInstance(): UserDatabaseConnection {
    if (!UserDatabaseConnection.instance) {
      UserDatabaseConnection.instance = new UserDatabaseConnection();
    }
    return UserDatabaseConnection.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('User database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const userDb = UserDatabaseConnection.getInstance().getClient();
export const userDatabaseConnection = UserDatabaseConnection.getInstance();