// Domain Security Service
// Handles domain ownership verification, security measures, and access control

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface DomainVerificationChallenge {
  challenge: string;
  expectedValue: string;
  expiresAt: Date;
}

export interface SecurityConfig {
  maxVerificationAttempts: number;
  challengeExpiryMinutes: number;
  rateLimitWindowMinutes: number;
  rateLimitMaxRequests: number;
  allowedChallengeTypes: string[];
}

export interface RateLimitInfo {
  attempts: number;
  windowStart: Date;
  blocked: boolean;
  blockExpires?: Date;
}

class DomainSecurityService {
  private static instance: DomainSecurityService;
  private verificationChallenges = new Map<string, DomainVerificationChallenge>();
  private rateLimits = new Map<string, RateLimitInfo>();
  private config: SecurityConfig;

  private constructor() {
    this.config = {
      maxVerificationAttempts: 5,
      challengeExpiryMinutes: 15,
      rateLimitWindowMinutes: 15,
      rateLimitMaxRequests: 10,
      allowedChallengeTypes: ['dns-txt', 'file', 'meta-tag'],
    };

    // Clean up expired challenges periodically
    setInterval(() => this.cleanupExpiredItems(), 5 * 60 * 1000); // Every 5 minutes
  }

  static getInstance(): DomainSecurityService {
    if (!DomainSecurityService.instance) {
      DomainSecurityService.instance = new DomainSecurityService();
    }
    return DomainSecurityService.instance;
  }

  // Generate domain ownership verification challenge
  async generateVerificationChallenge(
    domain: string,
    challengeType: string = 'dns-txt'
  ): Promise<DomainVerificationChallenge> {
    try {
      // Check rate limiting
      if (await this.isRateLimited(domain)) {
        throw new Error('Too many verification attempts. Please try again later.');
      }

      // Validate challenge type
      if (!this.config.allowedChallengeTypes.includes(challengeType)) {
        throw new Error(`Unsupported challenge type: ${challengeType}`);
      }

      // Generate unique challenge
      const challenge = this.generateChallengeString();
      const expectedValue = this.generateExpectedValue(domain, challenge);

      const challengeData: DomainVerificationChallenge = {
        challenge,
        expectedValue,
        expiresAt: new Date(Date.now() + this.config.challengeExpiryMinutes * 60 * 1000),
      };

      this.verificationChallenges.set(`${domain}:${challengeType}`, challengeData);

      // Record attempt for rate limiting
      await this.recordVerificationAttempt(domain);

      logger.info('Domain verification challenge generated', {
        domain,
        challengeType,
        challenge,
      });

      return challengeData;
    } catch (error) {
      logger.error('Failed to generate verification challenge:', error);
      throw error;
    }
  }

  // Verify domain ownership
  async verifyDomainOwnership(
    domain: string,
    challengeType: string,
    providedValue: string
  ): Promise<boolean> {
    try {
      const challengeKey = `${domain}:${challengeType}`;
      const challenge = this.verificationChallenges.get(challengeKey);

      if (!challenge) {
        throw new Error('No active verification challenge found');
      }

      // Check if challenge is expired
      if (new Date() > challenge.expiresAt) {
        this.verificationChallenges.delete(challengeKey);
        throw new Error('Verification challenge has expired');
      }

      // Verify the provided value
      const isValid = await this.validateChallengeResponse(domain, challengeType, providedValue, challenge);

      if (isValid) {
        // Mark domain as verified in database
        await this.markDomainAsVerified(domain);
        this.verificationChallenges.delete(challengeKey);

        logger.info('Domain ownership verified successfully', {
          domain,
          challengeType,
        });
      } else {
        // Record failed attempt
        await this.recordVerificationAttempt(domain, true);

        logger.warn('Domain ownership verification failed', {
          domain,
          challengeType,
          providedValue: providedValue.substring(0, 50) + '...', // Truncate for security
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Domain verification failed:', error);
      throw error;
    }
  }

  // Check if domain access is authorized
  async authorizeDomainAccess(domain: string, companyId: string): Promise<boolean> {
    try {
      const company = await prisma.company.findFirst({
        where: {
          id: companyId,
          OR: [
            { domain },
            { customDomain: domain },
          ],
          customDomainVerified: true,
        },
      });

      if (!company) {
        logger.warn('Unauthorized domain access attempt', {
          domain,
          companyId,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Domain authorization check failed:', error);
      return false;
    }
  }

  // Get domain security status
  async getDomainSecurityStatus(domain: string): Promise<{
    isVerified: boolean;
    isSecure: boolean;
    hasSSL: boolean;
    lastChecked: Date;
    securityScore: number;
  }> {
    try {
      const company = await prisma.company.findFirst({
        where: {
          OR: [
            { domain },
            { customDomain: domain },
          ],
        },
        include: {
          sslCertificate: true,
        },
      });

      if (!company) {
        return {
          isVerified: false,
          isSecure: false,
          hasSSL: false,
          lastChecked: new Date(),
          securityScore: 0,
        };
      }

      const isVerified = company.customDomainVerified;
      const hasSSL = !!company.sslCertificate;
      const isSecure = isVerified && hasSSL;

      // Calculate security score (0-100)
      let securityScore = 0;
      if (isVerified) securityScore += 40;
      if (hasSSL) securityScore += 40;
      if (company.sslCertificate?.autoRenew) securityScore += 20;

      return {
        isVerified,
        isSecure,
        hasSSL,
        lastChecked: new Date(),
        securityScore,
      };
    } catch (error) {
      logger.error('Failed to get domain security status:', error);
      return {
        isVerified: false,
        isSecure: false,
        hasSSL: false,
        lastChecked: new Date(),
        securityScore: 0,
      };
    }
  }

  // CORS validation for custom domains
  async validateCORSOrigin(origin: string, companyId: string): Promise<boolean> {
    try {
      // Allow same-origin requests
      if (!origin) return true;

      const originDomain = new URL(origin).hostname;

      // Check if the origin matches the company's custom domain
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          customDomain: true,
          customDomainVerified: true,
        },
      });

      if (!company?.customDomain || !company.customDomainVerified) {
        return false;
      }

      // Allow the custom domain and its subdomains
      const customDomain = company.customDomain.replace(/^www\./, '');
      const isAllowed = originDomain === customDomain ||
                       originDomain.endsWith(`.${customDomain}`);

      if (!isAllowed) {
        logger.warn('CORS validation failed', {
          origin: originDomain,
          allowedDomain: customDomain,
          companyId,
        });
      }

      return isAllowed;
    } catch (error) {
      logger.error('CORS validation error:', error);
      return false;
    }
  }

  // Private helper methods

  private generateChallengeString(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateExpectedValue(domain: string, challenge: string): string {
    // Create a hash of domain + challenge + secret
    const secret = process.env.DOMAIN_VERIFICATION_SECRET || 'default-secret';
    const hash = crypto.createHash('sha256')
      .update(`${domain}:${challenge}:${secret}`)
      .digest('hex');

    return hash.substring(0, 16); // First 16 characters
  }

  private async validateChallengeResponse(
    domain: string,
    challengeType: string,
    providedValue: string,
    challenge: DomainVerificationChallenge
  ): Promise<boolean> {
    switch (challengeType) {
      case 'dns-txt':
        return await this.validateDNSTXTChallenge(domain, providedValue, challenge);
      case 'file':
        return await this.validateFileChallenge(domain, providedValue, challenge);
      case 'meta-tag':
        return await this.validateMetaTagChallenge(domain, providedValue, challenge);
      default:
        return false;
    }
  }

  private async validateDNSTXTChallenge(
    domain: string,
    providedValue: string,
    challenge: DomainVerificationChallenge
  ): Promise<boolean> {
    // In production, this would query DNS TXT records
    // For now, simulate validation
    return providedValue === challenge.expectedValue;
  }

  private async validateFileChallenge(
    domain: string,
    providedValue: string,
    challenge: DomainVerificationChallenge
  ): Promise<boolean> {
    // In production, this would fetch a file from the domain
    // For now, simulate validation
    return providedValue === challenge.expectedValue;
  }

  private async validateMetaTagChallenge(
    domain: string,
    providedValue: string,
    challenge: DomainVerificationChallenge
  ): Promise<boolean> {
    // In production, this would fetch the HTML and check meta tags
    // For now, simulate validation
    return providedValue === challenge.expectedValue;
  }

  private async markDomainAsVerified(domain: string): Promise<void> {
    await prisma.company.updateMany({
      where: { customDomain: domain },
      data: {
        customDomainVerified: true,
        updatedAt: new Date(),
      },
    });
  }

  private async isRateLimited(identifier: string): Promise<boolean> {
    const rateLimit = this.rateLimits.get(identifier);

    if (!rateLimit) return false;

    // Check if block has expired
    if (rateLimit.blocked && rateLimit.blockExpires && new Date() > rateLimit.blockExpires) {
      this.rateLimits.delete(identifier);
      return false;
    }

    if (rateLimit.blocked) return true;

    // Check if within rate limit window
    const windowExpiry = new Date(rateLimit.windowStart.getTime() + this.config.rateLimitWindowMinutes * 60 * 1000);
    if (new Date() > windowExpiry) {
      // Reset window
      this.rateLimits.delete(identifier);
      return false;
    }

    return rateLimit.attempts >= this.config.rateLimitMaxRequests;
  }

  private async recordVerificationAttempt(domain: string, isFailure: boolean = false): Promise<void> {
    const existing = this.rateLimits.get(domain) || {
      attempts: 0,
      windowStart: new Date(),
      blocked: false,
    };

    existing.attempts++;

    // Block after max attempts
    if (existing.attempts >= this.config.maxVerificationAttempts) {
      existing.blocked = true;
      existing.blockExpires = new Date(Date.now() + 60 * 60 * 1000); // Block for 1 hour
    }

    this.rateLimits.set(domain, existing);
  }

  private cleanupExpiredItems(): void {
    const now = new Date();

    // Clean up expired challenges
    for (const [key, challenge] of this.verificationChallenges) {
      if (now > challenge.expiresAt) {
        this.verificationChallenges.delete(key);
      }
    }

    // Clean up expired rate limits
    for (const [key, rateLimit] of this.rateLimits) {
      if (rateLimit.blockExpires && now > rateLimit.blockExpires) {
        this.rateLimits.delete(key);
      }
    }

    logger.info('Cleaned up expired security items', {
      challengesRemoved: this.verificationChallenges.size,
      rateLimitsRemoved: this.rateLimits.size,
    });
  }

  // Get security metrics
  getSecurityMetrics(): {
    activeChallenges: number;
    activeRateLimits: number;
    blockedDomains: number;
  } {
    let blockedCount = 0;
    for (const rateLimit of this.rateLimits.values()) {
      if (rateLimit.blocked) blockedCount++;
    }

    return {
      activeChallenges: this.verificationChallenges.size,
      activeRateLimits: this.rateLimits.size,
      blockedDomains: blockedCount,
    };
  }

  // Security audit log
  async logSecurityEvent(
    event: string,
    domain: string,
    companyId: string,
    details: Record<string, any>
  ): Promise<void> {
    logger.info('Domain security event', {
      event,
      domain,
      companyId,
      ...details,
    });

    // In production, you might want to store this in a security audit table
  }
}

export const domainSecurityService = DomainSecurityService.getInstance();
export default domainSecurityService;