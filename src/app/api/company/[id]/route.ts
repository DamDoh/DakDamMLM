import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  domain: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
  address: z.any().optional(),
  taxId: z.string().optional(),
  licenseNumber: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().min(2).optional(),
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().min(1).optional(),
  allowEmailLogin: z.boolean().optional(),
  allowPhoneLogin: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  requirePhoneVerification: z.boolean().optional(),
  customCss: z.string().optional(),
  loginPageConfig: z.any().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            rules: true,
            orders: true,
          }
        }
      }
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(company);

  } catch (error) {
    console.error('Company fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateCompanySchema.parse(body);

    // Check if domain is being updated and if it's already taken
    if (validatedData.domain) {
      const existingCompany = await prisma.company.findFirst({
        where: {
          domain: validatedData.domain,
          id: { not: id }
        }
      });

      if (existingCompany) {
        return NextResponse.json(
          { error: 'Domain already in use by another company' },
          { status: 400 }
        );
      }
    }

    const company = await prisma.company.update({
      where: { id },
      data: validatedData
    });

    return NextResponse.json({
      success: true,
      company
    });

  } catch (error) {
    console.error('Company update error:', error);
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Soft delete - mark as inactive
    await prisma.company.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Company deactivated successfully'
    });

  } catch (error) {
    console.error('Company deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate company' },
      { status: 500 }
    );
  }
}