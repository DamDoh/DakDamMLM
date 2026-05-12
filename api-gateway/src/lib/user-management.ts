import type { AuthUser, RegisterData } from './auth-service';

// Error classes are now imported from auth-service

// AuthService class for client-side usage
export class AuthService {
  static async login(credentials: { identifier: string; password: string }): Promise<{ user: AuthUser; token: string } | null> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.identifier, password: credentials.password }),
      });
      if (!res.ok) return null;

      const raw = await res.json();
      // Handle ApiResponseUtil format: { success, data: { user, tokens }, ... }
      const data = raw.data || raw;
      const user = data.user as AuthUser | undefined;
      const token: string | undefined =
        data.tokens?.accessToken || data.token;

      if (!user || !token) {
        return null;
      }

      return { user, token };
    } catch (error) {
      console.error('AuthService login error:', error);
      return null;
    }
  }

  static async register(data: {
    email?: string;
    phoneNumber: string;
    password: string;
    firstName: string;
    surname: string;
    sponsorId?: string;
    placementParentId?: string;
    position?: 'left' | 'right';
  }): Promise<{ user: AuthUser; token: string } | null> {
    try {
      const payload: Partial<RegisterData> & Record<string, unknown> = {
        email: data.email || '',
        password: data.password,
        firstName: data.firstName,
        surname: data.surname,
        phoneNumber: data.phoneNumber,
        sponsorId: data.sponsorId,
        placementParentId: data.placementParentId,
        position: data.position,
      };
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;

      const raw = await res.json();
      const responseData = raw.data || raw;
      const user = responseData.user as AuthUser | undefined;
      const token: string | undefined =
        responseData.tokens?.accessToken || responseData.token;

      if (!user || !token) {
        return null;
      }

      return { user, token };
    } catch (error) {
      console.error('AuthService register error:', error);
      return null;
    }
  }

  static verifyToken(token: string): AuthUser | null {
    try {
      // Client-side decode without secret; token validity is enforced server-side
      const [, payload] = token.split('.');
      if (!payload) return null;
      const json = JSON.parse(atob(payload));
      return {
        id: json.userId,
        email: json.email,
        memberId: json.memberId,
        fullName: json.fullName,
        isAdmin: !!json.isAdmin,
        accountType: json.accountType || 'Customer',
      };
    } catch {
      return null;
    }
  }
}