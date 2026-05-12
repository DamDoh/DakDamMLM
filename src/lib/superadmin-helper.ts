import { prisma } from '@/lib/database';

/**
 * Check if a user is superadmin
 * Superadmin is identified by: isAdmin = true AND email matches SUPER_ADMIN_EMAIL
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail || superAdminEmail.trim() === '') {
      // If SUPER_ADMIN_EMAIL is not configured, check only isAdmin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true }
      });
      return user?.isAdmin === true;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, email: true }
    });

    if (!user || !user.isAdmin) {
      return false;
    }

    const userEmail = user.email?.toLowerCase().trim();
    const configuredEmail = superAdminEmail.toLowerCase().trim();

    return userEmail === configuredEmail;
  } catch (error) {
    console.error('Error checking superadmin status:', error);
    return false;
  }
}

/**
 * Check if a user can earn commissions
 * Superadmin itself cannot earn commissions, but members created by superadmin CAN
 * Also, members who have downlines CAN earn commissions
 */
export async function canEarnCommissions(userId: string): Promise<boolean> {
  try {
    // Superadmin itself cannot earn commissions
    if (await isSuperAdmin(userId)) {
      return false;
    }

    // Check if user has downlines (placementParentId children)
    // If they have downlines, they can earn commissions
    const hasDownlines = await prisma.user.count({
      where: {
        placementParentId: userId,
        deleted: false
      }
    });

    // Members with downlines can earn commissions (they're sponsors)
    return hasDownlines > 0;
  } catch (error) {
    console.error('Error checking if user can earn commissions:', error);
    return false;
  }
}

/**
 * Check if a user is superadmin (synchronous version using user object)
 */
export function isSuperAdminSync(user: { isAdmin?: boolean; email?: string }): boolean {
  try {
    if (!user.isAdmin) {
      return false;
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superAdminEmail || superAdminEmail.trim() === '') {
      // If SUPER_ADMIN_EMAIL is not configured, any admin is considered superadmin
      return user.isAdmin === true;
    }

    const userEmail = user.email?.toLowerCase().trim();
    const configuredEmail = superAdminEmail.toLowerCase().trim();

    return userEmail === configuredEmail;
  } catch (error) {
    console.error('Error checking superadmin status:', error);
    return false;
  }
}

