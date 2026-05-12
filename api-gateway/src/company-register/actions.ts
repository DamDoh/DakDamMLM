'use server';

import { prisma } from '@/lib/database';
import { z } from 'zod';
import { generateVerificationToken, sendVerificationEmail } from '@/services/email-verification-service';
import { hashPassword } from '@/lib/auth-service';

const companySchema = z.object({
  name: z.string().min(2),
  domain: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().min(5),
  taxId: z.string().optional(),
  licenseNumber: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().min(2),
  currency: z.string().min(3).max(3),
  timezone: z.string().min(1),
  logoUrl: z.string().optional(),
});

export async function createCompanyDocument(data: z.infer<typeof companySchema>) {
  try {
    // Validate input
    const validatedData = companySchema.parse(data);

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
      return {
        success: false,
        error: 'Company name or domain already exists'
      };
    }

    // Create company registration (pending verification)
    const company = await prisma.company.create({
      data: {
        name: validatedData.name,
        domain: validatedData.domain,
        description: validatedData.description,
        website: validatedData.website,
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
      }
    });

    // Generate and send verification email
    try {
      const { token } = await generateVerificationToken(validatedData.email, company.id);
      await sendVerificationEmail(validatedData.email, token);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    // Create initial admin user for the company
    try {
      const tempPassword = `temp${Math.random().toString(36).slice(-8)}`;
      await prisma.user.create({
        data: {
          email: validatedData.email,
          phoneNumber: validatedData.phone,
          password: await hashPassword(tempPassword),
          firstName: 'Admin',
          surname: 'User',
          fullName: 'Admin User',
          memberId: `${validatedData.name.substring(0, 3).toUpperCase()}-ADMIN-${Date.now()}`,
          companyId: company.id,
          isAdmin: true,
          active: false, // Inactive until email verified
          accountType: 'Distributor',
          teamSize: { left: 0, right: 0, total: 0 },
          children: { left: null, right: null },
          addresses: []
        }
      });

      // SECURITY FIX: Never log passwords - removed password from console
      // In production, send this password via email ONLY
      // await sendInitialPasswordEmail(validatedData.email, tempPassword, company.name);
      
      // For development, admin can reset password using forgot password flow
    } catch (userError) {
      console.error('Failed to create initial admin user:', userError);
      // Company is created but admin creation failed - can be fixed manually
    }

    return {
      success: true,
      companyId: company.id,
      message: 'Company registration submitted successfully. Please check your email for verification instructions.'
    };

  } catch (error) {
    console.error('Company registration error:', error);
    return {
      success: false,
      error: error instanceof z.ZodError
        ? 'Invalid input data'
        : 'Failed to register company'
    };
  }
}