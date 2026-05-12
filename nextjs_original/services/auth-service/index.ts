// Authentication Microservice
// Handles all authentication, authorization, and user session management

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../shared/database';
import { ServiceErrorHandler, ResponseUtils, ValidationUtils, generateRequestId } from '../shared/utils';
import type { Member } from '../shared/types';

// Lazy JWT_SECRET validation - only check when needed (not at module load)
// This prevents errors when the module is imported on the client side
const getJWTSecret = (): string => {
  if (typeof window !== 'undefined') {
    // Client-side - JWT operations should not happen here
    throw new Error('JWT operations cannot be performed on the client side');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable must be set. Application cannot start without a secure JWT secret.');
  }
  return process.env.JWT_SECRET;
};

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthUser {
  id: string;
  email: string;
  memberId?: string;
  fullName: string;
  isAdmin: boolean;
  accountType: 'Distributor' | 'Customer';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  surname: string;
  phoneNumber: string;
  memberId?: string;
  sponsorId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// JWT utilities
export function generateTokens(user: AuthUser): AuthTokens {
  const JWT_SECRET = getJWTSecret(); // Get secret only when needed
  
  const payload = {
    userId: user.id,
    email: user.email,
    memberId: user.memberId,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    accountType: user.accountType,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

  return { accessToken, refreshToken };
}

export function verifyToken(token: string): AuthUser | null {
  const JWT_SECRET = getJWTSecret(); // Get secret only when needed
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.userId,
      email: decoded.email,
      memberId: decoded.memberId,
      fullName: decoded.fullName,
      isAdmin: decoded.isAdmin,
      accountType: decoded.accountType,
    };
  } catch (error) {
    return null;
  }
}

// Authentication functions
export async function registerUser(data: RegisterData): Promise<AuthUser> {
  const { email, password, firstName, surname, phoneNumber, memberId, sponsorId } = data;

  // Validate input
  ValidationUtils.validateRequired(email, 'email');
  ValidationUtils.validateRequired(password, 'password');
  ValidationUtils.validateRequired(firstName, 'firstName');
  ValidationUtils.validateRequired(surname, 'surname');
  ValidationUtils.validateRequired(phoneNumber, 'phoneNumber');

  if (password.length < 8) {
    throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Password must be at least 8 characters long');
  }

  if (!ValidationUtils.isValidEmail(email)) {
    throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid email format');
  }

  if (!ValidationUtils.isValidPhoneNumber(phoneNumber)) {
    throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid phone number format');
  }

  // Check if user already exists
  const existingUser = await db.user.findFirst({
    where: {
      OR: [
        { email: email.toLowerCase() },
        { phoneNumber },
        ...(memberId ? [{ memberId: memberId }] : [])
      ]
    }
  });

  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) {
      throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Email already registered');
    }
    if (existingUser.phoneNumber === phoneNumber) {
      throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Phone number already registered');
    }
    if (memberId && existingUser.memberId === memberId) {
      throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Member ID already exists');
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const userData: any = {
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName,
    surname,
    phoneNumber,
    sponsorId,
    fullName: `${firstName} ${surname}`,
    isAdmin: false,
    active: true,
    pv: 0,
    rank: 'Member',
    children: { left: null, right: null },
    teamSize: { left: 0, right: 0, total: 0 },
    joinDate: new Date().toISOString(),
    lastActivityDate: new Date().toISOString(),
  };

  // Only add memberId if it's provided and not empty
  if (memberId && memberId.trim() !== '') {
    userData.memberId = memberId;
  }

  const user = await db.user.create({
    data: userData
  });

  return {
    id: user.id,
    email: user.email || '',
    memberId: user.memberId || undefined,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    accountType: 'Distributor',
  };
}

export async function loginUser(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const { email, password } = credentials;

  ValidationUtils.validateRequired(email, 'email');
  ValidationUtils.validateRequired(password, 'password');

  if (!ValidationUtils.isValidEmail(email)) {
    throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid email format');
  }

  // Find user
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      password: true,
      fullName: true,
      memberId: true,
      isAdmin: true,
      active: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastFailedLogin: true
    }
  });

  if (!user) {
    throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid email or password');
  }

  // Check if account is locked
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (1000 * 60));
    throw ServiceErrorHandler.createError(
      'AUTHENTICATION_ERROR',
      `Account is locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minutes.`
    );
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);
  
  if (!isValidPassword) {
    // Increment failed login attempts
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const maxAttempts = 5;
    const lockoutMinutes = 30;

    const updateData: any = {
      failedLoginAttempts: failedAttempts,
      lastFailedLogin: now
    };

    // Lock account if max attempts reached
    if (failedAttempts >= maxAttempts) {
      updateData.lockedUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000);
      
      console.log(`Account locked for user ${user.id} after ${failedAttempts} failed attempts`);
      
      // Log security event
      console.log(`[SECURITY] Account lockout: ${email} from IP: [Track in production]`);
    }

    await db.user.update({
      where: { id: user.id },
      data: updateData
    });

    throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid email or password');
  }

  // Check if user is active
  if (!user.active) {
    throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Account is deactivated');
  }

  // Successful login - reset failed attempts and clear lockout
  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastFailedLogin: null,
      updatedAt: now
    }
  });

  // Generate tokens
  const authUser: AuthUser = {
    id: user.id,
    email: user.email || '',
    memberId: user.memberId || undefined,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    accountType: 'Distributor',
  };

  const tokens = generateTokens(authUser);

  return { user: authUser, tokens };
}

export async function refreshToken(refreshToken: string): Promise<AuthTokens> {
  const JWT_SECRET = getJWTSecret(); // Get secret only when needed
  
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    const userId = decoded.userId;

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.active) {
      throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid refresh token');
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email || '',
      memberId: user.memberId || undefined,
      fullName: user.fullName,
      isAdmin: user.isAdmin,
      accountType: 'Distributor',
    };

    return generateTokens(authUser);
  } catch (error) {
    throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid refresh token');
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  ValidationUtils.validateRequired(currentPassword, 'currentPassword');
  ValidationUtils.validateRequired(newPassword, 'newPassword');

  if (newPassword.length < 8) {
    throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'New password must be at least 8 characters long');
  }

  const user = await db.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'User not found');
  }

  // Verify current password
  const isValidPassword = await verifyPassword(currentPassword, user.password);
  if (!isValidPassword) {
    throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Current password is incorrect');
  }

  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);

  // Update password
  await db.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword }
  });
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId }
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email || '',
    memberId: user.memberId || undefined,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    accountType: 'Distributor',
  };
}

// OTP-based authentication functions
export async function requestEmailVerification(userId: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, companyId: true }
    });

    if (!user || !user.email) {
      throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'User email not found');
    }

    // Import OTP service dynamically
    const { generateOtpServer } = await import('../otp-service');

    const result = await generateOtpServer({
      identifier: user.email,
      type: 'email',
      purpose: 'verification',
      companyId: companyId || user.companyId || undefined,
      ipAddress: undefined, // Will be set by API middleware
      userAgent: undefined, // Will be set by API middleware
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('Failed to request email verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send verification email',
    };
  }
}

export async function verifyEmailWithOtp(email: string, otpCode: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Import OTP service dynamically
    const { verifyOtpServer } = await import('../otp-service');

    const result = await verifyOtpServer({
      identifier: email,
      type: 'email',
      purpose: 'verification',
      code: otpCode,
      companyId,
    });

    if (result.success) {
      // Mark email as verified in user record
      await db.user.updateMany({
        where: { email: email.toLowerCase() },
        data: { /* Add emailVerified field if needed */ }
      });
    }

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('Failed to verify email with OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email verification failed',
    };
  }
}

export async function requestPasswordReset(email: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, active: true }
    });

    if (!user || !user.active) {
      // Don't reveal if user exists or not for security
      return { success: true }; // Pretend success to prevent email enumeration
    }

    // Import OTP service dynamically
    const { generateOtpServer } = await import('../otp-service');

    const result = await generateOtpServer({
      identifier: email,
      type: 'email',
      purpose: 'password_reset',
      companyId,
      ipAddress: undefined, // Will be set by API middleware
      userAgent: undefined, // Will be set by API middleware
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('Failed to request password reset:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send password reset email',
    };
  }
}

export async function resetPasswordWithOtp(email: string, otpCode: string, newPassword: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // First verify the OTP
    const { verifyOtpServer } = await import('../otp-service');

    const otpResult = await verifyOtpServer({
      identifier: email,
      type: 'email',
      purpose: 'password_reset',
      code: otpCode,
      companyId,
    });

    if (!otpResult.success) {
      return {
        success: false,
        error: otpResult.error || 'Invalid or expired OTP code',
      };
    }

    // Find user and update password
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, active: true }
    });

    if (!user || !user.active) {
      return {
        success: false,
        error: 'User not found or inactive',
      };
    }

    // Validate new password
    if (newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long',
      };
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      }
    });

    // Log password reset event
    console.log(`[SECURITY] Password reset successful for user: ${email}`);

    return { success: true };
  } catch (error) {
    console.error('Failed to reset password with OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Password reset failed',
    };
  }
}

export async function requestSmsVerification(userId: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true, companyId: true }
    });

    if (!user || !user.phoneNumber) {
      throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'User phone number not found');
    }

    // Import OTP service dynamically
    const { generateOtpServer } = await import('../otp-service');

    const result = await generateOtpServer({
      identifier: user.phoneNumber,
      type: 'sms',
      purpose: 'verification',
      companyId: companyId || user.companyId || undefined,
      ipAddress: undefined, // Will be set by API middleware
      userAgent: undefined, // Will be set by API middleware
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('Failed to request SMS verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send verification SMS',
    };
  }
}

export async function verifySmsWithOtp(phoneNumber: string, otpCode: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Import OTP service dynamically
    const { verifyOtpServer } = await import('../otp-service');

    const result = await verifyOtpServer({
      identifier: phoneNumber,
      type: 'sms',
      purpose: 'verification',
      code: otpCode,
      companyId,
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('Failed to verify SMS with OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS verification failed',
    };
  }
}

// Health check for load balancer
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
}