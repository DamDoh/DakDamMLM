"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentDatabaseConnection = exports.paymentDb = void 0;
const client_1 = require("@prisma/client");
class PaymentDatabaseConnection {
    constructor() {
        const databaseUrl = process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('Database URL not configured');
        }
        this.prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
            datasourceUrl: databaseUrl,
        });
        // Graceful shutdown handling
        process.on('beforeExit', async () => {
            await this.prisma.$disconnect();
        });
    }
    static getInstance() {
        if (!PaymentDatabaseConnection.instance) {
            PaymentDatabaseConnection.instance = new PaymentDatabaseConnection();
        }
        return PaymentDatabaseConnection.instance;
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
            console.error('Payment database health check failed:', error);
            return false;
        }
    }
}
// Export singleton instance
exports.paymentDb = PaymentDatabaseConnection.getInstance().getClient();
exports.paymentDatabaseConnection = PaymentDatabaseConnection.getInstance();
//# sourceMappingURL=database.js.map