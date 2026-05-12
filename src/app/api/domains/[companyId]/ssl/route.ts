// SSL Certificate Management API Routes
// REST API endpoints for SSL certificate operations

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { sslService } from '@/services/ssl-service';
import { customDomainService } from '@/services/custom-domain-service';
import { z } from 'zod';

const sslRequestSchema = z.object({
  email: z.string().email(),
  challengeType: z.enum(['http-01', 'dns-01']).default('http-01'),
});

// POST /api/domains/[companyId]/ssl - Request SSL certificate
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
    const validation = sslRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Get domain mapping
    const domainMapping = await customDomainService.getDomainMapping(params.companyId);
    if (!domainMapping?.customDomain) {
      return NextResponse.json({ error: 'No custom domain configured' }, { status: 400 });
    }

    // Request SSL certificate
    const certificate = await sslService.requestCertificate({
      domain: domainMapping.customDomain,
      email: validation.data.email,
      challengeType: validation.data.challengeType,
      companyId: params.companyId,
    });

    return NextResponse.json({
      certificate: {
        domain: certificate.domain,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt,
        issuer: certificate.issuer,
      },
      message: 'SSL certificate requested successfully',
    });
  } catch (error: any) {
    console.error('Error requesting SSL certificate:', error);

    if (error.message?.includes('Domain ownership verification failed')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/domains/[companyId]/ssl/renew - Renew SSL certificate
export async function PUT(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get domain mapping
    const domainMapping = await customDomainService.getDomainMapping(params.companyId);
    if (!domainMapping?.customDomain) {
      return NextResponse.json({ error: 'No custom domain configured' }, { status: 400 });
    }

    // Renew certificate
    const certificate = await sslService.renewCertificate(
      domainMapping.customDomain,
      params.companyId
    );

    return NextResponse.json({
      certificate: {
        domain: certificate.domain,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt,
        issuer: certificate.issuer,
      },
      message: 'SSL certificate renewed successfully',
    });
  } catch (error: any) {
    console.error('Error renewing SSL certificate:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/domains/[companyId]/ssl/status - Get SSL certificate status
export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get domain mapping
    const domainMapping = await customDomainService.getDomainMapping(params.companyId);
    if (!domainMapping?.customDomain) {
      return NextResponse.json({ error: 'No custom domain configured' }, { status: 404 });
    }

    // Get certificate expiry info
    const expiryInfo = await sslService.getCertificateExpiryInfo(domainMapping.customDomain);

    return NextResponse.json({
      domain: domainMapping.customDomain,
      hasCertificate: !!domainMapping.sslCertificate,
      expiryInfo,
    });
  } catch (error) {
    console.error('Error getting SSL status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}