'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Company } from '@/lib/types';

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

  useEffect(() => {
    // Load company data based on domain or URL parameter
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      setIsLoading(true);

      // Get company from domain or URL parameter
      const hostname = window.location.hostname;
      const urlParams = new URLSearchParams(window.location.search);
      const companyId = urlParams.get('company');

      let companyData: Company | null = null;

      if (companyId) {
        // Load specific company by ID
        const response = await fetch(`/api/company/${companyId}`);
        if (response.ok) {
          companyData = await response.json();
        }
      } else {
        // Try to find company by domain
        const response = await fetch(`/api/company/by-domain?domain=${hostname}`);
        if (response.ok) {
          companyData = await response.json();
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