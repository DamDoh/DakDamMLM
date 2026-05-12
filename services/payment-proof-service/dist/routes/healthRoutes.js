"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const router = express_1.default.Router();
exports.healthRoutes = router;
router.get('/', async (req, res) => {
    try {
        // Check database connection
        await index_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: 'healthy',
            service: 'payment-proof-service',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            service: 'payment-proof-service',
            error: 'Database connection failed',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/ready', async (req, res) => {
    try {
        // More comprehensive health check
        await index_1.prisma.$queryRaw `SELECT 1`;
        // Check if required environment variables are set
        const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            return res.status(503).json({
                status: 'not ready',
                service: 'payment-proof-service',
                error: `Missing required environment variables: ${missingVars.join(', ')}`,
                timestamp: new Date().toISOString()
            });
        }
        res.status(200).json({
            status: 'ready',
            service: 'payment-proof-service',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'not ready',
            service: 'payment-proof-service',
            error: 'Service not ready',
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=healthRoutes.js.map