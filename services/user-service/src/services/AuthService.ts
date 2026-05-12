import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userDb as db } from '../config/database';
import { ServiceErrorHandler, ValidationUtils } from '../../../../shared/utils';

interface AuthUser {
  id: string;
  email: string;
  memberId?: string;
  fullName: string;
  isAdmin: boolean;
  accountType: 'Distributor' | 'Customer';
}

interface LoginCredentials {
  memberId: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  surname: string;
  phoneNumber: string;
  memberId?: string;
  sponsorId?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private getJWTSecret(): string {
    if (!process.env.JWT_SECRET) {
      throw new Error('CRITICAL: JWT_SECRET environment variable must be set.');
    }
    return process.env.JWT_SECRET;
  }

  private JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateTokens(user: AuthUser): AuthTokens {
    const JWT_SECRET = this.getJWTSecret();

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

  verifyToken(token: string): AuthUser | null {
    const JWT_SECRET = this.getJWTSecret();

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

  async registerUser(data: RegisterData): Promise<AuthUser> {
    const { email, password, firstName, surname, phoneNumber, memberId, sponsorId } = data;

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

    const hashedPassword = await this.hashPassword(password);

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

    if (memberId && memberId.trim() !== '') {
      userData.memberId = memberId;
    }

    const user = await db.user.create({ data: userData });

    return {
      id: user.id,
      email: user.email || '',
      memberId: user.memberId || undefined,
      fullName: user.fullName,
      isAdmin: user.isAdmin,
      accountType: 'Distributor',
    };
  }

  async bulkRegisterUsers(users: RegisterData[]): Promise<AuthUser[]> {
    const results: AuthUser[] = [];
    for (const data of users) {
      try {
        const user = await this.registerUser(data);
        results.push(user);
      } catch (error) {
        // Log error and continue, or collect errors
        console.error(`Failed to register user ${data.email}:`, error);
      }
    }
    return results;
  }

  async loginUser(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { memberId, password } = credentials;

    ValidationUtils.validateRequired(memberId, 'memberId');
    ValidationUtils.validateRequired(password, 'password');

    const user = await db.user.findUnique({
      where: { memberId: memberId.trim() },
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
      throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid Member ID or password');
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (1000 * 60));
      throw ServiceErrorHandler.createError(
        'AUTHENTICATION_ERROR',
        `Account is locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minutes.`
      );
    }

    const isValidPassword = await this.verifyPassword(password, user.password);

    if (!isValidPassword) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const maxAttempts = 5;
      const lockoutMinutes = 30;

      const updateData: any = {
        failedLoginAttempts: failedAttempts,
        lastFailedLogin: now
      };

      if (failedAttempts >= maxAttempts) {
        updateData.lockedUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000);
      }

      await db.user.update({
        where: { id: user.id },
        data: updateData
      });

      throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid email or password');
    }

    if (!user.active) {
      throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Account is deactivated');
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null,
        updatedAt: now
      }
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email || '',
      memberId: user.memberId || undefined,
      fullName: user.fullName,
      isAdmin: user.isAdmin,
      accountType: 'Distributor',
    };

    const tokens = this.generateTokens(authUser);

    return { user: authUser, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const JWT_SECRET = this.getJWTSecret();

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      const userId = decoded.userId;

      const user = await db.user.findUnique({ where: { id: userId } });

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

      return this.generateTokens(authUser);
    } catch (error) {
      throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid refresh token');
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    ValidationUtils.validateRequired(currentPassword, 'currentPassword');
    ValidationUtils.validateRequired(newPassword, 'newPassword');

    if (newPassword.length < 8) {
      throw ServiceErrorHandler.createError('VALIDATION_ERROR', 'New password must be at least 8 characters long');
    }

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'User not found');
    }

    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Current password is incorrect');
    }

    const hashedNewPassword = await this.hashPassword(newPassword);

    await db.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const user = await db.user.findUnique({ where: { id: userId } });

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

  // OTP methods would call the OTP service via HTTP or message queue
  async requestEmailVerification(userId: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    // Implementation would call OTP service
    return { success: true };
  }

  async verifyEmailWithOtp(email: string, otpCode: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    // Implementation would call OTP service
    return { success: true };
  }

  async requestPasswordReset(email: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    // Implementation would call OTP service
    return { success: true };
  }

  async resetPasswordWithOtp(email: string, otpCode: string, newPassword: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    // Implementation would call OTP service
    return { success: true };
  }

  async requestSmsVerification(userId: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    // Implementation would call OTP service
    return { success: true };
  }

  async verifySmsWithOtp(phoneNumber: string, otpCode: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    // Implementation would call OTP service
    return { success: true };
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', timestamp: new Date().toISOString() };
    }
  }
}