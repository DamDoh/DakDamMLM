import { Request, Response, NextFunction } from 'express';
import { rbacService } from '@/lib/rbac-service';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: any;
      };
      session?: any;
    }
  }
}

/**
 * RBAC Authentication Middleware
 * Validates session tokens and attaches user context to requests
 */
export class RBACAuthMiddleware {
  /**
   * Main authentication middleware
   */
  static authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        return res.status(401).json({ error: 'No authentication token provided' });
      }

      const sessionResult = await rbacService.validateSession(token);

      if (!sessionResult.valid) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      // Attach user and session to request
      req.user = {
        id: sessionResult.user.id,
        email: sessionResult.user.email,
        roles: [], // Will be populated by role middleware
        permissions: null // Will be populated by permission middleware
      };
      req.session = sessionResult.session;

      next();

    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  /**
   * Optional authentication middleware (doesn't fail if no token)
   */
  static optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = this.extractToken(req);

      if (token) {
        const sessionResult = await rbacService.validateSession(token);
        if (sessionResult.valid) {
          req.user = {
            id: sessionResult.user.id,
            email: sessionResult.user.email,
            roles: [],
            permissions: null
          };
          req.session = sessionResult.session;
        }
      }

      next();

    } catch (error) {
      // Don't fail, just continue without authentication
      next();
    }
  };

  /**
   * Role-based authorization middleware factory
   */
  static requireRole = (requiredRole: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user roles if not already loaded
      if (!req.user.roles || req.user.roles.length === 0) {
        const permissions = await rbacService.getUserPermissions(req.user.id);
        req.user.roles = permissions?.user?.roles?.map((r: any) => r.role) || [];
      }

      // Check if user has required role
      if (!req.user.roles.includes(requiredRole)) {
        return res.status(403).json({
          error: 'Insufficient role permissions',
          required: requiredRole,
          has: req.user.roles
        });
      }

      next();
    };
  };

  /**
   * Permission-based authorization middleware factory
   */
  static requirePermission = (action: string, resource: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissionCheck = await rbacService.checkPermission({
        userId: req.user.id,
        action,
        resource,
        context: {
          workspaceId: req.body?.workspaceId || req.query?.workspaceId,
          conditions: req.body?.conditions || req.query?.conditions
        }
      });

      if (!permissionCheck.allowed) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          action,
          resource,
          reason: permissionCheck.reason,
          metadata: permissionCheck.metadata
        });
      }

      next();
    };
  };

  /**
   * Workspace-based authorization middleware
   */
  static requireWorkspace = (workspaceName?: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissions = await rbacService.getUserPermissions(req.user.id);
      const userWorkspaces = permissions?.user?.roles?.map((r: any) => r.workspace).filter(Boolean) || [];

      let hasAccess = false;

      if (workspaceName) {
        // Check specific workspace
        hasAccess = userWorkspaces.some((ws: any) => ws.name === workspaceName);
      } else {
        // Check if user has any workspace access
        hasAccess = userWorkspaces.length > 0;
      }

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Workspace access denied',
          required: workspaceName || 'any workspace',
          userWorkspaces: userWorkspaces.map((ws: any) => ws.name)
        });
      }

      next();
    };
  };

  /**
   * MFA requirement middleware
   */
  static requireMFA = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.mfaVerified) {
      return res.status(403).json({
        error: 'Multi-factor authentication required',
        requiresMFA: true
      });
    }

    next();
  };

  /**
   * Session validation middleware (checks for expired or invalid sessions)
   */
  static validateSession = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
      return next(); // Let authentication middleware handle this
    }

    // Check session expiry
    if (req.session.expiresAt < new Date()) {
      await rbacService.invalidateSession(req.session.id);
      return res.status(401).json({ error: 'Session expired' });
    }

    // Check for suspicious activity
    const riskScore = await this.calculateSessionRisk(req);
    if (riskScore > 80) {
      await rbacService.invalidateSession(req.session.id);
      return res.status(401).json({ error: 'Session terminated due to suspicious activity' });
    }

    next();
  };

  /**
   * Audit logging middleware
   */
  static auditLog = (action: string, resource: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      let responseBody: any = null;

      // Capture response
      res.send = function(body: any) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      // Log after response
      res.on('finish', async () => {
        try {
          if (req.user) {
            const status = res.statusCode;
            const riskLevel = status >= 400 ? 'medium' : 'low';

            // Only log significant actions or errors
            if (action !== 'read' || status !== 200) {
              await this.logAuditEvent({
                userId: req.user.id,
                action,
                resource,
                resourceId: req.params?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.session?.id,
                riskLevel,
                status: status < 400 ? 'success' : 'failure',
                metadata: {
                  method: req.method,
                  path: req.path,
                  query: req.query,
                  responseStatus: status
                }
              });
            }
          }
        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      });

      next();
    };
  };

  /**
   * Extract token from request
   */
  private static extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie
    const cookieToken = req.cookies?.rbac_token;
    if (cookieToken) {
      return cookieToken;
    }

    // Check query parameter (less secure, but useful for some cases)
    const queryToken = req.query?.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  /**
   * Calculate session risk score
   */
  private static async calculateSessionRisk(req: Request): Promise<number> {
    let riskScore = 0;

    // Geographic anomaly
    const currentIP = req.ip;
    const sessionIP = req.session.ipAddress;
    if (currentIP !== sessionIP) {
      riskScore += 30;
    }

    // User agent change
    const currentUA = req.get('User-Agent');
    const sessionUA = req.session.userAgent;
    if (currentUA && sessionUA && currentUA !== sessionUA) {
      riskScore += 20;
    }

    // Time-based anomalies
    const now = new Date();
    const lastActivity = req.session.lastActivity;
    if (lastActivity) {
      const timeDiff = now.getTime() - lastActivity.getTime();
      if (timeDiff > 2 * 60 * 60 * 1000) { // 2 hours of inactivity
        riskScore += 25;
      }
    }

    return Math.min(riskScore, 100);
  }

  /**
   * Log audit event
   */
  private static async logAuditEvent(event: any) {
    // This would call the rbacService.logAuditEvent method
    // For now, we'll implement a simple version
    try {
      const { prisma } = await import('@/lib/database');

      const auditEntry = {
        userId: event.userId,
        userRole: 'unknown', // Would need to look this up
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        riskLevel: event.riskLevel,
        status: event.status,
        metadata: event.metadata,
        hash: '' // Would calculate hash
      };

      await prisma.rBACAuditLog.create({ data: auditEntry });
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }
}

// Export middleware functions
export const rbacAuth = RBACAuthMiddleware.authenticate;
export const rbacOptionalAuth = RBACAuthMiddleware.optionalAuthenticate;
export const requireRole = RBACAuthMiddleware.requireRole;
export const requirePermission = RBACAuthMiddleware.requirePermission;
export const requireWorkspace = RBACAuthMiddleware.requireWorkspace;
export const requireMFA = RBACAuthMiddleware.requireMFA;
export const validateSession = RBACAuthMiddleware.validateSession;
export const auditLog = RBACAuthMiddleware.auditLog;