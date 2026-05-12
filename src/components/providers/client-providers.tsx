
'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { CartProvider } from '@/context/cart-context';
import { AuthProvider } from '@/context/auth-context';
import { I18nContext, SUPPORTED_LANGUAGES, DEFAULT_TRANSLATIONS, type I18nContextType, type Language } from '@/lib/internationalization';
import { LanguageStorage } from '@/lib/language-storage';

// Client-only providers; avoid importing server-only auth modules here

// Enhanced I18nProvider with dynamic language support
function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [customLanguages, setCustomLanguages] = useState<any[]>([]);

  useEffect(() => {
    // Load custom languages from API
    const loadLanguages = async () => {
      try {
        const loadedCustomLanguages = await LanguageStorage.getAllLanguages();
        setCustomLanguages(loadedCustomLanguages);

        const detectLanguage = () => {
          try {
            const stored = localStorage.getItem('preferred-language');
            const allLanguageCodes = [
              ...SUPPORTED_LANGUAGES.map(l => l.code),
              ...loadedCustomLanguages.map(l => l.code)
            ];
            
            // If stored language is 'en', override to 'km' since Khmer is now the main language
            // Only use stored preference if it's not 'en' and is a valid language code
            if (stored && stored !== 'en' && allLanguageCodes.includes(stored)) {
              return stored;
            }
            
            // If stored was 'en', migrate it to 'km' in localStorage
            if (stored === 'en') {
              localStorage.setItem('preferred-language', 'km');
            }

            const detected = typeof window !== 'undefined' ? navigator.language.split('-')[0] : 'km';
            return allLanguageCodes.includes(detected) ? detected : 'km';
          } catch (error) {
            console.warn('Failed to detect language:', error);
            return 'km';
          }
        };

        const detectedLanguage = detectLanguage();
        setLanguageState(detectedLanguage);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load languages:', error);
        setIsLoading(false);
      }
    };

    loadLanguages();

    // Listen for language updates
    const handleLanguagesUpdated = async () => {
      try {
        const updated = await LanguageStorage.getAllLanguages();
        setCustomLanguages(updated);
      } catch (error) {
        console.error('Failed to reload languages:', error);
      }
    };

    window.addEventListener('languagesUpdated', handleLanguagesUpdated);
    return () => window.removeEventListener('languagesUpdated', handleLanguagesUpdated);
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
      const allLanguageCodes = [
        ...SUPPORTED_LANGUAGES.map(l => l.code),
        ...customLanguages.map((l: any) => l.code)
      ];
      
      if (allLanguageCodes.includes(langCode)) {
        setLanguageState(langCode);
        localStorage.setItem('preferred-language', langCode);
      } else {
        console.warn(`Language ${langCode} not found`);
      }
    } catch (error) {
      console.warn('Failed to set language:', error);
    }
  }, [customLanguages]);

  const t = useCallback((key: string, variables?: Record<string, string>) => {
    try {
      // PRIORITY 1: Check for user edits in localStorage (overrides everything)
      const customLang = customLanguages.find((l: any) => l.code === language);
      if (customLang?.translations[key]) {
        let translation = customLang.translations[key];
        if (variables) {
          Object.entries(variables).forEach(([variable, value]) => {
            translation = translation.replace(new RegExp(`{{${variable}}}`, 'g'), value);
          });
        }
        return translation;
      }
      
      // PRIORITY 2: Try built-in translations
      let langTranslations = (DEFAULT_TRANSLATIONS as Record<string, Record<string, string>>)[language];
      let translation = langTranslations?.[key];
      
      // PRIORITY 3: Fallback to English
      if (!translation) {
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
  }, [language, customLanguages]);

  const getSupportedLanguages = useCallback(() => {
    // Create a map of custom languages by code for deduplication
    const customLanguageMap = new Map<string, Language>();
    customLanguages.forEach((lang: any) => {
      if (lang.code && !customLanguageMap.has(lang.code)) {
        customLanguageMap.set(lang.code, {
          code: lang.code,
          name: lang.name,
          nativeName: lang.nativeName,
          flag: lang.flag,
          isRTL: lang.isRTL
        });
      }
    });

    // Create a map to ensure uniqueness by code
    const uniqueLanguagesMap = new Map<string, Language>();

    // First, add all built-in languages (custom versions will override)
    SUPPORTED_LANGUAGES.forEach(lang => {
      const custom = customLanguageMap.get(lang.code);
      if (custom) {
        // Use custom version (has user edits)
        uniqueLanguagesMap.set(lang.code, custom);
      } else {
        // Use built-in version
        uniqueLanguagesMap.set(lang.code, lang);
      }
    });

    // Add custom languages that aren't in SUPPORTED_LANGUAGES
    customLanguages.forEach((lang: any) => {
      if (lang.code && !uniqueLanguagesMap.has(lang.code)) {
        uniqueLanguagesMap.set(lang.code, {
          code: lang.code,
          name: lang.name,
          nativeName: lang.nativeName,
          flag: lang.flag,
          isRTL: lang.isRTL
        });
      }
    });

    // Return as array, ensuring no duplicates
    return Array.from(uniqueLanguagesMap.values());
  }, [customLanguages]);
  
  const getCurrentLanguageInfo = useCallback(() => {
    const allLanguages = getSupportedLanguages();
    return allLanguages.find(l => l.code === language);
  }, [language, customLanguages, getSupportedLanguages]);

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

