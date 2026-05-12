import { NextRequest } from 'next/server';

// Security headers for production
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

// CORS configuration for production
export const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS ?
      process.env.ALLOWED_ORIGINS.split(',') :
      ['http://localhost:3000', 'https://localhost:3000'];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Input validation helpers
export class SecurityUtils {
  // Sanitize user input
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Validate phone number (basic)
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  // Check for suspicious patterns
  static containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /document\./i,
      /window\./i,
      /location\./i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  // Generate secure random token
  static generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Hash sensitive data for logging
  static hashForLogging(data: string): string {
    // Simple hash for logging purposes (not for security)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Check if request is from a trusted source
  static isTrustedRequest(request: NextRequest): boolean {
    const userAgent = request.headers.get('user-agent') || '';

    // Block known malicious user agents
    const maliciousAgents = [
      'sqlmap',
      'nmap',
      'masscan',
      'dirbuster',
      'gobuster',
      'nikto'
    ];

    if (maliciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
      return false;
    }

    // Additional checks can be added here
    return true;
  }

  // Security audit logging
  static logSecurityEvent(event: string, details: Record<string, any>, request?: NextRequest): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      ip: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      userAgent: request?.headers.get('user-agent'),
      url: request?.url,
      method: request?.method
    };

    // In production, send to security monitoring service
    console.warn('[SECURITY]', JSON.stringify(auditEntry));

    // TODO: Send to external security monitoring (SIEM, etc.)
    // this.sendToSecurityService(auditEntry);
  }
}

// Production optimizations
export const productionOptimizations = {
  // Disable React development tools in production
  disableReactDevTools: process.env.NODE_ENV === 'production',

  // Enable compression
  enableCompression: true,

  // Cache static assets
  staticCacheHeaders: {
    'Cache-Control': 'public, max-age=31536000, immutable'
  },

  // Security headers middleware
  securityMiddleware: (response: Response) => {
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
};