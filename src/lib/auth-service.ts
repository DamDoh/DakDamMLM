import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { generateUniqueMemberId, validateMemberId } from '@/lib/member-id-generator';
import { getEnvConfig } from '@/lib/env-validation';
import { findFirstAvailablePosition } from '@/services/user-service';

// Types
export interface AuthUser {
  id: string;
  email: string;
  memberId: string;
  fullName?: string;
  isAdmin: boolean;
  accountType?: string;
  companyId?: string;
  storeOwnerLevel?: string | null;
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
  idCardNumber?: string;
  idCardUrl?: string;
  placementParentId?: string;
  position?: string;
  referralCode?: string;
  accountType?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Lazy-load environment configuration to avoid errors at module load time
function getJwtSecret(): string {
  const env = getEnvConfig();
  return env.JWT_SECRET;
}

function getJwtRefreshSecret(): string {
  const env = getEnvConfig();
  return env.JWT_REFRESH_SECRET || env.JWT_SECRET;
}

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
      companyId: user.companyId,
      storeOwnerLevel: user.storeOwnerLevel
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    getJwtRefreshSecret(),
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Token verification
export function verifyToken(token: string): AuthUser | null {
  try {
    if (!token || token.trim() === '') {
      logger.warn('Token verification failed: Empty token');
      return null;
    }

    const secret = getJwtSecret();
    if (!secret) {
      logger.error('Token verification failed: JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(token, secret) as any;
    
    // Validate decoded token has required fields
    if (!decoded.userId || !decoded.email) {
      logger.warn('Token verification failed: Missing required fields in token');
      return null;
    }

    return {
      id: decoded.userId,
      email: decoded.email,
      memberId: decoded.memberId,
      fullName: decoded.fullName,
      isAdmin: decoded.isAdmin || false,
      accountType: decoded.accountType || 'Customer',
      companyId: decoded.companyId,
      storeOwnerLevel: decoded.storeOwnerLevel || null
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log specific error types for debugging
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token verification failed: Token expired', { 
        expiredAt: error.expiredAt,
        message: errorMessage 
      });
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Token verification failed: Invalid token format', { message: errorMessage });
    } else {
      logger.error('Token verification failed:', { error: errorMessage });
    }
    
    return null;
  }
}

// User registration with validation
export async function registerUser(data: RegisterData): Promise<AuthUser> {
  const {
    email,
    password,
    firstName,
    surname,
    phoneNumber,
    sponsorId,
    companyId,
    idCardNumber,
    idCardUrl,
    placementParentId,
    position,
    referralCode,
    accountType
  } = data;

  // Normalize email to lowercase for consistency (PostgreSQL is case-sensitive)
  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  if (!validateEmail(normalizedEmail)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate phone number
  if (!validatePhoneNumber(phoneNumber)) {
    throw new ValidationError('Invalid phone number format');
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    throw new ValidationError('Email already registered');
  }

  // Check if phone number already exists
  const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').trim();
  const existingUserByPhone = await prisma.user.findUnique({
    where: { phoneNumber: normalizedPhone }
  });

  if (existingUserByPhone) {
    throw new ValidationError('Phone number already registered');
  }

  // Check ID card number uniqueness within company if provided
  if (idCardNumber && companyId) {
    const existingUserByIdCard = await prisma.user.findFirst({
      where: {
        idCardNumber: idCardNumber,
        companyId: companyId
      }
    });

    if (existingUserByIdCard) {
      throw new ValidationError('ID card number already exists in this company');
    }
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
      where: { id: sponsorId },
      select: { id: true, active: true }
    });

    if (!sponsor) {
      throw new ValidationError('Sponsor not found');
    }

    if (!sponsor.active) {
      throw new ValidationError('Sponsor account is not active');
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user with MLM-specific fields
  const fullName = `${firstName} ${surname}`;
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      memberId,
      firstName,
      surname,
      fullName,
      phoneNumber: normalizedPhone,
      sponsorId,
      companyId,
      active: true,
      accountType: accountType || 'Customer',
      idCardNumber,
      idCardUrl,
      placementParentId,
      position,
      referralCode,
      teamSize: {},
      children: {},
      addresses: {}
    }
  });

  logger.info('User registered successfully', {
    userId: user.id,
    email: user.email,
    memberId: user.memberId,
    accountType: user.accountType,
    sponsorId: user.sponsorId,
    companyId: user.companyId
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

// MLM-specific user registration with advanced validation and genealogy
export async function registerMLMUser(data: RegisterData): Promise<AuthUser> {
  const {
    email,
    password,
    firstName,
    surname,
    phoneNumber,
    sponsorId,
    companyId,
    idCardNumber,
    idCardUrl,
    placementParentId,
    position,
    referralCode,
    accountType
  } = data;

  // Normalize email to lowercase for consistency (PostgreSQL is case-sensitive)
  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  if (!validateEmail(normalizedEmail)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate phone number
  if (!validatePhoneNumber(phoneNumber)) {
    throw new ValidationError('Invalid phone number format');
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    throw new ValidationError('Email already registered');
  }

  // Check if phone number already exists
  const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').trim();
  const existingUserByPhone = await prisma.user.findUnique({
    where: { phoneNumber: normalizedPhone }
  });

  if (existingUserByPhone) {
    throw new ValidationError('Phone number already registered');
  }

  // Check ID card number uniqueness within company if provided
  if (idCardNumber && companyId) {
    const existingUserByIdCard = await prisma.user.findFirst({
      where: {
        idCardNumber: idCardNumber,
        companyId: companyId
      }
    });

    if (existingUserByIdCard) {
      throw new ValidationError('ID card number already exists in this company');
    }
  }

  // Validate sponsor exists if provided
  if (sponsorId) {
    const sponsor = await prisma.user.findUnique({
      where: { id: sponsorId },
      select: { id: true, active: true }
    });

    if (!sponsor) {
      throw new ValidationError('Sponsor not found');
    }

    if (!sponsor.active) {
      throw new ValidationError('Sponsor account is not active');
    }
  }

  // Generate member ID using MLM-specific logic
  const memberId = await generateMLMMemberId(firstName, surname, phoneNumber, sponsorId);

  // Determine genealogy placement using MLM logic
  const placement = await determineMLMPlacement(sponsorId, placementParentId, position);

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user with MLM-specific fields
  const fullName = `${firstName} ${surname}`;
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      memberId,
      firstName,
      surname,
      fullName,
      phoneNumber: normalizedPhone,
      sponsorId,
      companyId,
      active: true,
      accountType: accountType || 'Customer',
      idCardNumber,
      idCardUrl,
      placementParentId: placement.placementParentId,
      position: placement.position,
      referralCode,
      rank: 'Member',
      pv: 0,
      teamSize: { left: 0, right: 0, total: 0 },
      children: { left: null, right: null },
      addresses: [],
      failedLoginAttempts: 0
    }
  });

  // Update genealogy relationships
  await updateMLMGenealogy(user.id, placement.placementParentId, placement.position);

  logger.info('MLM User registered successfully', {
    userId: user.id,
    email: user.email,
    memberId: user.memberId,
    accountType: user.accountType,
    sponsorId: user.sponsorId,
    companyId: user.companyId,
    placementParentId: placement.placementParentId,
    position: placement.position
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
export async function loginUser(credentials: LoginCredentials): Promise<{
  user: AuthUser;
  tokens: AuthTokens | null;
  requiresMFA?: boolean;
  mfaMethods?: string[];
}> {
  const { memberId, password } = credentials;

  // Validate that memberId is provided
  if (!memberId || !memberId.trim()) {
    throw new ValidationError('Member ID is required');
  }

  // Find user by memberId
  const normalizedMemberId = memberId.trim();
  const user = await prisma.user.findUnique({
    where: { memberId: normalizedMemberId }
  });

  if (!user) {
    // Don't reveal if user exists or not for security
    throw new AuthenticationError('Invalid Member ID or password');
  }

  if (!user.active) {
    throw new AuthenticationError('Account is deactivated');
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - new Date().getTime()) / (1000 * 60));
    throw new AuthenticationError(
      `Account is temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`
    );
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);

  if (!isValidPassword) {
    // Increment failed attempts
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updates: any = { 
      failedLoginAttempts: failedAttempts,
      lastFailedLogin: new Date()
    };

    // Lock account after 5 failed attempts for 30 minutes
    if (failedAttempts >= 5) {
      updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
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

    throw new AuthenticationError('Invalid Member ID or password');
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
    companyId: user.companyId || undefined,
    storeOwnerLevel: user.storeOwnerLevel || null
  };

  // Check if MFA is required for admin users
  const requiresMFA = user.isAdmin || user.accountType === 'SuperAdmin' || user.accountType === 'Admin';

  logger.info('User login validation', {
    userId: user.id,
    email: user.email,
    requiresMFA,
    accountType: user.accountType,
    isAdmin: user.isAdmin
  });

  if (requiresMFA) {
    // For admin users, always require MFA
    return {
      user: authUser,
      tokens: null, // Don't issue tokens yet
      requiresMFA: true,
      mfaMethods: ['totp', 'sms']
    };
  }

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
    const decoded = jwt.verify(refreshToken, getJwtRefreshSecret()) as any;
    const userId = decoded.userId;

    // Get user data for new tokens
    // Note: In production, you'd want to store refresh tokens in database
    // and validate them properly. This is a simplified implementation.

    // For now, we'll need the user data passed or retrieved
    // This is a limitation of the simplified implementation
    return null; // Implement properly based on your needs

  } catch (error) {
    logger.error('Refresh token verification failed:', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Auth service health check failed:', { error: error instanceof Error ? error.message : String(error) });
    return { status: 'unhealthy', timestamp: new Date() };
  }
}

// MLM-specific helper functions
async function generateMLMMemberId(firstName: string, surname: string, phoneNumber: string, sponsorId?: string): Promise<string> {
  // Use the same logic as the registration route for consistency
  const idPattern = /^([A-Z]+)(\d+)$/;
  let prefix = 'MEM';
  let nextNumber = 1;
  let numberLength = 3;

  // Check if sponsor exists and extract their ID pattern
  if (sponsorId) {
    const sponsor = await prisma.user.findFirst({
      where: {
        OR: [
          { id: sponsorId },
          { memberId: sponsorId }
        ]
      },
      select: { memberId: true }
    });

    if (sponsor && sponsor.memberId) {
      const sponsorMatch = sponsor.memberId.match(idPattern);
      if (sponsorMatch) {
        prefix = sponsorMatch[1];
        const sponsorNumber = parseInt(sponsorMatch[2], 10);
        numberLength = sponsorMatch[2].length;
        nextNumber = sponsorNumber + 1;
      }
    }
  }

  // If not following sponsor, use MEM pattern as default
  if (!sponsorId) {
    const existingMemMembers = await prisma.user.findMany({
      where: {
        memberId: {
          startsWith: 'MEM'
        },
        deleted: false
      },
      select: { memberId: true }
    });

    const memPattern = /^MEM(\d+)$/;
    const existingNumbers = existingMemMembers
      .map(m => {
        const match = m.memberId.match(memPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0)
      .sort((a, b) => a - b);

    if (existingNumbers.length > 0) {
      for (let i = 0; i < existingNumbers.length; i++) {
        const expected = i + 1;
        if (existingNumbers[i] !== expected) {
          nextNumber = expected;
          break;
        }
      }
      if (nextNumber === 1) {
        nextNumber = Math.max(...existingNumbers) + 1;
      }
    }
  } else {
    // When following sponsor, check for existing IDs with same prefix
    const existingSamePrefix = await prisma.user.findMany({
      where: {
        memberId: {
          startsWith: prefix
        },
        deleted: false
      },
      select: { memberId: true }
    });

    const prefixPattern = new RegExp(`^${prefix}(\\d+)$`);
    const existingNumbers = existingSamePrefix
      .map(m => {
        const match = m.memberId.match(prefixPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0)
      .sort((a, b) => a - b);

    if (existingNumbers.length > 0) {
      for (const num of existingNumbers) {
        if (num >= nextNumber) {
          if (num === nextNumber) {
            nextNumber = num + 1;
          } else {
            break;
          }
        }
      }
    }
  }

  // Generate ID with prefix and zero-padded number
  let candidateId = `${prefix}${nextNumber.toString().padStart(numberLength, '0')}`;

  // Double-check for uniqueness
  let counter = 0;
  while (counter < 999) {
    const existing = await prisma.user.findUnique({
      where: { memberId: candidateId }
    });

    if (!existing) {
      return candidateId;
    }

    nextNumber++;
    candidateId = `${prefix}${nextNumber.toString().padStart(numberLength, '0')}`;
    counter++;
  }

  // Fallback: use timestamp-based ID
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

async function determineMLMPlacement(sponsorId?: string, placementParentId?: string, position?: string): Promise<{
  placementParentId: string | null;
  position: 'left' | 'right' | null;
}> {
  let finalPlacementParentId = placementParentId;
  let finalPosition = position as 'left' | 'right' | null;

  // If no placement specified, find first available position under sponsor
  if (!finalPlacementParentId && sponsorId) {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        memberId: true,
        sponsorId: true,
        placementParentId: true,
        position: true,
        children: true,
        active: true,
        isAdmin: true
      }
    });

    // Check if sponsor is superadmin - cannot place under superadmin
    const { isSuperAdmin } = await import('@/lib/superadmin-helper');
    const isSuperadminSponsor = await isSuperAdmin(sponsorId);

    if (isSuperadminSponsor) {
      console.warn(`⚠️ Cannot place member under superadmin sponsor ${sponsorId}. Finding alternative placement.`);
      // Find alternative non-superadmin placement
      const nonSuperadminUsers = allUsers.filter(u => u.id !== sponsorId && !u.isAdmin);

      if (nonSuperadminUsers.length > 0) {
        const alternativeSponsor = nonSuperadminUsers[0];
        const alternativePlacement = await findFirstAvailablePosition(alternativeSponsor.id, new Map(nonSuperadminUsers.map(u => [u.id, u])));
        if (alternativePlacement) {
          finalPlacementParentId = alternativePlacement.parentId;
          finalPosition = alternativePlacement.position;
        }
      }
    } else {
      // Use sponsor as placement parent
      const placement = await findFirstAvailablePosition(sponsorId, new Map(allUsers.map(u => [u.id, u])));
      if (placement) {
        finalPlacementParentId = placement.parentId;
        finalPosition = placement.position;
      }
    }
  }

  return {
    placementParentId: finalPlacementParentId || null,
    position: finalPosition || null
  };
}

async function updateMLMGenealogy(userId: string, placementParentId: string | null, position: 'left' | 'right' | null) {
  // Update parent's children if placement was made
  if (placementParentId && position) {
    const parent = await prisma.user.findUnique({
      where: { id: placementParentId },
      select: { children: true }
    });

    if (parent) {
      const updatedChildren = { ...(parent.children as any) };
      updatedChildren[position] = userId;

      await prisma.user.update({
        where: { id: placementParentId },
        data: { children: updatedChildren }
      });

      // Update team sizes
      try {
        const { PVMatchingService } = await import('@/services/pv-matching-service');

        // Update direct parent's teamSize
        await PVMatchingService.updateTeamSize(placementParentId);

        // Update all upline sponsors' teamSize (cascade)
        await PVMatchingService.updateUplineTeamSizes(userId);
      } catch (error) {
        console.error('Error updating team sizes:', error);
      }

      // Trigger Daily Match and commissions
      try {
        const { checkAndTriggerDailyMatch, triggerUplineCascade } = await import('@/services/daily-match-trigger');

        await checkAndTriggerDailyMatch(placementParentId);
        await triggerUplineCascade(userId);
      } catch (error) {
        console.error('Error triggering matches:', error);
      }
    }
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
