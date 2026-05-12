"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationDatabaseConnection = exports.notificationDb = void 0;
const client_1 = require("@prisma/client");
class NotificationDatabaseConnection {
    constructor() {
        const databaseUrl = process.env.NOTIFICATION_DATABASE_URL || process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('Database URL not configured');
        }
        this.prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
        // Graceful shutdown handling
        process.on('beforeExit', async () => {
            await this.prisma.$disconnect();
        });
    }
    static getInstance() {
        if (!NotificationDatabaseConnection.instance) {
            NotificationDatabaseConnection.instance = new NotificationDatabaseConnection();
        }
        return NotificationDatabaseConnection.instance;
    }
    getClient() {
        return this.prisma;
    }
    async healthCheck() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch (error) {
            console.error('Notification database health check failed:', error);
            return false;
        }
    }
}
// Export singleton instance
exports.notificationDb = NotificationDatabaseConnection.getInstance().getClient();
exports.notificationDatabaseConnection = NotificationDatabaseConnection.getInstance();
//# sourceMappingURL=database.js.map