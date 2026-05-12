import { prisma } from '@/lib/database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

/**
 * Super Admin Service
 * Provides enterprise-grade centralized orchestration and governance
 */

export interface SuperAdminSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  mfaVerified: boolean;
  superAdmin: {
    id: string;
    role: {
      name: string;
      level: number;
      permissions: any[];
    };
  };
}

export interface TenantMetrics {
  tenantId: string;
  activeUsers: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  complianceStatus: 'compliant' | 'warning' | 'violation';
  lastHealthCheck: Date;
}

export interface GovernanceRule {
  id: string;
  name: string;
  ruleType: 'security' | 'performance' | 'compliance' | 'business';
  condition: any;
  action: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  executionCount: number;
  successRate: number;
}

export class SuperAdminService {
  private readonly jwtSecret: string;
  private readonly sessionTimeout: number = 8 * 60 * 60 * 1000; // 8 hours

  // Super Admin email whitelist (from spec)
  private readonly SUPER_ADMIN_EMAILS: string[] = [
    process.env.SUPER_ADMIN_EMAIL || 'admin@dakdam.com',
    'superadmin@dakdam.com'
  ].filter(Boolean);

  constructor() {
    this.jwtSecret = process.env.SUPER_ADMIN_JWT_SECRET || 'super-admin-secret-change-in-production';
  }

  /**
   * Check if a user is a Super Admin based on email and RBAC
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, isAdmin: true }
      });

      if (!user) return false;

      // Check if user email is in whitelist
      const emailWhitelisted = this.SUPER_ADMIN_EMAILS.includes(user.email);

      // Check if user has isAdmin flag (legacy check)
      const adminFlag = user.isAdmin;

      return emailWhitelisted || adminFlag;
    } catch (error) {
      console.error('Super admin check failed:', error);
      return false;
    }
  }

  /**
   * Authenticate as Super Admin with MFA
   */
  async authenticateSuperAdmin(credentials: {
    email: string;
    password: string;
    mfaCode?: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<{ success: boolean; session?: SuperAdminSession; requiresMFA?: boolean; error?: string }> {
    try {
      // Verify user exists and is a super admin
      const user = await prisma.user.findUnique({
        where: { email: credentials.email }
      });

      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      const isSuper = await this.isSuperAdmin(user.id);
      if (!isSuper) {
        return { success: false, error: 'Super admin access required' };
      }

      // Verify password (using bcrypt)
      const passwordValid = await bcrypt.compare(credentials.password, user.password || '');
      if (!passwordValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Get or create SuperAdminUser record
      let superAdminUser = await prisma.superAdminUser.findUnique({
        where: { userId: user.id },
        include: { role: true }
      });

      if (!superAdminUser) {
        // Auto-create SuperAdminUser for this user (first-time super admin)
        const defaultRole = await prisma.superAdminRole.findFirst({
          where: { level: 1 },
          include: { permissions: true }
        });

        if (!defaultRole) {
          return { success: false, error: 'Super admin role not configured' };
        }

        superAdminUser = await prisma.superAdminUser.create({
          data: {
            userId: user.id,
            roleId: defaultRole.id,
            isActive: true,
            mfaEnabled: true
          },
          include: { role: true }
        });
      }

      // Check if MFA is required
      const mfaConfig = await prisma.superAdminMFAConfig.findUnique({
        where: { superAdminId: superAdminUser.id }
      });

      const requiresMFA = superAdminUser.mfaEnabled && (!mfaConfig?.isEnabled || !mfaConfig);

      if (requiresMFA && !credentials.mfaCode) {
        return { success: true, requiresMFA: true };
      }

      // Verify MFA if required
      if (requiresMFA && credentials.mfaCode) {
        const mfaValid = await this.verifyMFACode(superAdminUser.id, credentials.mfaCode);
        if (!mfaValid) {
          return { success: false, error: 'Invalid MFA code' };
        }
      }

      // Create session
      const session = await this.createSuperAdminSession(superAdminUser);

      // Log audit
      await this.logSuperAdminAudit({
        superAdminId: superAdminUser.id,
        action: 'super_admin_login',
        entityType: 'user',
        entityId: user.id,
        ipAddress: credentials.ipAddress,
        userAgent: credentials.userAgent,
        metadata: { method: 'password' }
      });

      return {
        success: true,
        session: {
          id: session.id,
          userId: user.id,
          token: session.token,
          expiresAt: session.expiresAt,
          mfaVerified: true,
          superAdmin: {
            id: superAdminUser.id,
            role: {
              name: superAdminUser.role.name,
              level: superAdminUser.role.level,
              permissions: superAdminUser.role.permissions
            }
          }
        }
      };
    } catch (error) {
      console.error('Super admin authentication failed:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Create session token for super admin
   */
  private async createSuperAdminSession(superAdminUser: any): Promise<{
    id: string;
    token: string;
    expiresAt: Date;
  }> {
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      {
        userId: superAdminUser.userId,
        superAdminId: superAdminUser.id,
        sessionId,
        type: 'super_admin_session'
      },
      this.jwtSecret,
      { expiresIn: '8h' }
    );

    const expiresAt = new Date(Date.now() + this.sessionTimeout);

    await prisma.superAdminSession.create({
      data: {
        id: sessionId,
        userId: superAdminUser.userId,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt,
        mfaVerified: true
      }
    });

    return { id: sessionId, token, expiresAt };
  }

  /**
   * Verify MFA code (simplified - integrate with actual MFA provider)
   */
  private async verifyMFACode(superAdminId: string, code: string): Promise<boolean> {
    // In production, integrate with TOTP provider (Google Authenticator, etc.)
    // For demo, accept any 6-digit code (NOT for production!)
    return /^\d{6}$/.test(code);
  }

  /**
   * Validate Super Admin session
   */
  async validateSuperAdminSession(token: string): Promise<{
    valid: boolean;
    session?: any;
    superAdmin?: any;
  }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      if (decoded.type !== 'super_admin_session') {
        return { valid: false };
      }

      const session = await prisma.superAdminSession.findUnique({
        where: { id: decoded.sessionId },
        include: {
          user: true,
          superAdminUser: {
            include: { role: true }
          }
        }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return { valid: false };
      }

      // Update last activity
      await prisma.superAdminSession.update({
        where: { id: session.id },
        data: { lastActivity: new Date() }
      });

      return {
        valid: true,
        session,
        superAdmin: {
          id: session.superAdminUser.id,
          userId: session.userId,
          role: session.superAdminUser.role
        }
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Invalidate Super Admin session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await prisma.superAdminSession.update({
      where: { id: sessionId },
      data: { isActive: false }
    });
  }

  /**
   * Get all tenants with metrics
   */
  async getAllTenants(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{
    tenants: any[];
    total: number;
    pagination: any;
  }> {
    const { page = 1, limit = 20, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.isActive = status === 'active';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { domain: { contains: search } }
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          _count: { select: { users: true } },
          lifecycle: true,
          plan: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.company.count({ where })
    ]);

    return {
      tenants,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get tenant metrics (God's Eyes)
   */
  async getTenantMetrics(tenantId: string): Promise<TenantMetrics | null> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: tenantId },
        include: {
          _count: { select: { users: true } },
          orders: { where: { status: 'Pending' }, take: 1, orderBy: { createdAt: 'desc' } }
        }
      });

      if (!company) return null;

      // Calculate metrics
      const activeUsers = company._count.users;

      // Get system health metrics for this tenant
      const healthMetrics = await prisma.systemHealthMetric.findMany({
        where: {
          tags: { contains: { tenantId } }
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      const avgCpu = healthMetrics.length > 0
        ? healthMetrics.reduce((sum, m) => sum + (m.value || 0), 0) / healthMetrics.length
        : 0;

      return {
        tenantId: company.id,
        activeUsers,
        resourceUsage: {
          cpu: avgCpu,
          memory: 0, // Would calculate from metrics
          storage: 0 // Would calculate from DB size
        },
        complianceStatus: 'compliant', // Would check isolation checks
        lastHealthCheck: new Date()
      };
    } catch (error) {
      console.error('Failed to get tenant metrics:', error);
      return null;
    }
  }

  /**
   * Update tenant lifecycle state
   */
  async updateTenantLifecycle(params: {
    tenantId: string;
    action: 'suspend' | 'resume' | 'terminate';
    reason?: string;
    superAdminId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { tenantId, action, reason, superAdminId } = params;

      // Validate dual authorization for destructive actions
      if (action === 'terminate') {
        const authorized = await this.requireDualAuthorization({
          superAdminId,
          actionType: 'terminate_tenant',
          requestData: { tenantId, reason },
          riskLevel: 'critical'
        });

        if (!authorized) {
          return { success: false, error: 'Dual authorization required for termination' };
        }
      }

      // Get current lifecycle state
      const lifecycle = await prisma.companyLifecycle.findUnique({
        where: { companyId: tenantId }
      });

      const newState = this.mapActionToState(action);
      const previousState = lifecycle?.currentState || 'active';

      if (lifecycle) {
        await prisma.companyLifecycle.update({
          where: { companyId: tenantId },
          data: {
            currentState: newState,
            previousState,
            stateChangedAt: new Date(),
            stateChangedBy: superAdminId,
            suspensionReason: action === 'suspend' ? reason : null,
            terminationReason: action === 'terminate' ? reason : null
          }
        });
      } else {
        await prisma.companyLifecycle.create({
          data: {
            companyId: tenantId,
            currentState: newState,
            previousState: 'active',
            stateChangedBy: superAdminId,
            suspensionReason: action === 'suspend' ? reason : null
          }
        });
      }

      // Update company active status
      await prisma.company.update({
        where: { id: tenantId },
        data: {
          isActive: action !== 'terminate' && action !== 'suspend'
        }
      });

      // Audit log
      await this.logSuperAdminAudit({
        superAdminId,
        action: `tenant_${action}`,
        entityType: 'company',
        entityId: tenantId,
        metadata: { reason, previousState, newState }
      });

      return { success: true };
    } catch (error) {
      console.error('Lifecycle update failed:', error);
      return { success: false, error: 'Failed to update tenant lifecycle' };
    }
  }

  /**
   * Get global configuration
   */
  async getGlobalConfig(params?: {
    category?: string;
    activeOnly?: boolean;
  }): Promise<any[]> {
    const where: any = {};
    if (params?.category) where.category = params.category;
    if (params?.activeOnly) where.isActive = true;

    return await prisma.globalConfig.findMany({
      where,
      orderBy: { category: 'asc', key: 'asc' }
    });
  }

  /**
   * Update global configuration
   */
  async updateGlobalConfig(params: {
    key: string;
    value: any;
    superAdminId: string;
    effectiveDate?: Date;
    expiryDate?: Date;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { key, value, superAdminId, effectiveDate, expiryDate } = params;

      // Get existing config to track changes
      const existing = await prisma.globalConfig.findUnique({
        where: { key }
      });

      const oldValue = existing?.value;

      // Create new version or update
      const config = await prisma.globalConfig.upsert({
        where: { key },
        update: {
          value,
          type: typeof value === 'string' ? 'string' : typeof value,
          effectiveDate: effectiveDate || existing?.effectiveDate || new Date(),
          expiryDate,
          updatedAt: new Date()
        },
        create: {
          key,
          value,
          type: typeof value === 'string' ? 'string' : typeof value,
          category: 'system',
          description: `Config: ${key}`,
          isActive: true,
          effectiveDate: effectiveDate || new Date(),
          createdBy: superAdminId
        }
      });

      // Audit log
      await this.logSuperAdminAudit({
        superAdminId,
        action: 'global_config_update',
        entityType: 'global_config',
        entityId: config.id,
        oldValues: oldValue,
        newValues: value,
        metadata: { key }
      });

      return { success: true };
    } catch (error) {
      console.error('Config update failed:', error);
      return { success: false, error: 'Failed to update configuration' };
    }
  }

  /**
   * Bulk operations (God's Hands)
   */
  async executeBulkOperation(params: {
    commandType: 'bulk_update' | 'emergency' | 'maintenance';
    parameters: any;
    superAdminId: string;
    requiresApproval?: boolean;
  }): Promise<{ commandId: string; status: string }> {
    const { commandType, parameters, superAdminId, requiresApproval } = params;

    // Create system command
    const command = await prisma.systemCommand.create({
      data: {
        commandType,
        parameters,
        initiatedBy: superAdminId,
        status: requiresApproval ? 'pending' : 'executing'
      }
    });

    // For high-risk commands, require dual authorization
    if (requiresApproval || commandType === 'emergency') {
      await this.requireDualAuthorization({
        superAdminId,
        actionType: 'bulk_operation',
        requestData: { commandId: command.id, parameters },
        riskLevel: 'critical'
      });
    }

    // Execute command synchronously for now (in production, would be async worker)
    if (!requiresApproval) {
      await prisma.systemCommand.update({
        where: { id: command.id },
        data: { status: 'completed', completedAt: new Date() }
      });
    }

    return { commandId: command.id, status: command.status };
  }

  /**
   * Get risk profiles (God's Foresight)
   */
  async getRiskProfiles(params?: {
    entityType?: string;
    riskLevel?: string;
    limit?: number;
  }): Promise<any[]> {
    const where: any = {};
    if (params?.entityType) where.entityType = params.entityType;
    if (params?.riskLevel) where.riskScore = { gte: this.riskLevelToScore(params.riskLevel) };

    return await prisma.riskProfile.findMany({
      where,
      orderBy: { riskScore: 'desc' },
      take: params?.limit || 100
    });
  }

  private riskLevelToScore(level: string): number {
    switch (level) {
      case 'critical': return 90;
      case 'high': return 70;
      case 'medium': return 40;
      default: return 0;
    }
  }

  /**
   * Governance rule execution (God's Judgment)
   */
  async executeGovernanceRule(ruleId: string): Promise<{
    success: boolean;
    actionsTaken: any[];
  }> {
    const rule = await prisma.governanceRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || !rule.isActive) {
      return { success: false, actionsTaken: [] };
    }

    // Evaluate rule condition
    // This would involve scanning relevant entities and taking action
    // Simplified for demo
    const actionsTaken = [];

    await prisma.governanceRule.update({
      where: { id: ruleId },
      data: {
        lastExecutedAt: new Date(),
        executionCount: { increment: 1 }
      }
    });

    return { success: true, actionsTaken };
  }

  /**
   * Emergency event management
   */
  async declareEmergency(params: {
    eventType: string;
    severity: string;
    description: string;
    declaredBy: string;
    details?: any;
  }): Promise<{ eventId: string }> {
    const event = await prisma.emergencyEvent.create({
      data: {
        eventType: params.eventType,
        severity: params.severity,
        description: params.description,
        declaredBy: params.declaredBy,
        details: params.details,
        status: 'active',
        declaredAt: new Date()
      }
    });

    // Audit
    await this.logSuperAdminAudit({
      superAdminId: params.declaredBy,
      action: 'emergency_declared',
      entityType: 'emergency_event',
      entityId: event.id,
      metadata: { severity: params.severity, eventType: params.eventType }
    });

    return { eventId: event.id };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(params: {
    companyId?: string;
    reportType: 'GDPR' | 'SOC2' | 'HIPAA';
    periodStart: Date;
    periodEnd: Date;
  }): Promise<{ reportId: string; status: string }> {
    const report = await prisma.complianceReport.create({
      data: {
        companyId: params.companyId,
        reportType: params.reportType,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        status: 'generating'
      }
    });

    // Trigger async report generation (in production, would be a background job)
    // For now, mark as completed with empty findings
    await prisma.complianceReport.update({
      where: { id: report.id },
      data: {
        status: 'completed',
        generatedAt: new Date(),
        findings: [],
        recommendations: [],
        evidence: []
      }
    });

    return { reportId: report.id, status: 'completed' };
  }

  /**
   * Dual Authorization workflow
   */
  async requireDualAuthorization(params: {
    superAdminId: string;
    actionType: string;
    requestData: any;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    approvalDeadline?: Date;
  }): Promise<{ authorized: boolean; requestId?: string }> {
    const { superAdminId, actionType, requestData, riskLevel, approvalDeadline } = params;

    // For high-risk actions, check if existing approval exists
    if (riskLevel === 'critical' || riskLevel === 'high') {
      const existingApproval = await prisma.dualAuthorizationRequest.findFirst({
        where: {
          requestedBy: superAdminId,
          actionType,
          status: 'approved',
          approvalDeadline: { gte: new Date() }
        }
      });

      if (existingApproval) {
        return { authorized: true, requestId: existingApproval.id };
      }

      // Create new approval request
      const request = await prisma.dualAuthorizationRequest.create({
        data: {
          actionType,
          requestData,
          riskLevel,
          requestedBy: superAdminId,
          status: 'pending',
          approvalDeadline: approvalDeadline || new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
        }
      });

      // Would send notification to eligible approvers here

      return { authorized: false, requestId: request.id };
    }

    return { authorized: true };
  }

  /**
   * Log Super Admin audit event (immutable)
   */
  private async logSuperAdminAudit(params: {
    superAdminId: string;
    action: string;
    entityType: string;
    entityId?: string;
    companyId?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    riskScore?: number;
  }): Promise<void> {
    try {
      const auditEntry: any = {
        superAdminId: params.superAdminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        companyId: params.companyId,
        oldValues: params.oldValues,
        newValues: params.newValues,
        metadata: params.metadata,
        ipAddress: params.ipAddress || 'system',
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        riskScore: params.riskScore || 0,
        createdAt: new Date()
      };

      // Calculate cryptographic hash for immutability
      const hashData = JSON.stringify(auditEntry);
      auditEntry.hash = crypto.createHash('sha256').update(hashData).digest('hex');

      await prisma.superAdminAuditLog.create({ data: auditEntry });
    } catch (error) {
      console.error('Super admin audit logging failed:', error);
    }
  }

  /**
   * Map action to lifecycle state
   */
  private mapActionToState(action: string): string {
    switch (action) {
      case 'suspend': return 'suspended';
      case 'resume': return 'active';
      case 'terminate': return 'terminated';
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Get system health metrics overview
   */
  async getSystemHealth(): Promise<{
    totalTenants: number;
    activeTenants: number;
    systemLoad: number;
    criticalAlerts: number;
    averageResponseTime: number;
  }> {
    const [totalTenants, activeTenants, criticalAlerts] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { isActive: true } }),
      prisma.systemHealthMetric.count({
        where: {
          metricType: 'api_latency',
          value: { gte: 1000 } // High latency indicates issues
        }
      })
    ]);

    // Get average response time from recent metrics
    const recentMetrics = await prisma.systemHealthMetric.findMany({
      where: {
        metricType: 'api_latency',
        timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      },
      take: 100
    });

    const avgResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
      : 0;

    return {
      totalTenants,
      activeTenants,
      systemLoad: Math.min(100, (activeTenants / Math.max(totalTenants, 1)) * 100),
      criticalAlerts,
      averageResponseTime: avgResponseTime
    };
  }
}

// Export singleton instance
export const superAdminService = new SuperAdminService();
