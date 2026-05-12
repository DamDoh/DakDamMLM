'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useCompany } from '@/context/company-context';

interface ThemeContextType {
  primaryColor: string;
  secondaryColor: string;
  applyTheme: (primary: string, secondary: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { company } = useCompany();
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#64748b');

  useEffect(() => {
    if (company?.primaryColor) {
      setPrimaryColor(company.primaryColor);
    }
    if (company?.secondaryColor) {
      setSecondaryColor(company.secondaryColor);
    }
  }, [company]);

  const applyTheme = (primary: string, secondary: string) => {
    setPrimaryColor(primary);
    setSecondaryColor(secondary);

    // Apply CSS custom properties
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-foreground', getContrastColor(primary));
    document.documentElement.style.setProperty('--secondary', secondary);
    document.documentElement.style.setProperty('--secondary-foreground', getContrastColor(secondary));
  };

  useEffect(() => {
    applyTheme(primaryColor, secondaryColor);
  }, [primaryColor, secondaryColor]);

  return (
    <ThemeContext.Provider value={{ primaryColor, secondaryColor, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper function to determine contrast color
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const color = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}