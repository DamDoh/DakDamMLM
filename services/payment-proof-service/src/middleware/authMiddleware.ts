import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../index';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    uplineId?: string;
  };
  query: any;
  body: any;
  params: any;
  ip: any;
  get: any;
  header: any;
  file?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: any) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return (res as any).status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      id: decoded.id,
      role: decoded.role,
      uplineId: decoded.uplineId,
    };

    logger.info('Authentication successful', { userId: req.user.id, role: req.user.role });
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error instanceof Error ? error.message : String(error) });
    (res as any).status(401).json({ error: 'Invalid token.' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn('Access denied due to insufficient permissions', {
        userId: req.user?.id,
        userRole: req.user?.role,
        requiredRoles: roles
      });
      return (res as any).status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

export const requireUplineAccess = (req: AuthRequest, res: Response, next: any) => {
  // This middleware ensures uplines can only access their downlines' data
    const { userId } = (req as any).params;
  const currentUser = req.user;

  if (!currentUser) {
      return (res as any).status(401).json({ error: 'Authentication required.' });
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

  logger.warn('Access denied for upline relationship', {
    currentUserId: currentUser.id,
    currentUserRole: currentUser.role,
    targetUserId: userId
  });

  (res as any).status(403).json({ error: 'Access denied. Can only access own or downline data.' });
};