import { prisma } from '@/lib/database';
import { isSuperAdmin } from './superadmin-helper';

/**
 * Super Admin IAM (Identity & Access Management) utilities
 * Implements RBAC and ABAC for hierarchical permission control
 */

export interface PermissionContext {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  attributes?: Record<string, any>;
  environment?: Record<string, any>;
}

export interface ABACPolicy {
  effect: 'allow' | 'deny';
  conditions: Array<{
    attribute: string;
    operator: string;
    value: any;
  }>;
}

/**
 * Check if a user has super admin privileges with full context
 */
export async function checkSuperAdminAccess(
  context: PermissionContext
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // First check if user is a super admin
    const isSA = await isSuperAdmin(context.userId);
    if (!isSA) {
      return { allowed: false, reason: 'User is not a super admin' };
    }

    // Get super admin profile
    const superAdmin = await prisma.superAdminUser.findUnique({
      where: { userId: context.userId },
      include: { role: true }
    });

    if (!superAdmin || !superAdmin.isActive) {
      return { allowed: false, reason: 'Super admin account inactive' };
    }

    // Check MFA requirement
    if (superAdmin.mfaEnabled) {
      // Verify MFA has been completed for this session
      const mfaVerified = await verifySuperAdminMFA(superAdmin.id, context);
      if (!mfaVerified) {
        return {
          allowed: false,
          reason: 'MFA verification required',
          requiresMFA: true,
          mfaMethods: ['totp', 'sms', 'email']
        };
      }
    }

    // Check role-based permissions
    const rolePermissions = superAdmin.role.permissions as any;
    if (!hasRolePermission(rolePermissions, context.action, context.resource)) {
      return { allowed: false, reason: 'Insufficient role permissions' };
    }

    // Check ABAC restrictions
    const restrictions = superAdmin.role.restrictions as ABACPolicy[];
    if (restrictions && !evaluateABAC(restrictions, context)) {
      return { allowed: false, reason: 'ABAC policy violation' };
    }

    // Check session and security constraints
    const sessionValid = await validateSuperAdminSession(superAdmin, context);
    if (!sessionValid.allowed) {
      return sessionValid;
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking super admin access:', error);
    return { allowed: false, reason: 'Access check failed' };
  }
}

/**
 * Check if role has specific permission
 */
function hasRolePermission(
  rolePermissions: any,
  action: string,
  resource: string
): boolean {
  if (!rolePermissions || typeof rolePermissions !== 'object') {
    return false;
  }

  // Super admin level 1 has all permissions
  if (rolePermissions.level === 1) {
    return true;
  }

  const resourcePerms = rolePermissions[resource];
  if (!resourcePerms) {
    return false;
  }

  return Array.isArray(resourcePerms.actions) &&
         resourcePerms.actions.includes(action);
}

/**
 * Evaluate Attribute-Based Access Control policies
 */
function evaluateABAC(policies: ABACPolicy[], context: PermissionContext): boolean {
  for (const policy of policies) {
    if (evaluatePolicy(policy, context)) {
      return policy.effect === 'allow';
    }
  }
  return true; // Default allow if no policies match
}

/**
 * Evaluate a single ABAC policy
 */
function evaluatePolicy(policy: ABACPolicy, context: PermissionContext): boolean {
  return policy.conditions.every(condition => {
    const value = getAttributeValue(condition.attribute, context);
    return evaluateCondition(value, condition.operator, condition.value);
  });
}

/**
 * Get attribute value from context
 */
function getAttributeValue(attribute: string, context: PermissionContext): any {
  const [source, key] = attribute.split('.');

  switch (source) {
    case 'user':
      return context.attributes?.[key];
    case 'resource':
      return context.resourceId ? { id: context.resourceId, ...context.attributes }[key] : context.attributes?.[key];
    case 'environment':
      return context.environment?.[key];
    case 'action':
      return context.action === key;
    default:
      return context.attributes?.[attribute];
  }
}

/**
 * Evaluate condition operator
 */
function evaluateCondition(value: any, operator: string, expected: any): boolean {
  switch (operator) {
    case 'equals':
      return value === expected;
    case 'not_equals':
      return value !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(value);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(value);
    case 'contains':
      return Array.isArray(value) && value.includes(expected);
    case 'greater_than':
      return typeof value === 'number' && value > expected;
    case 'less_than':
      return typeof value === 'number' && value < expected;
    case 'regex':
      return new RegExp(expected).test(String(value));
    default:
      return false;
  }
}

/**
 * Validate super admin session and security constraints
 */
async function validateSuperAdminSession(
  superAdmin: any,
  context: PermissionContext
): Promise<{ allowed: boolean; reason?: string }> {
  // Check account lock
  if (superAdmin.lockedUntil && new Date() < superAdmin.lockedUntil) {
    return { allowed: false, reason: 'Account temporarily locked' };
  }

  // Check IP restrictions
  if (superAdmin.ipRestrictions) {
    const clientIP = context.environment?.ipAddress;
    if (clientIP && !isIPAllowed(clientIP, superAdmin.ipRestrictions)) {
      return { allowed: false, reason: 'IP address not allowed' };
    }
  }

  // Check session timeout
  if (superAdmin.lastLogin) {
    const sessionAge = Date.now() - superAdmin.lastLogin.getTime();
    const maxAge = superAdmin.sessionTimeout * 1000;
    if (sessionAge > maxAge) {
      return { allowed: false, reason: 'Session expired' };
    }
  }

  return { allowed: true };
}

/**
 * Check if IP is in allowed list
 */
function isIPAllowed(clientIP: string, restrictions: any): boolean {
  if (!restrictions.allowedIPs || !Array.isArray(restrictions.allowedIPs)) {
    return true; // No restrictions
  }

  return restrictions.allowedIPs.some((allowed: string) => {
    if (allowed.includes('*')) {
      // Simple wildcard support
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(clientIP);
    }
    return allowed === clientIP;
  });
}

/**
 * Get hierarchical permissions for a super admin
 */
export async function getSuperAdminPermissions(userId: string): Promise<any> {
  try {
    const superAdmin = await prisma.superAdminUser.findUnique({
      where: { userId },
      include: { role: true }
    });

    if (!superAdmin) {
      return null;
    }

    return {
      level: superAdmin.role.level,
      permissions: superAdmin.role.permissions,
      restrictions: superAdmin.role.restrictions,
      scope: getPermissionScope(superAdmin.role.level)
    };
  } catch (error) {
    console.error('Error getting super admin permissions:', error);
    return null;
  }
}

/**
 * Get permission scope based on role level
 */
function getPermissionScope(level: number): string[] {
  switch (level) {
    case 1: // Super Admin
      return ['global', 'all_tenants', 'all_users', 'system_config'];
    case 2: // Senior Admin
      return ['multi_tenant', 'system_monitoring', 'user_management'];
    case 3: // Admin
      return ['single_tenant', 'basic_monitoring'];
    default:
      return [];
  }
}

/**
 * Create audit log entry for access decision
 */
export async function logAccessDecision(
  context: PermissionContext,
  decision: { allowed: boolean; reason?: string },
  superAdminId: string
): Promise<void> {
  try {
    await prisma.superAdminAuditLog.create({
      data: {
        superAdminId,
        action: 'access_check',
        entityType: 'permission',
        metadata: {
          context,
          decision
        },
        ipAddress: context.environment?.ipAddress || 'unknown',
        userAgent: context.environment?.userAgent || 'unknown',
        sessionId: context.environment?.sessionId || 'unknown'
      }
    });
  } catch (error) {
    console.error('Error logging access decision:', error);
  }
}

// MFA verification for super admins
async function verifySuperAdminMFA(superAdminId: string, context: AccessContext): Promise<boolean> {
  try {
    // Check if MFA was verified in this session within the grace period
    const recentMFA = await prisma.superAdminAuditLog.findFirst({
      where: {
        superAdminId,
        action: 'mfa_verify',
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes grace period
        },
        metadata: {
          path: 'session_verified',
          sessionId: context.environment?.sessionId
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentMFA) {
      return true;
    }

    // Check MFA configuration
    const mfaConfig = await prisma.superAdminMFAConfig.findUnique({
      where: { superAdminId }
    });

    if (!mfaConfig || !mfaConfig.enabled) {
      return false; // MFA required but not configured
    }

    // Check if MFA was verified recently in any session (backup check)
    const anyRecentMFA = await prisma.superAdminAuditLog.findFirst({
      where: {
        superAdminId,
        action: 'mfa_verify',
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return !!anyRecentMFA;
  } catch (error) {
    console.error('MFA verification error:', error);
    return false; // Fail closed for security
  }
}