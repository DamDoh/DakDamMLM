// Tenant Routing Middleware
// Handles domain-based tenant identification and request routing

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { customDomainService } from './custom-domain-service';
import { brandingManagementService } from './branding-management-service';
import { dynamicThemeEngine } from './dynamic-theme-engine';

export interface TenantContext {
  companyId: string;
  companyName: string;
  customDomain?: string;
  isCustomDomain: boolean;
  branding?: any;
  theme?: any;
}

class TenantRoutingMiddleware {
  private static instance: TenantRoutingMiddleware;
  private tenantCache = new Map<string, TenantContext>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): TenantRoutingMiddleware {
    if (!TenantRoutingMiddleware.instance) {
      TenantRoutingMiddleware.instance = new TenantRoutingMiddleware();
    }
    return TenantRoutingMiddleware.instance;
  }

  // Main middleware function
  async handleRequest(request: NextRequest): Promise<NextResponse> {
    try {
      const hostname = this.extractHostname(request);
      const tenantContext = await this.resolveTenant(hostname);

      if (!tenantContext) {
        // No tenant found for this domain
        return this.handleUnknownTenant(request);
      }

      // Add tenant context to request headers for downstream use
      const response = NextResponse.next();
      response.headers.set('X-Tenant-ID', tenantContext.companyId);
      response.headers.set('X-Tenant-Name', tenantContext.companyName);
      response.headers.set('X-Custom-Domain', tenantContext.isCustomDomain.toString());

      // Apply branding if available
      if (tenantContext.branding) {
        await this.applyTenantBranding(tenantContext, response);
      }

      // Log tenant access for analytics
      this.logTenantAccess(tenantContext, request);

      return response;
    } catch (error) {
      logger.error('Tenant routing middleware error:', error);
      return NextResponse.next(); // Continue with default routing
    }
  }

  // Extract hostname from request
  private extractHostname(request: NextRequest): string {
    const host = request.headers.get('host') || '';
    return host.split(':')[0].toLowerCase(); // Remove port if present
  }

  // Resolve tenant from hostname
  private async resolveTenant(hostname: string): Promise<TenantContext | null> {
    // Check cache first
    const cached = this.tenantCache.get(hostname);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    try {
      let company = null;
      let isCustomDomain = false;

      // Check if it's a custom domain
      company = await prisma.company.findFirst({
        where: {
          customDomain: hostname,
          customDomainVerified: true,
        },
        select: {
          id: true,
          name: true,
          customDomain: true,
          customDomainVerified: true,
        },
      });

      if (company) {
        isCustomDomain = true;
      } else {
        // Check if it's a subdomain of the main platform
        const subdomain = this.extractSubdomain(hostname);
        if (subdomain) {
          company = await prisma.company.findFirst({
            where: {
              name: {
                equals: subdomain,
                mode: 'insensitive',
              },
            },
            select: {
              id: true,
              name: true,
              customDomain: true,
              customDomainVerified: true,
            },
          });
        }
      }

      if (!company) {
        return null;
      }

      // Get branding configuration
      const branding = await brandingManagementService.getBrandingConfig(company.id);

      const tenantContext: TenantContext = {
        companyId: company.id,
        companyName: company.name,
        customDomain: company.customDomain || undefined,
        isCustomDomain,
        branding,
      };

      // Cache the result
      this.tenantCache.set(hostname, { ...tenantContext, _cachedAt: Date.now() });

      return tenantContext;
    } catch (error) {
      logger.error('Failed to resolve tenant:', error);
      return null;
    }
  }

  // Extract subdomain from hostname
  private extractSubdomain(hostname: string): string | null {
    const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'localhost';
    const mainDomainParts = mainDomain.split('.');

    if (mainDomainParts.length < 2) return null;

    const hostnameParts = hostname.split('.');

    // Check if hostname is a subdomain of main domain
    if (hostnameParts.length === mainDomainParts.length + 1) {
      const subdomain = hostnameParts[0];
      const domainPart = hostnameParts.slice(1).join('.');

      if (domainPart === mainDomain) {
        return subdomain;
      }
    }

    return null;
  }

  // Handle unknown tenant
  private handleUnknownTenant(request: NextRequest): NextResponse {
    const hostname = this.extractHostname(request);

    // Log unknown domain access
    logger.warn('Access to unknown domain', {
      hostname,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    // Return 404 for unknown domains
    return new NextResponse('Domain not found', { status: 404 });
  }

  // Apply tenant branding
  private async applyTenantBranding(tenantContext: TenantContext, response: NextResponse): Promise<void> {
    try {
      if (!tenantContext.branding) return;

      // Generate theme from branding config
      const theme = dynamicThemeEngine.generateThemeFromBranding(
        tenantContext.companyId,
        tenantContext.branding
      );

      // Add theme CSS to response
      const themeCSS = dynamicThemeEngine.exportThemeAsCSS(theme);

      // Inject theme CSS into HTML response
      // Note: This is a simplified version. In production, you'd modify the HTML stream
      response.headers.set('X-Theme-CSS', Buffer.from(themeCSS).toString('base64'));

    } catch (error) {
      logger.error('Failed to apply tenant branding:', error);
    }
  }

  // Log tenant access for analytics
  private logTenantAccess(tenantContext: TenantContext, request: NextRequest): void {
    try {
      // Log basic access metrics (in production, you'd use a proper analytics service)
      logger.info('Tenant access', {
        companyId: tenantContext.companyId,
        companyName: tenantContext.companyName,
        hostname: this.extractHostname(request),
        isCustomDomain: tenantContext.isCustomDomain,
        path: request.nextUrl.pathname,
        method: request.method,
        userAgent: request.headers.get('user-agent')?.substring(0, 200), // Truncate
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to log tenant access:', error);
    }
  }

  // Check if cache entry is still valid
  private isCacheValid(context: any): boolean {
    if (!context._cachedAt) return false;
    return Date.now() - context._cachedAt < this.cacheExpiry;
  }

  // Get tenant context from request (for use in API routes and pages)
  async getTenantFromRequest(request: NextRequest): Promise<TenantContext | null> {
    const hostname = this.extractHostname(request);
    return this.resolveTenant(hostname);
  }

  // Get tenant context by ID
  async getTenantById(companyId: string): Promise<TenantContext | null> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          customDomain: true,
          customDomainVerified: true,
        },
      });

      if (!company) return null;

      const branding = await brandingManagementService.getBrandingConfig(companyId);

      return {
        companyId: company.id,
        companyName: company.name,
        customDomain: company.customDomain || undefined,
        isCustomDomain: !!company.customDomain,
        branding,
      };
    } catch (error) {
      logger.error('Failed to get tenant by ID:', error);
      return null;
    }
  }

  // Clear tenant cache (useful for testing or when tenant data changes)
  clearCache(): void {
    this.tenantCache.clear();
    logger.info('Tenant cache cleared');
  }

  // Health check
  async healthCheck(): Promise<{ status: string; cachedTenants: number }> {
    return {
      status: 'healthy',
      cachedTenants: this.tenantCache.size,
    };
  }

  // Security middleware to prevent domain hijacking
  async validateTenantAccess(request: NextRequest, requiredCompanyId?: string): Promise<boolean> {
    try {
      const tenantContext = await this.getTenantFromRequest(request);

      if (!tenantContext) {
        return false;
      }

      // If a specific company ID is required, check it matches
      if (requiredCompanyId && tenantContext.companyId !== requiredCompanyId) {
        logger.warn('Tenant access violation', {
          requestedCompanyId: requiredCompanyId,
          actualCompanyId: tenantContext.companyId,
          hostname: this.extractHostname(request),
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Tenant access validation failed:', error);
      return false;
    }
  }

  // Get all tenant domains for SSL certificate management
  async getAllTenantDomains(): Promise<Array<{ companyId: string; domain: string; hasSSL: boolean }>> {
    try {
      const companies = await prisma.company.findMany({
        where: {
          OR: [
            { customDomain: { not: null } },
            { customDomainVerified: true },
          ],
        },
        select: {
          id: true,
          customDomain: true,
          sslCertificate: {
            select: { id: true },
          },
        },
      });

      return companies
        .filter(company => company.customDomain)
        .map(company => ({
          companyId: company.id,
          domain: company.customDomain!,
          hasSSL: !!company.sslCertificate,
        }));
    } catch (error) {
      logger.error('Failed to get tenant domains:', error);
      return [];
    }
  }
}

// Export middleware function for Next.js
export async function tenantRoutingMiddleware(request: NextRequest): Promise<NextResponse> {
  const middleware = TenantRoutingMiddleware.getInstance();
  return middleware.handleRequest(request);
}

export const tenantRouting = TenantRoutingMiddleware.getInstance();
export default tenantRouting;