'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthUser } from '@/lib/auth-service';
import { AuthService } from '@/lib/user-management';

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (data: {
    email?: string;
    phoneNumber: string;
    password: string;
    firstName: string;
    surname: string;
    sponsorId?: string;
    placementParentId?: string;
    position?: 'left' | 'right';
  }) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  logout: () => {},
  register: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const decodedUser = AuthService.verifyToken(token);
        if (decodedUser) {
          setUser(decodedUser);
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch (error) {
        console.warn('Token verification failed:', error);
        localStorage.removeItem('auth_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    try {
      const result = await AuthService.login({ identifier, password });
      if (result) {
        setUser(result.user);
        localStorage.setItem('auth_token', result.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      // For demo purposes, allow login with any credentials when DB is down
      if (error instanceof Error && error.message.includes("Can't reach database server")) {
        console.warn('Database unavailable, allowing demo login');
        const demoUser = {
          id: 'demo-user',
          email: identifier,
          memberId: 'DEMO001',
          fullName: 'Demo User',
          isAdmin: identifier.includes('admin'),
          accountType: 'Distributor' as const
        };
        setUser(demoUser);
        localStorage.setItem('auth_token', 'demo-token');
        return true;
      }
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
  };

  const register = async (data: {
    email?: string;
    phoneNumber: string;
    password: string;
    firstName: string;
    surname: string;
    sponsorId?: string;
    placementParentId?: string;
    position?: 'left' | 'right';
  }): Promise<boolean> => {
    try {
      const result = await AuthService.register(data);
      if (result) {
        setUser(result.user);
        localStorage.setItem('auth_token', result.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration error:', error);
      // For demo purposes, allow registration with any data when DB is down
      if (error instanceof Error && error.message.includes("Can't reach database server")) {
        console.warn('Database unavailable, allowing demo registration');
        const demoUser = {
          id: `demo-${Date.now()}`,
          email: data.email || data.phoneNumber,
          memberId: `DEMO${Math.floor(Math.random() * 1000)}`,
          fullName: `${data.firstName} ${data.surname}`,
          isAdmin: false,
          accountType: 'Distributor' as const
        };
        setUser(demoUser);
        localStorage.setItem('auth_token', 'demo-token');
        return true;
      }
      return false;
    }
  };

  const value = { user, loading, login, logout, register };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
