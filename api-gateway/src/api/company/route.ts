import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { validateTaxId } from '@/lib/tax-id-validator';
import { z } from 'zod';

const createCompanySchema = z.object({
  name: z.string().min(2).max(100),
  domain: z.string().optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().min(5).max(20),
  taxId: z.string().max(50).optional(),
  licenseNumber: z.string().max(50).optional(),
  industry: z.string().max(100).optional(),
  country: z.string().min(2).max(2), // ISO country code
  currency: z.string().min(3).max(3), // ISO currency code
  timezone: z.string().min(1),
  logoUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for company creation
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 60 * 1000, maxRequests: 5 }); // 5 per hour
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for company creation', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize super admin access
    const authenticatedRequest = await requireSuperAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    // Check if user is authenticated and is super admin
    if (authenticatedRequest.status === 401) {
      return authenticatedRequest;
    }
    if (authenticatedRequest.status === 403) {
      logger.warn('Non-super-admin attempted to create company', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return authenticatedRequest;
    }

    const body = await request.json();
    const validatedData = createCompanySchema.parse(body);

    // Additional validation for domain format if provided
    if (validatedData.domain && !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*$/.test(validatedData.domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format. Only alphanumeric characters and hyphens allowed.' },
        { status: 400 }
      );
    }

    // Validate tax ID format based on country
    if (validatedData.taxId) {
      const taxIdValidation = validateTaxId(validatedData.taxId, validatedData.country);
      if (!taxIdValidation.isValid) {
        return NextResponse.json(
          { error: taxIdValidation.error },
          { status: 400 }
        );
      }
    }

    // Validate license number if provided
    if (validatedData.licenseNumber && validatedData.licenseNumber.length < 5) {
      return NextResponse.json(
        { error: 'License number must be at least 5 characters' },
        { status: 400 }
      );
    }

    // Check if company name or domain already exists
    const existingCompany = await prisma.company.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          ...(validatedData.domain ? [{ domain: validatedData.domain }] : [])
        ]
      }
    });

    if (existingCompany) {
      logger.warn('Attempted to create company with existing name/domain', {
        userId: (authenticatedRequest as any).user?.id,
        companyName: validatedData.name,
        domain: validatedData.domain,
        existingCompanyId: existingCompany.id
      }, request);

      return NextResponse.json(
        { error: 'Company name or domain already exists' },
        { status: 400 }
      );
    }

    // Create company (pending verification)
    const company = await prisma.company.create({
      data: {
        name: validatedData.name,
        domain: validatedData.domain,
        description: validatedData.description,
        website: validatedData.website || null,
        email: validatedData.email,
        phone: validatedData.phone,
        taxId: validatedData.taxId,
        licenseNumber: validatedData.licenseNumber,
        industry: validatedData.industry,
        country: validatedData.country,
        currency: validatedData.currency,
        timezone: validatedData.timezone,
        logoUrl: validatedData.logoUrl,
        isActive: false, // Pending verification
        isVerified: false,
        // Set default authentication preferences
        allowEmailLogin: true,
        allowPhoneLogin: true,
        requireEmailVerification: false,
        requirePhoneVerification: false,
      }
    });

    const duration = Date.now() - startTime;
    logger.info('Company created successfully', {
      userId: (authenticatedRequest as any).user?.id,
      companyId: company.id,
      companyName: company.name,
      domain: company.domain,
      duration
    }, request);

    return NextResponse.json({
      success: true,
      companyId: company.id,
      message: 'Company registration submitted successfully. Please check your email for verification instructions.'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Company creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for company queries
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for company API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (domain) {
      // Find company by domain (public access for company lookup)
      const company = await prisma.company.findUnique({
        where: { domain }
      });

      if (!company) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }

      const duration = Date.now() - startTime;
      logger.info('Company lookup by domain', {
        domain,
        companyId: company.id,
        duration
      }, request);

      return NextResponse.json(company);
    }

    // Get all active companies (admin only) - require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required for company listing' },
        { status: 401 }
      );
    }

    // For now, require super admin for company listing
    // In production, you might want to allow regular admins to see their own company
    const authenticatedRequest = await requireSuperAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      logger.warn('Unauthorized attempt to list companies', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return authenticatedRequest;
    }

    const companies = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    const duration = Date.now() - startTime;
    logger.info('Company listing accessed', {
      userId: (authenticatedRequest as any).user?.id,
      companyCount: companies.length,
      duration
    }, request);

    return NextResponse.json(companies);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Company fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}