"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderDatabaseConnection = exports.orderDb = void 0;
const client_1 = require("@prisma/client");
class OrderDatabaseConnection {
    constructor() {
        const databaseUrl = process.env.ORDER_DATABASE_URL || process.env.DATABASE_URL;
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
        if (!OrderDatabaseConnection.instance) {
            OrderDatabaseConnection.instance = new OrderDatabaseConnection();
        }
        return OrderDatabaseConnection.instance;
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
            console.error('Order database health check failed:', error);
            return false;
        }
    }
}
// Export singleton instance
exports.orderDb = OrderDatabaseConnection.getInstance().getClient();
exports.orderDatabaseConnection = OrderDatabaseConnection.getInstance();
//# sourceMappingURL=database.js.map