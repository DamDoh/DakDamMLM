
# DakDam MLM Security & Authentication Documentation

This document provides comprehensive security documentation for the DakDam MLM platform, covering authentication, authorization, data protection, and security best practices.

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Authorization & Access Control](#authorization--access-control)
3. [Data Protection & Encryption](#data-protection--encryption)
4. [Network Security](#network-security)
5. [Application Security](#application-security)
6. [Compliance & Regulatory](#compliance--regulatory)
7. [Security Monitoring](#security-monitoring)
8. [Incident Response](#incident-response)
9. [Security Best Practices](#security-best-practices)

---

## Authentication System

### JWT-Based Authentication

#### Token Structure
```typescript
interface JWTPayload {
  userId: string;
  memberId: string;
  email: string;
  companyId: string;
  role: UserRole;
  permissions: string[];
  iat: number;      // Issued at
  exp: number;      // Expiration time
  jti: string;      // JWT ID for token revocation
  iss: string;      // Issuer
  aud: string;      // Audience
}
```

#### Token Generation
```typescript
class JWTService {
  private readonly secret: string;
  private readonly refreshSecret: string;

  constructor() {
    this.secret = process.env.JWT_SECRET!;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET!;
  }

  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string {
    const jti = crypto.randomUUID();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (15 * 60); // 15 minutes

    return jwt.sign(
      { ...payload, iat, exp, jti },
      this.secret,
      { algorithm: 'HS256' }
    );
  }

  generateRefreshToken(userId: string): string {
    const jti = crypto.randomUUID();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (7 * 24 * 60 * 60); // 7 days

    return jwt.sign(
      { userId, jti, iat, exp, type: 'refresh' },
      this.refreshSecret,
      { algorithm: 'HS256' }
    );
  }
}
```

#### Token Validation Middleware
```typescript
export const authenticateToken = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Check if token is revoked
    const isRevoked = await checkTokenRevocation(decoded.jti);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Check if user still exists and is active
    const user = await getUserById(decoded.userId);
    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        error: 'User account is inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Attach user to request
    (req as any).user = {
      id: decoded.userId,
      memberId: decoded.memberId,
      email: decoded.email,
      companyId: decoded.companyId,
      role: decoded.role,
      permissions: decoded.permissions
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};
```

#### Token Refresh Flow
```typescript
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Check if refresh token is revoked
    const isRevoked = await checkRefreshTokenRevocation(decoded.jti);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token has been revoked'
      });
    }

    // Generate new tokens
    const user = await getUserById(decoded.userId);
    const accessToken = jwtService.generateAccessToken({
      userId: user.id,
      memberId: user.memberId,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
      permissions: await getUserPermissions(user.id)
    });

    const newRefreshToken = jwtService.generateRefreshToken(user.id);

    // Revoke old refresh token
    await revokeRefreshToken(decoded.jti);

    // Store new refresh token
    await storeRefreshToken(user.id, newRefreshToken, decoded.jti);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          memberId: user.memberId,
          email: user.email,
          fullName: user.fullName
        }
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
};
```

### Multi-Factor Authentication (MFA)

#### TOTP Implementation
```typescript
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

class MFAService {
  generateSecret(userId: string): { secret: string; qrCodeUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `DakDam MLM (${userId})`,
      issuer: 'DakDam'
    });

    const qrCodeUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `DakDam MLM (${userId})`,
      issuer: 'DakDam',
      encoding: 'ascii'
    });

    return {
      secret: secret.base32,
      qrCodeUrl
    };
  }

  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 30 seconds clock skew
    });
  }

  generateQRCode(qrCodeUrl: string): Promise<string> {
    return qrcode.toDataURL(qrCodeUrl);
  }
}
```

#### MFA Setup Flow
```typescript
export const setupMFA = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Generate MFA secret
    const { secret, qrCodeUrl } = mfaService.generateSecret(userId);

    // Generate QR code
    const qrCode = await mfaService.generateQRCode(qrCodeUrl);

    // Store secret temporarily (not yet verified)
    await storeTempMFASecret(userId, secret);

    res.json({
      success: true,
      data: {
        qrCode,
        secret: secret, // For manual entry
        message: 'Scan QR code with authenticator app, then verify with code'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to setup MFA'
    });
  }
};

export const verifyMFA = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { token } = req.body;

    // Get temporary secret
    const tempSecret = await getTempMFASecret(userId);
    if (!tempSecret) {
      return res.status(400).json({
        success: false,
        error: 'MFA setup not initiated'
      });
    }

    // Verify token
    const isValid = mfaService.verifyToken(tempSecret, token);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MFA token'
      });
    }

    // Store verified secret
    await storeMFASecret(userId, tempSecret);
    await removeTempMFASecret(userId);

    // Update user MFA status
    await updateUserMFAStatus(userId, true);

    res.json({
      success: true,
      message: 'MFA setup completed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to verify MFA'
    });
  }
};
```

### Password Security

#### Password Hashing
```typescript
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

class PasswordService {
  private readonly saltRounds = 12;

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

#### Password Reset Flow
```typescript
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If an account with this email exists, a reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = passwordService.generatePasswordResetToken();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store reset token (expires in 1 hour)
    await storePasswordResetToken(user.id, resetTokenHash, 3600000);

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(user.email, resetUrl);

    res.json({
      success: true,
      message: 'If an account with this email exists, a reset link has been sent.'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const resetRecord = await getValidResetToken(tokenHash);
    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Validate new password
    const passwordValidation = passwordService.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Hash new password
    const hashedPassword = await passwordService.hashPassword(newPassword);

    // Update user password
    await updateUserPassword(resetRecord.userId, hashedPassword);

    // Mark token as used
    await markResetTokenUsed(tokenHash);

    // Log password change
    await logSecurityEvent(resetRecord.userId, 'password_reset', req.ip);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
};
```

---

## Authorization & Access Control

### Role-Based Access Control (RBAC)

#### Role Definitions
```typescript
enum SystemRole {
  SUPER_ADMIN = 'super_admin',    // Full system access
  COMPANY_ADMIN = 'company_admin', // Company-wide access
  DISTRIBUTOR = 'distributor',    // Standard distributor
  STOCKIST = 'stockist',          // Stockist with inventory access
  CUSTOMER = 'customer'           // Basic customer access
}

enum Permission {
  // User Management
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Commission Management
  COMMISSION_READ = 'commission:read',
  COMMISSION_UPDATE = 'commission:update',
  COMMISSION_PROCESS = 'commission:process',

  // Genealogy Management
  GENEALOGY_READ = 'genealogy:read',
  GENEALOGY_UPDATE = 'genealogy:update',
  GENEALOGY_MOVE = 'genealogy:move',

  // Business Rules
  RULE_READ = 'rule:read',
  RULE_CREATE = 'rule:create',
  RULE_UPDATE = 'rule:update',
  RULE_DELETE = 'rule:delete',

  // Financial
  WALLET_READ = 'wallet:read',
  WALLET_TRANSFER = 'wallet:transfer',
  PAYOUT_REQUEST = 'payout:request',
  PAYOUT_APPROVE = 'payout:approve',

  // Administrative
  SYSTEM_CONFIG = 'system:config',
  AUDIT_READ = 'audit:read',
  REPORTS_GENERATE = 'reports:generate'
}
```

#### Role-Permission Mapping
```typescript
const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SystemRole.SUPER_ADMIN]: [
    // All permissions
    ...Object.values(Permission)
  ],

  [SystemRole.COMPANY_ADMIN]: [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.COMMISSION_READ,
    Permission.GENEALOGY_READ,
    Permission.GENEALOGY_UPDATE,
    Permission.RULE_READ,
    Permission.RULE_CREATE,
    Permission.RULE_UPDATE,
    Permission.WALLET_READ,
    Permission.PAYOUT_REQUEST,
    Permission.PAYOUT_APPROVE,
    Permission.AUDIT_READ,
    Permission.REPORTS_GENERATE
  ],

  [SystemRole.DISTRIBUTOR]: [
    Permission.USER_READ, // Can view own profile and downline
    Permission.COMMISSION_READ,
    Permission.GENEALOGY_READ,
    Permission.WALLET_READ,
    Permission.WALLET_TRANSFER,
    Permission.PAYOUT_REQUEST
  ],

  [SystemRole.STOCKIST]: [
    Permission.USER_READ,
    Permission.COMMISSION_READ,
    Permission.GENEALOGY_READ,
    Permission.WALLET_READ,
    Permission.WALLET_TRANSFER,
    Permission.PAYOUT_REQUEST,
    // Additional inventory permissions
    'inventory:read',
    'inventory:update',
    'stock_request:create'
  ],

  [SystemRole.CUSTOMER]: [
    Permission.USER_READ, // Own profile only
    Permission.WALLET_READ,
    'order:create',
    'order:read'
  ]
};
```

#### Permission Checking Middleware
```typescript
export const requirePermission = (requiredPermission: Permission) => {
  return (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Super admin bypass
    if (user.role === SystemRole.SUPER_ADMIN) {
      return next();
    }

    // Check if user has required permission
    const userPermissions = user.permissions || [];
    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: requiredPermission,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// Usage example
app.put('/api/users/:id',
  authenticateToken,
  requirePermission(Permission.USER_UPDATE),
  updateUser
);
```

### Company-Based Isolation

#### Multi-Tenant Data Access
```typescript
export const requireCompanyAccess = (resourceType: 'user' | 'commission' | 'order') => {
  return async (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;
    const resourceId = req.params.id;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Super admin can access all companies
    if (user.role === SystemRole.SUPER_ADMIN) {
      return next();
    }

    // Check if resource belongs to user's company
    const resourceCompanyId = await getResourceCompanyId(resourceType, resourceId);

    if (!resourceCompanyId || resourceCompanyId !== user.companyId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Resource belongs to different company',
        code: 'COMPANY_ACCESS_DENIED'
      });
    }

    next();
  };
};
```

#### Dynamic Permission Loading
```typescript
export const loadUserPermissions = async (userId: string): Promise<Permission[]> => {
  const user = await getUserById(userId);
  if (!user) {
    return [];
  }

  // Get base role permissions
  let permissions = [...ROLE_PERMISSIONS[user.role]];

  // Add company-specific permissions
  if (user.companyId) {
    const companyPermissions = await getCompanyPermissions(user.companyId);
    permissions.push(...companyPermissions);
  }

  // Add user-specific permissions
  const userSpecificPermissions = await getUserSpecificPermissions(userId);
  permissions.push(...userSpecificPermissions);

  // Remove duplicates
  return [...new Set(permissions)];
};
```

---

## Data Protection & Encryption

### Database Encryption

#### Sensitive Data Encryption
```typescript
import crypto from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;
  private ivLength = 16;

  constructor() {
    // Generate key from environment variable
    this.key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.key);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encryptedData
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

#### Encrypted Fields
```sql
-- Encrypted sensitive fields
ALTER TABLE users ADD COLUMN encrypted_id_card_number TEXT;
ALTER TABLE users ADD COLUMN encrypted_tax_id TEXT;
ALTER TABLE wallets ADD COLUMN encrypted_bank_details JSONB;

-- Create encryption functions
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Use pgcrypto for PostgreSQL encryption
  RETURN pgp_sym_encrypt(input_text, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_text, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;
```

### API Data Encryption

#### Request/Response Encryption
```typescript
export const encryptApiData = (data: any): string => {
  const jsonString = JSON.stringify(data);
  return encryptionService.encrypt(jsonString);
};

export const decryptApiData = (encryptedData: string): any => {
  const jsonString = encryptionService.decrypt(encryptedData);
  return JSON.parse(jsonString);
};

// Middleware for encrypted endpoints
export const encryptedResponse = (req: Request, res: Response, next: Function) => {
  const originalJson = res.json;

  res.json = function(data: any) {
    const encryptedData = encryptApiData(data);
    return originalJson.call(this, {
      success: true,
      data: encryptedData,
      encrypted: true
    });
  };

  next();
};
```

### File Encryption

#### Secure File Storage
```typescript
class SecureFileService {
  private encryptionService: EncryptionService;

  async storeSecureFile(fileBuffer: Buffer, filename: string, userId: string): Promise<string> {
    // Generate encryption key for this file
    const fileKey = crypto.randomBytes(32);
    const fileId = crypto.randomUUID();

    // Encrypt file data
    const encryptedData = this.encryptBuffer(fileBuffer, fileKey);

    // Store encrypted file
    const filePath = await this.storeFile(encryptedData, fileId);

    // Store file metadata with encrypted key
    const encryptedKey = this.encryptionService.encrypt(fileKey.toString('hex'));
    await this.storeFileMetadata(fileId, {
      filename,
      userId,
      encryptedKey,
      filePath,
      uploadedAt: new Date()
    });

    return fileId;
  }

  async retrieveSecureFile(fileId: string, userId: string): Promise<Buffer> {
    // Get file metadata
    const metadata = await this.getFileMetadata(fileId);

    // Check access permissions
    if (metadata.userId !== userId) {
      throw new Error('Access denied');
    }

    // Decrypt file key
    const fileKeyHex = this.encryptionService.decrypt(metadata.encryptedKey);
    const fileKey = Buffer.from(fileKeyHex, 'hex');

    // Retrieve and decrypt file
    const encryptedData = await this.retrieveFile(metadata.filePath);
    const decryptedData = this.decryptBuffer(encryptedData, fileKey);

    return decryptedData;
  }

  private encryptBuffer(buffer: Buffer, key: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);

    const encrypted = Buffer.concat([
      iv,
      cipher.update(buffer),
      cipher.final()
    ]);

    return encrypted;
  }

  private decryptBuffer(encryptedBuffer: Buffer, key: Buffer): Buffer {
    const iv = encryptedBuffer.slice(0, 16);
    const encryptedData = encryptedBuffer.slice(16);

    const decipher = crypto.createDecipher('aes-256-cbc', key);
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    return decrypted;
  }
}
```

---

## Network Security

### SSL/TLS Configuration

#### Nginx SSL Setup
```nginx
# /etc/nginx/sites-available/dakdam
server {
    listen 443 ssl http2;
    server_name api.dakdam.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/dakdam.crt;
    ssl_certificate_key /etc/ssl/private/dakdam.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req zone=api_zone burst=10 nodelay;
    limit_req_status 429;

    location / {
        proxy_pass http://api-gateway:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-SSL-Protocol $ssl_protocol;
        proxy_set_header X-SSL-Cipher $ssl_cipher;

        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check endpoint (no rate limiting)
    location /api/health {
        limit_req off;
        proxy_pass http://api-gateway:3000/api/health;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.dakdam.com;
    return 301 https://$server_name$request_uri;
}
```

### Web Application Firewall (WAF)

#### ModSecurity Configuration
```apache
# /etc/modsecurity/modsecurity.conf
SecRuleEngine On
SecRequestBodyAccess On
SecResponseBodyAccess On
SecResponseBodyMimeType text/plain text/html text/xml application/json

# Custom rules for MLM platform
SecRule REQUEST_URI "@streq /api/auth/login" \
  "id:1001,phase:1,t:none,nolog,pass,ctl:ruleEngine=DetectionOnly"

SecRule REQUEST_URI "@streq /api/auth/login" \
  "id:1002,phase:2,t:none,nolog,pass,initcol:ip=%{REMOTE_ADDR},initcol:user=%{ARGS.user}"

# Rate limiting for authentication
SecRule IP:BRUTE_FORCE_COUNTER "@gt 5" \
  "id:1003,phase:1,t:none,deny,status:429,msg:'Brute force attack detected'"

# SQL Injection protection
SecRule ARGS "@detectSQLi" \
  "id:1004,phase:2,t:none,deny,status:403,msg:'SQL Injection Attack',logdata:'%{MATCHED_VAR}'"

# XSS protection
SecRule ARGS "@detectXSS" \
  "id:1005,phase:2,t:none,deny,status:403,msg:'XSS Attack Detected'"

# Financial endpoint protection
SecRule REQUEST_URI "@streq /api/commissions/calculate" \
  "id:2001,phase:1,t:none,nolog,pass,ctl:ruleEngine=DetectionOnly"

SecRule REQUEST_URI "@streq /api/wallet/transfer" \
  "id:2002,phase:1,t:none,nolog,pass,ctl:ruleEngine=DetectionOnly"
```

### DDoS Protection

#### Rate Limiting Configuration
```typescript
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('rate_limit_exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Authentication rate limiting (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logSecurityEvent('auth_rate_limit_exceeded', {
      ip: req.ip,
      email: req.body.email
    });
    res.status(429).json({
      success: false,
      error: 'Too many login attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Financial operations rate limiting
export const financialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 financial operations per minute
  message: {
    success: false,
    error: 'Too many financial operations, please try again later.',
    retryAfter: '1 minute'
  }
});

// Speed limiter for gradual slowdown
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: 100, // add 100ms of delay per request after delayAfter
  maxDelayMs: 2000, // maximum delay of 2 seconds
});
```

### API Gateway Security

#### Request Validation Middleware
```typescript
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: Function) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logSecurityEvent('request_validation_failed', {
        ip: req.ip,
        path: req.path,
        errors: errors
      });

      return res.status(400).json({
        success: false,
        error: 'Request validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }

    // Sanitize input
    req.body = value;
    next();
  };
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: Function) => {
  // Remove potential XSS payloads
  const sanitizeString = (str: string) => {
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};
```

---

## Application Security

### Input Validation & Sanitization

#### Request Validation Schemas
```typescript
import Joi from 'joi';

// User registration schema
export const userRegistrationSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),

  firstName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      'string.pattern.base': 'First name can only contain letters and spaces'
    }),

  surname: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required(),

  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),

  memberId: Joi.string()
    .alphanum()
    .min(3)
    .max(20)
    .required(),

  sponsorId: Joi.string()
    .alphanum()
    .min(3)
    .max(20)
    .optional()
});

// Commission calculation schema
export const commissionCalculationSchema = Joi.object({
  orderId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid order ID format'
    })
});

// Wallet transfer schema
export const walletTransferSchema = Joi.object({
  toMemberId: Joi.string()
    .alphanum()
    .min(3)
    .max(20)
    .required(),

  amount: Joi.number()
    .positive()
    .precision(2)
    .max(50000) // Maximum transfer limit
    .required()
    .messages({
      'number.max': 'Transfer amount cannot exceed $50,000'
    }),

  description: Joi.string()
    .trim()
    .max(255)
    .optional()
});
```

### SQL Injection Prevention

#### Parameterized Queries with Prisma
```typescript
// Safe query with parameters
export const getUserById = async (userId: string) => {
  return await prisma.user.findUnique({
    where: {
      id: userId,
      active: true // Additional security filter
    }
  });
};

// Safe query with complex conditions
export const getUserCommissions = async (userId: string, status?: string) => {
  const where: any = {
    userId,
    companyId: await getUserCompanyId(userId) // Company isolation
  };

  if (status) {
    where.status = status;
  }

  return await prisma.commission.findMany({
    where,
    orderBy: {
      date: 'desc'
    },
    take: 50
  });
};
```

### XSS Protection

#### Content Security Policy
```typescript
// CSP middleware
export const cspMiddleware = (req: Request, res: Response, next: Function) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.example.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.example.com wss://api.example.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  next();
};
```

#### Secure Headers Middleware
```typescript
export const securityHeaders = (req: Request, res: Response, next: Function) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Feature policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS (only for HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};
```

---

## Compliance & Regulatory

### GDPR Compliance

#### Data Subject Access Request (DSAR)
```typescript
export const processDSAR = async (userId: string, requestType: 'access' | 'rectification' | 'erasure') => {
  // Log the DSAR request
  await logComplianceEvent('dsar_request', {
    userId,
    requestType,
    requestedAt: new Date(),
    ipAddress: getClientIP(),
    userAgent: getUserAgent()
  });

  switch (requestType) {
    case 'access':
      return await processDataAccessRequest(userId);

    case 'rectification':
      return await processDataRectificationRequest(userId);

    case 'erasure':
      return await processDataErasureRequest(userId);
  }
};

async function processDataAccessRequest(userId: string) {
  // Collect all user data
  const userData = await collectAllUserData(userId);

  // Generate privacy report
  const report = {
    userId,
    collectedAt: new Date(),
    data: userData,
    retention: {
      personalData: '7 years',
      financialData: '7 years',
      auditLogs: '7 years'
    },
    rights: {
      access: true,
      rectification: true,
      erasure: true,
      portability: true,
      objection: true,
      restriction: true
    }
  };

  // Send to user
  await sendDataToUser(userId, report);

  return { success: true, message: 'Data access report sent to user' };
}

async function processDataErasureRequest(userId: string) {
  // Check for legal holds
  const hasLegalHold = await checkLegalHold(userId);
  if (hasLegalHold) {
    throw new Error('Data erasure blocked due to legal hold');
  }

  // Anonymize personal data
  await anonymizeUserData(userId);

  // Log erasure
  await logComplianceEvent('data_erasure', {
    userId,
    erasedAt: new Date(),
    method: 'anonymization'
  });

  return { success: true, message: 'User data erased successfully' };
}
```

#### Data Retention Policies
```typescript
const DATA_RETENTION_POLICIES = {
  user_personal_data: {
    retention: '7 years',
    reason: 'Legal and tax compliance',
    action: 'anonymize'
  },
  financial_transactions: {
    retention: '7 years',
    reason: 'Financial regulatory requirements',
    action: 'archive'
  },
  audit_logs: {
    retention: '7 years',
    reason: 'Security and compliance auditing',
    action: 'archive'
  },
  failed_login_attempts: {
    retention: '1 year',
    reason: 'Security monitoring',
    action: 'delete'
  },
  session_data: {
    retention: '30 days',
    reason: 'Performance optimization',
    action: 'delete'
  }
};

export const enforceDataRetention = async () => {
  for (const [dataType, policy] of Object.entries(DATA_RETENTION_POLICIES)) {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - parseInt(policy.retention.split(' ')[0]));

    switch (policy.action) {
      case 'delete':
        await deleteOldData(dataType, cutoffDate);
        break;
      case 'archive':
        await archiveOldData(dataType, cutoffDate);
        break;
      case 'anonymize':
        await anonymizeOldData(dataType, cutoffDate);
        break;
    }

    await logRetentionAction(dataType, policy, cutoffDate);
  }
};
```

### AML/KYC Compliance

#### Transaction Monitoring
```typescript
export const monitorTransaction = async (transaction: TransactionData) => {
  const riskScore = await calculateRiskScore(transaction);

  // Log high-risk transactions
  if (riskScore > 70) {
    await logHighRiskTransaction(transaction, riskScore);

    // Flag for manual review
    await flagForReview(transaction.id, 'high_risk_transaction');

    // Send alert to compliance team
    await sendComplianceAlert({
      type: 'high_risk_transaction',
      transactionId: transaction.id,
      riskScore,
      amount: transaction.amount,
      userId: transaction.userId
    });
  }

  // Enhanced due diligence for very high risk
  if (riskScore > 90) {
    await initiateEnhancedDueDiligence(transaction.userId);
  }
};

async function calculateRiskScore(transaction: TransactionData): Promise<number> {
  let score = 0;

  // Amount-based scoring
  if (transaction.amount > 10000) score += 30;
  else if (transaction.amount > 5000) score += 20;
  else if (transaction.amount > 1000) score += 10;

  // Frequency-based scoring
  const recentTransactions = await getRecentTransactions(transaction.userId, 24); // Last 24 hours
  if (recentTransactions.length > 10) score += 20;
  if (recentTransactions.length > 20) score += 30;

  // Geographic scoring
  const userLocation = await getUserLocation(transaction.userId);
  const transactionLocation = getTransactionLocation(transaction);
  if (isHighRiskCountry(transactionLocation)) score += 25;
  if (userLocation !== transactionLocation) score += 15;

  // Velocity checks
  const velocityScore = await checkTransactionVelocity(transaction);
  score += velocityScore;

  // Blacklist checks
  if (await isBlacklistedUser(transaction.userId)) score += 50;
  if (await isBlacklistedLocation(transactionLocation)) score += 50;

  return Math.min(score, 100); // Cap at 100
}
```

#### KYC Profile Management
```typescript
export const createKYCProfile = async (userId: string, kycData: KYCData) => {
  // Validate documents
  await validateKYCDocuments(kycData.documents);

  // Check against sanctions lists
  const sanctionsCheck = await checkSanctionsLists(userId, kycData);
  if (sanctionsCheck.hit) {
    await logComplianceEvent('sanctions_hit', {
      userId,
      sanctionsList: sanctionsCheck.list,
      matchDetails: sanctionsCheck.details
    });
    throw new Error('User matches sanctions list');
  }

  // Perform identity verification
  const identityVerification = await verifyIdentity(kycData);
  if (!identityVerification.passed) {
    throw new Error('Identity verification failed');
  }

  // Calculate risk score
  const riskScore = await calculateKYCRiskScore(kycData);

  // Create KYC profile
  const kycProfile = await prisma.kycProfile.create({
    data: {
      userId,
      status: riskScore < 30 ? 'approved' : riskScore < 70 ? 'pending_review' : 'rejected',
      riskLevel: riskScore < 30 ? 'low' : riskScore < 70 ? 'medium' : 'high',
      riskScore,
      verificationLevel: kycData.verificationLevel,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      documents: {
        create: kycData.documents
      },
      checks: {
        create: [
          {
            type: 'identity',
            status: identityVerification.passed ? 'passed' : 'failed',
            result: identityVerification.result
          },
          {
            type: 'sanctions',
            status: sanctionsCheck.hit ? 'failed' : 'passed',
            result: sanctionsCheck.result
          }
        ]
      }
    }
  });

  // Log KYC creation
  await logComplianceEvent('kyc_profile_created', {
    userId,
    profileId: kycProfile.id,
    riskScore,
    status: kycProfile.status
  });

  return kycProfile;
};
```

---

## Security Monitoring

### Real-time Security Monitoring

#### Security Event Logging
```typescript
export const logSecurityEvent = async (
  eventType: SecurityEvent