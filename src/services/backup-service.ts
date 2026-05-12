import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const execAsync = promisify(exec);

export interface BackupConfig {
  databaseUrl: string;
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  retentionDays: number;
  schedule: string; // cron expression
}

export interface BackupResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  uploadTime: number;
  error?: string;
}

export class BackupService {
  private s3Client: S3Client;
  private config: BackupConfig;

  constructor(config: BackupConfig) {
    this.config = config;
    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  /**
   * Create database backup
   */
  async createDatabaseBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.sql`;
    const filePath = path.join('/tmp', fileName);

    try {
      // Extract database connection details from URL
      const dbUrl = new URL(this.config.databaseUrl);
      const dbName = dbUrl.pathname.slice(1);
      const dbHost = dbUrl.hostname;
      const dbPort = dbUrl.port;
      const dbUser = dbUrl.username;
      const dbPassword = dbUrl.password;

      // Create pg_dump command
      const dumpCommand = `PGPASSWORD=${dbPassword} pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f ${filePath} --no-password --format=custom`;

      await execAsync(dumpCommand);

      return filePath;
    } catch (error) {
      throw new Error(`Database backup failed: ${error}`);
    }
  }

  /**
   * Upload backup to cloud storage
   */
  async uploadToCloud(localPath: string, remoteName: string): Promise<void> {
    try {
      const fileContent = fs.readFileSync(localPath);

      const uploadCommand = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: `backups/${remoteName}`,
        Body: fileContent,
        ContentType: 'application/octet-stream',
        Metadata: {
          'backup-date': new Date().toISOString(),
          'backup-type': 'database'
        }
      });

      await this.s3Client.send(uploadCommand);
    } catch (error) {
      throw new Error(`Cloud upload failed: ${error}`);
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: 'backups/'
      });

      const response = await this.s3Client.send(listCommand);
      const objects = response.Contents || [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      for (const obj of objects) {
        if (obj.LastModified && obj.LastModified < cutoffDate) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: this.config.bucketName,
            Key: obj.Key
          });

          await this.s3Client.send(deleteCommand);
          console.log(`Deleted old backup: ${obj.Key}`);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Perform complete backup process
   */
  async performBackup(): Promise<BackupResult> {
    const startTime = Date.now();

    try {
      // Create backup
      console.log('Creating database backup...');
      const localPath = await this.createDatabaseBackup();

      // Get file size
      const stats = fs.statSync(localPath);
      const fileSize = stats.size;

      // Generate remote filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const remoteName = `backup-${timestamp}.dump`;

      // Upload to cloud
      console.log('Uploading to cloud storage...');
      await this.uploadToCloud(localPath, remoteName);

      // Clean up local file
      fs.unlinkSync(localPath);

      // Clean up old backups
      console.log('Cleaning up old backups...');
      await this.cleanupOldBackups();

      const uploadTime = Date.now() - startTime;

      console.log(`Backup completed successfully: ${remoteName}`);

      return {
        success: true,
        fileName: remoteName,
        fileSize,
        uploadTime
      };

    } catch (error) {
      const uploadTime = Date.now() - startTime;

      return {
        success: false,
        fileName: '',
        fileSize: 0,
        uploadTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{
    name: string;
    size: number;
    lastModified: Date;
  }>> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: 'backups/'
      });

      const response = await this.s3Client.send(listCommand);
      const objects = response.Contents || [];

      return objects.map(obj => ({
        name: obj.Key?.replace('backups/', '') || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date()
      })).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Validate backup configuration
   */
  async validateConfiguration(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check database connection
    try {
      const dbUrl = new URL(this.config.databaseUrl);
      if (!dbUrl.protocol.startsWith('postgresql')) {
        errors.push('Invalid database URL protocol');
      }
    } catch {
      errors.push('Invalid database URL format');
    }

    // Check S3 access
    try {
      const testCommand = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        MaxKeys: 1
      });

      await this.s3Client.send(testCommand);
    } catch (error) {
      errors.push(`S3 access failed: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Factory function to create backup service
export function createBackupService(config: BackupConfig): BackupService {
  return new BackupService(config);
}

// Default backup configuration
export const defaultBackupConfig: Partial<BackupConfig> = {
  region: 'us-east-1',
  retentionDays: 30,
  schedule: '0 2 * * *' // Daily at 2 AM
};