import { prisma } from '@/lib/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Comprehensive RBAC (Role-Based Access Control) Service
 * Implements hierarchical permission management with workspace delegation
 */

export interface PermissionCheck {
  userId: string;
  action: string; // 'C', 'R', 'U', 'D', 'X'
  resource: string; // user_data, financial_records, etc.
  resourceId?: string;
  context?: {
    workspaceId?: string;
    conditions?: any;
  };
}

export interface RBACSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  mfaVerified: boolean;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  metadata?: {
    role: string;
    workspace?: string;
    conditions?: any;
  };
}

export class RBACService {
  private readonly jwtSecret: string;
  private readonly sessionTimeout: number = 8 * 60 * 60 * 1000; // 8 hours
  private readonly idleTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.jwtSecret = process.env.RBAC_JWT_SECRET || 'default-rbac-secret-change-in-production';
  }

  /**
   * Check if user has permission for specific action on resource
   */
  async checkPermission(check: PermissionCheck): Promise<PermissionResult> {
    try {
      // Get user with roles and permissions
      const user = await prisma.rBACUser.findUnique({
        where: { id: check.userId },
        include: {
          roles: {
            where: { isActive: true, OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]},
            include: {
              role: {
                include: {
                  permissions: {
                    where: { isActive: true },
                    include: { permission: true }
                  }
                }
              },
              workspace: true
            }
          }
        }
      });

      if (!user || !user.isActive) {
        return { allowed: false, reason: 'User not found or inactive' };
      }

      if (user.accountLocked) {
        return { allowed: false, reason: 'Account is locked' };
      }

      // Check each assigned role
      for (const userRole of user.roles) {
        const result = await this.checkRolePermission(userRole, check);
        if (result.allowed) {
          return {
            allowed: true,
            metadata: {
              role: userRole.role.name,
              workspace: userRole.workspace?.name,
              conditions: result.conditions
            }
          };
        }
      }

      // Check inherited permissions from parent roles
      for (const userRole of user.roles) {
        const inheritedResult = await this.checkInheritedPermissions(userRole.roleId, check);
        if (inheritedResult.allowed) {
          return {
            allowed: true,
            metadata: {
              role: userRole.role.name + ' (inherited)',
              workspace: userRole.workspace?.name,
              conditions: inheritedResult.conditions
            }
          };
        }
      }

      return { allowed: false, reason: 'Insufficient permissions' };

    } catch (error) {
      console.error('Permission check failed:', error);
      return { allowed: false, reason: 'Permission check error' };
    }
  }

  /**
   * Check permissions for a specific role assignment
   */
  private async checkRolePermission(
    userRole: any,
    check: PermissionCheck
  ): Promise<{ allowed: boolean; conditions?: any }> {
    // Check workspace scope if specified
    if (check.context?.workspaceId && userRole.workspaceId !== check.context.workspaceId) {
      return { allowed: false };
    }

    // Check each permission in the role
    for (const rolePermission of userRole.role.permissions) {
      const permission = rolePermission.permission;

      // Check resource match
      if (permission.resource !== check.resource) {
        continue;
      }

      // Check action permission
      const actions = permission.actions as string[];
      if (!actions.includes(check.action)) {
        continue;
      }

      // Check scope limitations
      if (userRole.scopeLimitations) {
        const scopeCheck = this.checkScopeLimitations(userRole.scopeLimitations, check);
        if (!scopeCheck.allowed) {
          continue;
        }
      }

      // Check permission conditions
      if (permission.conditions) {
        const conditionCheck = this.evaluatePermissionConditions(permission.conditions, check);
        if (!conditionCheck.allowed) {
          continue;
        }
        return { allowed: true, conditions: conditionCheck.conditions };
      }

      return { allowed: true };
    }

    return { allowed: false };
  }

  /**
   * Check inherited permissions from parent roles
   */
  private async checkInheritedPermissions(
    roleId: string,
    check: PermissionCheck,
    visitedRoles: Set<string> = new Set()
  ): Promise<{ allowed: boolean; conditions?: any }> {
    if (visitedRoles.has(roleId)) {
      return { allowed: false }; // Prevent circular inheritance
    }
    visitedRoles.add(roleId);

    const role = await prisma.rBACRole.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          where: { isActive: true },
          include: { permission: true }
        }
      }
    });

    if (!role || !role.parentRoleId) {
      return { allowed: false };
    }

    // Check parent role permissions
    for (const rolePermission of role.permissions) {
      const permission = rolePermission.permission;

      if (permission.resource === check.resource) {
        const actions = permission.actions as string[];
        if (actions.includes(check.action)) {
          return { allowed: true };
        }
      }
    }

    // Recursively check grandparent roles
    return this.checkInheritedPermissions(role.parentRoleId, check, visitedRoles);
  }

  /**
   * Check scope limitations
   */
  private checkScopeLimitations(
    limitations: any,
    check: PermissionCheck
  ): { allowed: boolean } {
    for (const limitation of limitations) {
      switch (limitation.type) {
        case 'resource_filter':
          if (!this.checkResourceFilter(limitation, check)) {
            return { allowed: false };
          }
          break;
        case 'time_restriction':
          if (!this.checkTimeRestriction(limitation)) {
            return { allowed: false };
          }
          break;
        case 'geographic_limit':
          if (!this.checkGeographicLimit(limitation, check)) {
            return { allowed: false };
          }
          break;
        case 'amount_threshold':
          if (!this.checkAmountThreshold(limitation, check)) {
            return { allowed: false };
          }
          break;
      }
    }
    return { allowed: true };
  }

  /**
   * Evaluate permission conditions
   */
  private evaluatePermissionConditions(
    conditions: any,
    check: PermissionCheck
  ): { allowed: boolean; conditions?: any } {
    for (const condition of conditions) {
      const value = this.getConditionValue(condition.field, check);
      const allowed = this.evaluateCondition(value, condition.operator, condition.value);

      if (!allowed) {
        return { allowed: false };
      }
    }
    return { allowed: true, conditions };
  }

  /**
   * Get value for condition evaluation
   */
  private getConditionValue(field: string, check: PermissionCheck): any {
    switch (field) {
      case 'amount':
        return check.context?.conditions?.amount;
      case 'status':
        return check.context?.conditions?.status;
      case 'department':
        return check.context?.conditions?.department;
      case 'region':
        return check.context?.conditions?.region;
      default:
        return check.context?.conditions?.[field];
    }
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(value: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'not_equals':
        return value !== expected;
      case 'greater_than':
        return Number(value) > Number(expected);
      case 'less_than':
        return Number(value) < Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(value);
      case 'contains':
        return Array.isArray(value) && value.includes(expected);
      default:
        return false;
    }
  }

  /**
   * Helper methods for scope limitations
   */
  private checkResourceFilter(limitation: any, check: PermissionCheck): boolean {
    // Implementation for resource filtering
    return true; // Placeholder
  }

  private checkTimeRestriction(limitation: any): boolean {
    const now = new Date();
    const currentHour = now.getHours();

    if (limitation.allowedHours && !limitation.allowedHours.includes(currentHour)) {
      return false;
    }

    return true;
  }

  private checkGeographicLimit(limitation: any, check: PermissionCheck): boolean {
    const userRegion = check.context?.conditions?.region;
    return !limitation.allowedRegions || limitation.allowedRegions.includes(userRegion);
  }

  private checkAmountThreshold(limitation: any, check: PermissionCheck): boolean {
    const amount = check.context?.conditions?.amount;
    return !amount || amount <= limitation.maxAmount;
  }

  /**
   * Authenticate user and create session
   */
  async authenticate(credentials: {
    email: string;
    password: string;
    ipAddress: string;
    userAgent?: string;
    deviceFingerprint?: string;
  }): Promise<{ success: boolean; session?: RBACSession; requiresMFA?: boolean; user?: any }> {
    try {
      const user = await prisma.rBACUser.findUnique({
        where: { email: credentials.email },
        include: { mfaConfig: true }
      });

      if (!user || !user.isActive) {
        return { success: false };
      }

      // Check password
      const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!passwordValid) {
        await this.recordFailedLogin(user.id, credentials.ipAddress);
        return { success: false };
      }

      // Check if account is locked
      if (user.accountLocked) {
        return { success: false };
      }

      // Check MFA requirement
      if (user.mfaEnabled && user.mfaConfig) {
        return {
          success: true,
          requiresMFA: true,
          user: { id: user.id, email: user.email }
        };
      }

      // Create session
      const session = await this.createSession(user.id, credentials);

      // Update last login
      await prisma.rBACUser.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Log successful authentication
      await this.logAuditEvent({
        userId: user.id,
        action: 'login',
        resource: 'authentication',
        status: 'success',
        ipAddress: credentials.ipAddress,
        userAgent: credentials.userAgent,
        metadata: { method: 'password' }
      });

      return { success: true, session };

    } catch (error) {
      console.error('Authentication failed:', error);
      return { success: false };
    }
  }

  /**
   * Verify MFA and complete authentication
   */
  async verifyMFA(verification: {
    userId: string;
    code: string;
    method: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<{ success: boolean; session?: RBACSession }> {
    try {
      const user = await prisma.rBACUser.findUnique({
        where: { id: verification.userId },
        include: { mfaConfig: true }
      });

      if (!user?.mfaConfig) {
        return { success: false };
      }

      // Verify MFA code (simplified - would integrate with actual MFA service)
      const mfaValid = await this.verifyMFACode(user.mfaConfig, verification.code, verification.method);
      if (!mfaValid) {
        return { success: false };
      }

      // Create session
      const session = await this.createSession(user.id, {
        ipAddress: verification.ipAddress,
        userAgent: verification.userAgent
      });

      // Update MFA last verified
      await prisma.rBACMFAConfig.update({
        where: { userId: user.id },
        data: { lastVerified: new Date() }
      });

      // Log MFA verification
      await this.logAuditEvent({
        userId: user.id,
        action: 'mfa_verify',
        resource: 'authentication',
        status: 'success',
        ipAddress: verification.ipAddress,
        userAgent: verification.userAgent,
        metadata: { method: verification.method }
      });

      return { success: true, session };

    } catch (error) {
      console.error('MFA verification failed:', error);
      return { success: false };
    }
  }

  /**
   * Create user session
   */
  private async createSession(
    userId: string,
    context: {
      ipAddress: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ): Promise<RBACSession> {
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { userId, sessionId, type: 'rbac_session' },
      this.jwtSecret,
      { expiresIn: '8h' }
    );

    const expiresAt = new Date(Date.now() + this.sessionTimeout);

    const session = await prisma.rBACSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceFingerprint: context.deviceFingerprint,
        expiresAt,
        mfaVerified: true // Assumes MFA was verified
      }
    });

    return {
      id: sessionId,
      userId,
      token,
      expiresAt,
      mfaVerified: true
    };
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<{ valid: boolean; user?: any; session?: any }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      if (decoded.type !== 'rbac_session') {
        return { valid: false };
      }

      const session = await prisma.rBACSession.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return { valid: false };
      }

      // Update last activity
      await prisma.rBACSession.update({
        where: { id: session.id },
        data: { lastActivity: new Date() }
      });

      return {
        valid: true,
        user: session.user,
        session
      };

    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await prisma.rBACSession.update({
      where: { id: sessionId },
      data: { isActive: false }
    });
  }

  /**
   * Get user roles and permissions
   */
  async getUserPermissions(userId: string): Promise<any> {
    const user = await prisma.rBACUser.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: { isActive: true },
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            },
            workspace: true
          }
        }
      }
    });

    if (!user) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles.map(ur => ({
          role: ur.role.name,
          workspace: ur.workspace?.name,
          permissions: ur.role.permissions.map(rp => rp.permission)
        }))
      }
    };
  }

  /**
   * Helper methods
   */
  private async recordFailedLogin(userId: string, ipAddress: string): Promise<void> {
    // Implementation for failed login tracking
    await this.logAuditEvent({
      userId,
      action: 'login_failed',
      resource: 'authentication',
      status: 'failure',
      ipAddress,
      metadata: { reason: 'invalid_password' }
    });
  }

  private async verifyMFACode(mfaConfig: any, code: string, method: string): Promise<boolean> {
    // Simplified MFA verification - would integrate with actual MFA service
    return code === '123456'; // Placeholder
  }

  private async logAuditEvent(event: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress: string;
    userAgent?: string;
    sessionId?: string;
    justification?: string;
    riskLevel?: string;
    status?: string;
    errorMessage?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      // Get user role for audit
      const userRole = await prisma.rBACUserRole.findFirst({
        where: { userId: event.userId, isActive: true },
        include: { role: true }
      });

      const auditEntry = {
        userId: event.userId,
        userRole: userRole?.role.name || 'unknown',
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        oldValues: event.oldValues,
        newValues: event.newValues,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        justification: event.justification,
        riskLevel: event.riskLevel || 'low',
        status: event.status || 'success',
        errorMessage: event.errorMessage,
        metadata: event.metadata,
        hash: '' // Will be calculated
      };

      // Calculate cryptographic hash for immutability
      const hashData = JSON.stringify(auditEntry);
      auditEntry.hash = crypto.createHash('sha256').update(hashData).digest('hex');

      await prisma.rBACAuditLog.create({ data: auditEntry });

    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

// Export singleton instance
export const rbacService = new RBACService();