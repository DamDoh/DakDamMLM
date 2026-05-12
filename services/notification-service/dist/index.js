"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const notificationRoutes_1 = require("./routes/notificationRoutes");
const templateRoutes_1 = require("./routes/templateRoutes");
const preferenceRoutes_1 = require("./routes/preferenceRoutes");
const campaignRoutes_1 = require("./routes/campaignRoutes");
const healthRoutes_1 = require("./routes/healthRoutes");
const swagger_1 = require("./utils/swagger");
const logger_1 = require("./utils/logger");
const metrics_1 = require("./utils/metrics");
const cache_1 = require("./utils/cache");
const queue_1 = require("./utils/queue");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3005;
// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || false
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use((0, cors_1.default)(corsOptions));
// Compression middleware
app.use((0, compression_1.default)({
    level: 6, // Balanced compression
    threshold: 1024, // Only compress responses > 1KB
}));
// Body parsing with size limits
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Input sanitization middleware
app.use((req, res, next) => {
    // Sanitize string inputs
    const sanitizeString = (str) => str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
            return sanitizeString(obj);
        }
        else if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        else if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = sanitizeObject(value);
            }
            return sanitized;
        }
        return obj;
    };
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    next();
});
// Rate limiting - standard limiter
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent'),
            type: 'rate_limit_exceeded'
        });
        res.status(429).json({
            success: false,
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        });
    }
});
// Speed limiter - gradual slowdown
const speedLimiter = (0, express_slow_down_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // allow 50 requests per windowMs without delay
    delayMs: 100, // add 100ms of delay per request after delayAfter
});
// Apply rate limiting to API routes
app.use('/api/', limiter);
app.use('/api/', speedLimiter);
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Add request ID to response header
    res.set('X-Request-ID', requestId);
    logger_1.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
        type: 'request_start'
    });
    // Track response
    res.on('finish', () => {
        const duration = Date.now() - start;
        metrics_1.metricsService.observeRequest(req.method, req.path, res.statusCode, duration);
        logger_1.logger.info('Request completed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            requestId,
            type: 'request_complete'
        });
    });
    next();
});
// Health check endpoint (no auth required)
app.use('/api/health', healthRoutes_1.healthRoutes);
// Swagger documentation
if (process.env.NODE_ENV !== 'production') {
    app.use('/api-docs', swagger_1.swaggerUi.serve, swagger_1.swaggerUi.setup(swagger_1.swaggerSpec));
    logger_1.logger.info('Swagger documentation available at /api-docs');
}
// API routes
app.use('/api/notifications', notificationRoutes_1.notificationRoutes);
app.use('/api/templates', templateRoutes_1.templateRoutes);
app.use('/api/preferences', preferenceRoutes_1.preferenceRoutes);
app.use('/api/campaigns', campaignRoutes_1.campaignRoutes);
// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
    try {
        const metrics = await metrics_1.metricsService.getMetrics();
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(metrics);
    }
    catch (error) {
        logger_1.logger.error('Failed to serve metrics', { error: error.message });
        res.status(500).send('Error generating metrics');
    }
});
// Webhook endpoints for notification providers (no auth required)
app.post('/webhooks/sendgrid', express_1.default.raw({ type: 'application/json' }), (req, res) => {
    // Handle SendGrid webhooks
    logger_1.logger.info('SendGrid webhook received', { type: 'webhook_sendgrid' });
    res.json({ received: true });
});
app.post('/webhooks/twilio', (req, res) => {
    // Handle Twilio webhooks
    logger_1.logger.info('Twilio webhook received', { type: 'webhook_twilio' });
    res.json({ received: true });
});
app.post('/webhooks/firebase', (req, res) => {
    // Handle Firebase webhooks
    logger_1.logger.info('Firebase webhook received', { type: 'webhook_firebase' });
    res.json({ received: true });
});
// 404 handler
app.use((req, res) => {
    logger_1.logger.warn('Route not found', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        type: 'route_not_found'
    });
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
        method: req.method,
    });
});
// Global error handling middleware
app.use((err, req, res, next) => {
    const requestId = res.get('X-Request-ID') || 'unknown';
    logger_1.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId,
        type: 'unhandled_error'
    });
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorResponse = {
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        requestId,
        timestamp: new Date().toISOString(),
    };
    if (isDevelopment) {
        errorResponse.stack = err.stack;
    }
    res.status(err.status || 500).json(errorResponse);
});
// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`Received ${signal}, starting graceful shutdown`);
    try {
        // Close connections
        await queue_1.queueService.close();
        await cache_1.cacheService.disconnect();
        logger_1.logger.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Error during graceful shutdown', { error: error.message });
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Start server
const server = app.listen(PORT, async () => {
    logger_1.logger.info('Notification service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        type: 'service_start'
    });
    // Initialize connections
    try {
        await cache_1.cacheService.connect();
        await queue_1.queueService.connect();
        logger_1.logger.info('All connections established successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to establish connections', { error: error.message });
        process.exit(1);
    }
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
        type: 'uncaught_exception'
    });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled rejection', {
        reason: reason,
        promise: promise,
        type: 'unhandled_rejection'
    });
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=index.js.map