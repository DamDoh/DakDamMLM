"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOwnershipOrAdmin = exports.requireAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const utils_1 = require("../../../../shared/utils");
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_jwt_secret';
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token is required',
            timestamp: new Date().toISOString(),
            requestId: (0, utils_1.generateRequestId)(),
        });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            memberId: decoded.memberId,
            isAdmin: decoded.isAdmin,
        };
        next();
    }
    catch (error) {
        console.error('JWT verification failed:', error);
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token',
            timestamp: new Date().toISOString(),
            requestId: (0, utils_1.generateRequestId)(),
        });
    }
};
exports.authenticateToken = authenticateToken;
const requireAdmin = (req, res, next) => {
    if (!req.user?.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required',
            timestamp: new Date().toISOString(),
            requestId: (0, utils_1.generateRequestId)(),
        });
    }
    next();
};
exports.requireAdmin = requireAdmin;
const requireOwnershipOrAdmin = (userIdParam = 'userId') => (req, res, next) => {
    const userId = req.params[userIdParam];
    if (!req.user?.isAdmin && req.user?.id !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            timestamp: new Date().toISOString(),
            requestId: (0, utils_1.generateRequestId)(),
        });
    }
    next();
};
exports.requireOwnershipOrAdmin = requireOwnershipOrAdmin;
//# sourceMappingURL=auth.js.map
