"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const utils_1 = require("../../../../../shared/utils");
class AuthService {
    constructor() {
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
    }
    getJWTSecret() {
        if (!process.env.JWT_SECRET) {
            throw new Error('CRITICAL: JWT_SECRET environment variable must be set.');
        }
        return process.env.JWT_SECRET;
    }
    async hashPassword(password) {
        const saltRounds = 12;
        return bcryptjs_1.default.hash(password, saltRounds);
    }
    async verifyPassword(password, hashedPassword) {
        return bcryptjs_1.default.compare(password, hashedPassword);
    }
    generateTokens(user) {
        const JWT_SECRET = this.getJWTSecret();
        const payload = {
            userId: user.id,
            email: user.email,
            memberId: user.memberId,
            fullName: user.fullName,
            isAdmin: user.isAdmin,
            accountType: user.accountType,
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        return { accessToken, refreshToken };
    }
    verifyToken(token) {
        const JWT_SECRET = this.getJWTSecret();
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            return {
                id: decoded.userId,
                email: decoded.email,
                memberId: decoded.memberId,
                fullName: decoded.fullName,
                isAdmin: decoded.isAdmin,
                accountType: decoded.accountType,
            };
        }
        catch (error) {
            return null;
        }
    }
    async registerUser(data) {
        const { email, password, firstName, surname, phoneNumber, memberId, sponsorId } = data;
        utils_1.ValidationUtils.validateRequired(email, 'email');
        utils_1.ValidationUtils.validateRequired(password, 'password');
        utils_1.ValidationUtils.validateRequired(firstName, 'firstName');
        utils_1.ValidationUtils.validateRequired(surname, 'surname');
        utils_1.ValidationUtils.validateRequired(phoneNumber, 'phoneNumber');
        if (password.length < 8) {
            throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Password must be at least 8 characters long');
        }
        if (!utils_1.ValidationUtils.isValidEmail(email)) {
            throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid email format');
        }
        if (!utils_1.ValidationUtils.isValidPhoneNumber(phoneNumber)) {
            throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid phone number format');
        }
        // Check if user already exists
        const existingUser = await database_1.userDb.user.findFirst({
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
                throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Email already registered');
            }
            if (existingUser.phoneNumber === phoneNumber) {
                throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Phone number already registered');
            }
            if (memberId && existingUser.memberId === memberId) {
                throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Member ID already exists');
            }
        }
        const hashedPassword = await this.hashPassword(password);
        const userData = {
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
        const user = await database_1.userDb.user.create({ data: userData });
        return {
            id: user.id,
            email: user.email || '',
            memberId: user.memberId || undefined,
            fullName: user.fullName,
            isAdmin: user.isAdmin,
            accountType: 'Distributor',
        };
    }
    async loginUser(credentials) {
        const { email, password } = credentials;
        utils_1.ValidationUtils.validateRequired(email, 'email');
        utils_1.ValidationUtils.validateRequired(password, 'password');
        if (!utils_1.ValidationUtils.isValidEmail(email)) {
            throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'Invalid email format');
        }
        const user = await database_1.userDb.user.findUnique({
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
            throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid email or password');
        }
        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
            const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (1000 * 60));
            throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', `Account is locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minutes.`);
        }
        const isValidPassword = await this.verifyPassword(password, user.password);
        if (!isValidPassword) {
            const failedAttempts = (user.failedLoginAttempts || 0) + 1;
            const maxAttempts = 5;
            const lockoutMinutes = 30;
            const updateData = {
                failedLoginAttempts: failedAttempts,
                lastFailedLogin: now
            };
            if (failedAttempts >= maxAttempts) {
                updateData.lockedUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000);
            }
            await database_1.userDb.user.update({
                where: { id: user.id },
                data: updateData
            });
            throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid email or password');
        }
        if (!user.active) {
            throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Account is deactivated');
        }
        await database_1.userDb.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastFailedLogin: null,
                updatedAt: now
            }
        });
        const authUser = {
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
    async refreshToken(refreshToken) {
        const JWT_SECRET = this.getJWTSecret();
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, JWT_SECRET);
            const userId = decoded.userId;
            const user = await database_1.userDb.user.findUnique({ where: { id: userId } });
            if (!user || !user.active) {
                throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid refresh token');
            }
            const authUser = {
                id: user.id,
                email: user.email || '',
                memberId: user.memberId || undefined,
                fullName: user.fullName,
                isAdmin: user.isAdmin,
                accountType: 'Distributor',
            };
            return this.generateTokens(authUser);
        }
        catch (error) {
            throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Invalid refresh token');
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        utils_1.ValidationUtils.validateRequired(currentPassword, 'currentPassword');
        utils_1.ValidationUtils.validateRequired(newPassword, 'newPassword');
        if (newPassword.length < 8) {
            throw utils_1.ServiceErrorHandler.createError('VALIDATION_ERROR', 'New password must be at least 8 characters long');
        }
        const user = await database_1.userDb.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'User not found');
        }
        const isValidPassword = await this.verifyPassword(currentPassword, user.password);
        if (!isValidPassword) {
            throw utils_1.ServiceErrorHandler.createError('AUTHENTICATION_ERROR', 'Current password is incorrect');
        }
        const hashedNewPassword = await this.hashPassword(newPassword);
        await database_1.userDb.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });
    }
    async getUserById(userId) {
        const user = await database_1.userDb.user.findUnique({ where: { id: userId } });
        if (!user)
            return null;
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
    async requestEmailVerification(userId, companyId) {
        // Implementation would call OTP service
        return { success: true };
    }
    async verifyEmailWithOtp(email, otpCode, companyId) {
        // Implementation would call OTP service
        return { success: true };
    }
    async requestPasswordReset(email, companyId) {
        // Implementation would call OTP service
        return { success: true };
    }
    async resetPasswordWithOtp(email, otpCode, newPassword, companyId) {
        // Implementation would call OTP service
        return { success: true };
    }
    async requestSmsVerification(userId, companyId) {
        // Implementation would call OTP service
        return { success: true };
    }
    async verifySmsWithOtp(phoneNumber, otpCode, companyId) {
        // Implementation would call OTP service
        return { success: true };
    }
    async healthCheck() {
        try {
            await database_1.userDb.$queryRaw `SELECT 1`;
            return { status: 'healthy', timestamp: new Date().toISOString() };
        }
        catch (error) {
            return { status: 'unhealthy', timestamp: new Date().toISOString() };
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map