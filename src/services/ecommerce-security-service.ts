'use server';

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface SecurityAudit {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number;
  reasons: string[];
  recommendations: string[];
}

export interface PaymentSecurityCheck {
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
}

/**
 * Log security audit event
 */
export async function logSecurityAudit(
  userId: string | undefined,
  action: string,
  resource: string,
  resourceId: string | undefined,
  success: boolean,
  details?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string,
  companyId?: string
): Promise<void> {
  try {
    await prisma.securityAudit.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        ipAddress,
        userAgent,
        success,
        details,
        companyId
      }
    });
  } catch (error) {
    logger.error('Failed to log security audit', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      action,
      resource
    });
  }
}

/**
 * Detect potential fraudulent activity
 */
export async function detectFraudulentActivity(
  userId: string,
  action: string,
  amount?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<FraudDetectionResult> {
  try {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Check for rapid successive transactions
    const recentTransactions = await prisma.paymentTransaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    });

    if (recentTransactions.length > 10) {
      reasons.push('High transaction frequency');
      riskScore += 30;
      recommendations.push('Implement transaction rate limiting');
    }

    // Check for unusual amount patterns
    if (amount && amount > 10000) {
      reasons.push('Unusually high transaction amount');
      riskScore += 25;
      recommendations.push('Require additional verification for large amounts');
    }

    // Check IP address changes
    if (ipAddress) {
      const recentIPs = await prisma.securityAudit.findMany({
        where: {
          userId,
          ipAddress: { not: null },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: { ipAddress: true },
        distinct: ['ipAddress']
      });

      const uniqueIPs = new Set(recentIPs.map(audit => audit.ipAddress));
      if (uniqueIPs.size > 5) {
        reasons.push('Multiple IP addresses used recently');
        riskScore += 20;
        recommendations.push('Require identity verification');
      }

      // Check if IP is from high-risk location (simplified check)
      if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
        reasons.push('Suspicious IP address pattern');
        riskScore += 15;
      }
    }

    // Check user account age
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, active: true }
    });

    if (user) {
      const accountAgeHours = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);
      if (accountAgeHours < 24) {
        reasons.push('Very new account');
        riskScore += 15;
        recommendations.push('Require additional verification for new accounts');
      }
    }

    // Check for failed login attempts
    const recentFailedLogins = await prisma.securityAudit.count({
      where: {
        userId,
        action: 'login_failed',
        success: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    if (recentFailedLogins > 3) {
      reasons.push('Recent failed login attempts');
      riskScore += 25;
      recommendations.push('Account temporarily locked');
    }

    const isFraudulent = riskScore >= 50;

    return {
      isFraudulent,
      riskScore,
      reasons,
      recommendations
    };
  } catch (error) {
    logger.error('Failed to detect fraudulent activity', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      action
    });

    return {
      isFraudulent: false,
      riskScore: 0,
      reasons: [],
      recommendations: []
    };
  }
}

/**
 * Perform payment security checks
 */
export async function performPaymentSecurityCheck(
  userId: string,
  amount: number,
  paymentMethod: string,
  orderId?: string
): Promise<PaymentSecurityCheck> {
  try {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check payment method security
    if (paymentMethod === 'card') {
      // In production, integrate with payment processor security checks
      issues.push('Card payment requires PCI compliance verification');
      recommendations.push('Ensure PCI DSS compliance');
    }

    // Check transaction amount limits
    const dailyLimit = 50000; // Example limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTransactions = await prisma.paymentTransaction.findMany({
      where: {
        userId,
        createdAt: { gte: todayStart },
        status: 'completed'
      }
    });

    const todayTotal = todayTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    if (todayTotal + amount > dailyLimit) {
      issues.push('Daily transaction limit exceeded');
      recommendations.push('Reduce transaction amount or wait for daily reset');
    }

    // Check for suspicious patterns
    const fraudCheck = await detectFraudulentActivity(
      userId,
      'payment_attempt',
      amount
    );

    if (fraudCheck.isFraudulent) {
      issues.push('Fraudulent activity detected');
      recommendations.push(...fraudCheck.recommendations);
    }

    return {
      isSecure: issues.length === 0,
      issues,
      recommendations
    };
  } catch (error) {
    logger.error('Failed to perform payment security check', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      amount
    });

    return {
      isSecure: false,
      issues: ['Security check failed'],
      recommendations: ['Contact support']
    };
  }
}

/**
 * Encrypt sensitive payment data
 */
export function encryptPaymentData(data: string): string {
  try {
    const algorithm = 'aes-256-gcm';
    const key = process.env.PAYMENT_ENCRYPTION_KEY || 'default-key-change-in-production';
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
  } catch (error) {
    logger.error('Failed to encrypt payment data', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Decrypt sensitive payment data
 */
export function decryptPaymentData(encryptedData: string): string {
  try {
    const algorithm = 'aes-256-gcm';
    const key = process.env.PAYMENT_ENCRYPTION_KEY || 'default-key-change-in-production';

    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Failed to decrypt payment data', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Generate secure token for payment sessions
 */
export function generatePaymentToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate payment token
 */
export function validatePaymentToken(token: string): boolean {
  // Basic validation - check length and format
  return /^[a-f0-9]{64}$/.test(token);
}

/**
 * Rate limiting for payment endpoints
 */
export class PaymentRateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();

  checkLimit(identifier: string, maxAttempts: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record || now > record.resetTime) {
      this.attempts.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

// Global rate limiter instance
export const paymentRateLimiter = new PaymentRateLimiter();

/**
 * Security monitoring and alerting
 */
export async function monitorSecurityEvents(companyId?: string): Promise<{
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    count: number;
  }>;
}> {
  try {
    const alerts = [];

    // Check for failed payment attempts
    const failedPayments = await prisma.securityAudit.count({
      where: {
        action: 'payment_failed',
        success: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        },
        companyId
      }
    });

    if (failedPayments > 5) {
      alerts.push({
        type: 'failed_payments',
        severity: 'medium',
        message: 'High number of failed payment attempts detected',
        count: failedPayments
      });
    }

    // Check for suspicious IP addresses
    const suspiciousIPs = await prisma.securityAudit.findMany({
      where: {
        ipAddress: { not: null },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        },
        companyId
      },
      select: { ipAddress: true },
      distinct: ['ipAddress']
    });

    // Simplified suspicious IP check
    const suspiciousCount = suspiciousIPs.filter(ip =>
      ip.ipAddress?.includes('192.168.') || ip.ipAddress?.includes('10.')
    ).length;

    if (suspiciousCount > 10) {
      alerts.push({
        type: 'suspicious_ips',
        severity: 'high',
        message: 'Multiple suspicious IP addresses detected',
        count: suspiciousCount
      });
    }

    return { alerts };
  } catch (error) {
    logger.error('Failed to monitor security events', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });

    return { alerts: [] };
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\ecommerce-security-service.ts