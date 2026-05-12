import { Request, Response, NextFunction } from 'express';
import { superAdminService } from '@/services/super-admin-service';

/**
 * Super Admin Authentication Middleware
 * Validates JWT tokens and ensures super admin privileges
 */

export interface SuperAdminRequest extends Request {
  superAdmin?: {
    id: string;
    userId: string;
    role: {
      name: string;
      level: number;
      permissions: any[];
    };
  };
  session?: any;
}

/**
 * Authenticate super admin user
 */
export const superAdminAuth = async (
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token
    const authHeader = req.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const result = await superAdminService.validateSuperAdminSession(token);

    if (!result.valid || !result.superAdmin) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach super admin info to request
    req.superAdmin = {
      id: result.superAdmin.id,
      userId: result.superAdmin.userId,
      role: result.superAdmin.role
    };
    req.session = result.session;

    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional super admin authentication (doesn't fail if no token)
 */
export const superAdminOptionalAuth = async (
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (token) {
      const result = await superAdminService.validateSuperAdminSession(token);
      if (result.valid && result.superAdmin) {
        req.superAdmin = {
          id: result.superAdmin.id,
          userId: result.superAdmin.userId,
          role: result.superAdmin.role
        };
        req.session = result.session;
      }
    }

    next();
  } catch (error) {
    // Don't fail, just continue without authentication
    next();
  }
};

/**
 * Role-based authorization middleware
 * @param requiredLevel Minimum role level (1=SuperAdmin, 2=SeniorAdmin, 3=Admin)
 */
export const requireSuperAdminLevel = (requiredLevel: number = 1) => {
  return async (req: SuperAdminRequest, res: Response, next: NextFunction) => {
    if (!req.superAdmin) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.superAdmin.role.level > requiredLevel) {
      // Lower number = higher privilege (1 is highest)
      return res.status(403).json({
        error: 'Insufficient privileges',
        required: `Level ${requiredLevel}`,
        current: `Level ${req.superAdmin.role.level}`
      });
    }

    next();
  };
};

/**
 * Permission-based authorization
 * @param permission Specific permission string
 */
export const requireSuperAdminPermission = (permission: string) => {
  return async (req: SuperAdminRequest, res: Response, next: NextFunction) => {
    if (!req.superAdmin) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has permission (permissions stored in role)
    const hasPermission = req.superAdmin.role.permissions?.some(
      (p: any) => p.name === permission || p.resource === permission
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        role: req.superAdmin.role.name
      });
    }

    next();
  };
};

/**
 * Dual authorization requirement middleware
 * For critical operations that require secondary approval
 */
export const requireDualAuth = async (
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.superAdmin) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Check if there's a pending dual auth request that needs approval
    const pendingApprovals = await prisma.dualAuthorizationRequest.findMany({
      where: {
        requestedBy: req.superAdmin.userId,
        status: 'pending'
      }
    });

    if (pendingApprovals.length > 0) {
      return res.status(403).json({
        error: 'Dual authorization required',
        pendingRequests: pendingApprovals.map(p => ({
          id: p.id,
          actionType: p.actionType,
          riskLevel: p.riskLevel
        }))
      });
    }

    next();
  } catch (error) {
    console.error('Dual auth check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Import prisma for dual auth check
import { prisma } from '@/lib/database';
