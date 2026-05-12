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
      const data = await res.json();
      return { user: data.user as AuthUser, token: data.tokens?.accessToken || data.token };
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
      const result = await res.json();
      return { user: result.user as AuthUser, token: result.tokens?.accessToken || result.token };
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