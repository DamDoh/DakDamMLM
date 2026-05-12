/**
 * MEDIUM PRIORITY FIX #14: Enhanced Audit Trail Service
 * 
 * Comprehensive audit logging for all sensitive operations.
 * Ensures accountability and helps with debugging.
 */

import { prisma } from '@/lib/prisma';

export type AuditAction = 
  // User actions
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_restored'
  | 'user_login'
  | 'user_logout'
  | 'password_changed'
  | 'password_reset_requested'
  | 'email_changed'
  | 'phone_changed'
  
  // Financial actions
  | 'commission_calculated'
  | 'commission_paid'
  | 'commission_adjusted'
  | 'commission_capped'
  | 'wallet_credited'
  | 'wallet_debited'
  | 'wallet_transfer'
  | 'wallet_withdrawal'
  | 'balance_correction'
  
  // Rank actions
  | 'rank_promoted'
  | 'rank_demoted'
  | 'rank_manually_adjusted'
  
  // Genealogy actions
  | 'placement_assigned'
  | 'placement_changed'
  | 'sponsor_changed'
  | 'genealogy_integrity_fixed'
  
  // Order actions
  | 'order_created'
  | 'order_updated'
  | 'order_cancelled'
  | 'order_refunded'
  
  // Security actions
  | 'rate_limit_exceeded'
  | 'suspicious_activity_detected'
  | 'access_denied'
  | 'permission_granted'
  | 'permission_revoked'
  
  // System actions
  | 'system_maintenance'
  | 'database_backup'
  | 'database_restore'
  | 'configuration_changed';

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  changes: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
}

export interface AuditQuery {
  userId?: string;
  action?: AuditAction;
  entity?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
}

export class EnhancedAuditService {
  /**
   * Log an audit event
   */
  static async log(
    entry: AuditLogEntry
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          changes: {
            ...entry.changes,
            previousState: entry.previousState,
            newState: entry.newState,
            metadata: entry.metadata,
            timestamp: new Date()
          },
          ipAddress: entry.ipAddress || 'unknown',
          userAgent: entry.userAgent || 'unknown'
        }
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }

  /**
   * Log user action with full context
   */
  static async logUserAction(
    userId: string,
    action: AuditAction,
    details: {
      entity: string;
      entityId?: string;
      changes?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.log({
      userId,
      action,
      entity: details.entity,
      entityId: details.entityId,
      changes: details.changes || {},
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown'
    });
  }

  /**
   * Log financial transaction with before/after states
   */
  static async logFinancialTransaction(
    userId: string,
    action: AuditAction,
    previousBalance: number,
    newBalance: number,
    amount: number,
    transactionId: string,
    details: {
      type: string;
      description?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.log({
      userId,
      action,
      entity: 'wallet_transaction',
      entityId: transactionId,
      changes: {
        amount,
        type: details.type,
        description: details.description
      },
      previousState: { balance: previousBalance },
      newState: { balance: newBalance },
      metadata: details.metadata,
      ipAddress: details.ipAddress || 'system',
      userAgent: details.userAgent || 'financial-service'
    });
  }

  /**
   * Log rank change with full details
   */
  static async logRankChange(
    userId: string,
    oldRank: string,
    newRank: string,
    reason: string,
    metrics?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action: newRank > oldRank ? 'rank_promoted' : 'rank_demoted',
      entity: 'user',
      changes: {
        reason,
        metrics
      },
      previousState: { rank: oldRank },
      newState: { rank: newRank },
      ipAddress: 'system',
      userAgent: 'rank-maintenance-service'
    });
  }

  /**
   * Log commission adjustment (manual)
   */
  static async logCommissionAdjustment(
    userId: string,
    commissionId: string,
    oldAmount: number,
    newAmount: number,
    reason: string,
    adjustedBy: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'commission_adjusted',
      entity: 'commission',
      entityId: commissionId,
      changes: {
        reason,
        adjustedBy,
        difference: newAmount - oldAmount
      },
      previousState: { amount: oldAmount },
      newState: { amount: newAmount },
      ipAddress: 'admin',
      userAgent: 'admin-panel'
    });
  }

  /**
   * Query audit logs with filters
   */
  static async queryLogs(
    query: AuditQuery
  ): Promise<Array<any>> {
    const where: any = {};

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    if (query.ipAddress) where.ipAddress = query.ipAddress;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = query.startDate;
      if (query.endDate) where.createdAt.lte = query.endDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100
    });

    return logs;
  }

  /**
   * Get user activity timeline
   */
  static async getUserActivityTimeline(
    userId: string,
    days: number = 30,
    limit: number = 100
  ): Promise<Array<any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.queryLogs({
      userId,
      startDate,
      limit
    });
  }

  /**
   * Get suspicious activity (rate limits, access denied, etc.)
   */
  static async getSuspiciousActivity(
    hours: number = 24,
    limit: number = 100
  ): Promise<Array<any>> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const logs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['rate_limit_exceeded', 'suspicious_activity_detected', 'access_denied']
        },
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return logs;
  }

  /**
   * Get financial audit trail for user
   */
  static async getUserFinancialAudit(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<any>> {
    const where: any = {
      userId,
      action: {
        in: [
          'commission_calculated',
          'commission_paid',
          'commission_adjusted',
          'wallet_credited',
          'wallet_debited',
          'wallet_transfer',
          'wallet_withdrawal',
          'balance_correction'
        ]
      }
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return logs;
  }

  /**
   * Get system actions log
   */
  static async getSystemActions(
    days: number = 7
  ): Promise<Array<any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['system_maintenance', 'database_backup', 'database_restore', 'configuration_changed']
        },
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' }
    });

    return logs;
  }

  /**
   * Export audit logs to CSV
   */
  static async exportToCSV(
    query: AuditQuery
  ): Promise<string> {
    const logs = await this.queryLogs(query);

    const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Details', 'IP Address'];
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.user ? `${log.user.memberId} (${log.user.email})` : 'System',
      log.action,
      log.entity,
      JSON.stringify(log.changes),
      log.ipAddress
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csv;
  }

  /**
   * Get audit statistics
   */
  static async getStatistics(
    days: number = 30,
    companyId?: string
  ): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    uniqueUsers: number;
    suspiciousEvents: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      createdAt: { gte: startDate }
    };

    if (companyId) {
      where.user = { companyId };
    }

    const [totalEvents, eventsByAction, uniqueUsers, suspiciousEvents] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true }
      }),
      prisma.auditLog.findMany({
        where,
        select: { userId: true },
        distinct: ['userId']
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          action: {
            in: ['rate_limit_exceeded', 'suspicious_activity_detected', 'access_denied']
          }
        }
      })
    ]);

    const eventsByActionMap: Record<string, number> = {};
    for (const item of eventsByAction) {
      eventsByActionMap[item.action] = item._count.action;
    }

    return {
      totalEvents,
      eventsByAction: eventsByActionMap,
      uniqueUsers: uniqueUsers.length,
      suspiciousEvents
    };
  }

  /**
   * Clean up old audit logs
   * Keep logs based on retention policy
   */
  static async cleanupOldLogs(
    retentionDays: number = 2555 // 7 years default
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    console.log(`Cleaned up ${result.count} old audit logs (older than ${retentionDays} days)`);
    return result.count;
  }
}
