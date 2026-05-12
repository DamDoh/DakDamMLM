"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUplineAccess = exports.requireRole = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const authMiddleware = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.id,
            role: decoded.role,
            uplineId: decoded.uplineId,
        };
        index_1.logger.info('Authentication successful', { userId: req.user.id, role: req.user.role });
        next();
    }
    catch (error) {
        index_1.logger.error('Authentication failed', { error: error instanceof Error ? error.message : String(error) });
        res.status(401).json({ error: 'Invalid token.' });
    }
};
exports.authMiddleware = authMiddleware;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            index_1.logger.warn('Access denied due to insufficient permissions', {
                userId: req.user?.id,
                userRole: req.user?.role,
                requiredRoles: roles
            });
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireUplineAccess = (req, res, next) => {
    // This middleware ensures uplines can only access their downlines' data
    const { userId } = req.params;
    const currentUser = req.user;
    if (!currentUser) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    // Admins can access all
    if (currentUser.role === 'admin') {
        return next();
    }
    // Uplines can access their direct downlines
    if (currentUser.role === 'upline' && currentUser.uplineId === userId) {
        return next();
    }
    // Buyers can only access their own data
    if (currentUser.role === 'buyer' && currentUser.id === userId) {
        return next();
    }
    index_1.logger.warn('Access denied for upline relationship', {
        currentUserId: currentUser.id,
        currentUserRole: currentUser.role,
        targetUserId: userId
    });
    res.status(403).json({ error: 'Access denied. Can only access own or downline data.' });
};
exports.requireUplineAccess = requireUplineAccess;
//# sourceMappingURL=authMiddleware.js.map