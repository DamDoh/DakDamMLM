// Logo Upload API Route
// Handles logo file uploads for branding

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { brandingManagementService } from '@/services/branding-management-service';
import { z } from 'zod';
import {
  withErrorHandler,
  withRateLimit,
  AuthenticationError,
  AuthorizationError,
  ValidationError
} from '@/lib/api-error-handler';

const uploadSchema = z.object({
  type: z.enum(['logo', 'favicon', 'header', 'footer']),
});

// Authorization helper
async function authorizeCompanyAccess(userId: string, companyId: string): Promise<void> {
  // TODO: Implement proper authorization logic
  // For now, assume user has access to company
}

// POST /api/branding/[companyId]/upload - Upload logo file
const uploadLogoHandler = async (
  request: NextRequest,
  { params }: { params: { companyId: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  await authorizeCompanyAccess(session.user.id, params.companyId);

  // Parse form data
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;

  if (!file) {
    throw new ValidationError('No file provided');
  }

  // Validate type
  const validation = uploadSchema.safeParse({ type });
  if (!validation.success) {
    throw new ValidationError('Invalid upload type', validation.error.errors);
  }

  // Convert file to buffer
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name;

  // Upload logo
  const fileUrl = await brandingManagementService.uploadLogo(
    params.companyId,
    buffer,
    fileName,
    validation.data.type,
    session.user.id
  );

  return Response.json({ url: fileUrl });
};

// DELETE /api/branding/[companyId]/upload - Delete logo asset
const deleteLogoHandler = async (
  request: NextRequest,
  { params }: { params: { companyId: string } }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new AuthenticationError();
  }

  await authorizeCompanyAccess(session.user.id, params.companyId);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (!type || !['logo', 'favicon', 'header', 'footer'].includes(type)) {
    throw new ValidationError('Invalid asset type');
  }

  await brandingManagementService.deleteBrandingAsset(
    params.companyId,
    type as 'logo' | 'favicon' | 'header' | 'footer',
    session.user.id
  );

  return Response.json({ success: true });
};

// Apply middleware
export const POST = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 20 })(
    uploadLogoHandler
  )
);

export const DELETE = withErrorHandler(
  withRateLimit({ windowMs: 60000, maxRequests: 30 })(
    deleteLogoHandler
  )
);