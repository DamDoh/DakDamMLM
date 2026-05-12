"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import database and logging
const database_1 = require("./config/database");
var database_2 = require("./config/database");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return database_2.prisma; } });
const EnhancedLogger_1 = require("./services/EnhancedLogger");
exports.logger = EnhancedLogger_1.enhancedLogger;
// Import routes
const proofRoutes_1 = require("./routes/proofRoutes");
const approvalRoutes_1 = require("./routes/approvalRoutes");
const disputeRoutes_1 = require("./routes/disputeRoutes");
const healthRoutes_1 = require("./routes/healthRoutes");
// Import middleware
const authMiddleware_1 = require("./middleware/authMiddleware");
const errorHandler_1 = require("./middleware/errorHandler");
// Import services
const RedisService_1 = require("./services/RedisService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3004;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(EnhancedLogger_1.correlationMiddleware); // Add correlation ID tracking
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);
// Stricter rate limiting for uploads
const uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 uploads per hour
    message: 'Upload limit exceeded. Please try again later.',
});
app.use('/api/proofs/upload', uploadLimiter);
// Routes
app.use('/api/health', healthRoutes_1.healthRoutes);
app.use('/api/proofs', authMiddleware_1.authMiddleware, proofRoutes_1.proofRoutes);
app.use('/api/approvals', authMiddleware_1.authMiddleware, approvalRoutes_1.approvalRoutes);
app.use('/api/disputes', authMiddleware_1.authMiddleware, disputeRoutes_1.disputeRoutes);
// Error handling middleware
app.use(errorHandler_1.errorHandler);
// Initialize services
async function initializeServices() {
    try {
        // Connect to Redis
        await RedisService_1.redisService.connect();
        exports.logger.info('Redis connected successfully');
        // Start notification processor
        // notificationService.startNotificationProcessor();
        exports.logger.info('All services initialized successfully');
    }
    catch (error) {
        exports.logger.error('Failed to initialize services', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    }
}
// Graceful shutdown
async function gracefulShutdown(signal) {
    exports.logger.info(`${signal} received, shutting down gracefully`);
    try {
        // Close Redis connection
        await RedisService_1.redisService.disconnect();
        // Disconnect database
        await database_1.prisma.$disconnect();
        exports.logger.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        exports.logger.error('Error during graceful shutdown', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Start server
app.listen(PORT, async () => {
    exports.logger.info(`Payment Proof Service listening on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV,
        version: '1.0.0'
    });
    // Initialize services after server starts
    await initializeServices();
});
// Start notification processor
const notificationService = new (require('./services/NotificationService').NotificationService)();
notificationService.startNotificationProcessor();
//# sourceMappingURL=index.js.map