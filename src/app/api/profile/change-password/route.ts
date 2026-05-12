import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthenticatedRequest, AuthenticationError } from '@/lib/auth-middleware';
import { hashPassword } from '@/lib/auth-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  let authUser: AuthenticatedRequest['user'];
  try {
    const auth = await authenticateRequest(request);
    authUser = auth.user;
  } catch (err) {
    const message = err instanceof AuthenticationError ? err.message : 'Authentication required';
    return NextResponse.json({ success: false, error: message, message }, { status: 401 });
  }

  if (!authUser?.id) {
    return NextResponse.json({ success: false, error: 'User not found', message: 'User not found' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentIdCard, newPassword, confirmPassword } = body;

    if (!currentIdCard || !newPassword || !confirmPassword) {
      return ApiResponseUtil.validationError({
        message: 'Current ID card, new password, and confirm password are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return ApiResponseUtil.validationError({
        message: 'New password and confirm password do not match',
      });
    }

    if (newPassword.length < 4) {
      return ApiResponseUtil.validationError({
        message: 'New password must be at least 4 characters long',
      });
    }

    // Fetch current user to verify current ID card
    const user = await prisma.user.findUnique({
      where: { id: authUser!.id },
      select: { id: true, idCardNumber: true, password: true },
    });

    if (!user) {
      return ApiResponseUtil.error('User not found', 404);
    }

    // Verify current ID card matches
    // Handle null/undefined cases
    const currentIdCardNormalized = (user.idCardNumber || '').trim();
    const providedIdCardNormalized = (currentIdCard || '').trim();
    
    if (!currentIdCardNormalized) {
      return ApiResponseUtil.validationError({
        message: 'No ID card number found for your account. Please contact support.',
      });
    }
    
    if (currentIdCardNormalized !== providedIdCardNormalized) {
      return ApiResponseUtil.validationError({
        message: 'Current ID card number does not match',
      });
    }

    // Update idCardNumber with the new password value
    // The new password becomes the new idCardNumber
    const newIdCardNumber = newPassword;

    // Hash the last 4 digits of the new ID card as the password (matching registration logic)
    const lastFourDigits = newPassword.length >= 4 
      ? newPassword.slice(-4) 
      : newPassword;
    const hashedPassword = await hashPassword(lastFourDigits);

    await prisma.user.update({
      where: { id: authUser!.id },
      data: {
        password: hashedPassword,
        idCardNumber: newIdCardNumber,
      },
    });

    logger.info('Password and ID card updated', {
      userId: authUser!.id,
      ip: request.headers.get('x-forwarded-for'),
    }, request);

    return ApiResponseUtil.success(
      null,
      'Password and ID card have been updated successfully'
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Change password error', {
      error: err.message,
      stack: err.stack,
      ip: request.headers.get('x-forwarded-for'),
    }, request);

    // Handle Prisma unique constraint (e.g. idCardNumber already taken)
    const prismaErr = error as { code?: string };
    if (prismaErr?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: { message: 'This password is already used by another account. Please choose a different one.' } },
        { status: 400 }
      );
    }

    const message = process.env.NODE_ENV === 'development' ? err.message : 'Failed to change password';
    return NextResponse.json(
      { success: false, error: message, message, details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined },
      { status: 500 }
    );
  }
}
