import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { ApiResponseUtil } from '@/lib/api-response';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { StockistLevel, stockistLevelHierarchy } from '@/lib/types';

/**
 * Helper: Find the next available position in the binary tree (BFS approach)
 * Returns the parent user ID and position (left/right) where the new user should be placed
 */
async function findNextAvailablePosition(rootUserId: string, visited = new Set<string>()): Promise<{
  parentId: string;
  position: 'left' | 'right';
} | null> {
  // Use BFS to find the first available position
  const queue: string[] = [rootUserId];
  
  while (queue.length > 0) {
    const currentUserId = queue.shift()!;
    
    // Prevent circular references
    if (visited.has(currentUserId)) continue;
    visited.add(currentUserId);
    
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, children: true }
    });
    
    if (!user) continue;
    
    const children = user.children as any || { left: null, right: null };
    
    // Check if left is available
    if (!children.left) {
      return { parentId: user.id, position: 'left' };
    }
    
    // Check if right is available
    if (!children.right) {
      return { parentId: user.id, position: 'right' };
    }
    
    // Both slots taken, add children to queue for next level search
    if (children.left && !visited.has(children.left)) queue.push(children.left);
    if (children.right && !visited.has(children.right)) queue.push(children.right);
  }
  
  return null; // Should never happen in practice
}

/**
 * POST /api/binary-stock/assign-level
 * Assign a stockist level to a user in binary stock tree
 * 
 * Rules:
 * 1. Admin can assign any level to any user
 * 2. Stockist (D/C/M/S) can assign LOWER levels to their downline
 *    - D can assign C, M, or S
 *    - C can assign M or S
 *    - M can assign S
 *    - S cannot assign levels
 * 3. User receiving the level must be in the assigner's binary downline
 * 4. If a sponsor has no stock level but their downline gets a high level,
 *    the sponsor can optionally get a level one step below
 */
export async function POST(request: NextRequest) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    try {
      const authUser = req.user!;
      const body = await req.json();
      const { 
        targetUserId, 
        stockLevel, 
        downlineStockId, // Legacy: Which AdminStock to place this member under
        parentStockId, // New: The parent stock (member with stock level) to place under
        autoAssignSponsorLevel = false 
      } = body;

      // Use parentStockId if provided, otherwise fall back to downlineStockId
      const placementParentId = parentStockId || downlineStockId;

      // Validate inputs
      if (!targetUserId || !stockLevel) {
        return ApiResponseUtil.error('targetUserId and stockLevel are required');
      }

      const validLevels: StockistLevel[] = ['S', 'M', 'C', 'D'];
      if (!validLevels.includes(stockLevel)) {
        return ApiResponseUtil.error('Invalid stock level. Must be S, M, C, or D');
      }

      // Get the assigner's info
      const assigner = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          fullName: true,
          memberId: true,
          storeOwnerLevel: true,
          isAdmin: true,
          companyId: true
        }
      });

      if (!assigner) {
        return ApiResponseUtil.error('Assigner not found', 404);
      }

      // Get the target user's info
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          fullName: true,
          memberId: true,
          storeOwnerLevel: true,
          sponsorId: true,
          placementParentId: true,
          companyId: true
        }
      });

      if (!targetUser) {
        return ApiResponseUtil.error('Target user not found', 404);
      }

      // Check permissions - Only admins can assign stock levels
      if (!assigner.isAdmin) {
        return ApiResponseUtil.forbidden('Only admins can assign stock levels and add stockists to network');
      }

      // Check if target already has a stockist level
      if (targetUser.storeOwnerLevel && validLevels.includes(targetUser.storeOwnerLevel as StockistLevel)) {
        const currentHierarchy = stockistLevelHierarchy[targetUser.storeOwnerLevel as StockistLevel];
        const newHierarchy = stockistLevelHierarchy[stockLevel as StockistLevel];
        
        if (newHierarchy <= currentHierarchy) {
          return ApiResponseUtil.error(
            `Target user already has stock level ${targetUser.storeOwnerLevel}. Cannot downgrade to ${stockLevel}.`
          );
        }
      }

      // Track binary stock relationships separately from genealogy
      // When "Add Stockist to Network" is used, placementParentId tracks the binary stock parent
      // When "Add/Upgrade Stock Level" is used, only storeOwnerLevel is updated (no parent relationship)
      // This is separate from genealogy tree (children field) - they don't affect each other
      let placedUnderInfo = null;
      if (placementParentId) {
        const parentStock = await prisma.user.findUnique({
          where: { id: placementParentId },
          select: {
            id: true,
            fullName: true,
            memberId: true,
            storeOwnerLevel: true
          }
        });

        if (parentStock) {
          // Update placementParentId to track binary stock relationship
          // This is used by Binary Tree Stock View to show parent-child relationships
          // It does NOT affect the genealogy tree (children field remains unchanged)
          await prisma.user.update({
            where: { id: targetUserId },
            data: { 
              placementParentId: placementParentId,
              storeOwnerLevel: stockLevel // Assign the stock level
            }
          });

          placedUnderInfo = {
            stockId: placementParentId,
            stockName: parentStock.fullName,
            stockMemberId: parentStock.memberId,
            stockLevel: parentStock.storeOwnerLevel,
            position: null,
            originalSponsorId: placementParentId,
            originalSponsorName: parentStock.fullName
          };

          logger.info('Stock level assigned and linked to parent in binary stock (genealogy tree not modified)', {
            targetUserId,
            targetUserName: targetUser.fullName,
            assignedLevel: stockLevel,
            parentStockId: placementParentId,
            parentStockName: parentStock.fullName,
            parentStockLevel: parentStock.storeOwnerLevel
          }, req);
        }
      } else {
        // If no placementParentId, just assign the stock level (for "Add/Upgrade Stock Level" function)
        // IMPORTANT: Do NOT modify the genealogy tree (children field) - binary stock and genealogy are separate
        await prisma.user.update({
          where: { id: targetUserId },
          data: { storeOwnerLevel: stockLevel }
        });

        logger.info('Stock level assigned without parent relationship (genealogy tree not modified)', {
          targetUserId,
          targetUserName: targetUser.fullName,
          assignedLevel: stockLevel
        }, req);
      }

      logger.info('Stock level assigned successfully', {
        assignerId: authUser.id,
        assignerLevel: assigner.storeOwnerLevel,
        targetUserId: targetUserId,
        targetUserName: targetUser.fullName,
        newLevel: stockLevel,
        previousLevel: targetUser.storeOwnerLevel,
        placedUnder: placedUnderInfo
      }, req);

      // Optional: Auto-assign sponsor level if they have no level
      let sponsorLevelAssigned = null;
      if (autoAssignSponsorLevel) {
        // Find the sponsor/placement parent who has no stockist level
        const sponsorId = targetUser.placementParentId || targetUser.sponsorId;
        
        if (sponsorId && sponsorId !== authUser.id) {
          const sponsor = await prisma.user.findUnique({
            where: { id: sponsorId },
            select: {
              id: true,
              fullName: true,
              memberId: true,
              storeOwnerLevel: true
            }
          });

          if (sponsor && (!sponsor.storeOwnerLevel || !validLevels.includes(sponsor.storeOwnerLevel as StockistLevel))) {
            // Calculate one level below the assigned level
            const targetHierarchy = stockistLevelHierarchy[stockLevel as StockistLevel];
            let sponsorLevel: StockistLevel | null = null;

            // Assign one level below
            if (targetHierarchy > 1) {
              // Find the level that is one step below
              for (const [level, hierarchy] of Object.entries(stockistLevelHierarchy)) {
                if (hierarchy === targetHierarchy - 1) {
                  sponsorLevel = level as StockistLevel;
                  break;
                }
              }
            }

            if (sponsorLevel) {
              await prisma.user.update({
                where: { id: sponsorId },
                data: { storeOwnerLevel: sponsorLevel }
              });

              sponsorLevelAssigned = {
                sponsorId: sponsor.id,
                sponsorName: sponsor.fullName,
                sponsorMemberId: sponsor.memberId,
                assignedLevel: sponsorLevel
              };

              logger.info('Auto-assigned sponsor level', {
                sponsorId: sponsor.id,
                sponsorName: sponsor.fullName,
                newLevel: sponsorLevel,
                basedOnDownlineLevel: stockLevel
              }, req);
            }
          }
        }
      }

      return ApiResponseUtil.success({
        targetUserId,
        targetUserName: targetUser.fullName,
        targetMemberId: targetUser.memberId,
        assignedLevel: stockLevel,
        previousLevel: targetUser.storeOwnerLevel,
        placedUnder: placedUnderInfo,
        sponsorLevelAssigned
      }, `Successfully assigned stock level ${stockLevel} to ${targetUser.fullName}${placedUnderInfo ? ` under ${placedUnderInfo.stockName} (${placedUnderInfo.stockLevel})` : ''}`);

    } catch (error) {
      console.error('❌ Assign stock level error:', error);
      logger.error('Assign stock level failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, req);
      return ApiResponseUtil.error('Failed to assign stock level');
    }
  })(request);
}

/**
 * GET /api/binary-stock/assign-level
 * Get available stock levels that can be assigned by the current user
 */
export async function GET(request: NextRequest) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    try {
      const authUser = req.user!;

      // Get the current user's info
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          storeOwnerLevel: true,
          isAdmin: true
        }
      });

      if (!user) {
        return ApiResponseUtil.error('User not found', 404);
      }

      const validLevels: StockistLevel[] = ['S', 'M', 'C', 'D'];
      let availableLevels: StockistLevel[] = [];

      if (user.isAdmin) {
        // Admin can assign all levels
        availableLevels = validLevels;
      } else {
        // Non-admins cannot assign stock levels
        availableLevels = [];
      }

      return ApiResponseUtil.success({
        currentLevel: user.storeOwnerLevel,
        isAdmin: user.isAdmin,
        availableLevels,
        levelHierarchy: stockistLevelHierarchy
      });

    } catch (error) {
      console.error('❌ Get available levels error:', error);
      return ApiResponseUtil.error('Failed to get available levels');
    }
  })(request);
}
