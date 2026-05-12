interface AuthUser {
    id: string;
    email: string;
    memberId?: string;
    fullName: string;
    isAdmin: boolean;
    accountType: 'Distributor' | 'Customer';
}
interface LoginCredentials {
    email: string;
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
export declare class AuthService {
    private getJWTSecret;
    private JWT_EXPIRES_IN;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
    generateTokens(user: AuthUser): AuthTokens;
    verifyToken(token: string): AuthUser | null;
    registerUser(data: RegisterData): Promise<AuthUser>;
    loginUser(credentials: LoginCredentials): Promise<{
        user: AuthUser;
        tokens: AuthTokens;
    }>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    getUserById(userId: string): Promise<AuthUser | null>;
    requestEmailVerification(userId: string, companyId?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    verifyEmailWithOtp(email: string, otpCode: string, companyId?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    requestPasswordReset(email: string, companyId?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    resetPasswordWithOtp(email: string, otpCode: string, newPassword: string, companyId?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    requestSmsVerification(userId: string, companyId?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    verifySmsWithOtp(phoneNumber: string, otpCode: string, companyId?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    healthCheck(): Promise<{
        status: string;
        timestamp: string;
    }>;
}
export {};
//# sourceMappingURL=AuthService.d.ts.map