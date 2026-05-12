import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { ApiResponseUtil } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { canTransferStock, type StockistLevel } from '@/lib/types';

/**
 * Helper: Check if a user is in another user's binary stock network via placementParentId
 * @param rootId - The root user ID
 * @param targetId - The target user ID to check
 * @param visited - Set to track visited nodes and prevent circular references
 * @returns true if targetId is in rootId's binary stock network
 */
async function isUserInBinaryStockNetwork(rootId: string, targetId: string, visited = new Set<string>()): Promise<boolean> {
  if (rootId === targetId) {
    return true;
  }

  if (visited.has(rootId)) {
    return false;
  }
  visited.add(rootId);

  // Get all direct downlines via placementParentId
  const downlines = await prisma.user.findMany({
    where: {
      placementParentId: rootId,
      storeOwnerLevel: { in: ['S', 'M', 'C', 'D'] },
      deleted: false
    },
    select: { id: true }
  });

  for (const downline of downlines) {
    if (downline.id === targetId) {
      return true;
    }
    if (await isUserInBinaryStockNetwork(downline.id, targetId, visited)) {
      return true;
    }
  }

  return false;
}

/**
 * Helper: Check if a user is in another user's downline (recursive check)
 * @param ancestorId - The user who should be an ancestor
 * @param descendantId - The user who should be a descendant
 * @param visited - Set to track visited nodes and prevent circular references
 * @returns true if descendantId is in ancestorId's downline
 */
async function isUserInDownline(ancestorId: string, descendantId: string, visited = new Set<string>()): Promise<boolean> {
  // If checking same user, return true
  if (ancestorId === descendantId) {
    return true;
  }

  // Prevent circular references
  if (visited.has(ancestorId)) {
    return false;
  }
  visited.add(ancestorId);

  // Get the ancestor's children
  const ancestor = await prisma.user.findUnique({
    where: { id: ancestorId },
    select: { children: true }
  });

  if (!ancestor || !ancestor.children) {
    return false;
  }

  const children = ancestor.children as any;
  
  // Check if descendant is a direct child
  if (children.left === descendantId || children.right === descendantId) {
    return true;
  }

  // Recursively check left and right subtrees
  if (children.left && !visited.has(children.left)) {
    const isInLeft = await isUserInDownline(children.left, descendantId, visited);
    if (isInLeft) return true;
  }

  if (children.right && !visited.has(children.right)) {
    const isInRight = await isUserInDownline(children.right, descendantId, visited);
    if (isInRight) return true;
  }

  return false;
}

/**
 * GET /api/binary-stock
 * Get binary tree with stock levels
 * Shows stock distribution across binary tree
 */
export async function GET(request: NextRequest) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    try {
      const authUser = req.user!;
      
      // Rate limiting - optimized for 100M+ users scale
      const rateLimitResult = await rateLimit(req, { 
        windowMs: 60 * 1000, 
        maxRequests: 100000 // 100000 requests per minute (optimized for 100M users)
      });
      if (!rateLimitResult.success) {
        return rateLimitResult.response!;
      }

      const { searchParams } = new URL(req.url);
      const userId = searchParams.get('userId') || authUser.id;
      // For admins, use deeper depth to see more of the tree structure
      const defaultDepth = authUser.isAdmin ? '5' : '3';
      const depth = parseInt(searchParams.get('depth') || defaultDepth);

      // Get authenticated user's storeOwnerLevel from database
      const authUserData = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { storeOwnerLevel: true, isAdmin: true }
      });

      // Get user with binary tree structure
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          memberId: true,
          children: true,
          storeOwnerLevel: true,
          isAdmin: true
        }
      });

      if (!user) {
        return ApiResponseUtil.error('User not found', 404);
      }

      // Check permissions - user can only view their own tree unless admin
      // Also allow AdminStock users (those with storeOwnerLevel) to view their own tree and their downline
      const isAdminStock = !!user.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(user.storeOwnerLevel);
      const isAuthUserAdminStock = !!authUserData?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(authUserData.storeOwnerLevel);
      
      if (userId !== authUser.id && !authUser.isAdmin && !isAuthUserAdminStock) {
        return ApiResponseUtil.forbidden('You can only view your own binary tree');
      }
      
      // AdminStock users can view their own tree and their downline members' trees
      if (isAuthUserAdminStock && userId !== authUser.id) {
        // Check if the requested user has the authenticated user as their placementParentId (binary stock relationship)
        // This is the primary check for binary stock relationships
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { placementParentId: true, storeOwnerLevel: true }
        });
        const isBinaryStockDownline = targetUser?.placementParentId === authUser.id;
        
        // Also check if the requested user is in the authenticated user's downline (genealogy)
        // This allows viewing genealogy downlines as well
        const isInDownline = await isUserInDownline(authUser.id, userId);
        
        // Additionally, check if the requested user is a stockist in the authenticated user's binary stock network
        // by checking if they're in the recursive downline via placementParentId chain
        let isInBinaryStockNetwork = false;
        if (!isBinaryStockDownline && !isInDownline && targetUser?.storeOwnerLevel) {
          // Check if there's a chain: authUser -> ... -> targetUser via placementParentId
          let currentId: string | null = targetUser.placementParentId || null;
          const visited = new Set<string>();
          while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            if (currentId === authUser.id) {
              isInBinaryStockNetwork = true;
              break;
            }
            const parent = await prisma.user.findUnique({
              where: { id: currentId },
              select: { placementParentId: true }
            });
            currentId = parent?.placementParentId || null;
          }
        }
        
        // Special case: For shallow requests (depth=1), also check if the user is in the authenticated user's binary stock network
        // This is needed for the loadStockistsByLevel function which fetches stock for each stockist
        const isShallowRequest = depth <= 1;
        if (!isInDownline && !isBinaryStockDownline && !isInBinaryStockNetwork) {
          if (isShallowRequest && targetUser?.storeOwnerLevel) {
            // Check if the target user is in the authenticated user's binary stock network
            const isInNetwork = await isUserInBinaryStockNetwork(authUser.id, userId);
            if (!isInNetwork) {
              return ApiResponseUtil.forbidden('AdminStock users can only view their own binary tree and their downline members');
            }
          } else {
            return ApiResponseUtil.forbidden('AdminStock users can only view their own binary tree and their downline members');
          }
        }
      }

      // Get stock inventory for this user
      const stockInventory = await getStockInventory(userId);

      // Build binary tree with stock levels
      // For AdminStock users, filter to show only AdminStock members
      // For admins, show ALL stockists regardless of genealogy tree structure
      const filterAdminStockOnly = authUser.isAdmin ? false : (isAuthUserAdminStock || isAdminStock);
      
      let binaryTree;
      if (authUser.isAdmin) {
        // For admins: When viewing a specific user's tree (not the root), use placementParentId-based tree
        // to show only that user's downline. When viewing root (userId === authUser.id or no userId),
        // show all stockists.
        const isViewingSpecificUser = userId && userId !== authUser.id;
        if (isViewingSpecificUser) {
          // Viewing a specific user's tree - show only their downline
          binaryTree = await buildBinaryStockTreeFromPlacementParent(userId, depth);
        } else {
          // Viewing root - show ALL stockists from the database
          binaryTree = await buildAllStockistsTree(userId, depth);
        }
      } else {
        // For AdminStock users: Build tree based on placementParentId (binary stock relationship)
        // This ensures the current user (AdminStock) is always at the root
        binaryTree = await buildBinaryStockTreeFromPlacementParent(userId, depth);
      }

      // Calculate stock distribution by leg (only AdminStock members if filter is enabled)
      // For admins, include all users in stock distribution
      const stockDistribution = await calculateStockDistribution(userId, filterAdminStockOnly);

      // Get upline stockists (ancestors with stock levels S/M/C/D) for additional context
      const uplineStockists = await getUplineStockists(userId);

      logger.info('Binary stock tree retrieved', {
        userId: authUser.id,
        targetUserId: userId,
        depth,
        totalStock: stockInventory.totalStock
      }, req);

      return ApiResponseUtil.success({
        user: {
          id: user.id,
          fullName: user.fullName,
          memberId: user.memberId,
          storeOwnerLevel: user.storeOwnerLevel,
          stockInventory
        },
        binaryTree,
        stockDistribution,
        uplineStockists
      });

    } catch (error) {
      logger.error('Failed to get binary stock tree', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, req);
      return ApiResponseUtil.error('Failed to get binary stock tree');
    }
  })(request);
}

/**
 * POST /api/binary-stock/transfer
 * Transfer stock through binary tree
 * Admin or stockist can transfer to their downline
 */
export async function POST(request: NextRequest) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    try {
      const authUser = req.user!;

      const body = await req.json();
      const { toUserId, items, leg } = body;

      // Validate inputs
      if (!toUserId || !items || !Array.isArray(items) || items.length === 0) {
        return ApiResponseUtil.error('Invalid request. toUserId and items are required');
      }

      // Get sender and recipient
      const sender = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          fullName: true,
          memberId: true,
          children: true,
          storeOwnerLevel: true,
          isAdmin: true,
          companyId: true
        }
      });

      const recipient = await prisma.user.findUnique({
        where: { id: toUserId },
        select: {
          id: true,
          fullName: true,
          memberId: true,
          companyId: true
        }
      });

      if (!sender || !recipient) {
        return ApiResponseUtil.error('User not found', 404);
      }

      // Verify binary relationship
      const children = sender.children as any;
      const isLeftChild = children?.left === toUserId;
      const isRightChild = children?.right === toUserId;
      const isDirectDownline = isLeftChild || isRightChild;

      // Check permissions
      console.log('🔐 Permission Check:', {
        senderIsAdmin: sender.isAdmin,
        senderStoreOwnerLevel: sender.storeOwnerLevel,
        senderId: sender.id,
        senderName: sender.fullName,
        recipientId: toUserId,
        recipientName: recipient.fullName
      });

      if (!sender.isAdmin && !sender.storeOwnerLevel) {
        console.log('❌ Permission denied: Not admin and no storeOwnerLevel');
        return ApiResponseUtil.forbidden('Only admins and stockists can transfer stock');
      }

      // Binary Stock Page: Allow transfers to ANY member (not restricted to downline)
      // This is different from My Stock page which is restricted to downline only
      console.log('✅ Binary Stock transfer: Downline check skipped (can transfer to any member)');
      
      // Note: We skip the downline check for binary stock transfers
      // Stockists can transfer to any member they can see in the binary stock tree
      // This allows more flexibility in the binary stock distribution system

      // Check stockist level restrictions: higher level can transfer to lower level
      if (!sender.isAdmin && sender.storeOwnerLevel) {
        const recipientWithLevel = await prisma.user.findUnique({
          where: { id: toUserId },
          select: {
            storeOwnerLevel: true,
            fullName: true
          }
        });

        console.log('📊 Stockist level check:', {
          senderLevel: sender.storeOwnerLevel,
          recipientLevel: recipientWithLevel?.storeOwnerLevel
        });

        if (recipientWithLevel) {
          const senderLevel = sender.storeOwnerLevel as StockistLevel | null;
          const recipientLevel = recipientWithLevel.storeOwnerLevel as StockistLevel | null;

          if (!canTransferStock(senderLevel, recipientLevel)) {
            const senderLevelName = senderLevel ? `(${senderLevel})` : '';
            const recipientLevelName = recipientLevel ? `(${recipientLevel})` : '';
            
            console.log('❌ Permission denied: Cannot transfer between these stockist levels');
            logger.warn('Stock transfer denied - stockist level restriction', {
              senderId: sender.id,
              senderName: sender.fullName,
              senderLevel,
              recipientId: toUserId,
              recipientName: recipientWithLevel.fullName,
              recipientLevel
            }, req);
            
            return ApiResponseUtil.forbidden(
              `Cannot transfer stock. Stockist level ${senderLevelName} cannot transfer to stockist level ${recipientLevelName}. Only higher level stockists can transfer to lower level stockists.`
            );
          }
        }
        console.log('✅ Stockist level check passed');
      }

      // Log the transfer request
      console.log('🚀 Binary Stock Transfer Request Received:', {
        from: authUser.id,
        fromName: sender.fullName,
        to: toUserId,
        toName: recipient.fullName,
        items: items.map((i: any) => ({ name: i.productName, qty: i.quantity })),
        isAdmin: sender.isAdmin
      });

      // Use inventory service to transfer stock
      // Binary Stock Page: PV goes to rank (Top-Up) so handlePVChange runs for Matching Bonus
      // CRITICAL: pvDestination='rank' ensures PV updates user.pv and triggers Daily Match + Matching Bonus
      const { transferStock } = await import('@/services/inventory-service');
      
      console.log('📞 Calling transferStock function...');
      
      const result = await (transferStock as any)(
        authUser.id,
        toUserId,
        items,
        sender.companyId || undefined,
        'differential', // Binary Stock Page: Use differential commission rates
        'rank'          // PV → user.pv (Top-Up) so Matching Bonus triggers for any downline (A, B, C, D...)
      );

      console.log('✅ transferStock result:', result);

      if (!result.success) {
        console.error('❌ Transfer failed:', result.message);
        return ApiResponseUtil.error(result.message || 'Stock transfer failed');
      }

      // Log binary stock transfer
      logger.info('Binary stock transfer completed', {
        senderId: authUser.id,
        recipientId: toUserId,
        leg: isLeftChild ? 'left' : isRightChild ? 'right' : 'indirect',
        itemCount: items.length,
        transferId: result.transferId
      }, req);

      return ApiResponseUtil.success({
        transferId: result.transferId,
        message: `Successfully transferred stock to ${recipient.fullName} (${isLeftChild ? 'Left' : isRightChild ? 'Right' : 'Indirect'} leg)`,
        leg: isLeftChild ? 'left' : isRightChild ? 'right' : 'indirect'
      }, 'Stock transferred successfully');

    } catch (error) {
      logger.error('Binary stock transfer failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, req);
      return ApiResponseUtil.error('Failed to transfer stock');
    }
  })(request);
}

/**
 * Helper: Get stock inventory for a user from StockItems
 * For admin users, get from StockItems table
 * For regular users, this would need to track received stock (future implementation)
 */
async function getStockInventory(userId: string) {
  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, companyId: true }
  });

  if (!user) {
    return {
      items: [],
      totalStock: 0,
      productCount: 0
    };
  }

  // For admin users, get stock from StockItems table
  if (user.isAdmin) {
    const stockItems = await prisma.stockItem.findMany({
      where: {
        companyId: user.companyId || undefined,
        quantity: {
          gt: 0
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        quantity: true
      }
    });

    const items = stockItems.map(item => ({
      productId: item.id,
      productName: item.name,
      sku: item.code || item.id.substring(0, 8),
      quantity: item.quantity
    }));

    const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      totalStock,
      productCount: items.length
    };
  }

  // For non-admin users, get stock from inventory transactions
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

  const inventory: Record<string, {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
  }> = {};

  for (const tx of transactions) {
    const productId = tx.productId;
    if (!inventory[productId]) {
      // Try to get product name from StockItem
      const stockItem = await prisma.stockItem.findUnique({
        where: { id: productId },
        select: { name: true, code: true }
      });
      
      inventory[productId] = {
        productId,
        productName: stockItem?.name || 'Unknown Product',
        sku: stockItem?.code || productId.substring(0, 8),
        quantity: 0
      };
    }

    const qty = Number(tx.quantity) || 0;
    if (tx.type === 'purchase' || tx.type === 'transfer' || tx.type === 'return') {
      inventory[productId].quantity += qty;
    } else if (tx.type === 'sale' || tx.type === 'adjustment') {
      inventory[productId].quantity -= qty;
    }
  }

  const items = Object.values(inventory).filter(item => item.quantity > 0);
  const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    totalStock,
    productCount: items.length
  };
}

/**
 * Helper: Get upline stockists (ancestors with stock levels S/M/C/D)
 * This is used so AdminStock users can also see stockists in their upline chain
 * in the Binary Tree Stock View, without modifying the genealogy tree.
 */
async function getUplineStockists(userId: string) {
  const uplineStockists: Array<{
    id: string;
    fullName: string;
    memberId: string;
    storeOwnerLevel: string | null;
    rank: string | null;
    stockLevel: number;
    productCount: number;
  }> = [];

  const visited = new Set<string>();
  let currentId: string | null | undefined = userId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const user: { placementParentId: string | null; sponsorId: string | null } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: {
        placementParentId: true,
        sponsorId: true
      }
    });

    if (!user) break;

    const nextId: string | null = user.placementParentId || user.sponsorId;
    if (!nextId || visited.has(nextId)) break;

    const upline: { id: string; fullName: string; memberId: string; storeOwnerLevel: string | null; rank: string | null } | null = await prisma.user.findUnique({
      where: { id: nextId },
      select: {
        id: true,
        fullName: true,
        memberId: true,
        storeOwnerLevel: true,
        rank: true
      }
    });

    if (!upline) {
      // Mark nextId as visited to prevent infinite loops
      visited.add(nextId);
      currentId = nextId;
      continue;
    }

    // Only include users who have a valid stockist level
    if (upline.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(upline.storeOwnerLevel)) {
      const inventory = await getStockInventory(upline.id);
      uplineStockists.push({
        id: upline.id,
        fullName: upline.fullName,
        memberId: upline.memberId,
        storeOwnerLevel: upline.storeOwnerLevel,
        rank: upline.rank,
        stockLevel: inventory.totalStock,
        productCount: inventory.productCount
      });
    }

    currentId = nextId;
  }

  return uplineStockists;
}

/**
 * Helper: Collect all user IDs in the tree up to maxDepth (BFS approach)
 */
async function collectTreeUserIds(rootUserId: string, maxDepth: number): Promise<string[]> {
  const userIds: string[] = [];
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: rootUserId, depth: 0 }];
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    
    if (visited.has(id) || depth >= maxDepth) continue;
    visited.add(id);
    userIds.push(id);
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: { children: true }
    });
    
    if (user?.children) {
      const children = user.children as any;
      if (children.left && !visited.has(children.left)) {
        queue.push({ id: children.left, depth: depth + 1 });
      }
      if (children.right && !visited.has(children.right)) {
        queue.push({ id: children.right, depth: depth + 1 });
      }
    }
  }
  
  return userIds;
}

/**
 * Helper: Build tree from ALL stockists in the database (for admin view)
 * This ensures all stockists appear regardless of genealogy tree structure
 */
async function buildAllStockistsTree(rootUserId: string, maxDepth: number): Promise<any> {
  // Fetch ALL users with stock levels (excluding ADMIN001)
  const allStockists = await prisma.user.findMany({
    where: {
      storeOwnerLevel: { in: ['S', 'M', 'C', 'D'] },
      memberId: { not: 'ADMIN001' },
      deleted: false
    },
    select: {
      id: true,
      fullName: true,
      memberId: true,
      storeOwnerLevel: true,
      rank: true,
      placementParentId: true,
      children: true
    }
  });

  if (allStockists.length === 0) {
    // Return root user as placeholder
    const rootUser = await prisma.user.findUnique({
      where: { id: rootUserId },
      select: {
        id: true,
        fullName: true,
        memberId: true,
        storeOwnerLevel: true,
        rank: true
      }
    });
    
    if (!rootUser) return null;
    
    const stockInventory = await getStockInventory(rootUserId);
    return {
      id: rootUser.id,
      fullName: rootUser.fullName,
      memberId: rootUser.memberId,
      storeOwnerLevel: rootUser.storeOwnerLevel,
      rank: rootUser.rank,
      stockLevel: stockInventory.totalStock,
      productCount: stockInventory.productCount,
      left: null,
      right: null
    };
  }

  // Create a map of stockists by ID
  const stockistsMap = new Map(allStockists.map(s => [s.id, s]));
  
  // Build inventory for all stockists
  const stockistsWithInventory = await Promise.all(
    allStockists.map(async (stockist) => {
      const inventory = await getStockInventory(stockist.id);
      return {
        ...stockist,
        stockLevel: inventory.totalStock,
        productCount: inventory.productCount
      };
    })
  );

  // Sort by stock level priority (D > C > M > S), then by stock quantity
  const levelPriority: { [key: string]: number } = { 'D': 4, 'C': 3, 'M': 2, 'S': 1 };
  stockistsWithInventory.sort((a, b) => {
    const priorityA = levelPriority[a.storeOwnerLevel || ''] || 0;
    const priorityB = levelPriority[b.storeOwnerLevel || ''] || 0;
    if (priorityB !== priorityA) {
      return priorityB - priorityA; // Higher priority first
    }
    return b.stockLevel - a.stockLevel; // Higher stock first
  });

  // Build tree structure based on stock level hierarchy (D > C > M > S)
  // Group stockists by level and build hierarchical tree
  const byLevel = {
    D: stockistsWithInventory.filter(s => s.storeOwnerLevel === 'D'),
    C: stockistsWithInventory.filter(s => s.storeOwnerLevel === 'C'),
    M: stockistsWithInventory.filter(s => s.storeOwnerLevel === 'M'),
    S: stockistsWithInventory.filter(s => s.storeOwnerLevel === 'S')
  };

  // Build tree: D at root, C as children of D, M as children of C, S as children of M
  const buildHierarchicalTree = (level: 'D' | 'C' | 'M' | 'S', index: number, usedIndices: Map<string, Set<number>>): any => {
    const stockists = byLevel[level];
    if (index >= stockists.length) {
      // Try next lower level
      if (level === 'D' && byLevel.C.length > 0) return buildHierarchicalTree('C', 0, usedIndices);
      if (level === 'C' && byLevel.M.length > 0) return buildHierarchicalTree('M', 0, usedIndices);
      if (level === 'M' && byLevel.S.length > 0) return buildHierarchicalTree('S', 0, usedIndices);
      return null;
    }

    const stockist = stockists[index];
    const levelUsed = usedIndices.get(level) || new Set<number>();
    levelUsed.add(index);
    usedIndices.set(level, levelUsed);

    // Determine child level
    let childLevel: 'C' | 'M' | 'S' | null = null;
    if (level === 'D') childLevel = 'C';
    else if (level === 'C') childLevel = 'M';
    else if (level === 'M') childLevel = 'S';

    // Find unused children from next lower level
    let leftChild = null;
    let rightChild = null;
    
    if (childLevel) {
      const childStockists = byLevel[childLevel];
      const childUsed = usedIndices.get(childLevel) || new Set<number>();
      for (let i = 0; i < childStockists.length && (!leftChild || !rightChild); i++) {
        if (!childUsed.has(i)) {
          const child = buildHierarchicalTree(childLevel, i, usedIndices);
          if (child) {
            if (!leftChild) leftChild = child;
            else if (!rightChild) rightChild = child;
          }
        }
      }
    }

    return {
      id: stockist.id,
      fullName: stockist.fullName,
      memberId: stockist.memberId,
      storeOwnerLevel: stockist.storeOwnerLevel,
      rank: stockist.rank,
      stockLevel: stockist.stockLevel,
      productCount: stockist.productCount,
      left: leftChild,
      right: rightChild
    };
  };

  // Start from D level
  const usedIndices = new Map<string, Set<number>>();
  usedIndices.set('D', new Set<number>());
  usedIndices.set('C', new Set<number>());
  usedIndices.set('M', new Set<number>());
  usedIndices.set('S', new Set<number>());

  if (byLevel.D.length > 0) {
    return buildHierarchicalTree('D', 0, usedIndices);
  } else if (byLevel.C.length > 0) {
    return buildHierarchicalTree('C', 0, usedIndices);
  } else if (byLevel.M.length > 0) {
    return buildHierarchicalTree('M', 0, usedIndices);
  } else if (byLevel.S.length > 0) {
    return buildHierarchicalTree('S', 0, usedIndices);
  }

  return null;
}

/**
 * Helper: Build binary tree with stock levels (optimized with batch loading)
 * @param filterAdminStockOnly - If true, only show AdminStock members (those with storeOwnerLevel)
 */
async function buildBinaryTreeWithStock(userId: string, maxDepth: number, currentDepth = 0, filterAdminStockOnly = false, usersMap?: Map<string, any>, visited = new Set<string>()): Promise<any> {
  if (currentDepth >= maxDepth) {
    return null;
  }

  // Prevent circular references
  if (visited.has(userId)) {
    return null;
  }
  visited.add(userId);

  // If no usersMap provided, this is the root call - batch load all users first
  if (!usersMap) {
    const userIds = await collectTreeUserIds(userId, maxDepth);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        memberId: true,
        children: true,
        storeOwnerLevel: true,
        rank: true,
        isAdmin: true,
        companyId: true
      }
    });
    
    usersMap = new Map(users.map(u => [u.id, u]));
  }

  const user = usersMap.get(userId);
  if (!user) {
    return null;
  }

  const stockInventory = await getStockInventory(userId);
  const children = user.children as any;

  // Check if this user has stock
  const hasStock = stockInventory.totalStock > 0;
  
  // For admins (when filterAdminStockOnly is false), show ALL users who have stock OR have downlines with stock
  // For AdminStock users (when filterAdminStockOnly is true), only show users with stock levels
  const isStockist = user.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(user.storeOwnerLevel);

  // If filtering for AdminStock only, skip nodes without storeOwnerLevel (except root)
  // But still traverse their children to find stockists deeper in the tree
  if (filterAdminStockOnly && currentDepth > 0 && !isStockist) {
    // This node doesn't have a stock level, but we still need to traverse children
    // to find stockists that might be deeper in the tree
    let leftChild = null;
    let rightChild = null;
    
    if (children?.left && !visited.has(children.left)) {
      leftChild = await buildBinaryTreeWithStock(children.left, maxDepth, currentDepth + 1, filterAdminStockOnly, usersMap, visited);
    }
    
    if (children?.right && !visited.has(children.right)) {
      rightChild = await buildBinaryTreeWithStock(children.right, maxDepth, currentDepth + 1, filterAdminStockOnly, usersMap, visited);
    }
    
    // If we found stockists in children, return a node structure (even though this node itself isn't a stockist)
    // Otherwise return null to skip this branch entirely
    if (leftChild || rightChild) {
      return {
        id: user.id,
        fullName: user.fullName,
        memberId: user.memberId,
        storeOwnerLevel: null, // Not a stockist
        rank: user.rank,
        stockLevel: 0,
        productCount: 0,
        left: leftChild,
        right: rightChild
      };
    }
    
    return null;
  }

  // For admins: Always build children first to check if they have stock
  // This ensures we show users who have downlines with stock, even if they don't have stock themselves
  let leftChild = null;
  let rightChild = null;
  
  if (children?.left && !visited.has(children.left)) {
    leftChild = await buildBinaryTreeWithStock(children.left, maxDepth, currentDepth + 1, filterAdminStockOnly, usersMap, visited);
  }

  if (children?.right && !visited.has(children.right)) {
    rightChild = await buildBinaryTreeWithStock(children.right, maxDepth, currentDepth + 1, filterAdminStockOnly, usersMap, visited);
  }

  // For admins: Include node if it has stock, is a stockist, OR has children with stock
  // This ensures the hierarchical flow is visible (e.g., D with downlines S, M, C)
  if (!filterAdminStockOnly && currentDepth > 0) {
    const hasChildrenWithStock = (leftChild && (leftChild.stockLevel > 0 || leftChild.left || leftChild.right)) ||
                                 (rightChild && (rightChild.stockLevel > 0 || rightChild.left || rightChild.right));
    
    if (!hasStock && !isStockist && !hasChildrenWithStock) {
      // This node has no stock, is not a stockist, and has no children with stock - skip it
      return null;
    }
  }

  // This node should be included in the tree
  const node = {
    id: user.id,
    fullName: user.fullName,
    memberId: user.memberId,
    storeOwnerLevel: user.storeOwnerLevel,
    rank: user.rank,
    stockLevel: stockInventory.totalStock,
    productCount: stockInventory.productCount,
    left: leftChild,
    right: rightChild
  };

  return node;
}

/**
 * Helper: Build binary stock tree for AdminStock users based on placementParentId
 * This ensures the current user (AdminStock) is always at the root
 */
async function buildBinaryStockTreeFromPlacementParent(rootUserId: string, maxDepth: number): Promise<any> {
  // Get the root user
  const rootUser = await prisma.user.findUnique({
    where: { id: rootUserId },
    select: {
      id: true,
      fullName: true,
      memberId: true,
      storeOwnerLevel: true,
      rank: true
    }
  });

  if (!rootUser) {
    return null;
  }

  const rootInventory = await getStockInventory(rootUserId);

  // Build the root node
  const rootNode: any = {
    id: rootUser.id,
    fullName: rootUser.fullName,
    memberId: rootUser.memberId,
    storeOwnerLevel: rootUser.storeOwnerLevel,
    rank: rootUser.rank,
    stockLevel: rootInventory.totalStock,
    productCount: rootInventory.productCount,
    left: null,
    right: null
  };

  // Recursively build children based on placementParentId
  const buildChildren = async (parentId: string, currentDepth: number): Promise<{ left: any; right: any }> => {
    if (currentDepth >= maxDepth) {
      return { left: null, right: null };
    }

    // Find all stockists who have this parent as their placementParentId
    const downlines = await prisma.user.findMany({
      where: {
        placementParentId: parentId,
        storeOwnerLevel: { in: ['S', 'M', 'C', 'D'] },
        deleted: false
      },
      select: {
        id: true,
        fullName: true,
        memberId: true,
        storeOwnerLevel: true,
        rank: true,
        children: true // Use children to determine left/right position
      }
    });

    // Separate into left and right based on genealogy children relationship
    // Check which downlines are in the parent's left or right children
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: { children: true }
    });
    
    const parentChildren = parent?.children as any;
    const leftChildId = parentChildren?.left;
    const rightChildId = parentChildren?.right;
    
    const leftChild = downlines.find(d => d.id === leftChildId);
    const rightChild = downlines.find(d => d.id === rightChildId);

    // If no placementPosition, assign based on order (first = left, second = right)
    let leftNode = null;
    let rightNode = null;

    if (leftChild) {
      const leftInventory = await getStockInventory(leftChild.id);
      const leftChildren = await buildChildren(leftChild.id, currentDepth + 1);
      leftNode = {
        id: leftChild.id,
        fullName: leftChild.fullName,
        memberId: leftChild.memberId,
        storeOwnerLevel: leftChild.storeOwnerLevel,
        rank: leftChild.rank,
        stockLevel: leftInventory.totalStock,
        productCount: leftInventory.productCount,
        left: leftChildren.left,
        right: leftChildren.right
      };
    } else if (downlines.length > 0 && !rightChild) {
      // If there's only one child and no right child, assign it to left
      const firstChild = downlines[0];
      const firstInventory = await getStockInventory(firstChild.id);
      const firstChildren = await buildChildren(firstChild.id, currentDepth + 1);
      leftNode = {
        id: firstChild.id,
        fullName: firstChild.fullName,
        memberId: firstChild.memberId,
        storeOwnerLevel: firstChild.storeOwnerLevel,
        rank: firstChild.rank,
        stockLevel: firstInventory.totalStock,
        productCount: firstInventory.productCount,
        left: firstChildren.left,
        right: firstChildren.right
      };
    }

    if (rightChild) {
      const rightInventory = await getStockInventory(rightChild.id);
      const rightChildren = await buildChildren(rightChild.id, currentDepth + 1);
      rightNode = {
        id: rightChild.id,
        fullName: rightChild.fullName,
        memberId: rightChild.memberId,
        storeOwnerLevel: rightChild.storeOwnerLevel,
        rank: rightChild.rank,
        stockLevel: rightInventory.totalStock,
        productCount: rightInventory.productCount,
        left: rightChildren.left,
        right: rightChildren.right
      };
    } else if (downlines.length > 1 && !leftChild) {
      // If there are multiple children and no left child, assign second to right
      const secondChild = downlines[1];
      const secondInventory = await getStockInventory(secondChild.id);
      const secondChildren = await buildChildren(secondChild.id, currentDepth + 1);
      rightNode = {
        id: secondChild.id,
        fullName: secondChild.fullName,
        memberId: secondChild.memberId,
        storeOwnerLevel: secondChild.storeOwnerLevel,
        rank: secondChild.rank,
        stockLevel: secondInventory.totalStock,
        productCount: secondInventory.productCount,
        left: secondChildren.left,
        right: secondChildren.right
      };
    } else if (downlines.length > 1 && leftChild) {
      // If there's a left child and multiple children, assign the second one to right
      const secondChild = downlines.find(d => d.id !== leftChild.id);
      if (secondChild) {
        const secondInventory = await getStockInventory(secondChild.id);
        const secondChildren = await buildChildren(secondChild.id, currentDepth + 1);
        rightNode = {
          id: secondChild.id,
          fullName: secondChild.fullName,
          memberId: secondChild.memberId,
          storeOwnerLevel: secondChild.storeOwnerLevel,
          rank: secondChild.rank,
          stockLevel: secondInventory.totalStock,
          productCount: secondInventory.productCount,
          left: secondChildren.left,
          right: secondChildren.right
        };
      }
    }

    return { left: leftNode, right: rightNode };
  };

  // Build children for root
  const rootChildren = await buildChildren(rootUserId, 0);
  rootNode.left = rootChildren.left;
  rootNode.right = rootChildren.right;

  return rootNode;
}

/**
 * Helper: Calculate stock distribution by binary leg
 * @param filterAdminStockOnly - If true, only count AdminStock members (those with storeOwnerLevel)
 */
async function calculateStockDistribution(userId: string, filterAdminStockOnly = false) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { children: true, storeOwnerLevel: true }
  });

  if (!user) {
    return { left: 0, right: 0, total: 0, balance: 0 };
  }

  const children = user.children as any;
  
  // Track visited nodes to prevent circular references
  const visited = new Set<string>();
  
  // Helper function to recursively calculate stock for a leg
  const calculateLegStock = async (childId: string | null): Promise<number> => {
    if (!childId) return 0;
    
    // Prevent circular references
    if (visited.has(childId)) return 0;
    visited.add(childId);
    
    const child = await prisma.user.findUnique({
      where: { id: childId },
      select: {
        id: true,
        children: true,
        storeOwnerLevel: true
      }
    });
    
    if (!child) return 0;
    
    // If filtering AdminStock only, skip if not AdminStock
    if (filterAdminStockOnly && (!child.storeOwnerLevel || !['S', 'M', 'C', 'D'].includes(child.storeOwnerLevel))) {
      // Still traverse children in case there are AdminStock members deeper
      const childChildren = child.children as any;
      let total = 0;
      if (childChildren?.left && !visited.has(childChildren.left)) {
        total += await calculateLegStock(childChildren.left);
      }
      if (childChildren?.right && !visited.has(childChildren.right)) {
        total += await calculateLegStock(childChildren.right);
      }
      return total;
    }
    
    const childInventory = await getStockInventory(child.id);
    let total = childInventory.totalStock;
    
    const childChildren = child.children as any;
    if (childChildren?.left && !visited.has(childChildren.left)) {
      total += await calculateLegStock(childChildren.left);
    }
    if (childChildren?.right && !visited.has(childChildren.right)) {
      total += await calculateLegStock(childChildren.right);
    }
    
    return total;
  };

  // Calculate left leg stock
  let leftStock = 0;
  if (children?.left) {
    leftStock = await calculateLegStock(children.left);
  }

  // Calculate right leg stock
  let rightStock = 0;
  if (children?.right) {
    rightStock = await calculateLegStock(children.right);
  }

  return {
    left: leftStock,
    right: rightStock,
    total: leftStock + rightStock,
    balance: Math.abs(leftStock - rightStock)
  };
}
