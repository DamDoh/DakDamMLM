"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseUtils = exports.databaseConnection = exports.db = void 0;
const client_1 = require("@prisma/client");
// Database connection with connection pooling for scalability
class DatabaseConnection {
    constructor() {
        this.connectionPromise = null;
        this.prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });
        // Graceful shutdown handling
        process.on('beforeExit', async () => {
            await this.prisma.$disconnect();
        });
    }
    static getInstance() {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }
    getClient() {
        return this.prisma;
    }
    // Health check method for load balancers
    async healthCheck() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
    // Connection pool management
    async getConnectionInfo() {
        try {
            const result = await this.prisma.$queryRaw `
        SELECT COUNT(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;
            return {
                isConnected: true,
                connectionCount: Number(result[0]?.connection_count || 0),
            };
        }
        catch (error) {
            console.error('Failed to get connection info:', error);
            return {
                isConnected: false,
                connectionCount: 0,
            };
        }
    }
}
// Export singleton instance
exports.db = DatabaseConnection.getInstance().getClient();
exports.databaseConnection = DatabaseConnection.getInstance();
// Utility functions for common database operations
class DatabaseUtils {
    // Transaction wrapper with retry logic
    static async withTransaction(operation, maxRetries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await exports.db.$transaction(async (tx) => {
                    return await operation(tx);
                });
            }
            catch (error) {
                lastError = error;
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
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
        }
        throw lastError;
    }
    // Batch operations for better performance
    static async batchInsert(data, batchSize = 100, insertFn) {
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await insertFn(batch);
        }
    }
    // Safe query wrapper with timeout
    static async safeQuery(queryFn, timeoutMs = 30000) {
        return Promise.race([
            queryFn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), timeoutMs)),
        ]);
    }
}
exports.DatabaseUtils = DatabaseUtils;
//# sourceMappingURL=database.js.map