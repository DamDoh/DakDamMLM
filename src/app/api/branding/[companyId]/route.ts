// Branding API Routes
// REST API endpoints for branding management

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { brandingManagementService } from '@/services/branding-management-service';
import { z } from 'zod';
import {
  withErrorHandler,
  validateRequest,
  withRateLimit,
  AuthenticationError,
  AuthorizationError,
  NotFoundError
} from '@/lib/api-error-handler';

// Validation schemas
const brandingConfigSchema = z.object({
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  headerLogoUrl: z.string().url().optional(),
  footerLogoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  customFonts: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
  }).optional(),
  themeConfig: z.object({
    borderRadius: z.string().optional(),
    shadow: z.string().optional(),
    spacing: z.record(z.string()).optional(),
  }).optional(),
  customCss: z.string().optional(),
});

// Authorization helper
async function authorizeCompanyAccess(userId: string, companyId: string): Promise<void> {
  // TODO: Implement proper authorization logic
  // For now, assume user has access to company
  // In production, check if user is admin/owner of the company
}

// GET /api/branding/[companyId] - Get branding configuration
const getBrandingHandler = async (
  request: NextRequest,
  { params }: { params: { companyId: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  await authorizeCompanyAccess(session.user.id, params.companyId);

  const branding = await brandingManagementService.getBrandingConfig(params.companyId);

  if (!branding) {
    throw new NotFoundError('Company');
  }

  return Response.json({ branding });
};

// PUT /api/branding/[companyId] - Update branding configuration
const updateBrandingHandler = async (
  request: NextRequest,
  { params }: { params: { companyId: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  await authorizeCompanyAccess(session.user.id, params.companyId);

  const validatedData = (request as any).validatedData;

  const updatedBranding = await brandingManagementService.updateBrandingConfig(
    params.companyId,
    validatedData,
    session.user.id
  );

  return Response.json({ branding: updatedBranding });
};

// Apply middleware
export const GET = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 100 })(
    getBrandingHandler
  )
);

export const PUT = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 50 })(
    validateRequest(brandingConfigSchema)(
      updateBrandingHandler
    )
  )
);