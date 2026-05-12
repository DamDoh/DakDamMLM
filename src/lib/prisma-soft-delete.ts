/**
 * CRITICAL FIX #6: Soft Delete Middleware for Prisma
 * 
 * Automatically filters out deleted records from all queries
 * Ensures "deleted" users don't appear in results
 * 
 * Updated for Prisma v6: Uses $extends instead of $use middleware
 */

import { Prisma } from '@prisma/client';

/**
 * Helper function to add deleted filter to where clause
 */
function addDeletedFilter(where: any): any {
  if (!where) {
    return { deleted: false };
  }
  if (where.deleted === undefined) {
    return { ...where, deleted: false };
  }
  return where;
}

/**
 * Prisma client extension for soft delete functionality
 * Compatible with Prisma v6+ using $extends API
 * 
 * Note: Delete operations are converted to updates (soft delete)
 * by intercepting the query and calling update instead
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: 'softDelete',
  query: {
    $allModels: {
      async findUnique({ model, operation, args, query }: any) {
        // Only apply to models that support soft delete (have a 'deleted' field)
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          // Convert findUnique to findFirst with deleted filter
          const result = await query({
            ...args,
            where: addDeletedFilter(args.where)
          });
          return result;
        }
        return query(args);
      },
      async findFirst({ model, operation, args, query }: any) {
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          return query({
            ...args,
            where: addDeletedFilter(args.where)
          });
        }
        return query(args);
      },
      async findMany({ model, operation, args, query }: any) {
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          return query({
            ...args,
            where: addDeletedFilter(args.where)
          });
        }
        return query(args);
      },
      async count({ model, operation, args, query }: any) {
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          return query({
            ...args,
            where: addDeletedFilter(args.where)
          });
        }
        return query(args);
      },
      async update({ model, operation, args, query }: any) {
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          // Allow updates that set deleted: true (for soft delete operations)
          // Don't filter if we're setting deleted to true
          const isSettingDeleted = args.data?.deleted === true;
          if (isSettingDeleted) {
            // Allow the update to proceed without the deleted filter
            return query(args);
          }
          // For other updates, filter out deleted records
          return query({
            ...args,
            where: addDeletedFilter(args.where)
          });
        }
        return query(args);
      },
      async updateMany({ model, operation, args, query }: any) {
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          return query({
            ...args,
            where: addDeletedFilter(args.where)
          });
        }
        return query(args);
      },
      async delete({ model, operation, args, query }: any) {
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          // Convert delete to update (soft delete)
          // Use the query function with update operation
          const result = await query({
            model,
            operation: 'update',
            args: {
              where: args.where,
              data: {
                deleted: true,
                deletedDate: new Date(),
                active: false
              }
            }
          });
          return result;
        }
        return query(args);
      },
      async deleteMany({ model, operation, args, query }: any) {
        const softDeleteModels = ['user']; // Only User model has a deleted field
        if (softDeleteModels.includes(model.toLowerCase())) {
          // Convert deleteMany to updateMany (soft delete)
          const result = await query({
            model,
            operation: 'updateMany',
            args: {
              where: addDeletedFilter(args.where || {}),
              data: {
                deleted: true,
                deletedDate: new Date(),
                active: false
              }
            }
          });
          return result;
        }
        return query(args);
      }
    }
  }
});

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
    `);

    const typedStats = stats as { active: number; deleted: number; total: number } | undefined;
    return typedStats || { active: 0, deleted: 0, total: 0 };
  }
};
