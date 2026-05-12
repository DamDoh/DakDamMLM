import { prisma } from '@/lib/database';
import crypto from 'crypto';

/**
 * RBAC Audit Logging System
 * Provides immutable audit trails with cryptographic integrity
 */

export interface AuditEvent {
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent?: string;
  sessionId?: string;
  workspaceId?: string;
  justification?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failure' | 'denied';
  errorMessage?: string;
  metadata?: any;
  tags?: string[];
}

export class RBACAuditLogger {
  private static instance: RBACAuditLogger;
  private lastHash: string = '';

  private constructor() {
    // Initialize with genesis hash
    this.lastHash = crypto.createHash('sha256').update('RBAC_AUDIT_CHAIN_GENESIS').digest('hex');
  }

  static getInstance(): RBACAuditLogger {
    if (!RBACAuditLogger.instance) {
      RBACAuditLogger.instance = new RBACAuditLogger();
    }
    return RBACAuditLogger.instance;
  }

  /**
   * Log an audit event with cryptographic integrity
   */
  async logEvent(event: AuditEvent): Promise<string> {
    try {
      // Prepare audit data
      const auditData = {
        ...event,
        timestamp: new Date(),
        chainHash: '', // Will be calculated
        previousHash: this.lastHash
      };

      // Calculate cryptographic hash for this entry
      const hashData = JSON.stringify({
        ...auditData,
        chainHash: undefined // Exclude from hash calculation
      });
      auditData.chainHash = crypto.createHash('sha256').update(hashData).digest('hex');

      // Update chain
      this.lastHash = auditData.chainHash;

      // Store in database
      const auditEntry = await prisma.rBACAuditLog.create({
        data: {
          userId: event.userId,
          userRole: event.userRole,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          oldValues: event.oldValues,
          newValues: event.newValues,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          sessionId: event.sessionId,
          workspaceId: event.workspaceId,
          justification: event.justification,
          riskLevel: event.riskLevel,
          status: event.status,
          errorMessage: event.errorMessage,
          metadata: {
            ...event.metadata,
            tags: event.tags,
            chainPosition: await this.getChainPosition()
          },
          hash: auditData.chainHash
        }
      });

      // Trigger real-time alerts for high-risk events
      if (event.riskLevel === 'critical' || event.riskLevel === 'high') {
        await this.triggerSecurityAlert(auditEntry);
      }

      // Check for suspicious patterns
      await this.detectAnomalies(auditEntry);

      return auditEntry.id;

    } catch (error) {
      console.error('Audit logging failed:', error);
      // In production, this should trigger a critical alert
      throw new Error('Audit logging failure - potential security breach');
    }
  }

  /**
   * Verify audit chain integrity
   */
  async verifyChainIntegrity(): Promise<{
    valid: boolean;
    issues: Array<{
      entryId: string;
      issue: string;
      expectedHash: string;
      actualHash: string;
    }>;
  }> {
    const issues: any[] = [];

    try {
      const entries = await prisma.rBACAuditLog.findMany({
        orderBy: { timestamp: 'asc' }
      });

      let previousHash = crypto.createHash('sha256').update('RBAC_AUDIT_CHAIN_GENESIS').digest('hex');

      for (const entry of entries) {
        // Recalculate hash
        const hashData = JSON.stringify({
          userId: entry.userId,
          userRole: entry.userRole,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          oldValues: entry.oldValues,
          newValues: entry.newValues,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          sessionId: entry.sessionId,
          workspaceId: entry.workspaceId,
          justification: entry.justification,
          riskLevel: entry.riskLevel,
          status: entry.status,
          errorMessage: entry.errorMessage,
          metadata: entry.metadata,
          timestamp: entry.timestamp,
          previousHash
        });

        const expectedHash = crypto.createHash('sha256').update(hashData).digest('hex');

        if (expectedHash !== entry.hash) {
          issues.push({
            entryId: entry.id,
            issue: 'Hash mismatch - audit entry may have been tampered with',
            expectedHash,
            actualHash: entry.hash
          });
        }

        previousHash = entry.hash;
      }

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      console.error('Chain verification failed:', error);
      return {
        valid: false,
        issues: [{
          entryId: 'system',
          issue: 'Chain verification failed: ' + error.message,
          expectedHash: '',
          actualHash: ''
        }]
      };
    }
  }

  /**
   * Query audit logs with advanced filtering
   */
  async queryLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    riskLevel?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    workspaceId?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: any[];
    total: number;
    integrity: {
      verified: boolean;
      lastCheck: Date;
    };
  }> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters.status) where.status = filters.status;
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;
    if (filters.workspaceId) where.workspaceId = filters.workspaceId;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    if (filters.tags) {
      where.metadata = {
        path: ['tags'],
        array_contains: filters.tags
      };
    }

    const [logs, total] = await Promise.all([
      prisma.rBACAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0
      }),
      prisma.rBACAuditLog.count({ where })
    ]);

    // Perform integrity check
    const integrity = await this.performIntegrityCheck(logs);

    return {
      logs,
      total,
      integrity
    };
  }

  /**
   * Generate compliance reports
   */
  async generateComplianceReport(filters: {
    startDate: Date;
    endDate: Date;
    frameworks: string[]; // GDPR, SOC2, HIPAA, etc.
  }): Promise<any> {
    const logs = await this.queryLogs({
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    const report = {
      period: {
        start: filters.startDate,
        end: filters.endDate
      },
      summary: {
        totalEvents: logs.total,
        criticalEvents: logs.logs.filter(l => l.riskLevel === 'critical').length,
        failedOperations: logs.logs.filter(l => l.status === 'failure').length,
        uniqueUsers: new Set(logs.logs.map(l => l.userId)).size
      },
      compliance: {},
      integrity: logs.integrity
    };

    // Generate framework-specific compliance data
    for (const framework of filters.frameworks) {
      report.compliance[framework] = await this.generateFrameworkCompliance(logs.logs, framework);
    }

    return report;
  }

  /**
   * Real-time security monitoring
   */
  async monitorSecurityEvents(): Promise<{
    alerts: Array<{
      type: string;
      severity: string;
      description: string;
      events: any[];
      recommendedActions: string[];
    }>;
    metrics: {
      eventsPerMinute: number;
      failureRate: number;
      suspiciousActivity: number;
    };
  }> {
    const recentLogs = await prisma.rBACAuditLog.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    const alerts: any[] = [];
    let suspiciousActivity = 0;

    // Check for brute force attempts
    const failedLogins = recentLogs.filter(l =>
      l.action === 'login_failed' && l.status === 'failure'
    );

    if (failedLogins.length > 10) {
      alerts.push({
        type: 'brute_force',
        severity: 'high',
        description: `${failedLogins.length} failed login attempts in last 5 minutes`,
        events: failedLogins.slice(0, 5),
        recommendedActions: [
          'Implement rate limiting',
          'Alert security team',
          'Check affected accounts'
        ]
      });
      suspiciousActivity += failedLogins.length;
    }

    // Check for privilege escalation attempts
    const privilegeChanges = recentLogs.filter(l =>
      l.action.includes('permission') && l.riskLevel === 'high'
    );

    if (privilegeChanges.length > 0) {
      alerts.push({
        type: 'privilege_escalation',
        severity: 'critical',
        description: `${privilegeChanges.length} high-risk permission changes`,
        events: privilegeChanges,
        recommendedActions: [
          'Review permission changes',
          'Audit user access',
          'Implement additional approval requirements'
        ]
      });
      suspiciousActivity += privilegeChanges.length * 2;
    }

    // Check for unusual geographic activity
    const geographicAnomalies = await this.detectGeographicAnomalies(recentLogs);
    if (geographicAnomalies.length > 0) {
      alerts.push({
        type: 'geographic_anomaly',
        severity: 'medium',
        description: `${geographicAnomalies.length} unusual geographic access patterns`,
        events: geographicAnomalies,
        recommendedActions: [
          'Verify user locations',
          'Check for account compromise',
          'Implement geographic restrictions'
        ]
      });
      suspiciousActivity += geographicAnomalies.length;
    }

    const totalEvents = recentLogs.length;
    const failedEvents = recentLogs.filter(l => l.status === 'failure').length;

    return {
      alerts,
      metrics: {
        eventsPerMinute: totalEvents / 5,
        failureRate: failedEvents / Math.max(totalEvents, 1),
        suspiciousActivity
      }
    };
  }

  // Private helper methods

  private async getChainPosition(): Promise<number> {
    const count = await prisma.rBACAuditLog.count();
    return count + 1;
  }

  private async triggerSecurityAlert(auditEntry: any): Promise<void> {
    // In production, this would send alerts to security team
    // via email, Slack, PagerDuty, etc.
    console.log('🚨 SECURITY ALERT:', {
      type: 'high_risk_audit_event',
      entry: auditEntry,
      timestamp: new Date()
    });
  }

  private async detectAnomalies(auditEntry: any): Promise<void> {
    // Implement anomaly detection logic
    // This could use machine learning models to detect unusual patterns
  }

  private async performIntegrityCheck(logs: any[]): Promise<{
    verified: boolean;
    lastCheck: Date;
  }> {
    // Simplified integrity check for recent logs
    const check = await this.verifyChainIntegrity();
    return {
      verified: check.valid,
      lastCheck: new Date()
    };
  }

  private async generateFrameworkCompliance(logs: any[], framework: string): Promise<any> {
    // Generate compliance data based on framework requirements
    switch (framework) {
      case 'GDPR':
        return {
          dataAccess: logs.filter(l => l.resource.includes('user_data')).length,
          consentRecords: logs.filter(l => l.action.includes('consent')).length,
          dataDeletion: logs.filter(l => l.action === 'delete' && l.resource.includes('user')).length,
          breachNotifications: logs.filter(l => l.action.includes('breach')).length
        };

      case 'SOC2':
        return {
          accessControls: logs.filter(l => l.resource.includes('permission')).length,
          changeManagement: logs.filter(l => l.action.includes('update')).length,
          incidentResponse: logs.filter(l => l.riskLevel === 'critical').length,
          monitoring: logs.filter(l => l.action.includes('monitor')).length
        };

      default:
        return {
          totalEvents: logs.length,
          riskDistribution: {
            low: logs.filter(l => l.riskLevel === 'low').length,
            medium: logs.filter(l => l.riskLevel === 'medium').length,
            high: logs.filter(l => l.riskLevel === 'high').length,
            critical: logs.filter(l => l.riskLevel === 'critical').length
          }
        };
    }
  }

  private async detectGeographicAnomalies(logs: any[]): Promise<any[]> {
    // Simplified geographic anomaly detection
    // In production, this would use IP geolocation and user behavior analysis
    return logs.filter(log =>
      log.metadata?.geographicAnomaly === true
    );
  }
}

// Export singleton instance
export const rbacAuditLogger = RBACAuditLogger.getInstance();