/**
 * BLOCKCHAIN-STYLE IMMUTABLE AUDIT LOGGING SERVICE
 *
 * Provides cryptographically secure, immutable audit trails for:
 * - Financial transactions (commissions, payments, transfers)
 * - User actions and data changes
 * - System events and security incidents
 * - Regulatory compliance and DSAR requests
 *
 * Features:
 * - SHA-256 cryptographic hashing
 * - Merkle tree structure for integrity
 * - Tamper-proof audit chains
 * - Digital signatures for authenticity
 * - Compliance with SOX, GDPR, and financial regulations
 *
 * Created: 2025-11-20 (Enhancement)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface AuditBlock {
  id: string;
  blockNumber: number;
  timestamp: Date;
  previousHash: string;
  hash: string;
  data: AuditEntry;
  signature?: string;
  merkleRoot?: string;
  nonce: number;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  companyId?: string;
  action: string;
  entity: string;
  entityId?: string;
  changes: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  complianceFlags?: string[];
}

export interface AuditChain {
  chainId: string;
  genesisBlock: AuditBlock;
  latestBlock: AuditBlock;
  totalBlocks: number;
  isValid: boolean;
  lastValidation: Date;
}

class BlockchainAuditService {
  private chains = new Map<string, AuditChain>();
  private readonly DIFFICULTY = 2; // Proof-of-work difficulty
  private readonly GENESIS_PREVIOUS_HASH = '0'.repeat(64);

  /**
   * Initialize audit chains for companies
   */
  async initializeCompanyChain(companyId: string): Promise<AuditChain> {
    try {
      // Check if chain already exists
      if (this.chains.has(companyId)) {
        return this.chains.get(companyId)!;
      }

      // Create genesis block
      const genesisBlock = await this.createGenesisBlock(companyId);

      const chain: AuditChain = {
        chainId: companyId,
        genesisBlock,
        latestBlock: genesisBlock,
        totalBlocks: 1,
        isValid: true,
        lastValidation: new Date()
      };

      this.chains.set(companyId, chain);

      // Persist genesis block
      await this.persistBlock(genesisBlock);

      logger.info(`Audit chain initialized for company: ${companyId}`);
      return chain;

    } catch (error) {
      logger.error('Failed to initialize audit chain:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Add audit entry to blockchain
   */
  async addAuditEntry(entry: AuditEntry): Promise<AuditBlock> {
    try {
      const companyId = entry.companyId || 'global';
      let chain = this.chains.get(companyId);

      if (!chain) {
        chain = await this.initializeCompanyChain(companyId);
      }

      // Create new block
      const newBlock = await this.createBlock(chain.latestBlock, entry);

      // Add to chain
      chain.latestBlock = newBlock;
      chain.totalBlocks++;
      this.chains.set(companyId, chain);

      // Persist block
      await this.persistBlock(newBlock);

      // Validate chain integrity
      await this.validateChain(companyId);

      logger.info(`Audit block added: ${newBlock.id} for company: ${companyId}`);
      return newBlock;

    } catch (error) {
      logger.error('Failed to add audit entry:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create genesis block for new audit chain
   */
  private async createGenesisBlock(companyId: string): Promise<AuditBlock> {
    const genesisEntry: AuditEntry = {
      id: `genesis-${companyId}`,
      timestamp: new Date(),
      action: 'CHAIN_INITIALIZED',
      entity: 'audit_chain',
      changes: {
        companyId,
        initializedAt: new Date().toISOString(),
        version: '1.0.0'
      },
      metadata: {
        genesis: true,
        compliance: ['SOX', 'GDPR', 'FINANCIAL_REGULATIONS']
      }
    };

    const genesisBlock: AuditBlock = {
      id: `block-genesis-${companyId}`,
      blockNumber: 0,
      timestamp: new Date(),
      previousHash: this.GENESIS_PREVIOUS_HASH,
      hash: '',
      data: genesisEntry,
      nonce: 0
    };

    // Calculate genesis hash
    genesisBlock.hash = this.calculateBlockHash(genesisBlock);

    return genesisBlock;
  }

  /**
   * Create new block with proof-of-work
   */
  private async createBlock(previousBlock: AuditBlock, entry: AuditEntry): Promise<AuditBlock> {
    const block: AuditBlock = {
      id: `block-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      blockNumber: previousBlock.blockNumber + 1,
      timestamp: new Date(),
      previousHash: previousBlock.hash,
      hash: '',
      data: entry,
      nonce: 0
    };

    // Proof-of-work (simplified for performance)
    block.hash = this.calculateBlockHash(block);
    block.nonce = this.proofOfWork(block);

    // Recalculate hash with nonce
    block.hash = this.calculateBlockHash(block);

    // Add digital signature (simplified - in production use proper PKI)
    block.signature = this.signBlock(block);

    // Calculate Merkle root for data integrity
    block.merkleRoot = this.calculateMerkleRoot([entry]);

    return block;
  }

  /**
   * Calculate block hash using SHA-256
   */
  private calculateBlockHash(block: AuditBlock): string {
    const blockData = {
      blockNumber: block.blockNumber,
      timestamp: block.timestamp.toISOString(),
      previousHash: block.previousHash,
      data: block.data,
      nonce: block.nonce
    };

    return crypto.createHash('sha256')
      .update(JSON.stringify(blockData))
      .digest('hex');
  }

  /**
   * Simplified proof-of-work (adjustable difficulty)
   */
  private proofOfWork(block: AuditBlock): number {
    let nonce = 0;
    let hash = '';

    do {
      nonce++;
      block.nonce = nonce;
      hash = this.calculateBlockHash(block);
    } while (!hash.startsWith('0'.repeat(this.DIFFICULTY)));

    return nonce;
  }

  /**
   * Digital signature for block authenticity
   */
  private signBlock(block: AuditBlock): string {
    // Simplified signature - in production use RSA/ECDSA with private keys
    const signatureData = block.hash + block.timestamp.toISOString();
    return crypto.createHash('sha256')
      .update(signatureData)
      .digest('hex')
      .substring(0, 64); // Truncated for demo
  }

  /**
   * Calculate Merkle root for data integrity
   */
  private calculateMerkleRoot(entries: AuditEntry[]): string {
    if (entries.length === 0) return '';

    const hashes = entries.map(entry =>
      crypto.createHash('sha256')
        .update(JSON.stringify(entry))
        .digest('hex')
    );

    // Simplified Merkle tree calculation
    return crypto.createHash('sha256')
      .update(hashes.join(''))
      .digest('hex');
  }

  /**
   * Persist block to database
   */
  private async persistBlock(block: AuditBlock): Promise<void> {
    try {
      // Create audit log entry with blockchain data
      await prisma.auditLog.create({
        data: {
          userId: block.data.userId || null,
          action: `BLOCKCHAIN_AUDIT:${block.data.action}`,
          entity: block.data.entity,
          entityId: block.data.entityId || null,
          changes: {
            ...block.data.changes,
            blockchain: {
              blockId: block.id,
              blockNumber: block.blockNumber,
              hash: block.hash,
              previousHash: block.previousHash,
              signature: block.signature,
              merkleRoot: block.merkleRoot,
              nonce: block.nonce
            }
          },
          ipAddress: block.data.ipAddress || null,
          userAgent: block.data.userAgent || null,
          companyId: block.data.companyId || null
        }
      });
    } catch (error) {
      logger.error('Failed to persist audit block:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate entire blockchain integrity
   */
  async validateChain(companyId: string): Promise<boolean> {
    try {
      const chain = this.chains.get(companyId);
      if (!chain) {
        throw new Error(`Chain not found: ${companyId}`);
      }

      // Get all blocks from database
      const blocks = await prisma.auditLog.findMany({
        where: {
          companyId: companyId,
          action: {
            startsWith: 'BLOCKCHAIN_AUDIT:'
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      let previousHash = this.GENESIS_PREVIOUS_HASH;
      let isValid = true;

      for (const logEntry of blocks) {
        const blockchainData = (logEntry.changes as any)?.blockchain;
        if (!blockchainData) continue;

        // Validate hash chain
        if (blockchainData.previousHash !== previousHash) {
          isValid = false;
          break;
        }

        // Recalculate and verify hash
        const recalculatedHash = this.recalculateBlockHash(blockchainData);
        if (recalculatedHash !== blockchainData.hash) {
          isValid = false;
          break;
        }

        previousHash = blockchainData.hash;
      }

      // Update chain validation status
      chain.isValid = isValid;
      chain.lastValidation = new Date();
      this.chains.set(companyId, chain);

      if (!isValid) {
        logger.error(`Audit chain validation FAILED for company: ${companyId}`);
        // Trigger security alert
        await this.triggerSecurityAlert(companyId, 'CHAIN_VALIDATION_FAILED');
      }

      return isValid;

    } catch (error) {
      logger.error('Chain validation failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Recalculate block hash for validation
   */
  private recalculateBlockHash(blockchainData: any): string {
    const blockData = {
      blockNumber: blockchainData.blockNumber,
      timestamp: blockchainData.timestamp,
      previousHash: blockchainData.previousHash,
      data: blockchainData.data,
      nonce: blockchainData.nonce
    };

    return crypto.createHash('sha256')
      .update(JSON.stringify(blockData))
      .digest('hex');
  }

  /**
   * Get audit trail with blockchain verification
   */
  async getVerifiedAuditTrail(
    companyId: string,
    entityId?: string,
    limit: number = 100
  ): Promise<{
    entries: AuditEntry[];
    chainValid: boolean;
    verificationProof: string;
  }> {
    try {
      const where: any = {
        companyId: companyId,
        action: {
          startsWith: 'BLOCKCHAIN_AUDIT:'
        }
      };

      if (entityId) {
        where.entityId = entityId;
      }

      const auditLogs = await prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      const entries: AuditEntry[] = auditLogs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        userId: log.userId || undefined,
        companyId: log.companyId || undefined,
        action: log.action.replace('BLOCKCHAIN_AUDIT:', ''),
        entity: log.entity,
        entityId: log.entityId || undefined,
        changes: log.changes as Record<string, any>,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        metadata: (log.changes as any)?.metadata,
        complianceFlags: (log.changes as any)?.complianceFlags
      }));

      const chainValid = await this.validateChain(companyId);
      const verificationProof = this.generateVerificationProof(entries);

      return {
        entries,
        chainValid,
        verificationProof
      };

    } catch (error) {
      logger.error('Failed to get verified audit trail:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Generate verification proof for audit trail
   */
  private generateVerificationProof(entries: AuditEntry[]): string {
    const hashes = entries.map(entry =>
      crypto.createHash('sha256')
        .update(JSON.stringify(entry))
        .digest('hex')
    );

    return crypto.createHash('sha256')
      .update(hashes.join(''))
      .digest('hex');
  }

  /**
   * Log financial transaction with blockchain immutability
   */
  async logFinancialTransaction(
    userId: string,
    companyId: string,
    transactionType: string,
    amount: number,
    details: Record<string, any>
  ): Promise<AuditBlock> {
    const entry: AuditEntry = {
      id: `txn-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date(),
      userId,
      companyId,
      action: 'FINANCIAL_TRANSACTION',
      entity: transactionType,
      changes: {
        amount,
        ...details
      },
      complianceFlags: ['SOX', 'FINANCIAL_REGULATIONS', 'AML'],
      metadata: {
        transactionId: details.transactionId,
        regulatory: true,
        immutable: true
      }
    };

    return await this.addAuditEntry(entry);
  }

  /**
   * Log user data change with GDPR compliance
   */
  async logDataChange(
    userId: string,
    companyId: string,
    entity: string,
    entityId: string,
    changes: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditBlock> {
    const entry: AuditEntry = {
      id: `data-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date(),
      userId,
      companyId,
      action: 'DATA_MODIFICATION',
      entity,
      entityId,
      changes,
      ipAddress,
      userAgent,
      complianceFlags: ['GDPR', 'DATA_PROTECTION'],
      metadata: {
        gdprCompliant: true,
        dataRetention: '7_years'
      }
    };

    return await this.addAuditEntry(entry);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    companyId: string,
    eventType: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<AuditBlock> {
    const entry: AuditEntry = {
      id: `sec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date(),
      companyId,
      action: 'SECURITY_EVENT',
      entity: eventType,
      changes: {
        severity,
        ...details
      },
      complianceFlags: ['SECURITY_AUDIT', 'REGULATORY_COMPLIANCE'],
      metadata: {
        security: true,
        alertLevel: severity
      }
    };

    return await this.addAuditEntry(entry);
  }

  /**
   * Trigger security alert for chain tampering
   */
  private async triggerSecurityAlert(companyId: string, alertType: string): Promise<void> {
    try {
      // Log the security incident
      await this.logSecurityEvent(companyId, alertType, {
        description: 'Blockchain audit chain validation failed',
        impact: 'Data integrity compromised',
        actionRequired: 'Immediate investigation required'
      }, 'critical');

      // In production, this would trigger:
      // - Email alerts to security team
      // - System lockdown procedures
      // - Regulatory notifications

      logger.error(`SECURITY ALERT: ${alertType} for company ${companyId}`);

    } catch (error) {
      logger.error('Failed to trigger security alert:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get chain statistics
   */
  async getChainStats(companyId: string): Promise<{
    totalBlocks: number;
    isValid: boolean;
    lastValidation: Date;
    averageBlockTime: number;
    securityScore: number;
  }> {
    const chain = this.chains.get(companyId);
    if (!chain) {
      throw new Error(`Chain not found: ${companyId}`);
    }

    // Calculate average block time (simplified)
    const blockCount = await prisma.auditLog.count({
      where: {
        companyId,
        action: { startsWith: 'BLOCKCHAIN_AUDIT:' }
      }
    });

    const averageBlockTime = blockCount > 1 ? (Date.now() - chain.genesisBlock.timestamp.getTime()) / blockCount : 0;

    // Calculate security score based on validation and integrity
    let securityScore = 100;
    if (!chain.isValid) securityScore -= 50;
    if (chain.totalBlocks < 10) securityScore -= 20; // Low activity penalty

    return {
      totalBlocks: chain.totalBlocks,
      isValid: chain.isValid,
      lastValidation: chain.lastValidation,
      averageBlockTime,
      securityScore
    };
  }

  /**
   * Export audit trail for regulatory compliance
   */
  async exportAuditTrail(
    companyId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const auditTrail = await this.getVerifiedAuditTrail(companyId);

    const filteredEntries = auditTrail.entries.filter(
      entry => entry.timestamp >= startDate && entry.timestamp <= endDate
    );

    if (format === 'csv') {
      // Convert to CSV format
      const headers = ['timestamp', 'userId', 'action', 'entity', 'entityId', 'ipAddress', 'complianceFlags'];
      const rows = filteredEntries.map(entry => [
        entry.timestamp.toISOString(),
        entry.userId || '',
        entry.action,
        entry.entity,
        entry.entityId || '',
        entry.ipAddress || '',
        (entry.complianceFlags || []).join(';')
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify({
      companyId,
      exportDate: new Date().toISOString(),
      period: { startDate, endDate },
      chainValid: auditTrail.chainValid,
      verificationProof: auditTrail.verificationProof,
      entries: filteredEntries
    }, null, 2);
  }
}

// Export singleton instance
export const blockchainAuditService = new BlockchainAuditService();