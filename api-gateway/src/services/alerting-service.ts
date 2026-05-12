import { prisma } from '@/lib/prisma';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'performance' | 'business' | 'security';
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  channels: AlertChannel[];
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  duration?: number; // minutes
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'slack' | 'webhook';
  destination: string;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  data: Record<string, any>;
  createdAt: Date;
  resolvedAt?: Date;
}

export class AlertingService {
  private static alertRules: AlertRule[] = [
    // System alerts
    {
      id: 'system-db-connection',
      name: 'Database Connection Failed',
      description: 'Database connection is down',
      type: 'system',
      condition: { metric: 'db.connection.status', operator: 'eq', threshold: 0 },
      severity: 'critical',
      enabled: true,
      cooldownMinutes: 5,
      channels: [
        { type: 'email', destination: 'admin@company.com', enabled: true },
        { type: 'sms', destination: '+1234567890', enabled: true }
      ]
    },
    {
      id: 'system-high-cpu',
      name: 'High CPU Usage',
      description: 'CPU usage above 90%',
      type: 'performance',
      condition: { metric: 'system.cpu.usage', operator: 'gt', threshold: 90, duration: 5 },
      severity: 'high',
      enabled: true,
      cooldownMinutes: 15,
      channels: [
        { type: 'email', destination: 'admin@company.com', enabled: true }
      ]
    },
    {
      id: 'system-high-memory',
      name: 'High Memory Usage',
      description: 'Memory usage above 85%',
      type: 'performance',
      condition: { metric: 'system.memory.usage', operator: 'gt', threshold: 85, duration: 5 },
      severity: 'high',
      enabled: true,
      cooldownMinutes: 15,
      channels: [
        { type: 'email', destination: 'admin@company.com', enabled: true }
      ]
    },
    {
      id: 'system-disk-space',
      name: 'Low Disk Space',
      description: 'Disk space below 10%',
      type: 'system',
      condition: { metric: 'system.disk.free_percent', operator: 'lt', threshold: 10 },
      severity: 'high',
      enabled: true,
      cooldownMinutes: 60,
      channels: [
        { type: 'email', destination: 'admin@company.com', enabled: true }
      ]
    },

    // Business alerts
    {
      id: 'business-low-registrations',
      name: 'Low Daily Registrations',
      description: 'Daily registrations below threshold',
      type: 'business',
      condition: { metric: 'business.registrations.daily', operator: 'lt', threshold: 5 },
      severity: 'medium',
      enabled: true,
      cooldownMinutes: 1440, // 24 hours
      channels: [
        { type: 'email', destination: 'manager@company.com', enabled: true }
      ]
    },
    {
      id: 'business-high-failed-payments',
      name: 'High Failed Payment Rate',
      description: 'Payment failure rate above 5%',
      type: 'business',
      condition: { metric: 'business.payments.failure_rate', operator: 'gt', threshold: 5 },
      severity: 'high',
      enabled: true,
      cooldownMinutes: 60,
      channels: [
        { type: 'email', destination: 'finance@company.com', enabled: true }
      ]
    },

    // Security alerts
    {
      id: 'security-failed-logins',
      name: 'Multiple Failed Login Attempts',
      description: 'Failed login attempts exceed threshold',
      type: 'security',
      condition: { metric: 'security.failed_logins.hourly', operator: 'gt', threshold: 10 },
      severity: 'medium',
      enabled: true,
      cooldownMinutes: 30,
      channels: [
        { type: 'email', destination: 'security@company.com', enabled: true }
      ]
    },
    {
      id: 'security-suspicious-activity',
      name: 'Suspicious User Activity',
      description: 'Unusual user behavior detected',
      type: 'security',
      condition: { metric: 'security.suspicious_activity.score', operator: 'gt', threshold: 80 },
      severity: 'high',
      enabled: true,
      cooldownMinutes: 15,
      channels: [
        { type: 'email', destination: 'security@company.com', enabled: true },
        { type: 'sms', destination: '+1234567890', enabled: true }
      ]
    }
  ];

  /**
   * Check all alert rules against current metrics
   */
  static async checkAlerts(): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const shouldTrigger = await this.evaluateRule(rule);
        if (shouldTrigger) {
          const alert = await this.createAlert(rule);
          if (alert) {
            alerts.push(alert);
            await this.sendAlertNotifications(alert, rule.channels);
          }
        }
      } catch (error) {
        console.error(`Error checking alert rule ${rule.id}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Evaluate if an alert rule should trigger
   */
  private static async evaluateRule(rule: AlertRule): Promise<boolean> {
    // Check cooldown
    if (rule.lastTriggered) {
      const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldownMinutes * 60000);
      if (new Date() < cooldownEnd) {
        return false; // Still in cooldown
      }
    }

    const metricValue = await this.getMetricValue(rule.condition.metric);

    if (metricValue === null) {
      return false; // Metric not available
    }

    const { operator, threshold } = rule.condition;

    switch (operator) {
      case 'gt': return metricValue > threshold;
      case 'lt': return metricValue < threshold;
      case 'eq': return metricValue === threshold;
      case 'ne': return metricValue !== threshold;
      case 'gte': return metricValue >= threshold;
      case 'lte': return metricValue <= threshold;
      default: return false;
    }
  }

  /**
   * Get current value for a metric
   */
  private static async getMetricValue(metric: string): Promise<number | null> {
    try {
      switch (metric) {
        case 'db.connection.status':
          return await this.checkDatabaseConnection();

        case 'system.cpu.usage':
          return await this.getCPUUsage();

        case 'system.memory.usage':
          return await this.getMemoryUsage();

        case 'system.disk.free_percent':
          return await this.getDiskFreePercent();

        case 'business.registrations.daily':
          return await this.getDailyRegistrations();

        case 'business.payments.failure_rate':
          return await this.getPaymentFailureRate();

        case 'security.failed_logins.hourly':
          return await this.getFailedLoginsHourly();

        case 'security.suspicious_activity.score':
          return await this.getSuspiciousActivityScore();

        default:
          console.warn(`Unknown metric: ${metric}`);
          return null;
      }
    } catch (error) {
      console.error(`Error getting metric ${metric}:`, error);
      return null;
    }
  }

  /**
   * Create an alert record
   */
  private static async createAlert(rule: AlertRule): Promise<Alert | null> {
    try {
      const alertData = {
        ruleId: rule.id,
        title: rule.name,
        message: rule.description,
        severity: rule.severity,
        status: 'active' as const,
        data: {
          metric: rule.condition.metric,
          threshold: rule.condition.threshold,
          operator: rule.condition.operator
        }
      };

      // Check if similar alert already exists and is active
      const existingAlert = await prisma.alert.findFirst({
        where: {
          ruleId: rule.id,
          status: 'active'
        }
      });

      if (existingAlert) {
        return null; // Alert already active
      }

      const alert = await prisma.alert.create({
        data: alertData
      });

      // Update rule's last triggered time
      rule.lastTriggered = new Date();

      return {
        id: alert.id,
        ruleId: alert.ruleId,
        title: alert.title,
        message: alert.message,
        severity: alert.severity as any,
        status: alert.status as any,
        data: alert.data as any,
        createdAt: alert.createdAt,
        resolvedAt: alert.resolvedAt || undefined
      };

    } catch (error) {
      console.error('Error creating alert:', error);
      return null;
    }
  }

  /**
   * Send alert notifications
   */
  private static async sendAlertNotifications(alert: Alert, channels: AlertChannel[]): Promise<void> {
    for (const channel of channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailAlert(alert, channel.destination);
            break;
          case 'sms':
            await this.sendSMSAlert(alert, channel.destination);
            break;
          case 'slack':
            await this.sendSlackAlert(alert, channel.destination);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alert, channel.destination);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${channel.type} alert:`, error);
      }
    }
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string): Promise<void> {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolvedAt: new Date()
      }
    });
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts(): Promise<Alert[]> {
    const alerts = await prisma.alert.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' }
    });

    return alerts.map(alert => ({
      id: alert.id,
      ruleId: alert.ruleId,
      title: alert.title,
      message: alert.message,
      severity: alert.severity as any,
      status: alert.status as any,
      data: alert.data as any,
      createdAt: alert.createdAt,
      resolvedAt: alert.resolvedAt || undefined
    }));
  }

  // Metric collection methods
  private static async checkDatabaseConnection(): Promise<number> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 1; // Connected
    } catch {
      return 0; // Disconnected
    }
  }

  private static async getCPUUsage(): Promise<number> {
    // Simplified - in production, use system monitoring
    return Math.random() * 100; // Mock value
  }

  private static async getMemoryUsage(): Promise<number> {
    // Simplified - in production, use system monitoring
    return Math.random() * 100; // Mock value
  }

  private static async getDiskFreePercent(): Promise<number> {
    // Simplified - in production, use system monitoring
    return Math.random() * 100; // Mock value
  }

  private static async getDailyRegistrations(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.user.count({
      where: {
        createdAt: { gte: today }
      }
    });

    return count;
  }

  private static async getPaymentFailureRate(): Promise<number> {
    // Simplified - would need payment tracking
    return Math.random() * 10; // Mock value
  }

  private static async getFailedLoginsHourly(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await prisma.auditLog.count({
      where: {
        action: 'failed_login',
        createdAt: { gte: oneHourAgo }
      }
    });

    return count;
  }

  private static async getSuspiciousActivityScore(): Promise<number> {
    // Simplified - would need ML/anomaly detection
    return Math.random() * 100; // Mock value
  }

  // Notification methods (simplified)
  private static async sendEmailAlert(alert: Alert, email: string): Promise<void> {
    console.log(`Sending email alert to ${email}: ${alert.title}`);
    // In production, integrate with email service
  }

  private static async sendSMSAlert(alert: Alert, phone: string): Promise<void> {
    console.log(`Sending SMS alert to ${phone}: ${alert.title}`);
    // In production, integrate with SMS service
  }

  private static async sendSlackAlert(alert: Alert, webhook: string): Promise<void> {
    console.log(`Sending Slack alert to ${webhook}: ${alert.title}`);
    // In production, send to Slack webhook
  }

  private static async sendWebhookAlert(alert: Alert, url: string): Promise<void> {
    console.log(`Sending webhook alert to ${url}: ${alert.title}`);
    // In production, send HTTP request
  }
}