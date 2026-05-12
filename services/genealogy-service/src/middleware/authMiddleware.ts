import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    memberId?: string;
    isAdmin: boolean;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: any) => {
  const authHeader = (req as any).headers['authorization'] as string | undefined;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return (res as any).status(401).json({ error: 'Access token required' });
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
    return (res as any).status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user?.isAdmin) {
    return (res as any).status(403).json({ error: 'Admin access required' });
  }
  next();
};