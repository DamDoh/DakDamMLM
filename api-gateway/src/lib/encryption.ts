// Data Encryption Service
// Provides encryption/decryption for sensitive data at rest and in transit

import crypto from 'crypto';
import { logger } from './logger';
import { getEnvConfig } from './env-validation';

// Validate environment on module load
const env = getEnvConfig();

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag

// Get validated encryption key from environment
const ENCRYPTION_KEY = env.ENCRYPTION_KEY;
const ENCRYPTION_KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

export interface EncryptedData {
  encrypted: string; // Base64 encoded
  iv: string; // Base64 encoded
  tag: string; // Base64 encoded
}

export interface DecryptedData {
  data: string;
  success: boolean;
  error?: string;
}

/**
 * Encrypt sensitive data
 */
export function encryptData(plainText: string): EncryptedData {
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY_BUFFER);
    cipher.setAAD(Buffer.from('')); // Additional authenticated data

    // Encrypt data
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    };

  } catch (error) {
    logger.error('Encryption failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedData: EncryptedData): DecryptedData {
  try {
    const { encrypted, iv, tag } = encryptedData;

    // Decode base64 values
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');

    // Create decipher
    const decipher = crypto.createDecipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY_BUFFER);
    decipher.setAuthTag(tagBuffer);
    decipher.setAAD(Buffer.from(''));

    // Decrypt data
    let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return {
      data: decrypted,
      success: true
    };

  } catch (error) {
    logger.error('Decryption failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      data: '',
      success: false,
      error: 'Failed to decrypt data'
    };
  }
}

/**
 * Encrypt wallet balance
 */
export function encryptWalletBalance(balance: number): EncryptedData {
  return encryptData(balance.toString());
}

/**
 * Decrypt wallet balance
 */
export function decryptWalletBalance(encryptedBalance: EncryptedData): number {
  const result = decryptData(encryptedBalance);
  if (!result.success) {
    throw new Error(result.error || 'Failed to decrypt wallet balance');
  }
  return parseFloat(result.data) || 0;
}

/**
 * Encrypt sensitive user data (PII)
 */
export function encryptSensitiveData(data: Record<string, any>): Record<string, any> {
  const encrypted: Record<string, any> = { ...data };

  // Fields that should be encrypted
  const sensitiveFields = [
    'idCardNumber',
    'taxId',
    'bankAccountNumber',
    'socialSecurityNumber',
    'driversLicenseNumber'
  ];

  sensitiveFields.forEach(field => {
    if (encrypted[field]) {
      try {
        encrypted[field] = encryptData(encrypted[field]);
      } catch (error) {
        logger.error(`Failed to encrypt field ${field}:`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // Keep original value if encryption fails
      }
    }
  });

  return encrypted;
}

/**
 * Decrypt sensitive user data
 */
export function decryptSensitiveData(data: Record<string, any>): Record<string, any> {
  const decrypted: Record<string, any> = { ...data };

  // Fields that should be decrypted
  const sensitiveFields = [
    'idCardNumber',
    'taxId',
    'bankAccountNumber',
    'socialSecurityNumber',
    'driversLicenseNumber'
  ];

  sensitiveFields.forEach(field => {
    if (decrypted[field] && typeof decrypted[field] === 'object' && decrypted[field].encrypted) {
      try {
        const result = decryptData(decrypted[field] as EncryptedData);
        if (result.success) {
          decrypted[field] = result.data;
        }
      } catch (error) {
        logger.error(`Failed to decrypt field ${field}:`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // Keep encrypted value if decryption fails
      }
    }
  });

  return decrypted;
}

/**
 * Generate a secure encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  try {
    const buffer = Buffer.from(key, 'hex');
    return buffer.length === KEY_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Hash sensitive data for storage (one-way)
 */
export function hashSensitiveData(data: string, saltRounds: number = 12): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(data, crypto.randomBytes(16), 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

/**
 * Verify hashed sensitive data
 */
export function verifyHashedData(data: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hashBuffer = Buffer.from(hash, 'hex');
    const salt = hashBuffer.slice(0, 16);
    const originalHash = hashBuffer.slice(16);

    crypto.scrypt(data, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(crypto.timingSafeEqual(derivedKey, originalHash));
    });
  });
}

/**
 * Health check for encryption service
 */
export function encryptionHealthCheck(): { status: string; keyValid: boolean; timestamp: string } {
  const keyValid = validateEncryptionKey(ENCRYPTION_KEY);

  return {
    status: keyValid ? 'healthy' : 'unhealthy',
    keyValid,
    timestamp: new Date().toISOString()
  };
}