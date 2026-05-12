'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Company } from '@/lib/types';
import { useAuthContext } from '@/context/auth-context';

interface CompanyContextType {
  company: Company | null;
  setCompany: (company: Company | null) => void;
  isLoading: boolean;
  updateCompanyBranding: (updates: Partial<Company>) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get user from auth context (CompanyProvider should be inside AuthProvider)
  // This will throw if not inside AuthProvider, but that's expected
  const { user } = useAuthContext();

  useEffect(() => {
    // Load company data based on domain, URL parameter, or logged-in user
    loadCompanyData();
  }, [user?.companyId]);

  const loadCompanyData = async () => {
    try {
      setIsLoading(true);

      // First, try to get company from logged-in user
      let companyId: string | null = null;
      
      if (user?.companyId) {
        companyId = user.companyId;
      } else {
        // Fallback: try to get from token
        const token = localStorage.getItem('auth_token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            companyId = payload.companyId || null;
          } catch (e) {
            // Token parsing failed, continue with other methods
          }
        }
      }

      // If no companyId from user, check URL parameter
      if (!companyId) {
        const urlParams = new URLSearchParams(window.location.search);
        companyId = urlParams.get('company');
      }

      let companyData: Company | null = null;

      if (companyId) {
        // Load specific company by ID
        const response = await fetch(`/api/company/${companyId}`);
        if (response.ok) {
          companyData = await response.json();
        }
      } else {
        // Try to find company by domain (only if no companyId from user)
        // This is useful for public pages, but should not be required for logged-in users
        const hostname = window.location.hostname;
        // Skip domain lookup for localhost/development to avoid 404 errors
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          try {
            const response = await fetch(`/api/company?domain=${hostname}`);
            if (response.ok) {
              companyData = await response.json();
            }
            // Silently handle 404 - no company found for this domain is OK
          } catch (error) {
            // Silently handle fetch errors - domain lookup is optional
            console.debug('Company domain lookup failed (this is OK):', error);
          }
        }
      }

      setCompany(companyData);
    } catch (error) {
      console.error('Failed to load company data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCompanyBranding = async (updates: Partial<Company>) => {
    if (!company) return;

    try {
      const response = await fetch(`/api/company/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedCompany = await response.json();
        setCompany(updatedCompany);
      }
    } catch (error) {
      console.error('Failed to update company branding:', error);
      throw error;
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        company,
        setCompany,
        isLoading,
        updateCompanyBranding,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}