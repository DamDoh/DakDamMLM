import { prisma } from '@/lib/database';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * RBAC Session Management System
 * Handles authentication sessions, MFA, and security controls
 */

export interface SessionConfig {
  sessionTimeout: number; // milliseconds
  idleTimeout: number; // milliseconds
  maxConcurrentSessions: number;
  mfaGracePeriod: number; // minutes
  jwtSecret: string;
  refreshTokenExpiry: number; // milliseconds
}

export interface SessionData {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  mfaVerified: boolean;
  ipAddress: string;
  userAgent?: string;
  deviceFingerprint?: string;
  location?: any;
  riskScore: number;
  lastActivity: Date;
}

export interface MFASetup {
  userId: string;
  methods: MFAMethod[];
  backupCodes: string[];
  gracePeriod: number;
}

export interface MFAMethod {
  type: 'totp' | 'sms' | 'email' | 'hardware' | 'biometric';
  identifier: string; // phone, email, device ID
  secret?: string; // For TOTP
  enabled: boolean;
  lastUsed?: Date;
  failureCount: number;
}

export class RBACSessionManager {
  private config: SessionConfig;

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
      idleTimeout: 30 * 60 * 1000, // 30 minutes
      maxConcurrentSessions: 5,
      mfaGracePeriod: 5, // 5 minutes
      jwtSecret: process.env.RBAC_JWT_SECRET || 'default-rbac-secret-change-in-production',
      refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
      ...config
    };
  }

  /**
   * Create a new authenticated session
   */
  async createSession(
    userId: string,
    context: {
      ipAddress: string;
      userAgent?: string;
      deviceFingerprint?: string;
      mfaVerified?: boolean;
    }
  ): Promise<SessionData> {
    // Check concurrent session limits
    await this.enforceSessionLimits(userId);

    // Generate tokens
    const sessionId = crypto.randomUUID();
    const token = this.generateJWT({
      userId,
      sessionId,
      type: 'session',
      mfaVerified: context.mfaVerified || false
    });

    const refreshToken = this.generateJWT({
      userId,
      sessionId,
      type: 'refresh',
      tokenHash: crypto.createHash('sha256').update(token).digest('hex')
    });

    const expiresAt = new Date(Date.now() + this.config.sessionTimeout);

    // Calculate initial risk score
    const riskScore = await this.calculateSessionRisk({
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      userId
    });

    // Store session in database
    const session = await prisma.rBACSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceFingerprint: context.deviceFingerprint,
        expiresAt,
        mfaVerified: context.mfaVerified || false,
        riskScore
      }
    });

    return {
      id: sessionId,
      userId,
      token,
      refreshToken,
      expiresAt,
      mfaVerified: session.mfaVerified,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceFingerprint: session.deviceFingerprint,
      riskScore: session.riskScore,
      lastActivity: session.lastActivity
    };
  }

  /**
   * Validate and refresh session
   */
  async validateSession(token: string): Promise<{
    valid: boolean;
    session?: SessionData;
    user?: any;
    requiresRefresh?: boolean;
  }> {
    try {
      // Decode JWT
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;

      if (decoded.type !== 'session') {
        return { valid: false };
      }

      // Get session from database
      const session = await prisma.rBACSession.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true }
      });

      if (!session || !session.isActive) {
        return { valid: false };
      }

      // Check expiration
      if (session.expiresAt < new Date()) {
        await this.invalidateSession(session.id);
        return { valid: false };
      }

      // Check idle timeout
      const idleTime = Date.now() - session.lastActivity.getTime();
      if (idleTime > this.config.idleTimeout) {
        await this.invalidateSession(session.id);
        return { valid: false };
      }

      // Update last activity
      await prisma.rBACSession.update({
        where: { id: session.id },
        data: { lastActivity: new Date() }
      });

      // Check if refresh is needed (within last hour of expiry)
      const timeToExpiry = session.expiresAt.getTime() - Date.now();
      const requiresRefresh = timeToExpiry < (60 * 60 * 1000); // 1 hour

      return {
        valid: true,
        session: {
          id: session.id,
          userId: session.userId,
          token,
          refreshToken: '', // Not returned for security
          expiresAt: session.expiresAt,
          mfaVerified: session.mfaVerified,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          deviceFingerprint: session.deviceFingerprint,
          riskScore: session.riskScore,
          lastActivity: session.lastActivity
        },
        user: session.user,
        requiresRefresh
      };

    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Refresh session token
   */
  async refreshSession(refreshToken: string): Promise<SessionData | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as any;

      if (decoded.type !== 'refresh') {
        return null;
      }

      const session = await prisma.rBACSession.findUnique({
        where: { id: decoded.sessionId }
      });

      if (!session || !session.isActive) {
        return null;
      }

      // Generate new tokens
      const newToken = this.generateJWT({
        userId: session.userId,
        sessionId: session.id,
        type: 'session',
        mfaVerified: session.mfaVerified
      });

      const newRefreshToken = this.generateJWT({
        userId: session.userId,
        sessionId: session.id,
        type: 'refresh',
        tokenHash: crypto.createHash('sha256').update(newToken).digest('hex')
      });

      const newExpiresAt = new Date(Date.now() + this.config.sessionTimeout);

      // Update session
      await prisma.rBACSession.update({
        where: { id: session.id },
        data: {
          tokenHash: crypto.createHash('sha256').update(newToken).digest('hex'),
          expiresAt: newExpiresAt,
          lastActivity: new Date()
        }
      });

      return {
        id: session.id,
        userId: session.userId,
        token: newToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        mfaVerified: session.mfaVerified,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceFingerprint: session.deviceFingerprint,
        riskScore: session.riskScore,
        lastActivity: new Date()
      };

    } catch (error) {
      return null;
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
   * Invalidate all user sessions
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    const result = await prisma.rBACSession.updateMany({
      where: {
        userId,
        isActive: true
      },
      data: { isActive: false }
    });

    return result.count;
  }

  /**
   * MFA Setup and Management
   */

  /**
   * Setup MFA for user
   */
  async setupMFA(userId: string, methods: Omit<MFAMethod, 'failureCount'>[]): Promise<MFASetup> {
    const user = await prisma.rBACUser.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate secrets for TOTP methods
    const processedMethods = methods.map(method => ({
      ...method,
      secret: method.type === 'totp' ? this.generateTOTPSecret() : undefined,
      failureCount: 0
    }));

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store MFA configuration
    await prisma.rBACMFAConfig.upsert({
      where: { userId },
      update: {
        methods: processedMethods,
        backupCodes: await this.hashBackupCodes(backupCodes),
        gracePeriod: this.config.mfaGracePeriod
      },
      create: {
        userId,
        methods: processedMethods,
        backupCodes: await this.hashBackupCodes(backupCodes),
        gracePeriod: this.config.mfaGracePeriod
      }
    });

    // Update user MFA status
    await prisma.rBACUser.update({
      where: { id: userId },
      data: { mfaEnabled: true }
    });

    return {
      userId,
      methods: processedMethods,
      backupCodes, // Return plain codes to user
      gracePeriod: this.config.mfaGracePeriod
    };
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(userId: string, code: string, method: string): Promise<boolean> {
    const mfaConfig = await prisma.rBACMFAConfig.findUnique({
      where: { userId }
    });

    if (!mfaConfig) {
      return false;
    }

    const methodConfig = mfaConfig.methods.find((m: any) => m.type === method && m.enabled);

    if (!methodConfig) {
      return false;
    }

    let isValid = false;

    switch (method) {
      case 'totp':
        isValid = this.verifyTOTP(code, methodConfig.secret);
        break;
      case 'sms':
      case 'email':
        // In production, this would verify against sent codes
        isValid = code === '123456'; // Placeholder
        break;
      case 'hardware':
        // Hardware token verification
        isValid = this.verifyHardwareToken(code, methodConfig.identifier);
        break;
      case 'backup':
        isValid = await this.verifyBackupCode(userId, code);
        break;
    }

    if (isValid) {
      // Reset failure count and update last used
      await this.updateMFAMethodStatus(userId, method, true);
    } else {
      // Increment failure count
      await this.updateMFAMethodStatus(userId, method, false);
    }

    return isValid;
  }

  /**
   * Get MFA setup status
   */
  async getMFAStatus(userId: string): Promise<{
    enabled: boolean;
    methods: MFAMethod[];
    gracePeriod: number;
  } | null> {
    const config = await prisma.rBACMFAConfig.findUnique({
      where: { userId }
    });

    if (!config) {
      return null;
    }

    return {
      enabled: true,
      methods: config.methods as MFAMethod[],
      gracePeriod: config.gracePeriod
    };
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId: string): Promise<void> {
    await prisma.rBACMFAConfig.delete({
      where: { userId }
    });

    await prisma.rBACUser.update({
      where: { id: userId },
      data: { mfaEnabled: false }
    });
  }

  /**
   * Security Monitoring and Risk Assessment
   */

  /**
   * Calculate session risk score
   */
  private async calculateSessionRisk(context: {
    ipAddress: string;
    userAgent?: string;
    userId: string;
  }): Promise<number> {
    let riskScore = 0;

    // Check IP reputation (simplified)
    if (await this.isSuspiciousIP(context.ipAddress)) {
      riskScore += 40;
    }

    // Check user agent anomalies
    if (context.userAgent && await this.isAnomalousUserAgent(context.userId, context.userAgent)) {
      riskScore += 20;
    }

    // Check geographic anomalies
    const location = await this.getIPLocation(context.ipAddress);
    if (location && await this.isAnomalousLocation(context.userId, location)) {
      riskScore += 25;
    }

    // Check time-based patterns
    const hour = new Date().getHours();
    if (await this.isUnusualLoginTime(context.userId, hour)) {
      riskScore += 15;
    }

    return Math.min(riskScore, 100);
  }

  /**
   * Monitor active sessions
   */
  async getActiveSessions(userId?: string): Promise<any[]> {
    const where: any = { isActive: true };

    if (userId) {
      where.userId = userId;
    }

    const sessions = await prisma.rBACSession.findMany({
      where,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { lastActivity: 'desc' }
    });

    return sessions.map(session => ({
      id: session.id,
      user: session.user,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceFingerprint: session.deviceFingerprint,
      startedAt: session.startedAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      mfaVerified: session.mfaVerified,
      riskScore: session.riskScore
    }));
  }

  /**
   * Force logout of suspicious sessions
   */
  async forceLogout(sessionId: string, reason: string): Promise<void> {
    await prisma.rBACSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        metadata: {
          forceLogoutReason: reason,
          forceLogoutAt: new Date()
        }
      }
    });
  }

  // Private helper methods

  private generateJWT(payload: any): string {
    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: payload.type === 'refresh' ? '30d' : '8h'
    });
  }

  private async enforceSessionLimits(userId: string): Promise<void> {
    const activeSessions = await prisma.rBACSession.count({
      where: {
        userId,
        isActive: true
      }
    });

    if (activeSessions >= this.config.maxConcurrentSessions) {
      // Terminate oldest sessions
      const sessionsToTerminate = await prisma.rBACSession.findMany({
        where: {
          userId,
          isActive: true
        },
        orderBy: { lastActivity: 'asc' },
        take: activeSessions - this.config.maxConcurrentSessions + 1
      });

      for (const session of sessionsToTerminate) {
        await this.invalidateSession(session.id);
      }
    }
  }

  private generateTOTPSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private async hashBackupCodes(codes: string[]): Promise<string> {
    const hashedCodes = await Promise.all(
      codes.map(code => bcrypt.hash(code, 10))
    );
    return JSON.stringify(hashedCodes);
  }

  private verifyTOTP(code: string, secret: string): boolean {
    // Simplified TOTP verification - in production use speakeasy
    return code.length === 6 && /^\d+$/.test(code);
  }

  private verifyHardwareToken(code: string, deviceId: string): boolean {
    // Hardware token verification logic
    return code.length === 8 && /^\d+$/.test(code);
  }

  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const config = await prisma.rBACMFAConfig.findUnique({
      where: { userId }
    });

    if (!config?.backupCodes) return false;

    const hashedCodes = JSON.parse(config.backupCodes);
    for (const hashedCode of hashedCodes) {
      if (await bcrypt.compare(code, hashedCode)) {
        // Remove used backup code
        const index = hashedCodes.indexOf(hashedCode);
        hashedCodes.splice(index, 1);
        await prisma.rBACMFAConfig.update({
          where: { userId },
          data: { backupCodes: JSON.stringify(hashedCodes) }
        });
        return true;
      }
    }

    return false;
  }

  private async updateMFAMethodStatus(userId: string, method: string, success: boolean): Promise<void> {
    const config = await prisma.rBACMFAConfig.findUnique({
      where: { userId }
    });

    if (!config) return;

    const methods = config.methods as MFAMethod[];
    const methodIndex = methods.findIndex(m => m.type === method);

    if (methodIndex >= 0) {
      methods[methodIndex].lastUsed = new Date();
      if (success) {
        methods[methodIndex].failureCount = 0;
      } else {
        methods[methodIndex].failureCount++;
        // Disable method after 5 failures
        if (methods[methodIndex].failureCount >= 5) {
          methods[methodIndex].enabled = false;
        }
      }

      await prisma.rBACMFAConfig.update({
        where: { userId },
        data: { methods }
      });
    }
  }

  private async isSuspiciousIP(ipAddress: string): Promise<boolean> {
    // In production, check against threat intelligence feeds
    return false; // Placeholder
  }

  private async isAnomalousUserAgent(userId: string, userAgent: string): Promise<boolean> {
    // Check if user agent differs from historical patterns
    return false; // Placeholder
  }

  private async getIPLocation(ipAddress: string): Promise<any> {
    // IP geolocation service integration
    return { country: 'US', city: 'Unknown' }; // Placeholder
  }

  private async isAnomalousLocation(userId: string, location: any): Promise<boolean> {
    // Check against user's historical locations
    return false; // Placeholder
  }

  private async isUnusualLoginTime(userId: string, hour: number): Promise<boolean> {
    // Check against user's normal login times
    return false; // Placeholder
  }
}

// Export singleton instance
export const rbacSessionManager = new RBACSessionManager();