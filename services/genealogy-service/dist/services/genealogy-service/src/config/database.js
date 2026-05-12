"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genealogyDatabaseConnection = exports.genealogyDb = void 0;
const client_1 = require("@prisma/client");
class GenealogyDatabaseConnection {
    constructor() {
        const databaseUrl = process.env.GENEALOGY_DATABASE_URL || process.env.DATABASE_URL;
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
        if (!GenealogyDatabaseConnection.instance) {
            GenealogyDatabaseConnection.instance = new GenealogyDatabaseConnection();
        }
        return GenealogyDatabaseConnection.instance;
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
            console.error('Genealogy database health check failed:', error);
            return false;
        }
    }
}
// Export singleton instance
exports.genealogyDb = GenealogyDatabaseConnection.getInstance().getClient();
exports.genealogyDatabaseConnection = GenealogyDatabaseConnection.getInstance();
//# sourceMappingURL=database.js.map