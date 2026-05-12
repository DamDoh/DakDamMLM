"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userDatabaseConnection = exports.userDb = void 0;
const client_1 = require("@prisma/client");
class UserDatabaseConnection {
    constructor() {
        this.prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
        // Graceful shutdown handling
        process.on('beforeExit', async () => {
            await this.prisma.$disconnect();
        });
    }
    static getInstance() {
        if (!UserDatabaseConnection.instance) {
            UserDatabaseConnection.instance = new UserDatabaseConnection();
        }
        return UserDatabaseConnection.instance;
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
            console.error('User database health check failed:', error);
            return false;
        }
    }
}
// Export singleton instance
exports.userDb = UserDatabaseConnection.getInstance().getClient();
exports.userDatabaseConnection = UserDatabaseConnection.getInstance();
//# sourceMappingURL=database.js.map