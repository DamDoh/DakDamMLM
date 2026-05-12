// SSL Certificate Automation Service
// Handles Let's Encrypt integration for automatic SSL certificate issuance and renewal

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { customDomainService } from './custom-domain-service';

export interface SSLChallenge {
  type: 'http-01' | 'dns-01';
  token: string;
  keyAuthorization: string;
  challengeUrl?: string;
}

export interface SSLCertificateRequest {
  domain: string;
  email: string;
  challengeType: 'http-01' | 'dns-01';
  companyId: string;
}

export interface SSLCertificateResponse {
  certificate: string;
  privateKey: string;
  chainCertificates?: string;
  issuedAt: Date;
  expiresAt: Date;
  issuer: string;
}

class SSLService {
  private static instance: SSLService;
  private acmeClient: any = null; // Would be ACME client in production
  private challengeTokens = new Map<string, SSLChallenge>();

  private constructor() {
    this.initializeACMEClient();
  }

  static getInstance(): SSLService {
    if (!SSLService.instance) {
      SSLService.instance = new SSLService();
    }
    return SSLService.instance;
  }

  // Initialize ACME client (Let's Encrypt)
  private async initializeACMEClient(): Promise<void> {
    try {
      // In production, this would initialize the ACME client
      // For now, we'll simulate the client
      logger.info('SSL Service initialized');
    } catch (error) {
      logger.error('Failed to initialize ACME client:', error);
    }
  }

  // Request SSL certificate
  async requestCertificate(request: SSLCertificateRequest): Promise<SSLCertificateResponse> {
    try {
      logger.info('Requesting SSL certificate', {
        domain: request.domain,
        companyId: request.companyId,
        challengeType: request.challengeType,
      });

      // Verify domain ownership
      await this.verifyDomainOwnership(request.domain, request.companyId);

      // Generate ACME challenge
      const challenge = await this.generateChallenge(request.domain, request.challengeType);

      // Store challenge for verification
      this.challengeTokens.set(request.domain, challenge);

      // Complete ACME challenge based on type
      if (request.challengeType === 'http-01') {
        await this.completeHTTPChallenge(challenge, request.domain);
      } else {
        await this.completeDNSChallenge(challenge, request.domain);
      }

      // Request certificate from Let's Encrypt
      const certificate = await this.requestCertificateFromACME(request);

      // Validate certificate
      await this.validateCertificate(certificate, request.domain);

      // Store certificate metadata
      await this.storeCertificateMetadata(certificate, request.companyId);

      logger.info('SSL certificate issued successfully', {
        domain: request.domain,
        companyId: request.companyId,
        expiresAt: certificate.expiresAt,
      });

      return certificate;
    } catch (error) {
      logger.error('Failed to request SSL certificate:', error);
      throw error;
    }
  }

  // Renew SSL certificate
  async renewCertificate(domain: string, companyId: string): Promise<SSLCertificateResponse> {
    try {
      logger.info('Renewing SSL certificate', { domain, companyId });

      // Check if renewal is needed
      const existingCert = await prisma.sSLCertificate.findFirst({
        where: {
          domain,
          companyId,
          expiresAt: {
            lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        },
      });

      if (!existingCert) {
        throw new Error('No certificate found that needs renewal');
      }

      // Use same process as new certificate request
      const request: SSLCertificateRequest = {
        domain,
        email: await this.getCompanyEmail(companyId),
        challengeType: 'http-01', // Prefer HTTP for renewal
        companyId,
      };

      return this.requestCertificate(request);
    } catch (error) {
      logger.error('Failed to renew SSL certificate:', error);
      throw error;
    }
  }

  // Auto-renew certificates that are expiring soon
  async autoRenewCertificates(): Promise<void> {
    try {
      const expiringSoon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const certificatesToRenew = await prisma.sSLCertificate.findMany({
        where: {
          expiresAt: { lt: expiringSoon },
          autoRenew: true,
          renewalStatus: 'active',
        },
        include: {
          company: {
            select: { id: true, email: true },
          },
        },
      });

      logger.info(`Found ${certificatesToRenew.length} certificates to renew`);

      for (const cert of certificatesToRenew) {
        try {
          await this.renewCertificate(cert.domain, cert.companyId);

          // Update renewal status
          await prisma.sSLCertificate.update({
            where: { id: cert.id },
            data: {
              lastRenewedAt: new Date(),
              renewalStatus: 'active',
            },
          });
        } catch (error) {
          logger.error(`Failed to auto-renew certificate for ${cert.domain}:`, error);

          // Mark as failed
          await prisma.sSLCertificate.update({
            where: { id: cert.id },
            data: {
              renewalStatus: 'failed',
            },
          });
        }
      }
    } catch (error) {
      logger.error('Auto-renewal process failed:', error);
    }
  }

  // Get challenge for HTTP-01 verification
  getHTTPChallenge(domain: string): SSLChallenge | null {
    return this.challengeTokens.get(domain) || null;
  }

  // Validate certificate
  private async validateCertificate(cert: SSLCertificateResponse, domain: string): Promise<void> {
    try {
      // Basic validation - check dates and domain
      if (cert.expiresAt <= new Date()) {
        throw new Error('Certificate is already expired');
      }

      if (!cert.certificate.includes(domain)) {
        throw new Error('Certificate does not match domain');
      }

      // In production, you would validate the certificate chain
      logger.info('Certificate validation successful', { domain });
    } catch (error) {
      logger.error('Certificate validation failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private async verifyDomainOwnership(domain: string, companyId: string): Promise<void> {
    const mapping = await customDomainService.getDomainMapping(companyId);
    if (!mapping || mapping.customDomain !== domain || !mapping.isVerified) {
      throw new Error('Domain ownership not verified');
    }
  }

  private async generateChallenge(domain: string, type: 'http-01' | 'dns-01'): Promise<SSLChallenge> {
    // In production, this would generate real ACME challenge
    const token = this.generateRandomToken();
    const keyAuthorization = `${token}.${this.generateThumbprint()}`;

    const challenge: SSLChallenge = {
      type,
      token,
      keyAuthorization,
    };

    if (type === 'http-01') {
      challenge.challengeUrl = `/.well-known/acme-challenge/${token}`;
    }

    return challenge;
  }

  private async completeHTTPChallenge(challenge: SSLChallenge, domain: string): Promise<void> {
    // In production, this would serve the challenge file at the specified URL
    // For now, we'll simulate success
    logger.info('HTTP challenge completed', { domain, token: challenge.token });

    // Wait for Let's Encrypt to verify
    await this.waitForVerification(domain);
  }

  private async completeDNSChallenge(challenge: SSLChallenge, domain: string): Promise<void> {
    // In production, this would add TXT record to DNS
    logger.info('DNS challenge completed', { domain, token: challenge.token });

    // Wait for DNS propagation and Let's Encrypt verification
    await this.waitForVerification(domain);
  }

  private async requestCertificateFromACME(request: SSLCertificateRequest): Promise<SSLCertificateResponse> {
    // In production, this would make actual ACME request to Let's Encrypt
    // For now, return mock certificate
    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    return {
      certificate: `-----BEGIN CERTIFICATE-----\n${this.generateMockCertificate(request.domain)}\n-----END CERTIFICATE-----`,
      privateKey: `-----BEGIN PRIVATE KEY-----\n${this.generateMockPrivateKey()}\n-----END PRIVATE KEY-----`,
      chainCertificates: `-----BEGIN CERTIFICATE-----\n${this.generateMockChainCertificate()}\n-----END CERTIFICATE-----`,
      issuedAt,
      expiresAt,
      issuer: 'Let\'s Encrypt Authority X3',
    };
  }

  private async storeCertificateMetadata(cert: SSLCertificateResponse, companyId: string): Promise<void> {
    // This is handled by the customDomainService
    // We could add additional metadata storage here if needed
  }

  private async getCompanyEmail(companyId: string): Promise<string> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { email: true },
    });

    if (!company?.email) {
      throw new Error('Company email not found');
    }

    return company.email;
  }

  private async waitForVerification(domain: string): Promise<void> {
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private generateRandomToken(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private generateThumbprint(): string {
    // Mock thumbprint generation
    return 'mock_thumbprint_' + Math.random().toString(36).substring(2, 8);
  }

  private generateMockCertificate(domain: string): string {
    return `MIICiTCCAg+gAwIBAgIJAJ8l2Z2Z3Z3ZMAOGA1UEBhMCVVMxCzAJBgNVBAgTAkNB
    MRYwFAYDVQQHEw1TYW4gRnJhbmNpc2NvMRowGAYDVQQKExFMZXQncyBFbmNyeXB0
    IEF1dGhvcml0eSBYMzAeFw0xNjA5MDIwMDAwMDBaFw0xNjEyMDEwMDAwMDBaMBYx
    FDASBgNVBAMTC${domain}MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7VITN
    6rQJzB7KQG5WQP6Z`; // Truncated for brevity
  }

  private generateMockPrivateKey(): string {
    return `-----BEGIN PRIVATE KEY-----
    MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VITN6rQJzB7K
    QG5WQP6Z`; // Truncated for brevity
  }

  private generateMockChainCertificate(): string {
    return `-----BEGIN CERTIFICATE-----
    MIIEkjCCA3qgAwIBAgIQCgFBQgAAAVOFc2oLheynCDANBgkqhkiG9w0BAQsFADAW
    MQswCQYDVQQGEwJVUzAeFw0xNjA5MDIwMDAwMDBaFw0xNjEyMDEwMDAwMDBaMBYx
    FDASBgNVBAMTC${domain}MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7VITN
    6rQJzB7KQG5WQP6Z`; // Truncated for brevity
  }

  // Schedule auto-renewal (would be called by a cron job)
  async scheduleAutoRenewal(): Promise<void> {
    // In production, this would be called by a scheduled job
    // For now, just log that it would run
    logger.info('Auto-renewal scheduled (would run daily)');
  }

  // Get certificate expiry information
  async getCertificateExpiryInfo(domain: string): Promise<{
    expiresAt: Date;
    daysUntilExpiry: number;
    needsRenewal: boolean;
  } | null> {
    try {
      const cert = await prisma.sSLCertificate.findFirst({
        where: { domain },
        select: { expiresAt: true },
      });

      if (!cert) return null;

      const now = new Date();
      const daysUntilExpiry = Math.ceil((cert.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        expiresAt: cert.expiresAt,
        daysUntilExpiry,
        needsRenewal: daysUntilExpiry <= 30, // Renew if 30 days or less
      };
    } catch (error) {
      logger.error('Failed to get certificate expiry info:', error);
      return null;
    }
  }

  // Cleanup expired challenges
  cleanupExpiredChallenges(): void {
    // In production, this would clean up old challenge tokens
    const expiredDomains: string[] = [];

    for (const [domain, challenge] of this.challengeTokens) {
      // Challenges are typically valid for a short time
      // For now, just keep them for demo purposes
    }

    for (const domain of expiredDomains) {
      this.challengeTokens.delete(domain);
    }
  }
}

export const sslService = SSLService.getInstance();
export default sslService;