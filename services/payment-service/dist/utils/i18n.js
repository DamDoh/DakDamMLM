"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.i18next = exports.t = exports.i18nMiddleware = void 0;
const i18next_1 = __importDefault(require("i18next"));
exports.i18next = i18next_1.default;
const i18next_fs_backend_1 = __importDefault(require("i18next-fs-backend"));
const i18next_http_middleware_1 = __importDefault(require("i18next-http-middleware"));
const path_1 = __importDefault(require("path"));
// Initialize i18next with configuration
i18next_1.default
    .use(i18next_fs_backend_1.default)
    .use(i18next_http_middleware_1.default.LanguageDetector)
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
        loadPath: path_1.default.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
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
exports.default = i18next_1.default;
// Export middleware for use in Express
exports.i18nMiddleware = i18next_http_middleware_1.default.handle(i18next_1.default, {
    ignoreRoutes: ['/health', '/metrics', '/webhooks/'],
    removeLngFromUrl: false,
});
// Helper function to get translated text
const t = (key, options) => {
    return i18next_1.default.t(key, options);
};
exports.t = t;
//# sourceMappingURL=i18n.js.map