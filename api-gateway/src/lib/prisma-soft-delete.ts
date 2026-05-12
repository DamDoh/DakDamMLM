/**
 * CRITICAL FIX #6: Soft Delete Middleware for Prisma
 * 
 * Automatically filters out deleted records from all queries
 * Ensures "deleted" users don't appear in results
 */

import { Prisma } from '@prisma/client';

/**
 * Prisma middleware to automatically filter soft-deleted records
 * Apply this to prisma client
 */
export const softDeleteMiddleware: any = async (params: any, next: any) => {
  // Models that support soft delete
  const softDeleteModels = ['User', 'Company', 'Product'];

  if (softDeleteModels.includes(params.model || '')) {
    // findUnique and findFirst
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.action = 'findFirst';
      params.args.where = {
        ...params.args.where,
        deleted: false
      };
    }

    // findMany
    if (params.action === 'findMany') {
      if (params.args.where) {
        if (params.args.where.deleted === undefined) {
          params.args.where['deleted'] = false;
        }
      } else {
        params.args['where'] = { deleted: false };
      }
    }

    // count
    if (params.action === 'count') {
      if (params.args.where) {
        if (params.args.where.deleted === undefined) {
          params.args.where['deleted'] = false;
        }
      } else {
        params.args['where'] = { deleted: false };
      }
    }

    // Update and updateMany should still work on deleted records if explicitly filtered
    // But by default should not update deleted records
    if (params.action === 'update') {
      params.args.where = {
        ...params.args.where,
        deleted: false
      };
    }

    if (params.action === 'updateMany') {
      if (params.args.where) {
        if (params.args.where.deleted === undefined) {
          params.args.where['deleted'] = false;
        }
      } else {
        params.args['where'] = { deleted: false };
      }
    }

    // Soft delete: Convert delete to update
    if (params.action === 'delete') {
      params.action = 'update';
      params.args['data'] = { deleted: true };
    }

    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data) {
        params.args.data['deleted'] = true;
      } else {
        params.args['data'] = { deleted: true };
      }
    }
  }

  return next(params);
};

/**
 * Apply the middleware to prisma client
 * Add this to your prisma.ts file:
 * 
 * import { softDeleteMiddleware } from './prisma-soft-delete';
 * prisma.$use(softDeleteMiddleware);
 */

/**
 * Helper functions for soft delete operations
 */
export const SoftDeleteHelpers = {
  /**
   * Soft delete a user (mark as deleted, don't actually delete)
   */
  async softDeleteUser(prisma: any, userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        deleted: true,
        active: false,
        deletedAt: new Date()
      }
    });
  },

  /**
   * Permanently delete a user (hard delete - use with caution!)
   * Only use for GDPR compliance or data cleanup
   */
  async hardDeleteUser(prisma: any, userId: string): Promise<void> {
    // This bypasses the middleware
    await prisma.$executeRaw`DELETE FROM users WHERE id = ${userId}`;
  },

  /**
   * Restore a soft-deleted user
   */
  async restoreUser(prisma: any, userId: string): Promise<void> {
    // Need to bypass middleware to update deleted record
    await prisma.$executeRaw`
      UPDATE users 
      SET deleted = false, active = true, deleted_at = NULL
      WHERE id = ${userId}
    `;
  },

  /**
   * Get deleted users (bypasses middleware)
   */
  async getDeletedUsers(prisma: any, companyId?: string): Promise<any[]> {
    const where = companyId 
      ? `WHERE deleted = true AND company_id = '${companyId}'`
      : 'WHERE deleted = true';

    return await prisma.$queryRawUnsafe(`
      SELECT id, email, full_name, deleted_at
      FROM users
      ${where}
      ORDER BY deleted_at DESC
    `);
  },

  /**
   * Count deleted vs active users
   */
  async getUserStats(prisma: any, companyId?: string): Promise<{
    active: number;
    deleted: number;
    total: number;
  }> {
    const where = companyId ? `WHERE company_id = '${companyId}'` : '';

    const [stats] = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) FILTER (WHERE deleted = false AND active = true) as active,
        COUNT(*) FILTER (WHERE deleted = true) as deleted,
        COUNT(*) as total
      FROM users
      ${where}
    `) as Array<{
      active: number;
      deleted: number;
      total: number;
    }>;

    return stats || { active: 0, deleted: 0, total: 0 };
  }
};
