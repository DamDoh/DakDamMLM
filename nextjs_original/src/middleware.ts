import { NextRequest, NextResponse } from 'next/server';

/**
 * PRODUCTION-READY SECURITY MIDDLEWARE
 *
 * Implements comprehensive security headers and protections:
 * - Security headers (CSP, HSTS, etc.)
 * - Path traversal protection
 * - Sensitive file blocking
 * - Request validation
 */

// Security Headers for Production
const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS filter
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  
  // Strict Transport Security (HSTS) - enforce HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Content Security Policy (CSP)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for some React features
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://fonts.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block access to sensitive paths and files
  const blockedPaths = [
    '/.git',
    '/.env',
    '/.env.local',
    '/.env.production',
    '/package.json',
    '/package-lock.json',
    '/tsconfig.json',
    '/next.config.mjs',
    '/next.config.js',
    '/.gitignore',
    '/prisma/schema.prisma',
    '/README.md',
    '/.vscode',
    '/node_modules',
    '/.next'
  ];

  if (blockedPaths.some(path => pathname.startsWith(path))) {
    return new NextResponse(null, { status: 404 });
  }

  // Check for path traversal attempts
  if (pathname.includes('..') || pathname.includes('%2e%2e')) {
    console.warn('[SECURITY] Path traversal attempt blocked:', {
      pathname,
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent')
    });
    return new NextResponse(null, { status: 403 });
  }

  // Create response
  const response = NextResponse.next();

  // Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add additional security headers for API routes
  if (pathname.startsWith('/api/')) {
    // Prevent caching of API responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // API-specific security
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};