// Domain Management API Routes
// REST API endpoints for custom domain mapping and SSL management

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { customDomainService } from '@/services/custom-domain-service';
import { domainSecurityService } from '@/services/domain-security-service';
import { sslService } from '@/services/ssl-service';
import { z } from 'zod';

// Validation schemas
const domainMappingSchema = z.object({
  customDomain: z.string().regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/),
});

const sslRequestSchema = z.object({
  email: z.string().email(),
  challengeType: z.enum(['http-01', 'dns-01']).default('http-01'),
});

const domainVerificationSchema = z.object({
  challengeType: z.enum(['dns-txt', 'file', 'meta-tag']),
  value: z.string().min(1),
});

// GET /api/domains/[companyId] - Get domain mapping info
export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add authorization check

    const domainMapping = await customDomainService.getDomainMapping(params.companyId);

    if (!domainMapping) {
      return NextResponse.json({ error: 'No domain mapping found' }, { status: 404 });
    }

    // Get security status
    const securityStatus = await domainSecurityService.getDomainSecurityStatus(domainMapping.customDomain);

    return NextResponse.json({
      domainMapping,
      securityStatus,
    });
  } catch (error) {
    console.error('Error fetching domain mapping:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/domains/[companyId] - Map custom domain
export async function POST(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validation = domainMappingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const domainMapping = await customDomainService.mapDomain(
      params.companyId,
      validation.data.customDomain,
      session.user.id
    );

    // Get DNS configuration guide
    const dnsRecords = customDomainService.getDNSConfigurationGuide(validation.data.customDomain);

    return NextResponse.json({
      domainMapping,
      dnsRecords,
      message: 'Domain mapped successfully. Please configure your DNS records.',
    });
  } catch (error: any) {
    console.error('Error mapping domain:', error);

    if (error.message?.includes('Domain is already mapped')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/domains/[companyId]/verify - Verify domain ownership
export async function PUT(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate verification data
    const validation = domainVerificationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await domainSecurityService.verifyDomainOwnership(
      await customDomainService.getDomainMapping(params.companyId)?.customDomain || '',
      validation.data.challengeType,
      validation.data.value
    );

    return NextResponse.json({
      verified: result.isValid,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (error: any) {
    console.error('Error verifying domain:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}