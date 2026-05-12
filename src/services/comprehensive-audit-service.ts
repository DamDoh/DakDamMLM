// Comprehensive Audit Logging Service
// Tracks all branding, domain, and security operations for compliance

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  companyId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
  complianceFlags: string[];
}

export interface AuditQuery {
  userId?: string;
  companyId?: string;
  action?: string;
  resource?: string;
  dateFrom?: Date;
  dateTo?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByResource: Record<string, number>;
  complianceEvents: number;
  errorEvents: number;
  dateRange: {
    oldest: Date;
    newest: Date;
  };
}

class ComprehensiveAuditService {
  private static instance: ComprehensiveAuditService;
  private eventBuffer: AuditEvent[] = [];
  private bufferSize = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startPeriodicFlush();
  }

  static getInstance(): ComprehensiveAuditService {
    if (!ComprehensiveAuditService.instance) {
      ComprehensiveAuditService.instance = new ComprehensiveAuditService();
    }
    return ComprehensiveAuditService.instance;
  }

  // Log an audit event
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event,
    };

    // Add to buffer for batch processing
    this.eventBuffer.push(auditEvent);

    // Immediate logging for critical events
    if (this.isCriticalEvent(event)) {
      logger.info('Critical audit event', {
        eventId: auditEvent.id,
        action: event.action,
        resource: event.resource,
        success: event.success,
        companyId: event.companyId,
      });
    }

    // Flush buffer if it's full
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flushEvents();
    }

    // Check for compliance violations
    await this.checkComplianceViolations(auditEvent);
  }

  // Log branding operation
  async logBrandingOperation(
    userId: string,
    companyId: string,
    action: 'create' | 'update' | 'delete',
    resource: 'logo' | 'favicon' | 'theme' | 'config',
    resourceId?: string,
    changes?: Record<string, any>,
    request?: Request
  ): Promise<void> {
    const details: Record<string, any> = { changes };

    // Add compliance flags based on the operation
    const complianceFlags = this.determineComplianceFlags(action, resource, changes);

    await this.logEvent({
      userId,
      companyId,
      action: `branding.${action}`,
      resource: `branding.${resource}`,
      resourceId,
      details,
      ipAddress: this.extractIPAddress(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      sessionId: this.extractSessionId(request),
      success: true,
      complianceFlags,
    });
  }

  // Log domain operation
  async logDomainOperation(
    userId: string,
    companyId: string,
    action: 'map' | 'verify' | 'ssl_request' | 'ssl_renew',
    domain: string,
    details?: Record<string, any>,
    request?: Request
  ): Promise<void> {
    const complianceFlags = ['domain_management'];

    if (action === 'ssl_request' || action === 'ssl_renew') {
      complianceFlags.push('ssl_compliance', 'security');
    }

    await this.logEvent({
      userId,
      companyId,
      action: `domain.${action}`,
      resource: 'domain',
      resourceId: domain,
      details: { domain, ...details },
      ipAddress: this.extractIPAddress(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      sessionId: this.extractSessionId(request),
      success: true,
      complianceFlags,
    });
  }

  // Log security event
  async logSecurityEvent(
    eventType: 'rate_limit_exceeded' | 'suspicious_activity' | 'access_denied' | 'auth_failure',
    details: Record<string, any>,
    request?: Request
  ): Promise<void> {
    const complianceFlags = ['security'];

    if (eventType === 'rate_limit_exceeded') {
      complianceFlags.push('ddos_protection');
    }

    await this.logEvent({
      action: `security.${eventType}`,
      resource: 'security',
      details,
      ipAddress: this.extractIPAddress(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      sessionId: this.extractSessionId(request),
      success: false,
      errorMessage: details.error || eventType,
      complianceFlags,
    });
  }

  // Query audit events
  async queryEvents(query: AuditQuery): Promise<{
    events: AuditEvent[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Build where clause
      const where: any = {};

      if (query.userId) where.userId = query.userId;
      if (query.companyId) where.companyId = query.companyId;
      if (query.action) where.action = { contains: query.action };
      if (query.resource) where.resource = query.resource;
      if (query.success !== undefined) where.success = query.success;

      if (query.dateFrom || query.dateTo) {
        where.timestamp = {};
        if (query.dateFrom) where.timestamp.gte = query.dateFrom;
        if (query.dateTo) where.timestamp.lte = query.dateTo;
      }

      // Get total count
      const total = await prisma.auditEvent.count({ where });

      // Get events with pagination
      const events = await prisma.auditEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: (query.limit || 50) + 1, // +1 to check if there are more
        skip: query.offset || 0,
      });

      const hasMore = events.length > (query.limit || 50);
      const resultEvents = hasMore ? events.slice(0, -1) : events;

      return {
        events: resultEvents as AuditEvent[],
        total,
        hasMore,
      };
    } catch (error) {
      logger.error('Audit query failed:', error);
      return { events: [], total: 0, hasMore: false };
    }
  }

  // Get audit statistics
  async getAuditStats(
    companyId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<AuditStats> {
    try {
      const where: any = {};
      if (companyId) where.companyId = companyId;
      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = dateFrom;
        if (dateTo) where.timestamp.lte = dateTo;
      }

      // Get total events
      const totalEvents = await prisma.auditEvent.count({ where });

      // Get events by action
      const actionStats = await prisma.auditEvent.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
      });

      const eventsByAction = actionStats.reduce((acc, stat) => {
        acc[stat.action] = stat._count.action;
        return acc;
      }, {} as Record<string, number>);

      // Get events by resource
      const resourceStats = await prisma.auditEvent.groupBy({
        by: ['resource'],
        where,
        _count: { resource: true },
      });

      const eventsByResource = resourceStats.reduce((acc, stat) => {
        acc[stat.resource] = stat._count.resource;
        return acc;
      }, {} as Record<string, number>);

      // Get compliance and error stats
      const complianceEvents = await prisma.auditEvent.count({
        where: {
          ...where,
          complianceFlags: { hasSome: ['gdpr', 'security', 'ssl_compliance'] },
        },
      });

      const errorEvents = await prisma.auditEvent.count({
        where: { ...where, success: false },
      });

      // Get date range
      const dateRangeResult = await prisma.auditEvent.aggregate({
        where,
        _min: { timestamp: true },
        _max: { timestamp: true },
      });

      const dateRange = {
        oldest: dateRangeResult._min.timestamp || new Date(),
        newest: dateRangeResult._max.timestamp || new Date(),
      };

      return {
        totalEvents,
        eventsByAction,
        eventsByResource,
        complianceEvents,
        errorEvents,
        dateRange,
      };
    } catch (error) {
      logger.error('Audit stats query failed:', error);
      return {
        totalEvents: 0,
        eventsByAction: {},
        eventsByResource: {},
        complianceEvents: 0,
        errorEvents: 0,
        dateRange: {
          oldest: new Date(),
          newest: new Date(),
        },
      };
    }
  }

  // Export audit events for compliance reporting
  async exportAuditEvents(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const { events } = await this.queryEvents({ ...query, limit: 10000 }); // Limit to 10k for export

    if (format === 'csv') {
      return this.convertToCSV(events);
    }

    return JSON.stringify(events, null, 2);
  }

  // Private helper methods

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private isCriticalEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): boolean {
    const criticalActions = [
      'security.access_denied',
      'security.auth_failure',
      'domain.ssl_request',
      'branding.delete',
    ];

    return criticalActions.includes(event.action) || event.complianceFlags.includes('security');
  }

  private async checkComplianceViolations(event: AuditEvent): Promise<void> {
    // Check for GDPR compliance
    if (event.resource === 'user_data' && event.action.includes('delete')) {
      // Ensure data was properly deleted
      logger.info('GDPR compliance check: Data deletion logged', { eventId: event.id });
    }

    // Check for security violations
    if (event.action === 'security.rate_limit_exceeded') {
      const recentEvents = await this.queryEvents({
        ipAddress: event.ipAddress,
        dateFrom: new Date(Date.now() - 3600000), // Last hour
        limit: 10,
      });

      if (recentEvents.total > 5) {
        logger.warn('Potential DDoS attack detected', {
          ipAddress: event.ipAddress,
          eventsInLastHour: recentEvents.total,
        });
      }
    }
  }

  private determineComplianceFlags(
    action: string,
    resource: string,
    changes?: Record<string, any>
  ): string[] {
    const flags: string[] = [];

    // GDPR compliance for user data operations
    if (resource.includes('user') || changes?.includesPersonalData) {
      flags.push('gdpr');
    }

    // Security compliance
    if (resource.includes('security') || action === 'delete') {
      flags.push('security');
    }

    // SSL compliance
    if (resource.includes('ssl') || resource.includes('certificate')) {
      flags.push('ssl_compliance');
    }

    return flags;
  }

  private extractIPAddress(request?: Request): string | undefined {
    if (!request) return undefined;

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');

    return cfConnectingIP || realIP || forwardedFor?.split(',')[0].trim();
  }

  private extractSessionId(request?: Request): string | undefined {
    if (!request) return undefined;

    // Try to extract from various session headers
    return request.headers.get('x-session-id') ||
           request.headers.get('session-id') ||
           undefined;
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // Batch insert into database
      await prisma.auditEvent.createMany({
        data: events.map(event => ({
          id: event.id,
          timestamp: event.timestamp,
          userId: event.userId,
          companyId: event.companyId,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          details: event.details,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          sessionId: event.sessionId,
          success: event.success,
          errorMessage: event.errorMessage,
          complianceFlags: event.complianceFlags,
        })),
      });

      logger.info(`Flushed ${events.length} audit events to database`);
    } catch (error) {
      logger.error('Failed to flush audit events:', error);
      // Put events back in buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'Company ID',
      'Action',
      'Resource',
      'Resource ID',
      'Success',
      'Error Message',
      'IP Address',
      'Compliance Flags',
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.userId || '',
      event.companyId || '',
      event.action,
      event.resource,
      event.resourceId || '',
      event.success.toString(),
      event.errorMessage || '',
      event.ipAddress || '',
      event.complianceFlags.join(';'),
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 30000); // Flush every 30 seconds
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flushEvents();

    logger.info('Audit service shut down');
  }
}

export const comprehensiveAuditService = ComprehensiveAuditService.getInstance();
export default comprehensiveAuditService;