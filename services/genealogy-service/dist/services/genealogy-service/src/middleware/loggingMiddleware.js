"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorLogger = exports.requestLogger = void 0;
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${timestamp}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    });
    next();
};
exports.requestLogger = requestLogger;
const errorLogger = (error, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error: ${error.message}`);
    console.error(`[${timestamp}] Stack: ${error.stack}`);
    console.error(`[${timestamp}] URL: ${req.method} ${req.url}`);
    console.error(`[${timestamp}] Body:`, req.body);
    next(error);
};
exports.errorLogger = errorLogger;
//# sourceMappingURL=loggingMiddleware.js.map