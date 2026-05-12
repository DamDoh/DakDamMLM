import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../index';
import { prisma } from '../config/database';

export class FileEncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private tagLength = 16; // 128 bits

  // Get encryption key from environment or generate one
  private getEncryptionKey(): Buffer {
    const key = process.env.FILE_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('FILE_ENCRYPTION_KEY environment variable is required');
    }
    return crypto.scryptSync(key, 'salt', this.keyLength);
  }

  async encryptAndStoreFile(buffer: Buffer, filename: string, userId: string): Promise<string> {
    try {
      // Generate encryption key and IV
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher using AES-GCM
      const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
      cipher.setAAD(Buffer.from(userId)); // Additional authenticated data

      // Encrypt the file
      let encrypted = cipher.update(buffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Create unique filename
      const fileId = crypto.randomUUID();
      const encryptedFilename = `${fileId}.enc`;
      const userDir = userId.substring(0, 2); // First 2 chars for directory sharding
      const filePath = path.join('uploads', 'encrypted', userDir, encryptedFilename);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Store encryption metadata
      const metadata = {
        algorithm: this.algorithm,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        originalFilename: filename,
        userId,
        createdAt: new Date().toISOString()
      };

      // Combine metadata and encrypted data
      const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
      const metadataLength = Buffer.alloc(4);
      metadataLength.writeUInt32BE(metadataBuffer.length, 0);

      const finalBuffer = Buffer.concat([
        metadataLength,
        metadataBuffer,
        encrypted
      ]);

      // Write to file
      await fs.writeFile(filePath, finalBuffer);

      // Store encryption key reference in database
      await (prisma as any).fileEncryption.create({
        data: {
          proofId: fileId, // We'll update this when we have the proof ID
          algorithm: this.algorithm,
          key: key.toString('hex'), // In production, this should be encrypted with a master key
          iv: iv.toString('hex'),
          tag: tag.toString('hex')
        }
      });

      logger.info('File encrypted and stored successfully', { fileId, userId, filePath });

      return filePath;

    } catch (error) {
      logger.error('Error encrypting and storing file', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Failed to encrypt and store file');
    }
  }

  async decryptFile(encryptedPath: string): Promise<Buffer> {
    try {
      // Read encrypted file
      const encryptedBuffer = await fs.readFile(encryptedPath);

      // Extract metadata length (first 4 bytes)
      const metadataLength = encryptedBuffer.readUInt32BE(0);
      const metadataEnd = 4 + metadataLength;

      // Extract metadata
      const metadataBuffer = encryptedBuffer.subarray(4, metadataEnd);
      const metadata = JSON.parse(metadataBuffer.toString('utf8'));

      // Extract encrypted data
      const encryptedData = encryptedBuffer.subarray(metadataEnd);

      // Get encryption key
      const key = this.getEncryptionKey();
      const iv = Buffer.from(metadata.iv, 'hex');
      const tag = Buffer.from(metadata.tag, 'hex');

      // Create decipher using AES-GCM
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAAD(Buffer.from(metadata.userId));
      decipher.setAuthTag(tag);

      // Decrypt the file
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      logger.info('File decrypted successfully', { encryptedPath });

      return decrypted;

    } catch (error) {
      logger.error('Error decrypting file', { error: error instanceof Error ? error.message : String(error), encryptedPath });
      throw new Error('Failed to decrypt file');
    }
  }

  async deleteFile(encryptedPath: string): Promise<void> {
    try {
      await fs.remove(encryptedPath);
      logger.info('Encrypted file deleted', { encryptedPath });
    } catch (error) {
      logger.error('Error deleting encrypted file', { error: error instanceof Error ? error.message : String(error), encryptedPath });
      throw new Error('Failed to delete encrypted file');
    }
  }

  async getFileMetadata(encryptedPath: string): Promise<any> {
    try {
      const encryptedBuffer = await fs.readFile(encryptedPath);
      const metadataLength = encryptedBuffer.readUInt32BE(0);
      const metadataBuffer = encryptedBuffer.subarray(4, 4 + metadataLength);
      return JSON.parse(metadataBuffer.toString('utf8'));
    } catch (error) {
      logger.error('Error reading file metadata', { error: error instanceof Error ? error.message : String(error), encryptedPath });
      throw new Error('Failed to read file metadata');
    }
  }

  // Generate a secure random key for file encryption
  generateFileKey(): string {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  // Encrypt a file key with master key
  encryptFileKey(fileKey: string): string {
    const masterKey = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv('aes-256-cbc', masterKey, iv);

    let encrypted = cipher.update(fileKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  // Decrypt a file key with master key
  decryptFileKey(encryptedFileKey: string): string {
    const masterKey = this.getEncryptionKey();
    const [ivHex, encrypted] = encryptedFileKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', masterKey, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Validate file integrity
  async validateFileIntegrity(encryptedPath: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(encryptedPath);
      const fileStats = await fs.stat(encryptedPath);

      // Check if file exists and has content
      if (!fileStats || fileStats.size === 0) {
        return false;
      }

      // Additional integrity checks can be added here
      // For example, comparing file hash with stored hash

      return true;
    } catch (error) {
      logger.error('File integrity validation failed', { error: error instanceof Error ? error.message : String(error), encryptedPath });
      return false;
    }
  }
}