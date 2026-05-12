// Offline TOTP (Time-based OTP) Service
// RFC 6238 compliant TOTP implementation for offline OTP generation

import crypto from 'crypto';
import { db } from '../shared/database';
import { ServiceErrorHandler, ValidationUtils, PerformanceUtils } from '../shared/utils';

export interface TotpSecret {
  id: string;
  userId: string;
  secret: string; // Base32 encoded secret
  name: string; // Device/app name
  issuer: string; // Service name
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: number;
  period: number; // Time step in seconds
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  backupCodes?: string[]; // Emergency backup codes
  companyId?: string;
}

export interface TotpSetup {
  secret: string;
  qrCodeUrl: string;
  manualEntry: string;
  backupCodes: string[];
}

export interface TotpVerification {
  userId: string;
  code: string;
  secretId?: string;
  companyId?: string;
}

export interface TotpResult {
  success: boolean;
  secretId?: string;
  error?: string;
  remainingTime?: number; // Seconds until next code
}

class TotpService {
  private static readonly DEFAULTS = {
    algorithm: 'SHA1' as const,
    digits: 6,
    period: 30, // 30 seconds
    backupCodesCount: 10,
  };

  // TODO: Replace with proper TotpSecret model in Prisma schema
  // For now, using in-memory storage as workaround
  private static totpSecrets = new Map<string, TotpSecret & { createdAt: Date; lastUsedAt?: Date }>();

  // Generate a cryptographically secure random secret
  private generateSecret(): string {
    const bytes = crypto.randomBytes(32);
    return this.base32Encode(bytes);
  }

  // Base32 encoding (RFC 4648)
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  // Base32 decoding
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = encoded.replace(/=+$/, '').toUpperCase();

    let bits = 0;
    let value = 0;
    const output = Buffer.alloc(Math.floor((cleaned.length * 5) / 8));

    let outputIndex = 0;

    for (let i = 0; i < cleaned.length; i++) {
      const charIndex = alphabet.indexOf(cleaned[i]);
      if (charIndex === -1) {
        throw new Error('Invalid base32 character');
      }

      value = (value << 5) | charIndex;
      bits += 5;

      if (bits >= 8) {
        output[outputIndex++] = (value >>> (bits - 8)) & 0xff;
        bits -= 8;
      }
    }

    return output.slice(0, outputIndex);
  }

  // Generate TOTP code using RFC 6238 algorithm
  private generateTotp(
    secret: string,
    time: number = Math.floor(Date.now() / 1000),
    algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1',
    digits: number = 6,
    period: number = 30
  ): string {
    try {
      // Decode secret
      const key = this.base32Decode(secret);

      // Calculate time counter
      const counter = Math.floor(time / period);
      const counterBuffer = Buffer.alloc(8);
      counterBuffer.writeBigUInt64BE(BigInt(counter), 0);

      // HMAC calculation
      let hmac: Buffer;
      switch (algorithm) {
        case 'SHA256':
          hmac = crypto.createHmac('sha256', key).update(counterBuffer).digest();
          break;
        case 'SHA512':
          hmac = crypto.createHmac('sha512', key).update(counterBuffer).digest();
          break;
        case 'SHA1':
        default:
          hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
          break;
      }

      // Dynamic truncation
      const offset = hmac[hmac.length - 1] & 0xf;
      const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
      );

      // Generate final code
      const finalCode = (code % Math.pow(10, digits)).toString().padStart(digits, '0');
      return finalCode;

    } catch (error) {
      throw new Error('Failed to generate TOTP code');
    }
  }

  // Verify TOTP code with time window tolerance
  private verifyTotpCode(
    secret: string,
    code: string,
    time: number = Math.floor(Date.now() / 1000),
    algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1',
    digits: number = 6,
    period: number = 30,
    window: number = 1 // Allow 1 period before/after for clock skew
  ): boolean {
    // Check current time and adjacent windows
    for (let i = -window; i <= window; i++) {
      const checkTime = time + (i * period);
      const generatedCode = this.generateTotp(secret, checkTime, algorithm, digits, period);

      if (crypto.timingSafeEqual(
        Buffer.from(code, 'utf8'),
        Buffer.from(generatedCode, 'utf8')
      )) {
        return true;
      }
    }

    return false;
  }

  // Generate backup codes
  private generateBackupCodes(count: number = TotpService.DEFAULTS.backupCodesCount): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).readUInt32BE(0).toString().padStart(10, '0');
      codes.push(code);
    }

    return codes;
  }

  // Setup TOTP for user
  async setupTotp(
    userId: string,
    name: string = 'MLM Platform',
    issuer: string = 'MLM Platform',
    companyId?: string
  ): Promise<TotpSetup> {
    const timerId = PerformanceUtils.startTimer('setupTotp');

    try {
      // Generate secret
      const secret = this.generateSecret();

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Hash backup codes for storage
      const hashedBackupCodes = backupCodes.map(code =>
        crypto.createHash('sha256').update(code).digest('hex')
      );

      // TODO: Replace with proper TotpSecret model in Prisma schema
      // Save to in-memory storage (temporary workaround)
      const secretId = crypto.randomUUID();
      const totpSecret: TotpSecret & { createdAt: Date; lastUsedAt?: Date } = {
        id: secretId,
        userId,
        secret,
        name,
        issuer,
        algorithm: TotpService.DEFAULTS.algorithm,
        digits: TotpService.DEFAULTS.digits,
        period: TotpService.DEFAULTS.period,
        backupCodes: hashedBackupCodes,
        companyId,
        isActive: false, // Will be activated after verification
        createdAt: new Date(),
      };
      TotpService.totpSecrets.set(secretId, totpSecret);

      // Generate QR code URL for authenticator apps
      const qrCodeUrl = this.generateQrCodeUrl(secret, name, issuer);

      // Generate manual entry string
      const manualEntry = `${issuer}:${name}`;

      PerformanceUtils.endTimer(timerId);

      console.log(`TOTP setup initiated for user ${userId}`);

      return {
        secret,
        qrCodeUrl,
        manualEntry,
        backupCodes, // Return plain backup codes to user
      };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to setup TOTP:', error);
      throw ServiceErrorHandler.createError('SYSTEM_ERROR', 'Failed to setup offline OTP');
    }
  }

  // Generate QR code URL for authenticator apps
  private generateQrCodeUrl(secret: string, name: string, issuer: string): string {
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: TotpService.DEFAULTS.algorithm,
      digits: TotpService.DEFAULTS.digits.toString(),
      period: TotpService.DEFAULTS.period.toString(),
    });

    const label = encodeURIComponent(`${issuer}:${name}`);
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  // Verify and activate TOTP
  async verifyAndActivateTotp(
    userId: string,
    code: string,
    secretId?: string,
    companyId?: string
  ): Promise<TotpResult> {
    const timerId = PerformanceUtils.startTimer('verifyAndActivateTotp');

    try {
      // TODO: Replace with proper TotpSecret model in Prisma schema
      // Find the TOTP secret from in-memory storage
      let secretRecord: (TotpSecret & { createdAt: Date; lastUsedAt?: Date }) | undefined;
      if (secretId) {
        secretRecord = TotpService.totpSecrets.get(secretId);
      } else {
        // Find most recent inactive secret for user
        const userSecrets = Array.from(TotpService.totpSecrets.values())
          .filter(s => s.userId === userId && s.companyId === companyId && !s.isActive)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        secretRecord = userSecrets[0];
      }

      if (!secretRecord) {
        return { success: false, error: 'TOTP setup not found' };
      }

      // Verify the code
      const isValid = this.verifyTotpCode(
        secretRecord.secret,
        code,
        undefined, // Use current time
        secretRecord.algorithm,
        secretRecord.digits,
        secretRecord.period
      );

      if (!isValid) {
        return { success: false, error: 'Invalid TOTP code' };
      }

      // TODO: Replace with proper TotpSecret model in Prisma schema
      // Activate the TOTP secret in in-memory storage
      secretRecord.isActive = true;
      secretRecord.lastUsedAt = new Date();
      TotpService.totpSecrets.set(secretRecord.id, secretRecord);

      // Calculate remaining time until next code
      const now = Math.floor(Date.now() / 1000);
      const remainingTime = secretRecord.period - (now % secretRecord.period);

      PerformanceUtils.endTimer(timerId);

      console.log(`TOTP activated for user ${userId}`);

      return {
        success: true,
        secretId: secretRecord.id,
        remainingTime,
      };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to verify and activate TOTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // Verify TOTP code for authentication
  async verifyTotp(request: TotpVerification): Promise<TotpResult> {
    const timerId = PerformanceUtils.startTimer('verifyTotp');

    try {
      const { userId, code, secretId, companyId } = request;

      // TODO: Replace with proper TotpSecret model in Prisma schema
      // Find active TOTP secret from in-memory storage
      let secretRecord: (TotpSecret & { createdAt: Date; lastUsedAt?: Date }) | undefined;
      if (secretId) {
        secretRecord = TotpService.totpSecrets.get(secretId);
      } else {
        // Find most recent active secret for user
        const userSecrets = Array.from(TotpService.totpSecrets.values())
          .filter(s => s.userId === userId && s.companyId === companyId && s.isActive)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        secretRecord = userSecrets[0];
      }

      if (!secretRecord) {
        return { success: false, error: 'TOTP not configured' };
      }

      // Verify the code
      const isValid = this.verifyTotpCode(
        secretRecord.secret,
        code,
        undefined, // Use current time
        secretRecord.algorithm,
        secretRecord.digits,
        secretRecord.period
      );

      if (!isValid) {
        // Check backup codes if TOTP failed
        if (secretRecord.backupCodes) {
          const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
          const backupCodeIndex = secretRecord.backupCodes.indexOf(hashedCode);

          if (backupCodeIndex !== -1) {
            // Remove used backup code
            const updatedBackupCodes = [...secretRecord.backupCodes];
            updatedBackupCodes.splice(backupCodeIndex, 1);

            // TODO: Replace with proper TotpSecret model in Prisma schema
            secretRecord.backupCodes = updatedBackupCodes;
            secretRecord.lastUsedAt = new Date();
            TotpService.totpSecrets.set(secretRecord.id, secretRecord);

            PerformanceUtils.endTimer(timerId);
            console.log(`Backup code used for user ${userId}`);

            return {
              success: true,
              secretId: secretRecord.id,
            };
          }
        }

        return { success: false, error: 'Invalid TOTP code' };
      }

      // Update last used timestamp
      // TODO: Replace with proper TotpSecret model in Prisma schema
      secretRecord.lastUsedAt = new Date();
      TotpService.totpSecrets.set(secretRecord.id, secretRecord);

      // Calculate remaining time until next code
      const now = Math.floor(Date.now() / 1000);
      const remainingTime = secretRecord.period - (now % secretRecord.period);

      PerformanceUtils.endTimer(timerId);

      return {
        success: true,
        secretId: secretRecord.id,
        remainingTime,
      };

    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Failed to verify TOTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // Get TOTP secrets for user
  async getUserTotpSecrets(userId: string, companyId?: string): Promise<TotpSecret[]> {
    try {
      // TODO: Replace with proper TotpSecret model in Prisma schema
      const secrets: TotpSecret[] = Array.from(TotpService.totpSecrets.values())
        .filter(s => s.userId === userId && s.companyId === companyId)
        .map(s => ({
          id: s.id,
          userId: s.userId,
          secret: s.secret,
          name: s.name,
          issuer: s.issuer,
          algorithm: s.algorithm,
          digits: s.digits,
          period: s.period,
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt,
          isActive: s.isActive,
          backupCodes: s.backupCodes,
          companyId: s.companyId,
        }));

      return secrets;
    } catch (error) {
      console.error('Failed to get TOTP secrets:', error);
      return [];
    }
  }

  // Disable TOTP for user
  async disableTotp(userId: string, secretId?: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const whereClause: any = {
        userId,
        companyId,
        isActive: true,
      };

      if (secretId) {
        whereClause.id = secretId;
      }

      // TODO: Replace with proper TotpSecret model in Prisma schema
      let count = 0;
      for (const [id, secret] of TotpService.totpSecrets.entries()) {
        if ((!secretId || secret.id === secretId) && 
            secret.userId === userId && 
            secret.companyId === companyId && 
            secret.isActive) {
          secret.isActive = false;
          TotpService.totpSecrets.set(id, secret);
          count++;
        }
      }

      if (count === 0) {
        return { success: false, error: 'No active TOTP found' };
      }

      console.log(`TOTP disabled for user ${userId}`);
      return { success: true };

    } catch (error) {
      console.error('Failed to disable TOTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disable failed',
      };
    }
  }

  // Generate current TOTP code for a secret (for testing/debugging)
  async generateCurrentCode(secretId: string): Promise<{ code: string; remainingTime: number } | null> {
    try {
      // TODO: Replace with proper TotpSecret model in Prisma schema
      const secretRecord = TotpService.totpSecrets.get(secretId);

      if (!secretRecord) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const code = this.generateTotp(
        secretRecord.secret,
        now,
        secretRecord.algorithm,
        secretRecord.digits,
        secretRecord.period
      );

      const remainingTime = secretRecord.period - (now % secretRecord.period);

      return { code, remainingTime };

    } catch (error) {
      console.error('Failed to generate current TOTP code:', error);
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; activeSecrets: number; timestamp: string }> {
    try {
      // TODO: Replace with proper TotpSecret model in Prisma schema
      const activeSecrets = Array.from(TotpService.totpSecrets.values())
        .filter(s => s.isActive).length;

      return {
        status: 'healthy',
        activeSecrets,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        activeSecrets: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let totpServiceInstance: TotpService | null = null;

function getTotpService(): TotpService {
  if (!totpServiceInstance) {
    totpServiceInstance = new TotpService();
  }
  return totpServiceInstance;
}

// Server actions for API routes
export async function setupTotpServer(
  userId: string,
  name?: string,
  issuer?: string,
  companyId?: string
): Promise<TotpSetup> {
  try {
    const service = getTotpService();
    return await service.setupTotp(userId, name, issuer, companyId);
  } catch (error) {
    console.error('Failed to setup TOTP:', error);
    throw error;
  }
}

export async function verifyAndActivateTotpServer(
  userId: string,
  code: string,
  secretId?: string,
  companyId?: string
): Promise<TotpResult> {
  try {
    const service = getTotpService();
    return await service.verifyAndActivateTotp(userId, code, secretId, companyId);
  } catch (error) {
    console.error('Failed to verify and activate TOTP:', error);
    throw error;
  }
}

export async function verifyTotpServer(request: TotpVerification): Promise<TotpResult> {
  try {
    const service = getTotpService();
    return await service.verifyTotp(request);
  } catch (error) {
    console.error('Failed to verify TOTP:', error);
    throw error;
  }
}

export async function getUserTotpSecretsServer(userId: string, companyId?: string): Promise<TotpSecret[]> {
  try {
    const service = getTotpService();
    return await service.getUserTotpSecrets(userId, companyId);
  } catch (error) {
    console.error('Failed to get TOTP secrets:', error);
    return [];
  }
}

export async function disableTotpServer(userId: string, secretId?: string, companyId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const service = getTotpService();
    return await service.disableTotp(userId, secretId, companyId);
  } catch (error) {
    console.error('Failed to disable TOTP:', error);
    throw error;
  }
}

export async function generateCurrentTotpCodeServer(secretId: string): Promise<{ code: string; remainingTime: number } | null> {
  try {
    const service = getTotpService();
    return await service.generateCurrentCode(secretId);
  } catch (error) {
    console.error('Failed to generate current TOTP code:', error);
    return null;
  }
}

export { getTotpService };
export default getTotpService;