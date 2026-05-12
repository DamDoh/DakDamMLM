/**
 * COMPLIANCE SERVICE
 * 
 * Handles compliance documents, member agreements, and regulatory requirements
 * 
 * Features:
 * - Document management (terms, privacy, policies)
 * - Member agreement tracking
 * - Digital signature capture
 * - Compliance status checking
 * - Version control
 * 
 * Created: 2025-10-19 (Audit Fix)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface ComplianceDocument {
  id: string;
  title: string;
  type: 'terms' | 'privacy' | 'compensation' | 'policy';
  content: string;
  version: string;
  isActive: boolean;
  effectiveDate: Date;
  companyId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface MemberAgreement {
  id: string;
  memberId: string;
  documentId: string;
  signed: boolean;
  signedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  companyId?: string;
  createdAt: Date;
}

export interface CreateDocumentData {
  title: string;
  type: 'terms' | 'privacy' | 'compensation' | 'policy';
  content: string;
  version: string;
  effectiveDate: Date;
  companyId?: string;
  createdBy: string;
}

/**
 * Create a compliance document
 */
export async function createComplianceDocument(
  data: CreateDocumentData
): Promise<ComplianceDocument> {
  try {
    // Deactivate previous versions of same type
    if (data.companyId) {
      await prisma.complianceDocument.updateMany({
        where: {
          type: data.type,
          companyId: data.companyId,
          isActive: true
        },
        data: { isActive: false }
      });
    }

    // Create new document
    const document = await prisma.complianceDocument.create({
      data: {
        title: data.title,
        type: data.type,
        content: data.content,
        version: data.version,
        isActive: true,
        effectiveDate: data.effectiveDate,
        companyId: data.companyId,
        createdBy: data.createdBy
      }
    });

    logger.info('Compliance document created', {
      documentId: document.id,
      type: data.type,
      version: data.version
    });

    return document as ComplianceDocument;
  } catch (error) {
    logger.error('Failed to create compliance document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      data
    });
    throw error;
  }
}

/**
 * Get active compliance documents
 */
export async function getActiveComplianceDocuments(
  type?: 'terms' | 'privacy' | 'compensation' | 'policy',
  companyId?: string
): Promise<ComplianceDocument[]> {
  try {
    const where: any = { isActive: true };
    
    if (type) {
      where.type = type;
    }
    
    if (companyId) {
      where.companyId = companyId;
    }

    const documents = await prisma.complianceDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return documents as ComplianceDocument[];
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      logger.error('Failed to get active compliance documents', {
        error: 'Not found'
      });
    } else {
      logger.error('Failed to get active compliance documents', {
        error: errorMessage,
        type,
        companyId
      });
    }
    return [];
  }
}

/**
 * Get member agreements
 */
export async function getMemberAgreements(
  memberId: string,
  companyId?: string
): Promise<MemberAgreement[]> {
  try {
    const where: any = { memberId };
    
    if (companyId) {
      where.companyId = companyId;
    }

    const agreements = await prisma.memberAgreement.findMany({
      where,
      include: {
        document: {
          select: {
            title: true,
            type: true,
            version: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return agreements as any as MemberAgreement[];
  } catch (error) {
    logger.error('Failed to get member agreements', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId
    });
    return [];
  }
}

/**
 * Get all member agreements (for admin dashboard)
 * If memberId is provided, filters by that member; otherwise returns all
 */
export async function getAllMemberAgreements(
  companyId?: string,
  memberId?: string
): Promise<MemberAgreement[]> {
  try {
    const where: any = {};
    
    if (memberId) {
      where.memberId = memberId;
    }
    
    if (companyId) {
      where.companyId = companyId;
    }

    const agreements = await prisma.memberAgreement.findMany({
      where,
      include: {
        document: {
          select: {
            title: true,
            type: true,
            version: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return agreements as any as MemberAgreement[];
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      logger.error('Failed to get all member agreements', {
        error: 'Not found'
      });
    } else {
      logger.error('Failed to get all member agreements', {
        error: errorMessage,
        companyId,
        memberId
      });
    }
    return [];
  }
}

/**
 * Create a member agreement record
 */
export async function createMemberAgreement(
  memberId: string,
  documentId: string,
  companyId?: string
): Promise<MemberAgreement> {
  try {
    // Check if agreement already exists
    const existing = await prisma.memberAgreement.findFirst({
      where: {
        memberId,
        documentId
      }
    });

    if (existing) {
      logger.warn('Agreement already exists', { memberId, documentId });
      return existing as MemberAgreement;
    }

    // Validate document exists
    const document = await prisma.complianceDocument.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw new Error(`Compliance document ${documentId} not found`);
    }

    // Create agreement
    const agreement = await prisma.memberAgreement.create({
      data: {
        memberId,
        documentId,
        companyId
      }
    });

    logger.info('Member agreement created', {
      agreementId: agreement.id,
      memberId,
      documentId
    });

    return agreement as MemberAgreement;
  } catch (error) {
    logger.error('Failed to create member agreement', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId,
      documentId
    });
    throw error;
  }
}

/**
 * Sign an agreement (digital signature)
 */
export async function signAgreement(
  agreementId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<MemberAgreement> {
  try {
    const agreement = await prisma.memberAgreement.update({
      where: { id: agreementId },
      data: {
        signed: true,
        signedAt: new Date(),
        ipAddress,
        userAgent
      }
    });

    logger.info('Agreement signed', {
      agreementId,
      memberId: agreement.memberId,
      ipAddress
    });

    // Security audit log
    logger.security('Member signed compliance agreement', undefined, {
      agreementId,
      memberId: agreement.memberId,
      ipAddress,
      userAgent
    });

    return agreement as MemberAgreement;
  } catch (error) {
    logger.error('Failed to sign agreement', {
      error: error instanceof Error ? error.message : 'Unknown error',
      agreementId
    });
    throw error;
  }
}

/**
 * Check member's compliance status
 */
export async function checkComplianceStatus(
  memberId: string,
  companyId?: string
): Promise<{
  compliant: boolean;
  unsignedDocuments: string[];
  totalDocuments: number;
  signedDocuments: number;
}> {
  try {
    // Get all active documents for the company
    const activeDocuments = await getActiveComplianceDocuments(undefined, companyId);

    // Get member's signed agreements
    const memberAgreements = await prisma.memberAgreement.findMany({
      where: {
        memberId,
        signed: true,
        ...(companyId ? { companyId } : {})
      },
      select: { documentId: true }
    });

    const signedDocumentIds = new Set(memberAgreements.map(a => a.documentId));

    // Find unsigned documents
    const unsignedDocuments = activeDocuments
      .filter(doc => !signedDocumentIds.has(doc.id))
      .map(doc => doc.id);

    return {
      compliant: unsignedDocuments.length === 0,
      unsignedDocuments,
      totalDocuments: activeDocuments.length,
      signedDocuments: signedDocumentIds.size
    };
  } catch (error) {
    logger.error('Failed to check compliance status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId
    });
    return {
      compliant: false,
      unsignedDocuments: [],
      totalDocuments: 0,
      signedDocuments: 0
    };
  }
}

/**
 * Get unsigned documents for a member
 */
export async function getUnsignedDocuments(
  memberId: string,
  companyId?: string
): Promise<ComplianceDocument[]> {
  try {
    const status = await checkComplianceStatus(memberId, companyId);
    
    if (status.unsignedDocuments.length === 0) {
      return [];
    }

    const documents = await prisma.complianceDocument.findMany({
      where: {
        id: { in: status.unsignedDocuments },
        isActive: true
      }
    });

    return documents as ComplianceDocument[];
  } catch (error) {
    logger.error('Failed to get unsigned documents', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId
    });
    return [];
  }
}

/**
 * Get compliance statistics
 */
export async function getComplianceStatistics(companyId?: string): Promise<{
  totalDocuments: number;
  activeDocuments: number;
  totalAgreements: number;
  signedAgreements: number;
  complianceRate: number;
}> {
  try {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const [totalDocs, activeDocs, totalAgreements, signedAgreements] = await Promise.all([
      prisma.complianceDocument.count({ where }),
      prisma.complianceDocument.count({ where: { ...where, isActive: true } }),
      prisma.memberAgreement.count({ where }),
      prisma.memberAgreement.count({ where: { ...where, signed: true } })
    ]);

    const complianceRate = totalAgreements > 0
      ? (signedAgreements / totalAgreements) * 100
      : 0;

    return {
      totalDocuments: totalDocs,
      activeDocuments: activeDocs,
      totalAgreements,
      signedAgreements,
      complianceRate: Math.round(complianceRate * 100) / 100
    };
  } catch (error) {
    logger.error('Failed to get compliance statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return {
      totalDocuments: 0,
      activeDocuments: 0,
      totalAgreements: 0,
      signedAgreements: 0,
      complianceRate: 0
    };
  }
}

/**
 * Bulk create agreements for new member
 */
export async function createRequiredAgreementsForMember(
  memberId: string,
  companyId?: string
): Promise<number> {
  try {
    // Get all active compliance documents
    const documents = await getActiveComplianceDocuments(undefined, companyId);

    // Create agreements for all documents
    let created = 0;
    for (const document of documents) {
      try {
        await createMemberAgreement(memberId, document.id, companyId);
        created++;
      } catch (error) {
        // Continue if agreement already exists
        logger.warn('Failed to create agreement', {
          memberId,
          documentId: document.id,
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }

    logger.info('Required agreements created for new member', {
      memberId,
      created,
      total: documents.length
    });

    return created;
  } catch (error) {
    logger.error('Failed to create required agreements', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId
    });
    return 0;
  }
}
