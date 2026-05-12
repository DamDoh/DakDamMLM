// Branding Cache Service
// Handles caching of branding assets and theme configurations for performance

import { BrandingConfig } from './branding-management-service';
import { logger } from '@/lib/logger';

export interface CachedBranding {
  config: BrandingConfig;
  themeCSS: string;
  logoUrls: string[];
  faviconUrl?: string;
  lastModified: Date;
  etag: string;
}

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size
  enableCDN: boolean;
  cdnUrl?: string;
}

class BrandingCacheService {
  private static instance: BrandingCacheService;
  private cache = new Map<string, CachedBranding>();
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      ttl: 3600, // 1 hour default
      maxSize: 100, // 100 companies
      enableCDN: process.env.CDN_ENABLED === 'true',
      cdnUrl: process.env.CDN_URL,
    };

    this.startCleanupInterval();
  }

  static getInstance(): BrandingCacheService {
    if (!BrandingCacheService.instance) {
      BrandingCacheService.instance = new BrandingCacheService();
    }
    return BrandingCacheService.instance;
  }

  // Get cached branding for a company
  async getCachedBranding(companyId: string): Promise<CachedBranding | null> {
    const cached = this.cache.get(companyId);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (this.isExpired(cached)) {
      this.cache.delete(companyId);
      return null;
    }

    return cached;
  }

  // Set branding in cache
  async setCachedBranding(companyId: string, config: BrandingConfig, themeCSS: string): Promise<void> {
    try {
      // Check cache size limit
      if (this.cache.size >= this.config.maxSize) {
        this.evictOldest();
      }

      const logoUrls = this.extractLogoUrls(config);
      const etag = this.generateETag(config, themeCSS);

      const cachedBranding: CachedBranding = {
        config,
        themeCSS,
        logoUrls,
        faviconUrl: config.faviconUrl,
        lastModified: new Date(),
        etag,
      };

      this.cache.set(companyId, cachedBranding);

      logger.info('Branding cached successfully', {
        companyId,
        cacheSize: this.cache.size,
        etag,
      });
    } catch (error) {
      logger.error('Failed to cache branding:', error);
    }
  }

  // Get cached theme CSS with proper headers
  async getCachedThemeCSS(companyId: string): Promise<{
    css: string;
    headers: Record<string, string>;
  } | null> {
    const cached = await this.getCachedBranding(companyId);

    if (!cached) {
      return null;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'text/css',
      'Cache-Control': `public, max-age=${this.config.ttl}`,
      'ETag': cached.etag,
      'Last-Modified': cached.lastModified.toUTCString(),
    };

    // Add CDN headers if enabled
    if (this.config.enableCDN && this.config.cdnUrl) {
      headers['CDN-Cache-Control'] = `max-age=${this.config.ttl * 4}`; // Longer CDN cache
    }

    return {
      css: cached.themeCSS,
      headers,
    };
  }

  // Get cached logo URL with CDN transformation if available
  async getCachedLogoUrl(companyId: string, logoType: 'logo' | 'favicon' | 'header' | 'footer'): Promise<string | null> {
    const cached = await this.getCachedBranding(companyId);

    if (!cached) {
      return null;
    }

    let logoUrl: string | undefined;

    switch (logoType) {
      case 'logo':
        logoUrl = cached.config.logoUrl;
        break;
      case 'favicon':
        logoUrl = cached.faviconUrl;
        break;
      case 'header':
        logoUrl = cached.config.headerLogoUrl;
        break;
      case 'footer':
        logoUrl = cached.config.footerLogoUrl;
        break;
    }

    if (!logoUrl) {
      return null;
    }

    // Apply CDN transformation if enabled
    if (this.config.enableCDN && this.config.cdnUrl) {
      return this.applyCDNTransformation(logoUrl, logoType);
    }

    return logoUrl;
  }

  // Invalidate cache for a company
  async invalidateCache(companyId: string): Promise<void> {
    const deleted = this.cache.delete(companyId);

    if (deleted) {
      logger.info('Branding cache invalidated', { companyId });

      // Invalidate CDN cache if enabled
      if (this.config.enableCDN) {
        await this.invalidateCDNCache(companyId);
      }
    }
  }

  // Clear all cache
  async clearAllCache(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();

    logger.info('All branding cache cleared', { previousSize: size });

    // Clear CDN cache if enabled
    if (this.config.enableCDN) {
      await this.clearCDNCache();
    }
  }

  // Warm up cache for active companies
  async warmupCache(activeCompanyIds: string[]): Promise<void> {
    logger.info('Starting cache warmup', { companies: activeCompanyIds.length });

    // In a real implementation, this would fetch and cache branding for active companies
    // For now, just log the action
    for (const companyId of activeCompanyIds) {
      // Simulate cache warmup
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    logger.info('Cache warmup completed');
  }

  // Get cache statistics
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
    totalRequests?: number;
    cacheHits?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      // In a real implementation, you'd track hit rates
    };
  }

  // Update cache configuration
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Cache configuration updated', newConfig);
  }

  // Private helper methods

  private isExpired(cached: CachedBranding): boolean {
    const now = new Date();
    const expiryTime = new Date(cached.lastModified.getTime() + this.config.ttl * 1000);
    return now > expiryTime;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();

    for (const [key, cached] of this.cache) {
      if (cached.lastModified < oldestTime) {
        oldestTime = cached.lastModified;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.info('Evicted oldest cache entry', { companyId: oldestKey });
    }
  }

  private extractLogoUrls(config: BrandingConfig): string[] {
    const urls: string[] = [];

    if (config.logoUrl) urls.push(config.logoUrl);
    if (config.faviconUrl) urls.push(config.faviconUrl);
    if (config.headerLogoUrl) urls.push(config.headerLogoUrl);
    if (config.footerLogoUrl) urls.push(config.footerLogoUrl);

    return urls;
  }

  private generateETag(config: BrandingConfig, themeCSS: string): string {
    const content = JSON.stringify(config) + themeCSS;
    let hash = 0;

    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `"${Math.abs(hash).toString(36)}"`;
  }

  private applyCDNTransformation(url: string, logoType: string): string {
    if (!this.config.cdnUrl) return url;

    // Apply CDN transformations based on logo type
    const transformations: Record<string, string> = {
      logo: 'w_200,h_80,c_fit',
      favicon: 'w_32,h_32,c_fit',
      header: 'w_150,h_50,c_fit',
      footer: 'w_150,h_50,c_fit',
    };

    const transform = transformations[logoType] || '';
    const separator = url.includes('?') ? '&' : '?';

    return `${this.config.cdnUrl}${url}${separator}${transform}`;
  }

  private async invalidateCDNCache(companyId: string): Promise<void> {
    // In a real implementation, this would call CDN API to invalidate cache
    logger.info('CDN cache invalidated', { companyId });
  }

  private async clearCDNCache(): Promise<void> {
    // In a real implementation, this would clear entire CDN cache
    logger.info('CDN cache cleared');
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const beforeSize = this.cache.size;
    const now = new Date();

    for (const [key, cached] of this.cache) {
      const expiryTime = new Date(cached.lastModified.getTime() + this.config.ttl * 1000);
      if (now > expiryTime) {
        this.cache.delete(key);
      }
    }

    const removed = beforeSize - this.cache.size;
    if (removed > 0) {
      logger.info('Cleaned up expired cache entries', { removed });
    }
  }

  // Cleanup on process exit
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const brandingCacheService = BrandingCacheService.getInstance();
export default brandingCacheService;