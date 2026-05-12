import { NextRequest } from 'next/server';
import { changePassword, ValidationError, AuthenticationError } from '@/lib/auth';
import { authenticateRequest } from '@/lib/auth-middleware';
import { ApiResponseUtil } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authenticatedRequest = await authenticateRequest(request);
    const { currentPassword, newPassword } = await request.json();

    // Use centralized validation from auth-service
    if (!authenticatedRequest.user) {
      return ApiResponseUtil.unauthorized('User not authenticated');
    }

    await changePassword(
      authenticatedRequest.user.id,
      currentPassword,
      newPassword
    );

    return ApiResponseUtil.success(null, 'Password changed successfully');

  } catch (error) {
    logger.error('Change password error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof ValidationError) {
      return ApiResponseUtil.validationError({ message: error.message });
    }

    if (error instanceof AuthenticationError) {
      return ApiResponseUtil.unauthorized(error.message);
    }

    return ApiResponseUtil.error('Internal server error', 500);
  }
}