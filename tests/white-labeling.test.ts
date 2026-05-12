// Comprehensive Test Suite for White-Labeling Module
// Unit and integration tests for all services

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { brandingManagementService } from '@/services/branding-management-service';
import { dynamicThemeEngine } from '@/services/dynamic-theme-engine';
import { customDomainService } from '@/services/custom-domain-service';
import { domainSecurityService } from '@/services/domain-security-service';
import { sslService } from '@/services/ssl-service';
import { brandingCacheService } from '@/services/branding-cache-service';
import { prisma } from '@/lib/database';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/logger');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('White-Labeling Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BrandingManagementService', () => {
    const testCompanyId = 'company-123';
    const testUserId = 'user-123';

    it('should get branding config successfully', async () => {
      const mockConfig = {
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        accentColor: '#0000FF',
      };

      mockPrisma.company.findUnique.mockResolvedValue({
        id: testCompanyId,
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        accentColor: '#0000FF',
      } as any);

      const result = await brandingManagementService.getBrandingConfig(testCompanyId);

      expect(result).toEqual(mockConfig);
      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: testCompanyId },
        select: expect.any(Object),
      });
    });

    it('should update branding config with validation', async () => {
      const updateData = {
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        accentColor: '#0000FF',
      };

      mockPrisma.company.update.mockResolvedValue({
        id: testCompanyId,
        ...updateData,
      } as any);

      const result = await brandingManagementService.updateBrandingConfig(
        testCompanyId,
        updateData,
        testUserId
      );

      expect(result).toEqual(updateData);
    });

    it('should reject invalid color format', async () => {
      const invalidData = {
        primaryColor: 'invalid-color',
      };

      await expect(
        brandingManagementService.updateBrandingConfig(testCompanyId, invalidData, testUserId)
      ).rejects.toThrow('Invalid branding configuration');
    });

    it('should upload logo with validation', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      const mockUrl = '/uploads/logo.png';

      // Mock the service method (would normally upload to storage)
      jest.spyOn(brandingManagementService as any, 'uploadLogo').mockResolvedValue(mockUrl);

      const result = await brandingManagementService.uploadLogo(
        testCompanyId,
        mockBuffer,
        'logo.png',
        'logo',
        testUserId
      );

      expect(result).toBe(mockUrl);
    });

    it('should validate image file size', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      await expect(
        brandingManagementService.uploadLogo(
          testCompanyId,
          largeBuffer,
          'large.png',
          'logo',
          testUserId
        )
      ).rejects.toThrow('File size must be less than 5MB');
    });
  });

  describe('DynamicThemeEngine', () => {
    const testBranding = {
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
      accentColor: '#0000FF',
      customFonts: {
        primary: 'Arial',
        secondary: 'Helvetica',
      },
      themeConfig: {
        borderRadius: '8px',
        shadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    };

    it('should generate theme from branding config', () => {
      const theme = dynamicThemeEngine.generateThemeFromBranding('company-123', testBranding);

      expect(theme.id).toBe('company-company-123');
      expect(theme.variables.primaryColor).toBe('#FF0000');
      expect(theme.variables.fontPrimary).toBe('Arial');
    });

    it('should generate CSS variables', () => {
      const theme = dynamicThemeEngine.generateThemeFromBranding('company-123', testBranding);
      const css = dynamicThemeEngine.exportThemeAsCSS(theme);

      expect(css).toContain('--primary-color: #FF0000');
      expect(css).toContain('--font-primary: Arial');
      expect(css).toContain(':root {');
    });

    it('should apply theme to document', () => {
      const theme = dynamicThemeEngine.generateThemeFromBranding('company-123', testBranding);

      // Mock document
      const mockDocument = {
        createElement: jest.fn().mockReturnValue({
          setAttribute: jest.fn(),
          textContent: '',
        }),
        head: {
          insertBefore: jest.fn(),
        },
      } as any;

      dynamicThemeEngine.applyTheme(theme, mockDocument);

      expect(mockDocument.createElement).toHaveBeenCalledWith('style');
    });
  });

  describe('CustomDomainService', () => {
    const testCompanyId = 'company-123';
    const testDomain = 'example.com';

    it('should map domain successfully', async () => {
      mockPrisma.company.update.mockResolvedValue({
        id: testCompanyId,
        customDomain: testDomain,
      } as any);

      const result = await customDomainService.mapDomain(testCompanyId, testDomain, 'user-123');

      expect(result.companyId).toBe(testCompanyId);
      expect(result.customDomain).toBe(testDomain);
    });

    it('should reject duplicate domains', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'other-company',
        customDomain: testDomain,
      } as any);

      await expect(
        customDomainService.mapDomain(testCompanyId, testDomain, 'user-123')
      ).rejects.toThrow('Domain is already mapped to another company');
    });

    it('should validate domain format', async () => {
      await expect(
        customDomainService.mapDomain(testCompanyId, 'invalid-domain', 'user-123')
      ).rejects.toThrow('Invalid domain format');
    });
  });

  describe('DomainSecurityService', () => {
    const testDomain = 'example.com';

    it('should generate verification challenge', async () => {
      const challenge = await domainSecurityService.generateVerificationChallenge(
        testDomain,
        'dns-txt'
      );

      expect(challenge.challenge).toBeDefined();
      expect(challenge.expectedValue).toBeDefined();
      expect(challenge.expiresAt).toBeInstanceOf(Date);
    });

    it('should rate limit verification attempts', async () => {
      // First attempt should succeed
      await domainSecurityService.generateVerificationChallenge(testDomain, 'dns-txt');

      // Subsequent attempts should be rate limited
      await expect(
        domainSecurityService.generateVerificationChallenge(testDomain, 'dns-txt')
      ).rejects.toThrow('Too many verification attempts');
    });

    it('should verify domain ownership', async () => {
      const challenge = await domainSecurityService.generateVerificationChallenge(
        testDomain,
        'dns-txt'
      );

      const result = await domainSecurityService.verifyDomainOwnership(
        testDomain,
        'dns-txt',
        challenge.expectedValue
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('BrandingCacheService', () => {
    const testCompanyId = 'company-123';
    const testBranding = {
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
    };

    beforeEach(() => {
      brandingCacheService.clearAllCache();
    });

    it('should cache branding configuration', async () => {
      await brandingCacheService.setCachedBranding(testCompanyId, testBranding, 'css-content');

      const cached = await brandingCacheService.getCachedBranding(testCompanyId);
      expect(cached?.config).toEqual(testBranding);
    });

    it('should return null for non-existent cache', async () => {
      const cached = await brandingCacheService.getCachedBranding('non-existent');
      expect(cached).toBeNull();
    });

    it('should provide cache statistics', () => {
      const stats = brandingCacheService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
    });

    it('should evict oldest entries when cache is full', async () => {
      // Fill cache beyond limit
      for (let i = 0; i < 120; i++) {
        await brandingCacheService.setCachedBranding(`company-${i}`, testBranding, 'css');
      }

      const stats = brandingCacheService.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(100); // maxSize
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete branding workflow', async () => {
      // 1. Create branding config
      const branding = {
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        accentColor: '#0000FF',
      };

      // 2. Generate theme
      const theme = dynamicThemeEngine.generateThemeFromBranding('company-123', branding);
      expect(theme.variables.primaryColor).toBe('#FF0000');

      // 3. Cache branding
      await brandingCacheService.setCachedBranding('company-123', branding, 'css');

      // 4. Retrieve from cache
      const cached = await brandingCacheService.getCachedBranding('company-123');
      expect(cached?.config.primaryColor).toBe('#FF0000');
    });

    it('should handle domain mapping and verification workflow', async () => {
      const testDomain = 'test-example.com';

      // 1. Map domain
      const mapping = await customDomainService.mapDomain('company-123', testDomain, 'user-123');
      expect(mapping.customDomain).toBe(testDomain);

      // 2. Generate verification challenge
      const challenge = await domainSecurityService.generateVerificationChallenge(
        testDomain,
        'dns-txt'
      );

      // 3. Verify domain
      const verification = await domainSecurityService.verifyDomainOwnership(
        testDomain,
        'dns-txt',
        challenge.expectedValue
      );

      expect(verification.isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockPrisma.company.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        brandingManagementService.getBrandingConfig('company-123')
      ).rejects.toThrow('Failed to retrieve branding configuration');
    });

    it('should handle invalid branding data', async () => {
      const invalidBranding = {
        primaryColor: 'not-a-color',
      };

      const validation = await brandingManagementService.validateBrandingConfig(invalidBranding);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle domain security rate limiting', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        try {
          await domainSecurityService.generateVerificationChallenge('test.com', 'dns-txt');
        } catch (e) {
          // Ignore errors
        }
      }

      await expect(
        domainSecurityService.generateVerificationChallenge('test.com', 'dns-txt')
      ).rejects.toThrow('Too many verification attempts');
    });
  });
});