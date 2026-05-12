"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.checkDatabaseHealth = checkDatabaseHealth;
exports.disconnectDatabase = disconnectDatabase;
exports.startConnectionPoolMonitoring = startConnectionPoolMonitoring;
const client_1 = require("@prisma/client");
const index_1 = require("../index");
const prismaConfig = {
    log: process.env.NODE_ENV === 'development' ? [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' }
    ] : [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' }
    ],
};
// Create Prisma client with enhanced configuration
exports.prisma = new client_1.PrismaClient(prismaConfig);
// Log database queries in development - commented out due to Prisma type issues
// if (process.env.NODE_ENV === 'development') {
//   (prisma as any).$on('query', (e: any) => {
//     logger.debug(`Database Query: ${e.query}`, {
//       duration: e.duration,
//       params: e.params,
//       target: e.target
//     });
//   });
// }
// Health check function
async function checkDatabaseHealth() {
    const startTime = Date.now();
    try {
        // Simple query to test connection
        await exports.prisma.$queryRaw `SELECT 1 as health_check`;
        const responseTime = Date.now() - startTime;
        // Get connection pool stats if available
        let connectionCount;
        try {
            // This is a simplified way to check connections
            // In production, you might want to use a connection pool monitoring tool
            const result = await exports.prisma.$queryRaw `SELECT count(*) as connections FROM pg_stat_activity WHERE datname = current_database()`;
            connectionCount = parseInt(result[0].connections);
        }
        catch {
            // Connection count not available
        }
        return {
            healthy: true,
            responseTime,
            connectionCount
        };
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        return {
            healthy: false,
            responseTime,
            error: error instanceof Error ? error.message : 'Unknown database error'
        };
    }
}
// Graceful shutdown
async function disconnectDatabase() {
    try {
        await exports.prisma.$disconnect();
        index_1.logger.info('Database disconnected successfully');
    }
    catch (error) {
        index_1.logger.error('Error disconnecting from database', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
// Connection pool monitoring
function startConnectionPoolMonitoring() {
    const monitoringInterval = parseInt(process.env.DB_MONITORING_INTERVAL || '30000'); // 30 seconds
    setInterval(async () => {
        try {
            const health = await checkDatabaseHealth();
            if (!health.healthy) {
                index_1.logger.error('Database health check failed', {
                    responseTime: health.responseTime,
                    error: health.error
                });
            }
            else {
                index_1.logger.debug('Database health check passed', {
                    responseTime: health.responseTime,
                    connectionCount: health.connectionCount
                });
            }
        }
        catch (error) {
            index_1.logger.error('Database monitoring error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }, monitoringInterval);
}
// Initialize connection pool monitoring
if (process.env.NODE_ENV === 'production') {
    startConnectionPoolMonitoring();
}
// Handle process termination
process.on('SIGTERM', async () => {
    index_1.logger.info('SIGTERM received, disconnecting database');
    await disconnectDatabase();
});
process.on('SIGINT', async () => {
    index_1.logger.info('SIGINT received, disconnecting database');
    await disconnectDatabase();
});
//# sourceMappingURL=database.js.map