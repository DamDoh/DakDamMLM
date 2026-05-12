
'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { CartProvider } from '@/context/cart-context';
import { AuthProvider } from '@/context/auth-context';
import { I18nContext, SUPPORTED_LANGUAGES, DEFAULT_TRANSLATIONS, type I18nContextType } from '@/lib/internationalization';

// Client-only providers; avoid importing server-only auth modules here

// Enhanced I18nProvider with better error handling and performance
function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>('en');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectLanguage = () => {
      try {
        const stored = localStorage.getItem('preferred-language');
        if (stored && SUPPORTED_LANGUAGES.some(lang => lang.code === stored)) {
          return stored;
        }

        const detected = typeof window !== 'undefined' ? navigator.language.split('-')[0] : 'en';
        return SUPPORTED_LANGUAGES.some(lang => lang.code === detected) ? detected : 'en';
      } catch (error) {
        console.warn('Failed to detect language:', error);
        return 'en';
      }
    };

    const detectedLanguage = detectLanguage();
    setLanguageState(detectedLanguage);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      try {
        const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === language);
        document.documentElement.dir = langInfo?.isRTL ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
      } catch (error) {
        console.warn('Failed to set document language attributes:', error);
      }
    }
  }, [language, isLoading]);

  const setLanguage = useCallback((langCode: string) => {
    try {
      if (SUPPORTED_LANGUAGES.some(lang => lang.code === langCode)) {
        setLanguageState(langCode);
        localStorage.setItem('preferred-language', langCode);
      }
    } catch (error) {
      console.warn('Failed to set language:', error);
    }
  }, []);

  const t = useCallback((key: string, variables?: Record<string, string>) => {
    try {
      const langTranslations = (DEFAULT_TRANSLATIONS as Record<string, Record<string, string>>)[language] || DEFAULT_TRANSLATIONS.en;
      let translation = langTranslations[key];

      if (!translation) {
        console.warn(`Missing translation for key "${key}" in language "${language}". Using fallback.`);
        translation = (DEFAULT_TRANSLATIONS.en as Record<string, string>)[key] || key;
      }

      if (variables) {
        Object.entries(variables).forEach(([variable, value]) => {
          translation = translation.replace(new RegExp(`{{${variable}}}`, 'g'), value);
        });
      }

      return translation;
    } catch (error) {
      console.error('Translation error:', error);
      return key;
    }
  }, [language]);

  const getSupportedLanguages = useCallback(() => SUPPORTED_LANGUAGES, []);
  const getCurrentLanguageInfo = useCallback(() => SUPPORTED_LANGUAGES.find(l => l.code === language), [language]);

  const contextValue: I18nContextType = {
    language,
    setLanguage,
    t,
    getSupportedLanguages,
    getCurrentLanguageInfo,
  };

  // Show loading state while detecting language
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

// Enhanced ClientProviders with error boundaries and performance monitoring
export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <I18nProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </I18nProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Error boundary component for better error handling
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ClientProviders Error Boundary caught an error:', error, errorInfo);

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { errorInfo } });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive mb-4">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">
              We&apos;re sorry, but something unexpected happened.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
