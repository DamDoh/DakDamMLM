// Custom Domain Service
// Handles domain mapping, SSL certificate automation, and DNS validation

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { SSLCertificate } from '@prisma/client';

export interface DomainMapping {
  companyId: string;
  customDomain: string;
  isVerified: boolean;
  sslCertificate?: SSLCertificate;
  createdAt: Date;
  verifiedAt?: Date;
}

export interface DNSRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  ttl?: number;
}

export interface DomainVerificationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dnsRecords: DNSRecord[];
}

export interface SSLRequest {
  domain: string;
  email: string;
  challengeType: 'http-01' | 'dns-01';
}

class CustomDomainService {
  private static instance: CustomDomainService;

  private constructor() {}

  static getInstance(): CustomDomainService {
    if (!CustomDomainService.instance) {
      CustomDomainService.instance = new CustomDomainService();
    }
    return CustomDomainService.instance;
  }

  // Map custom domain to company
  async mapDomain(companyId: string, customDomain: string, requestedBy: string): Promise<DomainMapping> {
    try {
      // Validate domain format
      if (!this.isValidDomain(customDomain)) {
        throw new Error('Invalid domain format');
      }

      // Check if domain is already mapped
      const existingMapping = await prisma.company.findFirst({
        where: { customDomain },
      });

      if (existingMapping && existingMapping.id !== companyId) {
        throw new Error('Domain is already mapped to another company');
      }

      // Update company with custom domain
      const updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: {
          customDomain,
          customDomainVerified: false,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          customDomain: true,
          customDomainVerified: true,
          sslCertificate: true,
          createdAt: true,
        },
      });

      const mapping: DomainMapping = {
        companyId: updatedCompany.id,
        customDomain: updatedCompany.customDomain!,
        isVerified: updatedCompany.customDomainVerified,
        sslCertificate: updatedCompany.sslCertificate || undefined,
        createdAt: updatedCompany.createdAt,
      };

      logger.info('Custom domain mapped successfully', {
        companyId,
        customDomain,
        requestedBy,
      });

      return mapping;
    } catch (error) {
      logger.error('Failed to map custom domain:', error);
      throw error;
    }
  }

  // Verify domain ownership
  async verifyDomainOwnership(companyId: string, verifiedBy: string): Promise<DomainVerificationResult> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          customDomain: true,
          customDomainVerified: true,
        },
      });

      if (!company?.customDomain) {
        throw new Error('No custom domain configured for this company');
      }

      const domain = company.customDomain;
      const result: DomainVerificationResult = {
        isValid: false,
        errors: [],
        warnings: [],
        dnsRecords: [],
      };

      // Check DNS records
      const dnsCheck = await this.checkDNSRecords(domain);
      result.dnsRecords = dnsCheck.records;

      if (!dnsCheck.isValid) {
        result.errors.push(...dnsCheck.errors);
      }

      // Check SSL certificate
      const sslCheck = await this.checkSSLCertificate(domain);
      if (!sslCheck.isValid) {
        result.warnings.push(...sslCheck.warnings);
      }

      // If all checks pass, mark domain as verified
      if (dnsCheck.isValid && result.errors.length === 0) {
        result.isValid = true;

        // Update company verification status
        await prisma.company.update({
          where: { id: companyId },
          data: {
            customDomainVerified: true,
            updatedAt: new Date(),
          },
        });

        logger.info('Domain verification successful', {
          companyId,
          domain,
          verifiedBy,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to verify domain ownership:', error);
      throw error;
    }
  }

  // Request SSL certificate
  async requestSSLCertificate(companyId: string, request: SSLRequest, requestedBy: string): Promise<SSLCertificate> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          customDomain: true,
          email: true,
        },
      });

      if (!company?.customDomain) {
        throw new Error('No custom domain configured for SSL certificate request');
      }

      // Verify domain ownership first
      const verification = await this.verifyDomainOwnership(companyId, requestedBy);
      if (!verification.isValid) {
        throw new Error('Domain ownership verification failed. Cannot issue SSL certificate.');
      }

      // Check if certificate already exists
      const existingCert = await prisma.sSLCertificate.findUnique({
        where: { domain: request.domain },
      });

      if (existingCert && existingCert.expiresAt > new Date()) {
        throw new Error('SSL certificate already exists and is still valid');
      }

      // In a real implementation, this would integrate with Let's Encrypt
      // For now, we'll simulate certificate generation
      const certificate = await this.generateSSLCertificate(request);

      // Store certificate in database
      const savedCertificate = await prisma.sSLCertificate.create({
        data: {
          domain: certificate.domain,
          certificateData: certificate.certificateData,
          privateKey: certificate.privateKey,
          chainCertificates: certificate.chainCertificates,
          issuedBy: certificate.issuedBy,
          issuedAt: certificate.issuedAt,
          expiresAt: certificate.expiresAt,
          autoRenew: certificate.autoRenew,
          companyId,
        },
      });

      // Update company with certificate reference
      await prisma.company.update({
        where: { id: companyId },
        data: {
          sslCertificateId: savedCertificate.id,
          updatedAt: new Date(),
        },
      });

      logger.info('SSL certificate issued successfully', {
        companyId,
        domain: request.domain,
        requestedBy,
      });

      return savedCertificate;
    } catch (error) {
      logger.error('Failed to request SSL certificate:', error);
      throw error;
    }
  }

  // Renew SSL certificate
  async renewSSLCertificate(certificateId: string, renewedBy: string): Promise<SSLCertificate> {
    try {
      const certificate = await prisma.sSLCertificate.findUnique({
        where: { id: certificateId },
        include: { company: true },
      });

      if (!certificate) {
        throw new Error('SSL certificate not found');
      }

      // Check if renewal is needed (30 days before expiry)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      if (certificate.expiresAt > thirtyDaysFromNow) {
        throw new Error('Certificate does not need renewal yet');
      }

      // Simulate certificate renewal
      const renewedCert = await this.renewSSLCertificateData(certificate);

      // Update certificate in database
      const updatedCertificate = await prisma.sSLCertificate.update({
        where: { id: certificateId },
        data: {
          certificateData: renewedCert.certificateData,
          privateKey: renewedCert.privateKey,
          chainCertificates: renewedCert.chainCertificates,
          issuedAt: renewedCert.issuedAt,
          expiresAt: renewedCert.expiresAt,
          lastRenewedAt: new Date(),
          renewalStatus: 'active',
          updatedAt: new Date(),
        },
      });

      logger.info('SSL certificate renewed successfully', {
        certificateId,
        domain: certificate.domain,
        renewedBy,
      });

      return updatedCertificate;
    } catch (error) {
      logger.error('Failed to renew SSL certificate:', error);
      throw error;
    }
  }

  // Get domain mapping for a company
  async getDomainMapping(companyId: string): Promise<DomainMapping | null> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          customDomain: true,
          customDomainVerified: true,
          sslCertificate: true,
          createdAt: true,
        },
      });

      if (!company?.customDomain) {
        return null;
      }

      return {
        companyId: company.id,
        customDomain: company.customDomain,
        isVerified: company.customDomainVerified,
        sslCertificate: company.sslCertificate || undefined,
        createdAt: company.createdAt,
      };
    } catch (error) {
      logger.error('Failed to get domain mapping:', error);
      return null;
    }
  }

  // Get DNS configuration guide
  getDNSConfigurationGuide(domain: string): DNSRecord[] {
    const baseDomain = domain.replace(/^www\./, '');

    return [
      {
        type: 'A',
        name: baseDomain,
        value: process.env.APP_PUBLIC_IP || 'YOUR_SERVER_IP',
        ttl: 300,
      },
      {
        type: 'CNAME',
        name: `www.${baseDomain}`,
        value: baseDomain,
        ttl: 300,
      },
      {
        type: 'TXT',
        name: `_acme-challenge.${baseDomain}`,
        value: 'PLACEHOLDER_FOR_LETS_ENCRYPT_CHALLENGE',
        ttl: 300,
      },
    ];
  }

  // Private helper methods

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  private async checkDNSRecords(domain: string): Promise<{ isValid: boolean; records: DNSRecord[]; errors: string[] }> {
    // In a real implementation, this would query DNS servers
    // For now, we'll simulate DNS checking
    const records: DNSRecord[] = [];
    const errors: string[] = [];

    try {
      // Simulate A record check
      const aRecord = await this.simulateDNSLookup(domain, 'A');
      if (aRecord) {
        records.push({
          type: 'A',
          name: domain,
          value: aRecord,
        });
      } else {
        errors.push('A record not found for domain');
      }

      // Simulate CNAME check for www subdomain
      if (domain.startsWith('www.')) {
        const cnameRecord = await this.simulateDNSLookup(domain, 'CNAME');
        if (cnameRecord) {
          records.push({
            type: 'CNAME',
            name: domain,
            value: cnameRecord,
          });
        }
      }

      return {
        isValid: errors.length === 0,
        records,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        records,
        errors: ['DNS lookup failed'],
      };
    }
  }

  private async checkSSLCertificate(domain: string): Promise<{ isValid: boolean; warnings: string[] }> {
    try {
      // In a real implementation, this would check certificate validity
      // For now, we'll simulate SSL checking
      const warnings: string[] = [];

      // Simulate certificate expiry check
      const certExpiry = new Date();
      certExpiry.setFullYear(certExpiry.getFullYear() + 1); // Simulate valid cert

      if (certExpiry < new Date()) {
        warnings.push('SSL certificate has expired');
      }

      return {
        isValid: warnings.length === 0,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        warnings: ['SSL certificate check failed'],
      };
    }
  }

  private async generateSSLCertificate(request: SSLRequest): Promise<{
    domain: string;
    certificateData: string;
    privateKey: string;
    chainCertificates?: string;
    issuedBy: string;
    issuedAt: Date;
    expiresAt: Date;
    autoRenew: boolean;
  }> {
    // In a real implementation, this would integrate with Let's Encrypt ACME
    // For now, we'll generate a mock certificate

    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Valid for 1 year

    return {
      domain: request.domain,
      certificateData: `-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE_DATA\n-----END CERTIFICATE-----`,
      privateKey: `-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY_DATA\n-----END PRIVATE KEY-----`,
      chainCertificates: `-----BEGIN CERTIFICATE-----\nMOCK_CHAIN_CERTIFICATE_DATA\n-----END CERTIFICATE-----`,
      issuedBy: 'Let\'s Encrypt',
      issuedAt,
      expiresAt,
      autoRenew: true,
    };
  }

  private async renewSSLCertificateData(existingCert: SSLCertificate): Promise<{
    certificateData: string;
    privateKey: string;
    chainCertificates?: string;
    issuedAt: Date;
    expiresAt: Date;
  }> {
    // Simulate certificate renewal
    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    return {
      certificateData: `-----BEGIN CERTIFICATE-----\nRENEWED_MOCK_CERTIFICATE_DATA\n-----END CERTIFICATE-----`,
      privateKey: `-----BEGIN PRIVATE KEY-----\nRENEWED_MOCK_PRIVATE_KEY_DATA\n-----END PRIVATE KEY-----`,
      chainCertificates: `-----BEGIN CERTIFICATE-----\nRENEWED_MOCK_CHAIN_CERTIFICATE_DATA\n-----END CERTIFICATE-----`,
      issuedAt,
      expiresAt,
    };
  }

  private async simulateDNSLookup(domain: string, type: 'A' | 'CNAME'): Promise<string | null> {
    // Simulate DNS lookup delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate successful lookup for demo purposes
    if (type === 'A') {
      return process.env.APP_PUBLIC_IP || '192.168.1.100';
    } else if (type === 'CNAME') {
      return domain.replace('www.', '');
    }

    return null;
  }
}

export const customDomainService = CustomDomainService.getInstance();
export default customDomainService;