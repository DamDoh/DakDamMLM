"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionDatabaseConnection = exports.commissionDb = void 0;
const client_1 = require("@prisma/client");
class CommissionDatabaseConnection {
    constructor() {
        const databaseUrl = process.env.COMMISSION_DATABASE_URL || process.env.DATABASE_URL;
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
        if (!CommissionDatabaseConnection.instance) {
            CommissionDatabaseConnection.instance = new CommissionDatabaseConnection();
        }
        return CommissionDatabaseConnection.instance;
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
            console.error('Commission database health check failed:', error);
            return false;
        }
    }
}
// Export singleton instance
exports.commissionDb = CommissionDatabaseConnection.getInstance().getClient();
exports.commissionDatabaseConnection = CommissionDatabaseConnection.getInstance();
//# sourceMappingURL=database.js.map