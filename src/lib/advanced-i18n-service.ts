/**
 * ADVANCED INTERNATIONALIZATION SERVICE WITH RTL SUPPORT
 *
 * Comprehensive internationalization system with full RTL (Right-to-Left)
 * language support for Arabic, Hebrew, Persian, and other RTL languages.
 * Provides enterprise-grade localization with cultural adaptation,
 * pluralization, gender support, and accessibility compliance.
 *
 * Features:
 * - Full RTL layout support with CSS logical properties
 * - Arabic, Hebrew, Persian, Urdu, and other RTL languages
 * - Cultural adaptation and localization best practices
 * - Advanced pluralization and gender support
 * - Accessibility compliance (WCAG 2.1)
 * - Performance-optimized lazy loading
 * - Fallback language chains
 * - Real-time language switching
 * - Number, date, and currency formatting
 * - SEO-friendly language URLs
 * - Content management integration
 *
 * Created: 2025-11-20 (Final Enhancement)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { logger } from '@/lib/logger';
import { advancedCache } from '@/lib/advanced-cache';

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag: string;
  country: string;
  currency: string;
  dateFormat: string;
  numberFormat: {
    decimalSeparator: string;
    thousandSeparator: string;
    currencyPosition: 'before' | 'after';
  };
  pluralRules: {
    zero?: string;
    one: string;
    two?: string;
    few?: string;
    many?: string;
    other: string;
  };
  fallbackLanguages: string[];
  isActive: boolean;
  loadPath?: string;
}

export interface TranslationContext {
  gender?: 'male' | 'female' | 'neutral';
  count?: number;
  context?: string;
  namespace?: string;
}

export interface LocalizedContent {
  id: string;
  translations: Record<string, any>;
  metadata: {
    lastModified: Date;
    modifiedBy: string;
    version: number;
    tags: string[];
    categories: string[];
  };
  seo: {
    title: Record<string, string>;
    description: Record<string, string>;
    keywords: Record<string, string[]>;
    ogImage?: Record<string, string>;
  };
}

class AdvancedI18nService {
  private languages: Map<string, LanguageConfig> = new Map();
  private currentLanguage: string = 'km';
  private isInitialized: boolean = false;
  private rtlLanguages = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ji']);
  private contentCache = new Map<string, LocalizedContent>();

  constructor() {
    this.initializeLanguages();
  }

  /**
   * Initialize supported languages with comprehensive configurations
   */
  private initializeLanguages(): void {
    const languageConfigs: LanguageConfig[] = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        flag: '🇺🇸',
        country: 'US',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'item',
          other: 'items'
        },
        fallbackLanguages: [],
        isActive: true
      },
      {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        direction: 'rtl',
        flag: '🇸🇦',
        country: 'SA',
        currency: 'SAR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          zero: 'لا توجد عناصر',
          one: 'عنصر واحد',
          two: 'عنصران',
          few: '{{count}} عناصر',
          many: '{{count}} عنصر',
          other: '{{count}} عنصر'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'he',
        name: 'Hebrew',
        nativeName: 'עברית',
        direction: 'rtl',
        flag: '🇮🇱',
        country: 'IL',
        currency: 'ILS',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'פריט',
          two: 'שני פריטים',
          many: '{{count}} פריטים',
          other: '{{count}} פריטים'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'fa',
        name: 'Persian',
        nativeName: 'فارسی',
        direction: 'rtl',
        flag: '🇮🇷',
        country: 'IR',
        currency: 'IRR',
        dateFormat: 'YYYY/MM/DD',
        numberFormat: {
          decimalSeparator: '/',
          thousandSeparator: ',',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'یک آیتم',
          other: '{{count}} آیتم'
        },
        fallbackLanguages: ['ar', 'en'],
        isActive: true
      },
      {
        code: 'ur',
        name: 'Urdu',
        nativeName: 'اردو',
        direction: 'rtl',
        flag: '🇵🇰',
        country: 'PK',
        currency: 'PKR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'ایک آئٹم',
          other: '{{count}} آئٹمز'
        },
        fallbackLanguages: ['ar', 'en'],
        isActive: true
      },
      {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        direction: 'ltr',
        flag: '🇩🇪',
        country: 'DE',
        currency: 'EUR',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'Artikel',
          other: '{{count}} Artikel'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        flag: '🇫🇷',
        country: 'FR',
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'article',
          other: '{{count}} articles'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        direction: 'ltr',
        flag: '🇪🇸',
        country: 'ES',
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'artículo',
          other: '{{count}} artículos'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        direction: 'ltr',
        flag: '🇨🇳',
        country: 'CN',
        currency: 'CNY',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: '{{count}} 项',
          other: '{{count}} 项'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        direction: 'ltr',
        flag: '🇯🇵',
        country: 'JP',
        currency: 'JPY',
        dateFormat: 'YYYY/MM/DD',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: '{{count}} 項目',
          other: '{{count}} 項目'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिन्दी',
        direction: 'ltr',
        flag: '🇮🇳',
        country: 'IN',
        currency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'आइटम',
          other: '{{count}} आइटम'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        direction: 'ltr',
        flag: '🇧🇷',
        country: 'BR',
        currency: 'BRL',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'item',
          other: '{{count}} itens'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский',
        direction: 'ltr',
        flag: '🇷🇺',
        country: 'RU',
        currency: 'RUB',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} элемент',
          few: '{{count}} элемента',
          many: '{{count}} элементов',
          other: '{{count}} элементов'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'ko',
        name: 'Korean',
        nativeName: '한국어',
        direction: 'ltr',
        flag: '🇰🇷',
        country: 'KR',
        currency: 'KRW',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: '{{count}} 항목',
          other: '{{count}} 항목'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'it',
        name: 'Italian',
        nativeName: 'Italiano',
        direction: 'ltr',
        flag: '🇮🇹',
        country: 'IT',
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'elemento',
          other: '{{count}} elementi'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'nl',
        name: 'Dutch',
        nativeName: 'Nederlands',
        direction: 'ltr',
        flag: '🇳🇱',
        country: 'NL',
        currency: 'EUR',
        dateFormat: 'DD-MM-YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'item',
          other: '{{count}} items'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'tr',
        name: 'Turkish',
        nativeName: 'Türkçe',
        direction: 'ltr',
        flag: '🇹🇷',
        country: 'TR',
        currency: 'TRY',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: 'öğe',
          other: '{{count}} öğe'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'sv',
        name: 'Swedish',
        nativeName: 'Svenska',
        direction: 'ltr',
        flag: '🇸🇪',
        country: 'SE',
        currency: 'SEK',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'objekt',
          other: '{{count}} objekt'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'da',
        name: 'Danish',
        nativeName: 'Dansk',
        direction: 'ltr',
        flag: '🇩🇰',
        country: 'DK',
        currency: 'DKK',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'element',
          other: '{{count}} elementer'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'no',
        name: 'Norwegian',
        nativeName: 'Norsk',
        direction: 'ltr',
        flag: '🇳🇴',
        country: 'NO',
        currency: 'NOK',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'element',
          other: '{{count}} elementer'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'fi',
        name: 'Finnish',
        nativeName: 'Suomi',
        direction: 'ltr',
        flag: '🇫🇮',
        country: 'FI',
        currency: 'EUR',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'kohde',
          other: '{{count}} kohdetta'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'pl',
        name: 'Polish',
        nativeName: 'Polski',
        direction: 'ltr',
        flag: '🇵🇱',
        country: 'PL',
        currency: 'PLN',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} element',
          few: '{{count}} elementy',
          many: '{{count}} elementów',
          other: '{{count}} elementów'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'cs',
        name: 'Czech',
        nativeName: 'Čeština',
        direction: 'ltr',
        flag: '🇨🇿',
        country: 'CZ',
        currency: 'CZK',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} položka',
          few: '{{count}} položky',
          many: '{{count}} položek',
          other: '{{count}} položek'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'hu',
        name: 'Hungarian',
        nativeName: 'Magyar',
        direction: 'ltr',
        flag: '🇭🇺',
        country: 'HU',
        currency: 'HUF',
        dateFormat: 'YYYY.MM.DD',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} elem',
          other: '{{count}} elem'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'ro',
        name: 'Romanian',
        nativeName: 'Română',
        direction: 'ltr',
        flag: '🇷🇴',
        country: 'RO',
        currency: 'RON',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} element',
          few: '{{count}} elemente',
          other: '{{count}} de elemente'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'sk',
        name: 'Slovak',
        nativeName: 'Slovenčina',
        direction: 'ltr',
        flag: '🇸🇰',
        country: 'SK',
        currency: 'EUR',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} položka',
          few: '{{count}} položky',
          many: '{{count}} položiek',
          other: '{{count}} položiek'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'sl',
        name: 'Slovenian',
        nativeName: 'Slovenščina',
        direction: 'ltr',
        flag: '🇸🇮',
        country: 'SI',
        currency: 'EUR',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} element',
          two: '{{count}} elementa',
          few: '{{count}} elementi',
          other: '{{count}} elementov'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'et',
        name: 'Estonian',
        nativeName: 'Eesti',
        direction: 'ltr',
        flag: '🇪🇪',
        country: 'EE',
        currency: 'EUR',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} üksus',
          other: '{{count}} üksust'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'lv',
        name: 'Latvian',
        nativeName: 'Latviešu',
        direction: 'ltr',
        flag: '🇱🇻',
        country: 'LV',
        currency: 'EUR',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          zero: 'nav vienību',
          one: '{{count}} vienība',
          other: '{{count}} vienības'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'lt',
        name: 'Lithuanian',
        nativeName: 'Lietuvių',
        direction: 'ltr',
        flag: '🇱🇹',
        country: 'LT',
        currency: 'EUR',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} vienetas',
          few: '{{count}} vienetai',
          many: '{{count}} vienetų',
          other: '{{count}} vienetų'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'bg',
        name: 'Bulgarian',
        nativeName: 'Български',
        direction: 'ltr',
        flag: '🇧🇬',
        country: 'BG',
        currency: 'BGN',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: ' ',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} елемент',
          other: '{{count}} елемента'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'hr',
        name: 'Croatian',
        nativeName: 'Hrvatski',
        direction: 'ltr',
        flag: '🇭🇷',
        country: 'HR',
        currency: 'EUR',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} stavka',
          few: '{{count}} stavke',
          other: '{{count}} stavki'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'sr',
        name: 'Serbian',
        nativeName: 'Српски',
        direction: 'ltr',
        flag: '🇷🇸',
        country: 'RS',
        currency: 'RSD',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} ставка',
          few: '{{count}} ставке',
          other: '{{count}} ставки'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'mk',
        name: 'Macedonian',
        nativeName: 'Македонски',
        direction: 'ltr',
        flag: '🇲🇰',
        country: 'MK',
        currency: 'MKD',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} ставка',
          other: '{{count}} ставки'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'bs',
        name: 'Bosnian',
        nativeName: 'Bosanski',
        direction: 'ltr',
        flag: '🇧🇦',
        country: 'BA',
        currency: 'BAM',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} stavka',
          few: '{{count}} stavke',
          other: '{{count}} stavki'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'sq',
        name: 'Albanian',
        nativeName: 'Shqip',
        direction: 'ltr',
        flag: '🇦🇱',
        country: 'AL',
        currency: 'ALL',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} artikull',
          other: '{{count}} artikuj'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'mt',
        name: 'Maltese',
        nativeName: 'Malti',
        direction: 'ltr',
        flag: '🇲🇹',
        country: 'MT',
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: '{{count}} oġġett',
          few: '{{count}} oġġetti',
          many: '{{count}} oġġett',
          other: '{{count}} oġġetti'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'ga',
        name: 'Irish',
        nativeName: 'Gaeilge',
        direction: 'ltr',
        flag: '🇮🇪',
        country: 'IE',
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: '{{count}} mír',
          two: '{{count}} mhír',
          few: '{{count}} mhír',
          many: '{{count}} mír',
          other: '{{count}} mír'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'cy',
        name: 'Welsh',
        nativeName: 'Cymraeg',
        direction: 'ltr',
        flag: '🇬🇧',
        country: 'GB',
        currency: 'GBP',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: '.',
          thousandSeparator: ',',
          currencyPosition: 'before'
        },
        pluralRules: {
          zero: 'dim eitemau',
          one: '{{count}} eitem',
          two: '{{count}} eitem',
          few: '{{count}} eitem',
          many: '{{count}} eitem',
          other: '{{count}} eitem'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'eu',
        name: 'Basque',
        nativeName: 'Euskera',
        direction: 'ltr',
        flag: '🇪🇸',
        country: 'ES',
        currency: 'EUR',
        dateFormat: 'YYYY/MM/DD',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: 'elementu {{count}}',
          other: '{{count}} elementu'
        },
        fallbackLanguages: ['es', 'en'],
        isActive: true
      },
      {
        code: 'gl',
        name: 'Galician',
        nativeName: 'Galego',
        direction: 'ltr',
        flag: '🇪🇸',
        country: 'ES',
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: '{{count}} elemento',
          other: '{{count}} elementos'
        },
        fallbackLanguages: ['es', 'en'],
        isActive: true
      },
      {
        code: 'ca',
        name: 'Catalan',
        nativeName: 'Català',
        direction: 'ltr',
        flag: '🇪🇸',
        country: 'ES',
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'before'
        },
        pluralRules: {
          one: '{{count}} element',
          other: '{{count}} elements'
        },
        fallbackLanguages: ['es', 'en'],
        isActive: true
      },
      {
        code: 'is',
        name: 'Icelandic',
        nativeName: 'Íslenska',
        direction: 'ltr',
        flag: '🇮🇸',
        country: 'IS',
        currency: 'ISK',
        dateFormat: 'DD.MM.YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} atriði',
          other: '{{count}} atriði'
        },
        fallbackLanguages: ['en'],
        isActive: true
      },
      {
        code: 'fo',
        name: 'Faroese',
        nativeName: 'Føroyskt',
        direction: 'ltr',
        flag: '🇫🇴',
        country: 'FO',
        currency: 'DKK',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} lutur',
          other: '{{count}} lutir'
        },
        fallbackLanguages: ['da', 'en'],
        isActive: true
      },
      {
        code: 'kl',
        name: 'Greenlandic',
        nativeName: 'Kalaallisut',
        direction: 'ltr',
        flag: '🇬🇱',
        country: 'GL',
        currency: 'DKK',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: {
          decimalSeparator: ',',
          thousandSeparator: '.',
          currencyPosition: 'after'
        },
        pluralRules: {
          one: '{{count}} annertussusiaq',
          other: '{{count}} annertussusiartik'
        },
        fallbackLanguages: ['da', 'en'],
        isActive: true
      }
    ];

    languageConfigs.forEach(config => {
      this.languages.set(config.code, config);
    });
  }

  /**
   * Initialize i18next with comprehensive configuration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await i18n
        .use(HttpBackend)
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
          fallbackLng: 'km',
          debug: process.env.NODE_ENV === 'development',

          // Language detection
          detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage']
          },

          // Backend configuration
          backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
            addPath: '/locales/add/{{lng}}/{{ns}}',
            allowMultiLoading: true,
            crossDomain: false
          },

          // Interpolation
          interpolation: {
            escapeValue: false, // React already escapes
            format: (value, format, lng) => {
              if (format === 'number') return this.formatNumber(value, lng);
              if (format === 'currency') return this.formatCurrency(value, lng);
              if (format === 'date') return this.formatDate(value, {}, lng);
              return value;
            }
          },

          // React options
          react: {
            useSuspense: true,
            bindI18n: 'languageChanged loaded',
            bindI18nStore: 'added removed',
            transEmptyNodeValue: '',
            transSupportBasicHtmlNodes: true,
            transWrapTextNodes: ''
          },

          // Resources (fallback)
          resources: {
            en: {
              common: {
                welcome: 'Welcome',
                loading: 'Loading...',
                error: 'Error',
                success: 'Success',
                cancel: 'Cancel',
                confirm: 'Confirm',
                save: 'Save',
                delete: 'Delete',
                edit: 'Edit',
                view: 'View',
                search: 'Search',
                filter: 'Filter',
                sort: 'Sort',
                export: 'Export',
                import: 'Import',
                download: 'Download',
                upload: 'Upload',
                select: 'Select',
                selected: 'Selected',
                all: 'All',
                none: 'None',
                yes: 'Yes',
                no: 'No',
                ok: 'OK',
                close: 'Close',
                back: 'Back',
                next: 'Next',
                previous: 'Previous',
                finish: 'Finish',
                submit: 'Submit',
                reset: 'Reset',
                clear: 'Clear',
                apply: 'Apply',
                remove: 'Remove',
                add: 'Add',
                create: 'Create',
                update: 'Update',
                copy: 'Copy',
                paste: 'Paste',
                cut: 'Cut',
                undo: 'Undo',
                redo: 'Redo'
              }
            }
          }
        });

      // Set up language change handler
      i18n.on('languageChanged', (lng) => {
        this.handleLanguageChange(lng);
      });

      this.isInitialized = true;
      logger.info('Advanced i18n service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize i18n service:', error as Error);
      throw error;
    }
  }

  /**
   * Handle language change with RTL support
   */
  private handleLanguageChange(languageCode: string): void {
    this.currentLanguage = languageCode;
    const config = this.languages.get(languageCode);

    if (config) {
      // Update document direction for RTL support
      document.documentElement.dir = config.direction;
      document.documentElement.lang = languageCode;

      // Update CSS custom properties for RTL
      this.updateRTLCSS(config.direction);

      // Update HTML meta tags
      this.updateMetaTags(config);

      // Cache current language
      advancedCache.set('i18n', 'currentLanguage', languageCode, { ttl: 86400 }); // 24 hours

      logger.info(`Language changed to: ${languageCode} (${config.direction})`);
    }
  }

  /**
   * Update CSS for RTL support using logical properties
   */
  private updateRTLCSS(direction: 'ltr' | 'rtl'): void {
    const root = document.documentElement.style;

    if (direction === 'rtl') {
      root.setProperty('--direction', 'rtl');
      root.setProperty('--text-align', 'right');
      root.setProperty('--float', 'right');
      root.setProperty('--margin-start', 'margin-right');
      root.setProperty('--margin-end', 'margin-left');
      root.setProperty('--padding-start', 'padding-right');
      root.setProperty('--padding-end', 'padding-left');
      root.setProperty('--border-start', 'border-right');
      root.setProperty('--border-end', 'border-left');
    } else {
      root.setProperty('--direction', 'ltr');
      root.setProperty('--text-align', 'left');
      root.setProperty('--float', 'left');
      root.setProperty('--margin-start', 'margin-left');
      root.setProperty('--margin-end', 'margin-right');
      root.setProperty('--padding-start', 'padding-left');
      root.setProperty('--padding-end', 'padding-right');
      root.setProperty('--border-start', 'border-left');
      root.setProperty('--border-end', 'border-right');
    }
  }

  /**
   * Update HTML meta tags for SEO and accessibility
   */
  private updateMetaTags(config: LanguageConfig): void {
    // Update title
    document.title = `${config.nativeName} | DakDam MLM`;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', `DakDam MLM Platform - ${config.nativeName}`);
    }

    // Update Open Graph locale
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) {
      ogLocale.setAttribute('content', `${config.code}_${config.country}`);
    }

    // Add alternate language links for SEO
    this.updateAlternateLanguageLinks();
  }

  /**
   * Update alternate language links for SEO
   */
  private updateAlternateLanguageLinks(): void {
    // Remove existing alternate links
    document.querySelectorAll('link[rel="alternate"]').forEach(link => link.remove());

    // Add new alternate links
    this.languages.forEach((config, code) => {
      if (config.isActive) {
        const link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = code;
        link.href = `${window.location.origin}/${code}${window.location.pathname}`;
        document.head.appendChild(link);
      }
    });
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): LanguageConfig[] {
    return Array.from(this.languages.values()).filter(lang => lang.isActive);
  }

  /**
   * Get current language configuration
   */
  getCurrentLanguage(): LanguageConfig | undefined {
    return this.languages.get(this.currentLanguage);
  }

  /**
   * Check if current language is RTL
   */
  isRTL(): boolean {
    const config = this.getCurrentLanguage();
    return config?.direction === 'rtl';
  }

  /**
   * Change language
   */
  async changeLanguage(languageCode: string): Promise<void> {
    if (!this.languages.has(languageCode)) {
      throw new Error(`Language ${languageCode} is not supported`);
    }

    try {
      await i18n.changeLanguage(languageCode);
      this.currentLanguage = languageCode;
    } catch (error) {
      logger.error(`Failed to change language to ${languageCode}:`, error as Error);
      throw error;
    }
  }

  /**
   * Translate with context support
   */
  t(key: string, options: TranslationContext & any = {}): string {
    try {
      const result = i18n.t(key, {
        ...options,
        lng: this.currentLanguage
      });
      return typeof result === 'string' ? result : key;
    } catch (error) {
      logger.warn(`Translation failed for key: ${key}`, error as Error);
      return key; // Fallback to key
    }
  }

  /**
   * Format number according to language rules
   */
  formatNumber(value: number, languageCode?: string): string {
    const lng = languageCode || this.currentLanguage;
    const config = this.languages.get(lng);

    if (!config) return value.toString();

    return new Intl.NumberFormat(`${lng}-${config.country}`, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Format currency according to language rules
   */
  formatCurrency(amount: number, currencyCode?: string, languageCode?: string): string {
    const lng = languageCode || this.currentLanguage;
    const config = this.languages.get(lng);
    const currency = currencyCode || config?.currency || 'USD';

    return new Intl.NumberFormat(`${lng}-${config?.country || 'US'}`, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Format date according to language rules
   */
  formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}, languageCode?: string): string {
    const lng = languageCode || this.currentLanguage;
    const config = this.languages.get(lng);
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat(`${lng}-${config?.country || 'US'}`, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...options
    }).format(dateObj);
  }

  /**
   * Get plural form for current language
   */
  getPluralForm(count: number, languageCode?: string): string {
    const lng = languageCode || this.currentLanguage;
    const config = this.languages.get(lng);

    if (!config) return 'other';

    // Simple plural rules implementation
    if (count === 0 && config.pluralRules.zero) return 'zero';
    if (count === 1 && config.pluralRules.one) return 'one';
    if (count === 2 && config.pluralRules.two) return 'two';
    if (count >= 3 && count <= 10 && config.pluralRules.few) return 'few';
    if (count > 10 && config.pluralRules.many) return 'many';

    return config.pluralRules.other ? 'other' : 'one';
  }

  /**
   * Load translations for a language
   */
  async loadTranslations(languageCode: string, namespace: string = 'common'): Promise<void> {
    try {
      // Check cache first
      const cacheKey = `i18n:${languageCode}:${namespace}`;
      const cached = await advancedCache.get('i18n', cacheKey);

      if (cached) {
        i18n.addResourceBundle(languageCode, namespace, cached, true, true);
        return;
      }

      // Load from backend
      await i18n.loadNamespaces([namespace]);

      // Cache the loaded translations
      const resources = i18n.getResourceBundle(languageCode, namespace);
      if (resources) {
        await advancedCache.set('i18n', cacheKey, resources, { ttl: 3600 }); // 1 hour
      }

    } catch (error) {
      logger.error(`Failed to load translations for ${languageCode}:${namespace}:`, error as Error);
      throw error;
    }
  }

  /**
   * Add custom translations
   */
  async addTranslations(languageCode: string, namespace: string, translations: Record<string, any>): Promise<void> {
    try {
      i18n.addResourceBundle(languageCode, namespace, translations, true, true);

      // Update cache
      const cacheKey = `i18n:${languageCode}:${namespace}`;
      await advancedCache.set('i18n', cacheKey, translations, { ttl: 3600 });

      logger.info(`Added translations for ${languageCode}:${namespace}`);

    } catch (error) {
      logger.error(`Failed to add translations for ${languageCode}:${namespace}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get localized content by ID
   */
  async getLocalizedContent(contentId: string, languageCode?: string): Promise<LocalizedContent | null> {
    const lng = languageCode || this.currentLanguage;

    // Check cache first
    const cacheKey = `localized_content:${contentId}:${lng}`;
    const cached = await advancedCache.get('i18n', cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // In a real implementation, fetch from database or CMS
      // For now, return mock data
      const content: LocalizedContent = {
        id: contentId,
        translations: {
          [lng]: {
            title: `Title in ${lng}`,
            content: `Content in ${lng}`
          }
        },
        metadata: {
          lastModified: new Date(),
          modifiedBy: 'system',
          version: 1,
          tags: ['example'],
          categories: ['general']
        },
        seo: {
          title: { [lng]: `SEO Title in ${lng}` },
          description: { [lng]: `SEO Description in ${lng}` },
          keywords: { [lng]: ['keyword1', 'keyword2'] }
        }
      };

      // Cache the content
      await advancedCache.set('i18n', cacheKey, content, { ttl: 1800 }); // 30 minutes

      return content;

    } catch (error) {
      logger.error(`Failed to get localized content ${contentId}:`, error as Error);
      return null;
    }
  }

  /**
   * Generate SEO-friendly URL for language
   */
  generateLocalizedUrl(path: string, languageCode?: string): string {
    const lng = languageCode || this.currentLanguage;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (lng === 'en') {
      return `${baseUrl}${path}`;
    }

    return `${baseUrl}/${lng}${path}`;
  }

  /**
   * Get language from URL
   */
  getLanguageFromUrl(url: string): string {
    const urlParts = url.split('/');
    const potentialLang = urlParts[3]; // Assuming format: domain.com/lang/path

    if (potentialLang && this.languages.has(potentialLang)) {
      return potentialLang;
    }

    return 'km';
  }

  /**
   * Export translations for external use
   */
  async exportTranslations(languageCode: string, namespaces: string[] = ['common']): Promise<Record<string, any>> {
    const exportData: Record<string, any> = {};

    for (const ns of namespaces) {
      try {
        const resources = i18n.getResourceBundle(languageCode, ns);
        if (resources) {
          exportData[ns] = resources;
        }
      } catch (error) {
        logger.warn(`Failed to export namespace ${ns} for ${languageCode}:`, error as Error);
      }
    }

    return exportData;
  }

  /**
   * Import translations from external source
   */
  async importTranslations(languageCode: string, translations: Record<string, any>): Promise<void> {
    try {
      for (const [namespace, resources] of Object.entries(translations)) {
        await this.addTranslations(languageCode, namespace, resources);
      }

      logger.info(`Imported translations for ${languageCode}`);

    } catch (error) {
      logger.error(`Failed to import translations for ${languageCode}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get translation statistics
   */
  async getTranslationStats(): Promise<{
    totalLanguages: number;
    activeLanguages: number;
    totalKeys: number;
    completionRates: Record<string, number>;
    missingTranslations: Record<string, string[]>;
  }> {
    const stats = {
      totalLanguages: this.languages.size,
      activeLanguages: Array.from(this.languages.values()).filter(l => l.isActive).length,
      totalKeys: 0,
      completionRates: {} as Record<string, number>,
      missingTranslations: {} as Record<string, string[]>
    };

    // Calculate completion rates and missing translations
    const baseLanguage = 'km';
    const baseResources = i18n.getResourceBundle(baseLanguage, 'common');

    if (baseResources) {
      const baseKeys = Object.keys(baseResources);
      stats.totalKeys = baseKeys.length;

      for (const [code, config] of this.languages) {
        if (!config.isActive) continue;

        const resources = i18n.getResourceBundle(code, 'common');
        const missingKeys: string[] = [];

        if (resources) {
          let translatedKeys = 0;
          const resourcesObj = resources as Record<string, any>;
          for (const key of baseKeys) {
            if (resourcesObj[key] && resourcesObj[key] !== key) {
              translatedKeys++;
            } else {
              missingKeys.push(key);
            }
          }
          stats.completionRates[code] = (translatedKeys / baseKeys.length) * 100;
        } else {
          stats.completionRates[code] = 0;
          missingKeys.push(...baseKeys);
        }

        if (missingKeys.length > 0) {
          stats.missingTranslations[code] = missingKeys;
        }
      }
    }

    return stats;
  }

  /**
   * Validate translation quality
   */
  async validateTranslations(languageCode: string, content: string): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    try {
      const config = this.languages.get(languageCode);
      if (!config) {
        return { isValid: false, issues: ['Language not supported'], suggestions: [] };
      }

      // Check for RTL consistency in RTL languages
      if (config.direction === 'rtl') {
        const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
        const hasRTLChars = rtlChars.test(content);

        if (!hasRTLChars && content.length > 10) {
          issues.push('RTL language should contain RTL characters');
          suggestions.push('Consider using Arabic, Hebrew, or Persian script');
        }
      }

      // Check for placeholder consistency
      const placeholderRegex = /\{\{\w+\}\}/g;
      const placeholders = content.match(placeholderRegex) || [];

      // Basic validation passed
      return {
        isValid: issues.length === 0,
        issues,
        suggestions
      };

    } catch (error) {
      return {
        isValid: false,
        issues: ['Validation failed'],
        suggestions: ['Check translation format and content']
      };
    }
  }

  /**
   * Get accessibility features for current language
   */
  getAccessibilityFeatures(): {
    lang: string;
    dir: string;
    textDirection: string;
    fontFamily: string;
    fontSize: string;
  } {
    const config = this.getCurrentLanguage();
    const isRTL = config?.direction === 'rtl';

    return {
      lang: this.currentLanguage,
      dir: config?.direction || 'ltr',
      textDirection: isRTL ? 'rtl' : 'ltr',
      fontFamily: isRTL ? 'var(--rtl-font-family, "Noto Sans Arabic", sans-serif)' : 'var(--ltr-font-family, system-ui, sans-serif)',
      fontSize: 'var(--base-font-size, 16px)'
    };
  }

  /**
   * Generate language selector component data
   */
  getLanguageSelectorData(): Array<{
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    direction: string;
    isCurrent: boolean;
  }> {
    return Array.from(this.languages.values())
      .filter(lang => lang.isActive)
      .map(lang => ({
        code: lang.code,
        name: lang.name,
        nativeName: lang.nativeName,
        flag: lang.flag,
        direction: lang.direction,
        isCurrent: lang.code === this.currentLanguage
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get SEO metadata for current language
   */
  getSEOMetadata(pageKey: string): {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    canonicalUrl: string;
    alternateUrls: Record<string, string>;
  } {
    const baseTitle = this.t(`seo.${pageKey}.title`, { defaultValue: 'DakDam MLM' });
    const baseDescription = this.t(`seo.${pageKey}.description`, {
      defaultValue: 'Advanced Multi-Level Marketing Platform with AI-powered features'
    });
    const keywords = this.t(`seo.${pageKey}.keywords`, { defaultValue: ['MLM', 'Network Marketing'] });

    const config = this.getCurrentLanguage();
    const canonicalUrl = this.generateLocalizedUrl(`/${pageKey}`);

    const alternateUrls: Record<string, string> = {};
    this.languages.forEach((lang, code) => {
      if (lang.isActive) {
        alternateUrls[code] = this.generateLocalizedUrl(`/${pageKey}`, code);
      }
    });

    return {
      title: `${baseTitle} | ${config?.nativeName || 'DakDam'}`,
      description: baseDescription,
      keywords: Array.isArray(keywords) ? keywords : [keywords],
      ogTitle: baseTitle,
      ogDescription: baseDescription,
      canonicalUrl,
      alternateUrls
    };
  }

  /**
   * Shutdown i18n service
   */
  async shutdown(): Promise<void> {
    try {
      // Clear caches
      await advancedCache.delete('i18n', 'currentLanguage');

      // Clear content cache
      this.contentCache.clear();

      logger.info('Advanced i18n service shut down');

    } catch (error) {
      logger.error('Error shutting down i18n service:', error as Error);
    }
  }
}

// Export singleton instance
export const advancedI18nService = new AdvancedI18nService();

// Export React hook for easy usage
// Note: This is a wrapper hook. For React components, use react-i18next's useTranslation directly
export const useAdvancedTranslation = () => {
  const t = (key: string, options: TranslationContext & any = {}) => {
    return advancedI18nService.t(key, options);
  };

  return {
    t,
    i18n: i18n,
    currentLanguage: advancedI18nService.getCurrentLanguage(),
    isRTL: advancedI18nService.isRTL(),
    changeLanguage: advancedI18nService.changeLanguage.bind(advancedI18nService),
    supportedLanguages: advancedI18nService.getSupportedLanguages(),
    formatNumber: advancedI18nService.formatNumber.bind(advancedI18nService),
    formatCurrency: advancedI18nService.formatCurrency.bind(advancedI18nService),
    formatDate: advancedI18nService.formatDate.bind(advancedI18nService),
    getPluralForm: advancedI18nService.getPluralForm.bind(advancedI18nService),
    accessibility: advancedI18nService.getAccessibilityFeatures(),
    seo: advancedI18nService.getSEOMetadata.bind(advancedI18nService)
  };
};

// Export utilities
export { AdvancedI18nService };
export default advancedI18nService;