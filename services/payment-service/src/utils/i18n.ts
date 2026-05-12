import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import * as middleware from 'i18next-http-middleware';
import path from 'path';

// Initialize i18next with configuration
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Language detection options
    detection: {
      order: ['header', 'querystring', 'cookie'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lang',
      lookupCookie: 'i18next',
      caches: ['cookie'],
    },

    // Backend options
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },

    // Fallback language
    fallbackLng: 'en',

    // Default namespace
    defaultNS: 'common',
    ns: ['common'],

    // Supported languages
    supportedLngs: ['en', 'km'],

    // Debug mode (disable in production)
    debug: process.env.NODE_ENV === 'development',

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // React options (for future frontend integration)
    react: {
      useSuspense: false,
    },
  });

export default i18next;

// Export middleware for use in Express
export const i18nMiddleware = middleware.handle(i18next, {
  ignoreRoutes: ['/health', '/metrics', '/webhooks/'],
  removeLngFromUrl: false,
});

// Helper function to get translated text
export const t = (key: string, options?: any) => {
  return i18next.t(key, options);
};

// Export for use in other files
export { i18next };