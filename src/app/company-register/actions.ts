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
  // Admin account fields
  adminFirstName: z.string().min(2),
  adminSurname: z.string().min(2),
  adminEmail: z.string().email(),
  adminPhone: z.string().min(5),
  adminPassword: z.string().min(8),
  adminConfirmPassword: z.string(),
}).refine(data => data.adminPassword === data.adminConfirmPassword, {
  message: 'Passwords do not match',
  path: ['adminConfirmPassword'],
});

export async function createCompanyDocument(data: z.infer<typeof companySchema>) {
  let validatedData: z.infer<typeof companySchema> | null = null;
  
  try {
    console.log('Company registration started:', { name: data.name, email: data.email });
    
    // Validate input
    validatedData = companySchema.parse(data);

    // Normalize company name (trim and lowercase for comparison)
    const normalizedName = validatedData.name.trim();
    
    // Check if company name already exists (case-insensitive check)
    // Get all companies and check manually since PostgreSQL is case-sensitive
    const allCompanies = await prisma.company.findMany({
      select: { id: true, name: true, domain: true, email: true, createdAt: true }
    });

    console.log(`Checking against ${allCompanies.length} existing companies:`, 
      allCompanies.map(c => ({ name: c.name, domain: c.domain }))
    );

    const existingCompanyByName = allCompanies.find(
      company => company.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );

    if (existingCompanyByName) {
      console.log('Duplicate company found:', {
        existing: existingCompanyByName.name,
        new: validatedData.name,
        existingId: existingCompanyByName.id,
        existingEmail: existingCompanyByName.email,
        existingCreatedAt: existingCompanyByName.createdAt
      });
      
      return {
        success: false,
        error: `Company name "${existingCompanyByName.name}" already exists (registered on ${new Date(existingCompanyByName.createdAt).toLocaleDateString()}). Please choose a different name.`
      };
    }

    // Check if domain already exists (if provided) - case-insensitive
    if (validatedData.domain && validatedData.domain.trim() !== '') {
      const normalizedDomain = validatedData.domain.trim().toLowerCase();
      
      const existingCompanyByDomain = allCompanies.find(
        company => company.domain && company.domain.trim().toLowerCase() === normalizedDomain
      );

      if (existingCompanyByDomain) {
        console.log('Duplicate domain found:', {
          existingDomain: existingCompanyByDomain.domain,
          newDomain: validatedData.domain,
          existingCompany: existingCompanyByDomain.name
        });
        
        return {
          success: false,
          error: `Domain "${existingCompanyByDomain.domain}" is already taken by "${existingCompanyByDomain.name}". Please choose a different domain.`
        };
      }
    }

    // Create company registration (pending verification)
    // Use the normalized name (trimmed) for storage
    const company = await prisma.company.create({
      data: {
        name: normalizedName, // Use normalized name (trimmed)
        domain: validatedData.domain?.trim() || null, // Trim domain if provided
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
        isActive: true, // Set to active so it appears in registration dropdown
        isVerified: false, // Pending admin verification
      }
    });
    
    console.log('Company created successfully:', { id: company.id, name: company.name });

    // Generate and send verification email (non-blocking)
    // If email verification fails, registration still succeeds
    try {
      const { token } = await generateVerificationToken(validatedData.email, company.id);
      await sendVerificationEmail(validatedData.email, token, validatedData.name);
      console.log('Verification email sent successfully');
    } catch (emailError: any) {
      console.warn('Email verification failed (non-critical):', emailError?.message || emailError);
      // Don't fail registration if email fails - email verification is optional
      // The company is still created successfully
    }

    // Check if admin email or phone already exists
    const normalizedAdminEmail = validatedData.adminEmail.toLowerCase().trim();
    const normalizedAdminPhone = validatedData.adminPhone.replace(/[\s\-\(\)]/g, '').trim();
    
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedAdminEmail },
          { phoneNumber: normalizedAdminPhone }
        ]
      }
    });

    if (existingAdmin) {
      return {
        success: false,
        error: 'Admin email or phone number is already registered. Please use different credentials.'
      };
    }

    // Create initial admin user for the company
    try {
      // Normalize admin email and phone number for consistent storage
      const adminFullName = `${validatedData.adminFirstName} ${validatedData.adminSurname}`.trim();
      
      // Generate member ID for admin (using company name prefix)
      const companyPrefix = validatedData.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'ADM';
      const memberId = `${companyPrefix}-ADMIN-${Date.now()}`;
      
      await prisma.user.create({
        data: {
          email: normalizedAdminEmail,
          phoneNumber: normalizedAdminPhone,
          password: await hashPassword(validatedData.adminPassword),
          firstName: validatedData.adminFirstName.trim(),
          surname: validatedData.adminSurname.trim(),
          fullName: adminFullName,
          memberId: memberId,
          companyId: company.id,
          isAdmin: true,
          active: true, // Active immediately since password is set by user
          accountType: 'Distributor',
          teamSize: { left: 0, right: 0, total: 0 },
          children: { left: null, right: null },
          addresses: []
        }
      });

      console.log('Admin user created successfully:', {
        memberId,
        email: normalizedAdminEmail,
        companyId: company.id
      });

      // Send verification email to admin
      try {
        const { token } = await generateVerificationToken(normalizedAdminEmail, company.id);
        await sendVerificationEmail(normalizedAdminEmail, token, validatedData.name);
        console.log('Admin verification email sent successfully');
      } catch (emailError: any) {
        console.warn('Admin email verification failed (non-critical):', emailError?.message || emailError);
      }
      
    } catch (userError: any) {
      console.error('Failed to create initial admin user:', userError);
      
      // Check if it's a unique constraint error
      if ((userError as any).code === 'P2002') {
        return {
          success: false,
          error: 'Admin email or phone number is already registered. Please use different credentials.'
        };
      }
      
      return {
        success: false,
        error: `Failed to create admin account: ${userError?.message || 'Unknown error'}`
      };
    }

    return {
      success: true,
      companyId: company.id,
      message: `Company "${validatedData.name}" and admin account created successfully! You can now log in with your admin credentials. Please check your email for verification instructions.`
    };

  } catch (error: any) {
    console.error('Company registration error:', error);
    console.error('Error details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      code: (error as any)?.code
    });
    
    // Provide more detailed error messages
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: `Invalid input data: ${errorMessages}`
      };
    }
    
    if (error instanceof Error) {
      // Check for Prisma unique constraint errors (P2002)
      // This is a fallback in case our duplicate check missed something (race condition, etc.)
      if ((error as any).code === 'P2002') {
        const target = (error as any).meta?.target;
        console.error('Prisma unique constraint violation:', {
          code: (error as any).code,
          target: target,
          attemptedName: validatedData?.name || data?.name,
          attemptedDomain: validatedData?.domain || data?.domain
        });
        
        // Try to find which company already exists to show helpful message
        try {
          const attemptedName = validatedData?.name || data?.name || '';
          const attemptedDomain = validatedData?.domain || data?.domain || '';
          
          if (Array.isArray(target) && target.includes('name')) {
            const existing = await prisma.company.findFirst({
              where: { name: attemptedName }
            });
            if (existing) {
              return {
                success: false,
                error: `Company name "${existing.name}" already exists (ID: ${existing.id}). Please choose a different name.`
              };
            }
            return {
              success: false,
              error: 'Company name already exists. Please choose a different name.'
            };
          }
          if (Array.isArray(target) && target.includes('domain')) {
            const existing = await prisma.company.findFirst({
              where: { domain: attemptedDomain }
            });
            if (existing) {
              return {
                success: false,
                error: `Domain "${existing.domain}" is already taken by "${existing.name}". Please choose a different domain.`
              };
            }
            return {
              success: false,
              error: 'Domain already exists. Please choose a different domain.'
            };
          }
        } catch (lookupError) {
          console.error('Failed to lookup existing company:', lookupError);
        }
        
        return {
          success: false,
          error: 'Company name or domain already exists. Please check your input and try again.'
        };
      }
      
      // Check for other database constraint errors
      if (error.message.includes('Unique constraint') || error.message.includes('already exists')) {
        // Don't override - let the specific error message from our checks show
        return {
          success: false,
          error: error.message || 'Company name or domain already exists'
        };
      }
      
      // Check for connection errors
      if (error.message.includes('Can\'t reach database') || error.message.includes('connection')) {
        return {
          success: false,
          error: 'Database connection failed. Please try again later.'
        };
      }
      
      // Return the actual error message
      return {
        success: false,
        error: error.message || 'Failed to register company'
      };
    }
    
    return {
      success: false,
      error: error?.message || 'Failed to register company. Please try again.'
    };
  }
}