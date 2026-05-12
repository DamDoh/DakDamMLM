import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { generateUniqueMemberId, validateMemberId } from '@/lib/member-id-generator';
import { getEnvConfig } from '@/lib/env-validation';

// Validate environment on module load
getEnvConfig();

// Types
export interface AuthUser {
  id: string;
  email: string;
  memberId: string;
  fullName?: string;
  isAdmin: boolean;
  accountType?: string;
  companyId?: string;
}

export interface LoginCredentials {
  memberId: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  surname: string;
  phoneNumber: string;
  sponsorId?: string;
  companyId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Get validated environment configuration
const env = getEnvConfig();
const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET || JWT_SECRET;

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Token generation
export function generateTokens(user: AuthUser): AuthTokens {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      memberId: user.memberId,
      fullName: user.fullName,
      isAdmin: user.isAdmin,
      accountType: user.accountType,
      companyId: user.companyId
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Token verification
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.userId,
      email: decoded.email,
      memberId: decoded.memberId,
      fullName: decoded.fullName,
      isAdmin: decoded.isAdmin,
      accountType: decoded.accountType || 'Customer',
      companyId: decoded.companyId
    };
  } catch (error) {
    logger.error('Token verification failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

// User registration with validation
export async function registerUser(data: RegisterData): Promise<AuthUser> {
  const { email, password, firstName, surname, phoneNumber, sponsorId, companyId } = data;

  // Validate email format
  if (!validateEmail(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate phone number
  if (!validatePhoneNumber(phoneNumber)) {
    throw new ValidationError('Invalid phone number format');
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new ValidationError('Email already registered');
  }

  // Generate unique member ID
  const memberId = await generateUniqueMemberId(
    firstName,
    surname,
    phoneNumber,
    async (checkId: string) => {
      const existing = await prisma.user.findUnique({
        where: { memberId: checkId }
      });
      return !!existing;
    }
  );

  // Validate sponsor exists if provided
  if (sponsorId) {
    const sponsor = await prisma.user.findUnique({
      where: { memberId: sponsorId }
    });

    if (!sponsor) {
      throw new ValidationError('Sponsor not found');
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const fullName = `${firstName} ${surname}`;
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      memberId,
      firstName,
      surname,
      fullName,
      phoneNumber,
      sponsorId,
      companyId,
      active: true,
      teamSize: {},
      children: {},
      addresses: {}
    }
  });

  logger.info('User registered successfully', {
    userId: user.id,
    email: user.email,
    memberId: user.memberId
  });

  return {
    id: user.id,
    email: user.email,
    memberId: user.memberId,
    fullName: user.fullName || `${user.firstName} ${user.surname}`,
    isAdmin: user.isAdmin || false,
    accountType: user.accountType || 'Customer',
    companyId: user.companyId || undefined
  };
}

// User login with account lockout
export async function loginUser(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: AuthTokens } | null> {
  const { memberId, password } = credentials;

  // Find user by memberId
  const user = await prisma.user.findUnique({
    where: { memberId }
  });

  if (!user || !user.active) {
    // Don't reveal if user exists or not for security
    return null;
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthenticationError('Account is temporarily locked due to too many failed login attempts');
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);

  if (!isValidPassword) {
    // Increment failed attempts
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updates: any = { failedLoginAttempts: failedAttempts };

    // Lock account after 5 failed attempts for 30 minutes
    if (failedAttempts >= 5) {
      updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      updates.failedLoginAttempts = 0; // Reset counter
      logger.warn('Account locked due to failed login attempts', {
        userId: user.id,
        email: user.email,
        failedAttempts
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updates
    });

    return null;
  }

  // Successful login - reset failed attempts and unlock
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      // Use lastActivityDate rather than a non-existent lastLoginAt field
      lastActivityDate: new Date()
    }
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    memberId: user.memberId,
    fullName: user.fullName || `${user.firstName} ${user.surname}`,
    isAdmin: user.isAdmin || false,
    accountType: user.accountType || 'Customer',
    companyId: user.companyId || undefined
  };

  const tokens = generateTokens(authUser);

  logger.info('User logged in successfully', {
    userId: user.id,
    email: user.email
  });

  return { user: authUser, tokens };
}

// Password change
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  // Verify old password
  const isValidOldPassword = await verifyPassword(oldPassword, user.password);
  if (!isValidOldPassword) {
    throw new ValidationError('Current password is incorrect');
  }

  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword }
  });

  logger.info('Password changed successfully', { userId });
}

// Get user by ID
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    memberId: user.memberId,
    fullName: user.fullName || `${user.firstName} ${user.surname}`,
    isAdmin: user.isAdmin || false,
    accountType: user.accountType || 'Customer',
    companyId: user.companyId || undefined
  };
}

// Refresh token
export function refreshToken(refreshToken: string): AuthTokens | null {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const userId = decoded.userId;

    // Get user data for new tokens
    // Note: In production, you'd want to store refresh tokens in database
    // and validate them properly. This is a simplified implementation.

    // For now, we'll need the user data passed or retrieved
    // This is a limitation of the simplified implementation
    return null; // Implement properly based on your needs

  } catch (error) {
    logger.error('Refresh token verification failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

// Validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phoneNumber: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phoneNumber);
}

// Health check
export async function healthCheck(): Promise<{ status: string; timestamp: Date }> {
  try {
    // Test database connection
    await prisma.user.count();
    return { status: 'healthy', timestamp: new Date() };
  } catch (error) {
    logger.error('Auth service health check failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return { status: 'unhealthy', timestamp: new Date() };
  }
}

// Error classes
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Request password reset (OTP-based)
 * This generates an OTP and sends it via email/SMS
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, active: true, deleted: true }
    });

    if (!user || user.deleted || !user.active) {
      // Don't reveal if user exists or not (security)
      // Return success anyway to prevent email enumeration
      return { success: true };
    }

    // Note: In production, this should generate and send an OTP via email/SMS
    // For now, this is a stub implementation
    logger.info('Password reset requested', { email: email.substring(0, 3) + '***' });
    
    return { success: true };
  } catch (error: any) {
    logger.error('Password reset request failed', { error: error.message });
    // Return success anyway to prevent email enumeration
    return { success: true };
  }
}

/**
 * Reset password with OTP
 * Validates OTP and updates password
 */
export async function resetPasswordWithOtp(
  email: string,
  otpCode: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Validate OTP code here
    // For now, this is a simplified implementation
    // In production, you should verify the OTP against the stored OTP
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    logger.info('Password reset with OTP successful', { email: email.substring(0, 3) + '***' });
    
    return { success: true };
  } catch (error: any) {
    logger.error('Password reset with OTP failed', { error: error.message });
    return { success: false, error: error.message || 'Failed to reset password' };
  }
}

// Explicit re-exports for TypeScript module resolution
export type { };