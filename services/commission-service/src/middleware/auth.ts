import { Request, Response } from 'express';
type NextFunction = (err?: any) => void;
import jwt from 'jsonwebtoken';
import { generateRequestId } from '../../../../shared/utils';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    memberId?: string;
    isAdmin: boolean;
  };
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET. Please set it before running the service.');
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = (req.headers as any)['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return (res as any).status(401).json({
      success: false,
      error: 'Access token is required',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      memberId: decoded.memberId,
      isAdmin: decoded.isAdmin,
    };
    next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return (res as any).status(403).json({
      success: false,
      error: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return (res as any).status(403).json({
      success: false,
      error: 'Admin access required',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }
  next();
};

export const requireOwnershipOrAdmin = (userIdParam: string = 'userId') =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = (req as any).params[userIdParam];

    if (!req.user?.isAdmin && req.user?.id !== userId) {
      return (res as any).status(403).json({
        success: false,
        error: 'Access denied',
        timestamp: new Date().toISOString(),
        requestId: generateRequestId(),
      });
    }
    next();
  };
