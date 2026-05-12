// Comprehensive Internationalization System
// Complete i18n setup for MLM platform with 10+ languages

import { createInstance, Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import all translations
import { en } from '@/lib/translations/en';
import { zh } from '@/lib/translations/zh';
import { ja } from '@/lib/translations/ja';
import { ko } from '@/lib/translations/ko';
import { th } from '@/lib/translations/th';
import { vi } from '@/lib/translations/vi';
import { id } from '@/lib/translations/id';
import { es } from '@/lib/translations/es';
import { fil } from '@/lib/translations/fil';
import { fr } from '@/lib/translations/fr';
import { de } from '@/lib/translations/de';
import { km } from '@/lib/translations/km';

// Language resources
const resources: Resource = {
  en: { translation: en },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  th: { translation: th },
  vi: { translation: vi },
  id: { translation: id },
  es: { translation: es },
  fil: { translation: fil },
  fr: { translation: fr },
  de: { translation: de },
  km: { translation: km },
};

// Language metadata
export const LANGUAGES = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
  zh: { name: 'Chinese (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳', rtl: false },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rtl: false },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷', rtl: false },
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', rtl: false },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', rtl: false },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', rtl: false },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  fil: { name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', rtl: false },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false },
  km: { name: 'Khmer', nativeName: 'ខ្មែរ', flag: '🇰🇭', rtl: false },
};

// Default language
const DEFAULT_LANGUAGE = 'en';

// Supported languages for the platform
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGES);

// Initialize i18next instance
const i18n = createInstance({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,

  // Debug settings
  debug: process.env.NODE_ENV === 'development',

  // Interpolation settings
  interpolation: {
    escapeValue: false, // React already escapes values
  },

  // Detection settings (for browser)
  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  },

  // React integration
  react: {
    useSuspense: false,
  },

  // Custom key separator
  keySeparator: '.',

  // Namespace
  defaultNS: 'translation',
  ns: ['translation'],
});

// Initialize React i18next
i18n.use(initReactI18next).init();

// Utility functions
export const changeLanguage = async (language: string): Promise<void> => {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    console.warn(`Language '${language}' is not supported. Falling back to '${DEFAULT_LANGUAGE}'.`);
    language = DEFAULT_LANGUAGE;
  }

  try {
    await i18n.changeLanguage(language);

    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', language);
    }

    // Update document attributes for RTL support
    const isRTL = LANGUAGES[language as keyof typeof LANGUAGES]?.rtl;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;

    console.log(`Language changed to: ${language}`);
  } catch (error) {
    console.error('Failed to change language:', error);
  }
};

export const getCurrentLanguage = (): string => {
  return i18n.language || DEFAULT_LANGUAGE;
};

export const getLanguageInfo = (language: string) => {
  return LANGUAGES[language as keyof typeof LANGUAGES] || LANGUAGES[DEFAULT_LANGUAGE];
};

export const isLanguageSupported = (language: string): boolean => {
  return SUPPORTED_LANGUAGES.includes(language);
};

// Translation helper functions
export const t = (key: string, options?: any): string => {
  return i18n.t(key, options);
};

export const tPlural = (key: string, count: number, options?: any): string => {
  return i18n.t(key, { ...options, count });
};

export const tExists = (key: string): boolean => {
  return i18n.exists(key);
};

// MLM-specific translation helpers
export const tCommission = (type: string, amount: number): string => {
  const key = `commission.type.${type}`;
  return t(key, { amount, defaultValue: `${type}: ${amount}` });
};

export const tRank = (rank: string): string => {
  const key = `rank.${rank.toLowerCase()}`;
  return t(key, { defaultValue: rank });
};

export const tCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat(getCurrentLanguage(), {
    style: 'currency',
    currency,
  }).format(amount);
};

export const tDate = (date: Date): string => {
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const tRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(getCurrentLanguage(), { numeric: 'auto' });

  if (diffInSeconds < 60) return rtf.format(-diffInSeconds, 'second');
  if (diffInSeconds < 3600) return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  if (diffInSeconds < 86400) return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  if (diffInSeconds < 2592000) return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
};

// Language switching utilities
export const getLanguageOptions = () => {
  return SUPPORTED_LANGUAGES.map(lang => ({
    code: lang,
    ...LANGUAGES[lang as keyof typeof LANGUAGES],
  }));
};

export const detectUserLanguage = (): string => {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  // Check localStorage first
  const stored = localStorage.getItem('i18nextLng');
  if (stored && isLanguageSupported(stored)) {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (isLanguageSupported(browserLang)) {
    return browserLang;
  }

  // Check for regional variants
  const browserLangFull = navigator.language;
  const languageMatch = SUPPORTED_LANGUAGES.find(lang =>
    browserLangFull.startsWith(lang) || lang.startsWith(browserLang)
  );

  return languageMatch || DEFAULT_LANGUAGE;
};

// Admin language (always English as requested)
export const ADMIN_LANGUAGE = 'en';

export const isAdminLanguage = (language: string): boolean => {
  return language === ADMIN_LANGUAGE;
};

// Translation validation
export const validateTranslations = (): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];
  const englishKeys = Object.keys(en);

  SUPPORTED_LANGUAGES.forEach(lang => {
    if (lang === 'en') return; // Skip English as it's the source

    const langTranslations = resources[lang]?.translation;
    if (!langTranslations) {
      missing.push(`${lang}: entire language missing`);
      return;
    }

    englishKeys.forEach(key => {
      if (!langTranslations[key]) {
        missing.push(`${lang}: ${key}`);
      }
    });
  });

  return {
    valid: missing.length === 0,
    missing,
  };
};

// Translation statistics
export const getTranslationStats = () => {
  const stats: Record<string, { total: number; translated: number; percentage: number }> = {};

  const englishKeys = Object.keys(en);

  SUPPORTED_LANGUAGES.forEach(lang => {
    const langTranslations = resources[lang]?.translation || {};
    const translatedKeys = englishKeys.filter(key => !!langTranslations[key]);

    stats[lang] = {
      total: englishKeys.length,
      translated: translatedKeys.length,
      percentage: Math.round((translatedKeys.length / englishKeys.length) * 100),
    };
  });

  return stats;
};

// Export the configured i18n instance
export default i18n;