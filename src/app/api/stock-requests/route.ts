import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth, requireAdmin, authenticateRequest, AuthenticatedRequest, AuthenticationError } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, VALIDATION_PATTERNS, API_MESSAGES } from '@/lib/api-response';
import { createNotification } from '@/services/notification-service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for stock requests API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request - require authentication for all stock request operations
    let authenticatedRequest: AuthenticatedRequest;
    let user: any;
    
    try {
      authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
      
      if (!user) {
        return ApiResponseUtil.unauthorized();
      }
    } catch (authError: any) {
      const message = authError instanceof AuthenticationError 
        ? authError.message 
        : 'Authentication required';
      
      logger.warn('Authentication failed for stock requests fetch', {
        error: message,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      
      return ApiResponseUtil.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get('status');
    const role = searchParams.get('role'); // 'requester' to show requests where user is the requester
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 records
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate query parameters using standardized patterns (case-insensitive)
    if (rawStatus) {
      const statusUpper = rawStatus.toUpperCase();
      const validStatuses = VALIDATION_PATTERNS.statuses.stockRequest.map(s => s.toUpperCase());
      
      if (!validStatuses.includes(statusUpper)) {
        return ApiResponseUtil.validationError([
          { field: 'status', message: `Invalid status. Must be one of: ${VALIDATION_PATTERNS.statuses.stockRequest.join(', ')}` }
        ]);
      }
    }

    const whereClause: any = {};
    // Use lowercase status for database query (as it's stored in lowercase in the database)
    if (rawStatus) {
      whereClause.status = rawStatus.toLowerCase();
    }

    if (user?.isAdmin) {
      // Admins should see:
      // 1. Requests from stockist members (S, M, C, D) requesting for themselves
      // 2. Requests from orders (where stockistId is an admin user)
      
      // Get all stockist members (S, M, C, D)
      const stockistMembers = await prisma.user.findMany({
        where: {
          storeOwnerLevel: { in: ['S', 'M', 'C', 'D'] },
          active: true,
          deleted: false
        },
        select: { id: true }
      });
      
      // Get all admin users (for order-based stock requests)
      const adminUsers = await prisma.user.findMany({
        where: {
          isAdmin: true,
          active: true,
          deleted: false
        },
        select: { id: true }
      });
      
      const stockistIds = stockistMembers.map(m => m.id);
      const adminIds = adminUsers.map(a => a.id);
      
      // Combine stockist IDs and admin IDs (orders are routed to admins)
      const allIds = [...new Set([...stockistIds, ...adminIds])];
      
      // Show requests where:
      // 1. stockistId is a stockist or admin (normal requests)
      // 2. OR stockistName starts with ADMIN_TRANSFER: (catalog/stock transfers by admin to any member)
      whereClause.OR = [
        ...(allIds.length > 0 ? [{ stockistId: { in: allIds } }] : []),
        { stockistName: { startsWith: 'ADMIN_TRANSFER:' } },
      ];
    } else {
      // Non-admin users: Check if user has stockist level (admin stock)
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { storeOwnerLevel: true }
      });
      
      const hasStockistLevel = userRecord?.storeOwnerLevel && 
        ['S', 'M', 'C', 'D'].includes(userRecord.storeOwnerLevel);
      
      if (hasStockistLevel) {
        // AdminStock users (S, M, C, D) should see:
        // - Requests they need to approve (stockistId = their id) - PRIMARY: shows their own transfers
        // - Requests they themselves created as requester (requesterId = their id)
        // - Transfers they received (toUserId = their id AND stockistId != their id) - only if they're NOT the stockist
        // NOTE: We exclude records where fromUserId = their id AND stockistId != their id to avoid duplicates
        //       because if stockistId = their id, they already see it as the primary record
        whereClause.OR = [
          { stockistId: user.id }, // Primary: their own records (as sender/approver)
          { 
            requesterId: user.id,
            stockistId: { not: user.id } // Only if they're not the stockist (to avoid duplicates)
          },
          { 
            toUserId: user.id,
            stockistId: { not: user.id } // Only show recipient records where they're NOT the stockist
          }
        ];
        
        logger.info('Admin stock user viewing stock requests as approver, requester, and recipient', {
          userId: user.id,
          storeOwnerLevel: userRecord.storeOwnerLevel
        }, request);
      } else {
        // Non-stockist members see:
        // - Their own requests (as requester)
        // - Transfers they received (as recipient, but not their own stockistId)
        // NOTE: We don't show fromUserId = their id for non-stockists because they don't send transfers
        whereClause.OR = [
          { requesterId: user.id },
          { 
            toUserId: user.id,
            stockistId: { not: user.id } // Only show recipient records where they're NOT the stockist
          }
        ];
      }
    }

    // Try to access StockRequest model - handle gracefully if it doesn't exist
    let stockRequests: any[] = [];
    let total = 0;

    try {
      // Check if StockRequest model is available
      const StockRequestModel = (prisma as any).stockRequest;
      
      if (!StockRequestModel) {
        logger.warn('StockRequest model not available in Prisma client', {
          userId: user?.id,
          status: rawStatus,
          attemptedOperation: 'fetch'
        }, request);
        // Return empty result - model not available
      } else {
        // Check if user is admin stock (S, M, C, D)
        const currentUserRecord = await prisma.user.findUnique({
          where: { id: user.id },
          select: { storeOwnerLevel: true }
        });
        const isAdminStock = currentUserRecord?.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(currentUserRecord.storeOwnerLevel);
        
        // Model exists, try to query
        // Use prisma.stockRequest directly - type assertion needed until Prisma types are fully regenerated
        stockRequests = await (prisma.stockRequest.findMany as any)({
          where: whereClause,
          include: {
            items: true,
            stockist: {
              select: {
                id: true,
                firstName: true,
                surname: true,
                memberId: true,
                storeOwnerLevel: true,
                fullName: true
              }
            },
            toUser: {
              select: {
                id: true,
                firstName: true,
                surname: true,
                memberId: true,
                storeOwnerLevel: true,
                fullName: true
              }
            },
            fromUser: {
              select: {
                id: true,
                firstName: true,
                surname: true,
                memberId: true,
                storeOwnerLevel: true,
                fullName: true
              }
            },
            requester: {
              select: {
                id: true,
                firstName: true,
                surname: true,
                memberId: true,
                storeOwnerLevel: true,
                fullName: true
              }
            }
          },
          orderBy: { createdDate: 'desc' },
          take: user?.isAdmin ? limit * 2 : limit, // Fetch more for admins to filter
          skip: offset
        });
        
        console.log('🔍 Direct Prisma query result:', {
          count: stockRequests.length,
          whereClause,
          userId: user.id,
          firstRecord: stockRequests[0] ? {
            id: stockRequests[0].id,
            stockistId: stockRequests[0].stockistId,
            fromUserId: stockRequests[0].fromUserId,
            toUserId: stockRequests[0].toUserId
          } : null
        });

        // Deduplicate transfers: When a transfer is made, TWO records are created (sender and recipient)
        // Both have the same fromUserId, toUserId, and createdDate
        // We only want to show ONE record per transfer - prefer the one where stockistId = user.id
        if (stockRequests.length > 0) {
          const seenTransfers = new Map<string, any>();
          const deduplicatedRequests: any[] = [];
          
          // First pass: collect all transfer records and group them
          const transferGroups = new Map<string, any[]>();
          
          for (const request of stockRequests) {
            // Only deduplicate records that have fromUserId and toUserId (transfers)
            if (request.fromUserId && request.toUserId && request.createdDate) {
              // Create a unique key: fromUserId + toUserId + date (rounded to nearest 30 seconds)
              // Use a larger time window (30 seconds) to catch records created at slightly different times
              const transferDate = new Date(request.createdDate);
              const roundedSeconds = Math.floor(transferDate.getTime() / 30000) * 30000; // Round to nearest 30 seconds
              const dateKey = new Date(roundedSeconds).toISOString().substring(0, 19); // YYYY-MM-DDTHH:mm:ss
              // Sort IDs alphabetically so A->B and B->A have the same key
              const sortedIds = [request.fromUserId, request.toUserId].sort().join('-');
              const transferKey = `${sortedIds}-${dateKey}`;
              
              // Group records by transfer key
              if (!transferGroups.has(transferKey)) {
                transferGroups.set(transferKey, []);
              }
              transferGroups.get(transferKey)!.push(request);
            } else {
              // No fromUserId/toUserId, not a transfer - add it directly (no deduplication needed)
              deduplicatedRequests.push(request);
            }
          }
          
          // Second pass: for each transfer group, keep only ONE record (prefer user's own record)
          for (const [transferKey, group] of transferGroups.entries()) {
            if (group.length === 1) {
              // Only one record, add it
              deduplicatedRequests.push(group[0]);
            } else {
              // Multiple records for the same transfer - keep only one
              // Prefer the record where stockistId = user.id (user's own record)
              const userRecord = group.find(r => r.stockistId === user.id);
              if (userRecord) {
                deduplicatedRequests.push(userRecord);
              } else {
                // No user record found, just take the first one
                deduplicatedRequests.push(group[0]);
              }
            }
          }
          
          // Sort deduplicated requests by createdDate (newest first) to maintain chronological order
          deduplicatedRequests.sort((a: any, b: any) => {
            const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
            const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
            return dateB - dateA; // Descending order (newest first)
          });
          
          const beforeCount = stockRequests.length;
          stockRequests = deduplicatedRequests;
          
          console.log('✅ Deduplicated stock requests:', {
            before: beforeCount,
            after: stockRequests.length,
            removed: beforeCount - stockRequests.length,
            userId: user.id,
            transferGroups: transferGroups.size
          });
        }

        // For admins only, filter to show:
        // 1. Requests from stockist members requesting for themselves (not from their downline)
        // 2. Requests from orders (where stockistId is an admin user)
        // 3. Admin transfers (ADMIN_TRANSFER:)
        // Note: AdminStock users already have the correct where clause (stockistId = their id)
        if (user?.isAdmin && stockRequests.length > 0) {
          // Get admin IDs to identify order-based requests
          // adminUsers is defined in the outer scope (line 86), but TypeScript needs explicit reference
          const fetchedAdminUsers = await prisma.user.findMany({
            where: {
              isAdmin: true,
              active: true,
              deleted: false
            },
            select: { id: true }
          });
          const adminIds = fetchedAdminUsers.map((a: any) => a.id);
          
          // Debug logging
          logger.info('Filtering stock requests for admin', {
            userId: user.id,
            totalRequests: stockRequests.length,
            adminIds,
            requests: stockRequests.map((r: any) => ({
              id: r.id,
              stockistId: r.stockistId,
              stockistName: r.stockistName,
              isAdminStockistId: adminIds.includes(r.stockistId)
            }))
          }, request);
          
          stockRequests = stockRequests.filter((req: any) => {
            // If stockistId is an admin ID OR stockistName starts with "ORDER:", this is an order-based request - always show it
            const isOrderBased = adminIds.includes(req.stockistId) || 
                                (req.stockistName && req.stockistName.startsWith('ORDER:'));
            
            // If stockistName starts with "ADMIN_TRANSFER:", this is an admin transfer to adminstock - always show it
            const isAdminTransfer = req.stockistName && req.stockistName.startsWith('ADMIN_TRANSFER:');
            
            if (isOrderBased || isAdminTransfer) {
              logger.debug('Including order-based or admin transfer stock request', {
                requestId: req.id,
                stockistId: req.stockistId,
                stockistName: req.stockistName,
                isOrderBased,
                isAdminTransfer
              }, request);
              return true;
            }
            
            // Otherwise, check if it's from a stockist member requesting for themselves
            // If stockist exists and has stockist level
            if (req.stockist && req.stockist.storeOwnerLevel && 
                ['S', 'M', 'C', 'D'].includes(req.stockist.storeOwnerLevel)) {
              // Check if the request is from the stockist themselves
              // (stockistName should match the stockist's fullName for self-requests)
              const stockistFullName = req.stockist.fullName || 
                `${req.stockist.firstName || ''} ${req.stockist.surname || ''}`.trim();
              const requestStockistName = req.stockistName || '';
              
              // If names match, it's a self-request (stockist requesting for themselves)
              // If names don't match, it's from a downline member (should not show to admin)
              const nameMatch = stockistFullName.toLowerCase() === requestStockistName.toLowerCase();
              if (nameMatch) {
                logger.debug('Including self-request from stockist', {
                  requestId: req.id,
                  stockistId: req.stockistId,
                  stockistName: req.stockistName
                }, request);
              }
              return nameMatch;
            }
            return false;
          });
          
          // Update total to reflect filtered count before pagination
          total = stockRequests.length;
          
          logger.info('After filtering stock requests for admin', {
            userId: user.id,
            filteredCount: stockRequests.length,
            offset,
            limit,
            willShow: stockRequests.slice(offset, offset + limit).length
          }, request);
          
          // Apply pagination after filtering (for admins, we filter then paginate)
          const startIdx = offset;
          const endIdx = offset + limit;
          stockRequests = stockRequests.slice(startIdx, endIdx);
          
          logger.info('After pagination for admin', {
            userId: user.id,
            finalCount: stockRequests.length,
            showingIndices: `${startIdx} to ${endIdx - 1}`
          }, request);
        } else {
          // For non-admins (including admin stock), pagination is already applied via take/skip in query
          // Get the count before deduplication (we'll update it after)
          total = await (prisma.stockRequest.count as any)({ where: whereClause });
        }
      }
    } catch (dbError: any) {
      const errorMessage = dbError?.message || 'Unknown database error';
      logger.error('Database query error for stock requests', {
        error: errorMessage,
        errorCode: dbError?.code,
        whereClause,
        userId: user?.id
      }, request);
      
      // For any database error, return empty array instead of crashing
      // This allows the UI to work even if the feature isn't fully set up
      stockRequests = [];
      total = 0;
    }

    logger.info('Stock requests fetched successfully', {
      userId: user?.id,
      count: stockRequests.length,
      total,
      status: rawStatus,
      isAdmin: user?.isAdmin,
      whereClause,
      duration: Date.now() - startTime,
      requests: stockRequests.map((r: any) => ({
        id: r.id,
        stockistId: r.stockistId,
        stockistName: r.stockistName,
        fromUserId: r.fromUserId,
        toUserId: r.toUserId,
        status: r.status,
        itemCount: r.items?.length || 0
      }))
    }, request);

    // Deduplicate stock requests - when a transfer happens, two records are created (sender and recipient)
    // We need to show only one record per transfer to avoid duplicates
    const seenTransfers = new Map<string, { record: any; timestamp: number }>();
    const deduplicatedRequests: any[] = [];
    
    for (const req of stockRequests) {
      // Create a unique key for each transfer based on fromUserId, toUserId, and createdDate
      // This identifies records that belong to the same transfer
      if (req.fromUserId && req.toUserId) {
        // Normalize the date to seconds (round down) to handle slight timing differences
        // Both records are created in the same transaction but might have millisecond differences
        let dateSeconds = 0;
        let timestamp = 0;
        if (req.createdDate) {
          const date = req.createdDate instanceof Date ? req.createdDate : new Date(req.createdDate);
          timestamp = date.getTime();
          dateSeconds = Math.floor(timestamp / 1000); // Round to seconds
        }
        
        // Create transfer key using fromUserId, toUserId, and date in seconds
        // Sort userIds to ensure consistent key regardless of direction
        const userIds = [req.fromUserId, req.toUserId].sort();
        const transferKey = `${userIds[0]}-${userIds[1]}-${dateSeconds}`;
        
        // Check if we've seen this transfer
        const existing = seenTransfers.get(transferKey);
        
        if (!existing) {
          // First time seeing this transfer
          seenTransfers.set(transferKey, { record: req, timestamp });
          deduplicatedRequests.push(req);
        } else {
          // We've seen this transfer before - check if it's within 5 seconds (same transfer)
          // This handles cases where records are created milliseconds apart
          const timeDiff = Math.abs(timestamp - existing.timestamp);
          if (timeDiff <= 5000) { // Within 5 seconds = same transfer
            // Prefer the record where stockistId matches the current user
            // This ensures users see the transfer from their own perspective
            if (req.stockistId === user.id && existing.record.stockistId !== user.id) {
              // Replace with the record that matches current user's perspective
              const index = deduplicatedRequests.findIndex(r => r.id === existing.record.id);
              if (index !== -1) {
                deduplicatedRequests[index] = req;
              }
              seenTransfers.set(transferKey, { record: req, timestamp });
            }
            // Otherwise, skip this duplicate record
          } else {
            // Different transfer (more than 5 seconds apart) - treat as separate
            seenTransfers.set(transferKey, { record: req, timestamp });
            deduplicatedRequests.push(req);
          }
        }
      } else {
        // For requests without fromUserId/toUserId (old format or non-transfer requests), include them
        deduplicatedRequests.push(req);
      }
    }

    // Sort deduplicated requests by createdDate (newest first) to maintain chronological order
    const sortedDeduplicatedRequests = deduplicatedRequests.sort((a: any, b: any) => {
      const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
      const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });

    // Enhance items with PV (for accurate invoice display) without changing DB schema
    // We look up PV from Product or StockItem for each item and attach as a computed field
    const enhancedStockRequests = await Promise.all(
      sortedDeduplicatedRequests.map(async (req: any) => {
        if (!req.items || req.items.length === 0) {
          return req;
        }

        const enhancedItems = await Promise.all(
          req.items.map(async (item: any) => {
            let pv = 0;

            try {
              // First try to find as Product
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { pv: true }
              });

              if (product) {
                pv = product.pv || 0;
              } else {
                // Fallback: try as StockItem (admin stock)
                const stockItem = await prisma.stockItem.findUnique({
                  where: { id: item.productId },
                  select: { pv: true }
                });

                if (stockItem) {
                  pv = stockItem.pv || 0;
                }
              }
            } catch (e) {
              // If lookup fails, keep pv as 0 and don't break the response
              logger.warn('Failed to enrich stock request item with PV', {
                itemId: item.id,
                productId: item.productId,
                error: e instanceof Error ? e.message : 'Unknown error'
              }, request);
            }

            return {
              ...item,
              pv
            };
          })
        );

        return {
          ...req,
          items: enhancedItems
        };
      })
    );

    // Update total count after deduplication
    // Since we deduplicated, we need to recalculate the total
    // For non-admins, we need to count unique transfers, not all records
    let finalTotal = total;
    if (!user?.isAdmin) {
      // For non-admins, count unique transfers based on fromUserId/toUserId pairs
      // This gives us the actual number of unique transfers
      const uniqueTransferKeys = new Set<string>();
      for (const req of stockRequests) {
        if (req.fromUserId && req.toUserId) {
          const transferKey = `${req.fromUserId}-${req.toUserId}-${req.createdDate?.toISOString() || req.createdDate}`;
          uniqueTransferKeys.add(transferKey);
        } else {
          // For non-transfer requests, count them individually
          uniqueTransferKeys.add(req.id);
        }
      }
      finalTotal = uniqueTransferKeys.size;
    } else {
      // For admins, use the deduplicated count
      finalTotal = enhancedStockRequests.length;
    }

    // Debug: Log the actual response structure
    console.log('🔍 API Response Debug:', {
      userId: user?.id,
      rawCount: stockRequests.length,
      deduplicatedCount: deduplicatedRequests.length,
      enhancedCount: enhancedStockRequests.length,
      originalTotal: total,
      finalTotal,
      firstRecord: enhancedStockRequests[0] ? {
        id: enhancedStockRequests[0].id,
        stockistId: enhancedStockRequests[0].stockistId,
        fromUserId: enhancedStockRequests[0].fromUserId,
        toUserId: enhancedStockRequests[0].toUserId,
        status: enhancedStockRequests[0].status,
        itemsCount: enhancedStockRequests[0].items?.length || 0
      } : null
    });

    return ApiResponseUtil.paginated(
      enhancedStockRequests,
      finalTotal,
      limit,
      offset,
      API_MESSAGES.FETCHED
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.constructor.name : typeof error;
    
    logger.error('Stock requests API error', {
      error: errorMessage,
      stack: errorStack,
      errorType: errorName,
      errorCode: (error as any)?.code,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return ApiResponseUtil.unauthorized();
    }

    // If it's a database/model error, return empty result instead of 500
    if (
      errorMessage.includes('model') || 
      errorMessage.includes('StockRequest') ||
      errorMessage.includes('does not exist') ||
      errorMessage.includes('Unknown table') ||
      errorMessage.includes('Table') ||
      (error as any)?.code === 'P2021' ||
      (error as any)?.code === 'P2001'
    ) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    // Return more detailed error for debugging
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { 
          stack: errorStack,
          errorType: errorName,
          errorCode: (error as any)?.code
        })
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return await requireAuth(async (req: AuthenticatedRequest) => {
    const startTime = Date.now();

    try {
      // Apply rate limiting - increased for stock requests
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100 });
      if (!rateLimitResult.success) {
        logger.warn('Rate limit exceeded for stock request creation', {
          ip: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent')
        }, request);
        return rateLimitResult.response!;
      }

      const user = req.user!;
      const body = await request.json();
      const { items, stockistLevel, targetStockistId, requestedById, requestedByName } = body;
    
    // Determine target stockist and requester:
    // - If targetStockistId is provided, route to that stockist (upline)
    // - Otherwise, route to the requesting user (for stockist members requesting for themselves)
    let finalTargetStockistId = targetStockistId || user.id;
    let requesterName = requestedByName || user.fullName;
    let requesterId = requestedById || user.id;
    
    // If routing to upline (targetStockistId is different from user.id), verify the target stockist
    if (targetStockistId && targetStockistId !== user.id) {
      const targetStockist = await prisma.user.findUnique({
        where: { id: finalTargetStockistId },
        select: { id: true, storeOwnerLevel: true, active: true }
      });
      
      if (!targetStockist) {
        return ApiResponseUtil.validationError([{
          field: 'targetStockistId',
          message: 'Target stockist not found'
        }]);
      }
      
      if (!targetStockist.active) {
        return ApiResponseUtil.validationError([{
          field: 'targetStockistId',
          message: 'Target stockist is not active'
        }]);
      }
      
      const hasStockistLevel = targetStockist.storeOwnerLevel && 
        ['S', 'M', 'C', 'D'].includes(targetStockist.storeOwnerLevel);
      
      if (!hasStockistLevel) {
        return ApiResponseUtil.validationError([{
          field: 'targetStockistId',
          message: 'Target user does not have a valid stockist level (S, M, C, or D)'
        }]);
      }
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ApiResponseUtil.validationError([{ field: 'items', message: 'Items are required' }]);
    }

    // Calculate total value and item count
    let totalValue = 0;
    let itemCount = 0;

    for (const item of items) {
      if (!item.productId || !item.requestedQuantity || item.requestedQuantity <= 0) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: 'Each item must have productId and positive requestedQuantity'
        }]);
      }
      totalValue += (item.unitPrice || 0) * item.requestedQuantity;
      itemCount += item.requestedQuantity;
    }

    // Check if StockRequest model is available
    if (!(prisma as any).stockRequest) {
      return ApiResponseUtil.serviceUnavailable('Stock request functionality is not yet available');
    }

    // Get target stockist info for stockistLevel
    const targetStockist = await prisma.user.findUnique({
      where: { id: finalTargetStockistId },
      select: { storeOwnerLevel: true }
    });
    
    const finalStockistLevel = stockistLevel || targetStockist?.storeOwnerLevel || 'S';
    
    // Get requester info for full details
    const requesterUser = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, memberId: true, fullName: true }
    });

    // Create stock request
    // stockistId = target stockist (upline) who will handle the request
    // stockistName = name of the requester (downline member)
    // requesterId = the actual user who made the request (receiver of stock)
    const stockRequest = await (prisma as any).stockRequest.create({
      data: {
        stockistId: finalTargetStockistId, // Target stockist (upline) - determines who approves it
        stockistName: requesterName, // Name of requester (downline member)
        stockistLevel: finalStockistLevel,
        requesterId: requesterId, // CRITICAL: The actual requester (receiver of stock)
        requesterName: requesterUser?.fullName || requesterName,
        requesterMemberId: requesterUser?.memberId || null,
        status: 'pending',
        totalValue,
        itemCount,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName || 'Unknown Product',
            requestedQuantity: item.requestedQuantity,
            unitPrice: item.unitPrice || 0
          }))
        }
      },
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true
          }
        }
      }
    });
    
    logger.info('Stock request created with requesterId', {
      requestId: stockRequest.id,
      stockistId: finalTargetStockistId,
      requesterId: requesterId,
      requesterName: requesterName,
      userId: user.id
    }, request);

    logger.info('Stock request created', {
      userId: user.id,
      requestId: stockRequest.id,
      itemCount,
      totalValue,
      duration: Date.now() - startTime
    }, request);

    // Send notification to admins about new stock request
    try {
      // Find all admin users
      const adminUsers = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true }
      });

      // Send notification to all admins and the target stockist (upline)
      const notificationPromises = adminUsers.map(admin => 
        createNotification(
          admin.id,
          'stock-request',
          {
            stockistName: requesterName,
            stockistLevel: finalStockistLevel
          },
          'high',
          {
            requestId: stockRequest.id,
            type: 'stock_request',
            stockRequestId: stockRequest.id,
            link: '/admin/binary-stock?tab=requests' // Navigate to admin stock requests page
          }
        ).catch((error: any) => {
          console.error(`Failed to send notification to admin ${admin.id}:`, error);
        })
      );
      
      // Also notify the target stockist (upline) if they're not an admin AND not the requester
      // (Don't notify the requester about their own request - they'll be notified when it's approved/rejected)
      if (finalTargetStockistId !== requesterId) {
        const targetStockistUser = await prisma.user.findUnique({
          where: { id: finalTargetStockistId },
          select: { id: true, isAdmin: true }
        });
        
        if (targetStockistUser && !targetStockistUser.isAdmin) {
          notificationPromises.push(
            createNotification(
              finalTargetStockistId,
              'stock-request',
              {
                stockistName: requesterName,
                stockistLevel: finalStockistLevel
              },
              'high',
              {
                requestId: stockRequest.id,
                type: 'stock_request',
                stockRequestId: stockRequest.id,
                link: '/my-stock' // Navigate to my-stock page to see requests
              }
            ).catch((error: any) => {
              console.error(`Failed to send notification to stockist ${finalTargetStockistId}:`, error);
            })
          );
        }
      }

      await Promise.all(notificationPromises);
      
      logger.info('Stock request notifications sent to admins', {
        requestId: stockRequest.id,
        adminCount: adminUsers.length
      }, request);
    } catch (notifError) {
      // Log but don't fail the request creation if notification fails
      logger.error('Failed to send admin notifications for stock request', {
        error: notifError instanceof Error ? notifError.message : 'Unknown error',
        requestId: stockRequest.id
      }, request);
    }

      return ApiResponseUtil.success(stockRequest, 'Stock request created successfully');

    } catch (error) {
      logger.error('Stock request creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: request.headers.get('x-forwarded-for')
      }, request);

      return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
    }
  })(request);
}

export async function PATCH(request: NextRequest) {
  return await requireAuth(async (req: AuthenticatedRequest) => {
    const startTime = Date.now();

    try {
      // Apply rate limiting
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
      if (!rateLimitResult.success) {
        return rateLimitResult.response!;
      }

      const user = req.user!;
      const body = await request.json();
    const { requestId, status, approvedQuantities } = body;

    if (!requestId || !status) {
      return ApiResponseUtil.validationError([
        { field: 'requestId', message: 'Request ID is required' },
        { field: 'status', message: 'Status is required' }
      ]);
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return ApiResponseUtil.validationError([
        { field: 'status', message: 'Invalid status value' }
      ]);
    }

    // Check if StockRequest model is available
    if (!(prisma as any).stockRequest) {
      return ApiResponseUtil.serviceUnavailable('Stock request functionality is not yet available');
    }

    // Check authorization: Admin can approve any request, stockist can only approve requests where they are the target
    const stockRequest = await (prisma as any).stockRequest.findUnique({
      where: { id: requestId },
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true
          }
        }
      }
    });

    if (!stockRequest) {
      return ApiResponseUtil.notFound('Stock request not found');
    }

    // Check if user is admin
    const isAdmin = user.isAdmin === true;
    
    // Check if user is a stockist (S, M, C, D)
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { storeOwnerLevel: true, isAdmin: true }
    });
    
    const hasStockistLevel = userRecord?.storeOwnerLevel && 
      ['S', 'M', 'C', 'D'].includes(userRecord.storeOwnerLevel);
    
    // Authorization check:
    // 1. Admin can approve any request
    // 2. Stockist can only approve requests where stockistId = their ID (requests from their downline)
    if (!isAdmin && !hasStockistLevel) {
      logger.warn('Stock request approval denied - user is not admin or stockist', {
        userId: user.id,
        requestId,
        userStoreOwnerLevel: userRecord?.storeOwnerLevel
      }, request);
      return ApiResponseUtil.forbidden('Only admins and stockist members (S, M, C, D) can approve stock requests');
    }
    
    // For stockist members, verify they are the target stockist for this request
    // stockistId in the request = target stockist (upline) who should handle the request
    if (!isAdmin) {
      // Convert both to strings for comparison to avoid type mismatches
      const requestStockistId = String(stockRequest.stockistId || '').trim();
      const userId = String(user.id || '').trim();
      
      logger.info('Stock request approval authorization check', {
        userId,
        requestStockistId,
        requestId,
        userStoreOwnerLevel: userRecord?.storeOwnerLevel,
        isMatch: requestStockistId === userId
      }, request);
      
      if (requestStockistId !== userId) {
        logger.warn('Stock request approval denied - stockistId mismatch', {
          userId,
          requestStockistId,
          requestId,
          userStoreOwnerLevel: userRecord?.storeOwnerLevel,
          stockRequestData: {
            id: stockRequest.id,
            stockistId: stockRequest.stockistId,
            stockistName: stockRequest.stockistName,
            status: stockRequest.status
          }
        }, request);
        return ApiResponseUtil.forbidden(`You can only approve stock requests from your downline members. This request is assigned to stockist ID: ${requestStockistId}, but your ID is: ${userId}.`);
      }
    }

    // If approving, process the stock transfer
    logger.info('Processing stock request status update', {
      requestId,
      status,
      statusType: typeof status,
      isApproved: status === 'approved',
      itemCount: stockRequest.items.length
    }, request);

    if (status === 'approved') {
      console.log('🚀 ================== STOCK REQUEST APPROVAL STARTED ==================');
      console.log('🚀 Request ID:', requestId);
      console.log('🚀 Stockist ID:', stockRequest.stockistId);
      console.log('🚀 Requester ID:', stockRequest.requesterId);
      console.log('🚀 Stockist Name:', stockRequest.stockistName);
      console.log('🚀 Approver ID:', user.id);
      console.log('🚀 Approver is Admin:', isAdmin);
      console.log('🚀 Items:', stockRequest.items.length);
      
      logger.info('Starting approval process - will update PV, inventory, and wallet', {
        requestId,
        stockistId: stockRequest.stockistId,
        itemCount: stockRequest.items.length,
        approverId: user.id,
        isApproverAdmin: isAdmin,
        approverStoreOwnerLevel: userRecord?.storeOwnerLevel,
        items: stockRequest.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          requestedQuantity: item.requestedQuantity
        }))
      }, request);

      // Calculate total PV and total amount from items
      let totalPV = 0;
      let totalAmount = 0;
      
      // Map to track the actual product IDs used for each item (might differ from request due to Product/StockItem mismatch)
      const actualProductIdMap = new Map<string, string>();
      
      for (const item of stockRequest.items) {
        const quantity = approvedQuantities?.[item.id] || item.requestedQuantity;
        
        // Get product/stockItem details for PV
        // Note: productId might be a StockItem ID or Product ID depending on request source
        let productPV = 0;
        let productPrice = item.unitPrice || 0;
        let productQty = 0;
        
        // First try to find as Product
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { pv: true, price: true, qty: true }
        });
        
        if (product) {
          productPV = product.pv || 0;
          productPrice = product.price || item.unitPrice || 0;
          productQty = product.qty || 0;
        } else {
          // Try to find as StockItem
          const stockItem = await prisma.stockItem.findUnique({
            where: { id: item.productId },
            select: { pv: true, price: true, quantity: true }
          });
          
          if (stockItem) {
            productPV = stockItem.pv || 0;
            productPrice = stockItem.price || item.unitPrice || 0;
            productQty = stockItem.quantity || 0;
          }
        }
        
        totalPV += productPV * quantity;
        totalAmount += productPrice * quantity;
        
        // Different deduction logic based on who is approving:
        // - System Admin: Deduct from main product/stockItem inventory
        // - AdminStock (D, C, M, S): Deduct from their own inventory (InventoryTransaction)
        
        if (isAdmin) {
          // System Admin: Deduct from main product inventory or stockItem
          logger.info('Admin approving - deducting from inventory', {
            productId: item.productId,
            productName: item.productName,
            currentQty: productQty,
            deductQty: quantity,
            newQty: productQty - quantity
          }, request);
          
          if (product) {
            // Deduct from Product table
            const updatedProduct = await prisma.product.update({
              where: { id: item.productId },
              data: {
                qty: {
                  decrement: quantity
                }
              },
              select: { qty: true }
            });
            
            logger.info('Product inventory updated by admin', {
              productId: item.productId,
              productName: item.productName,
              oldQty: productQty,
              deductedQty: quantity,
              newQty: updatedProduct.qty
            }, request);
          } else {
            // Deduct from StockItem table
            await prisma.stockItem.update({
              where: { id: item.productId },
              data: {
                quantity: {
                  decrement: quantity
                }
              }
            });
            
            logger.info('StockItem inventory updated by admin', {
              productId: item.productId,
              productName: item.productName,
              oldQty: productQty,
              deductedQty: quantity,
              newQty: productQty - quantity
            }, request);
          }
        } else if (hasStockistLevel && (prisma as any).inventoryTransaction) {
            // AdminStock: Deduct from their own inventory (My Stock)
            logger.info('AdminStock approving - deducting from their inventory', {
              approverId: user.id,
              approverLevel: userRecord?.storeOwnerLevel,
              productId: item.productId,
              productName: item.productName,
              deductQty: quantity
            }, request);
            
            // The productId in stock requests might be a StockItem ID, but AdminStock inventory
            // might be stored with Product IDs. We need to find the matching inventory.
            
            // First, try to find inventory transactions with the exact productId
            let approverTransactions = await (prisma as any).inventoryTransaction.findMany({
              where: { 
                userId: user.id,
                productId: item.productId
              },
              orderBy: { createdAt: 'asc' }
            });
            
            // If no transactions found, try to find by matching product name
            // (StockItem might have a different ID than Product)
            let actualProductId = item.productId;
            
            if (approverTransactions.length === 0 && item.productName) {
              logger.info('No inventory found by productId, trying to match by product name', {
                productId: item.productId,
                productName: item.productName
              }, request);
              
              // Get all unique productIds from approver's inventory
              const allApproverTransactions = await (prisma as any).inventoryTransaction.findMany({
                where: { userId: user.id },
                select: { productId: true }
              });
              
              const uniqueProductIds = [...new Set(allApproverTransactions.map((t: any) => t.productId))];
              
              // Try to find the product by name in both Product and StockItem tables
              const matchingProduct = await prisma.product.findFirst({
                where: { 
                  id: { in: uniqueProductIds as string[] },
                  name: { contains: item.productName.split('(')[0].trim(), mode: 'insensitive' as any }
                },
                select: { id: true, name: true }
              });
              
              if (matchingProduct) {
                actualProductId = matchingProduct.id;
                logger.info('Found matching product by name', {
                  originalProductId: item.productId,
                  matchedProductId: actualProductId,
                  matchedProductName: matchingProduct.name
                }, request);
                
                // Re-fetch transactions with the correct productId
                approverTransactions = await (prisma as any).inventoryTransaction.findMany({
                  where: { 
                    userId: user.id,
                    productId: actualProductId
                  },
                  orderBy: { createdAt: 'asc' }
                });
              } else {
                // Try matching by exact name
                const exactMatchProduct = await prisma.product.findFirst({
                  where: { 
                    id: { in: uniqueProductIds as string[] },
                    name: item.productName
                  },
                  select: { id: true, name: true }
                });
                
                if (exactMatchProduct) {
                  actualProductId = exactMatchProduct.id;
                  approverTransactions = await (prisma as any).inventoryTransaction.findMany({
                    where: { 
                      userId: user.id,
                      productId: actualProductId
                    },
                    orderBy: { createdAt: 'asc' }
                  });
                }
              }
            }

            // Calculate approver's current stock
            let approverCurrentStock = 0;
            for (const transaction of approverTransactions) {
              const qty = Number(transaction.quantity) || 0;
              if (transaction.type === 'purchase' || transaction.type === 'transfer' || transaction.type === 'return') {
                approverCurrentStock += qty;
              } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
                approverCurrentStock -= qty;
              }
            }
            approverCurrentStock = Math.max(0, approverCurrentStock);
            
            // Check if approver has enough stock
            if (approverCurrentStock < quantity) {
              logger.error('AdminStock has insufficient inventory', {
                approverId: user.id,
                originalProductId: item.productId,
                actualProductId: actualProductId,
                productName: item.productName,
                availableStock: approverCurrentStock,
                requestedQuantity: quantity,
                transactionsFound: approverTransactions.length
              }, request);
              return ApiResponseUtil.error(
                `Insufficient stock for ${item.productName}. You have ${approverCurrentStock} units but ${quantity} are requested.`
              );
            }
            
            // Create inventory transaction to deduct from approver's stock
            await (prisma as any).inventoryTransaction.create({
              data: {
                userId: user.id, // Approver (AdminStock)
                productId: actualProductId, // Use the matched product ID
                type: 'sale', // Use 'sale' type to deduct
                quantity: quantity,
                previousQty: approverCurrentStock,
                newQty: approverCurrentStock - quantity,
                reference: `Stock request approved: ${requestId}`,
                reason: `Stock transferred to downline - ${quantity} units of ${item.productName}`,
                createdBy: user.id
              }
            });
            
            logger.info('AdminStock inventory deducted', {
              approverId: user.id,
              originalProductId: item.productId,
              actualProductId: actualProductId,
              productName: item.productName,
              previousQty: approverCurrentStock,
              deductedQty: quantity,
              newQty: approverCurrentStock - quantity
            }, request);
            
            // Store the actual product ID used for this item (for recipient inventory creation)
            actualProductIdMap.set(item.id, actualProductId);
        }
      }
      
      // Determine the actual customer/member who should receive the stock/notification
      // IMPORTANT: stockistId is the TARGET stockist (who approves), NOT the requester!
      // - requesterId = the member who made the request (should receive the stock)
      // - stockistId = the upline stockist who is APPROVING the request (NOT the receiver)
      // - The approver (user.id) should NEVER receive the stock
      
      let recipientUserId = stockRequest.requesterId;
      
      // If requesterId is not set (old requests), find the actual requester
      if (!recipientUserId) {
        // Method 1: Look up by stockistName (which contains the requester's name)
        if (stockRequest.stockistName) {
          let requesterName = stockRequest.stockistName;
          
          // Strip prefixes if present
          if (requesterName.startsWith('ADMIN_TRANSFER:')) {
            requesterName = requesterName.replace('ADMIN_TRANSFER:', '');
          }
          if (requesterName.startsWith('ORDER:')) {
            // Extract customer name from format "ORDER:ORDER_ID|Customer Name"
            const parts = requesterName.split('|');
            if (parts.length > 1) {
              requesterName = parts[1].trim();
            }
          }
          
          // Look up the requester by name - EXCLUDE the approver (user.id)
          const requesterUser = await prisma.user.findFirst({
            where: { 
              fullName: requesterName,
              id: { not: user.id }, // Exclude the approver
              active: true,
              deleted: false
            },
            select: { id: true, fullName: true }
          });
          
          if (requesterUser) {
            recipientUserId = requesterUser.id;
            logger.info('Found requester by name lookup', {
              requesterName,
              requesterId: recipientUserId,
              stockistId: stockRequest.stockistId,
              approverId: user.id
            }, request);
          }
        }
        
        // Method 2: If stockistId is NOT the approver, it might be the requester
        // (for cases where AdminStock requests for themselves without upline)
        if (!recipientUserId && stockRequest.stockistId !== user.id) {
          recipientUserId = stockRequest.stockistId;
          logger.info('Using stockistId as recipient (not the approver)', {
            recipientUserId,
            stockistId: stockRequest.stockistId,
            approverId: user.id
          }, request);
        }
        
        // Method 3: Last resort - error out if we still don't have a recipient
        if (!recipientUserId) {
          logger.error('Cannot determine recipient for stock request', {
            stockRequestId: requestId,
            stockistId: stockRequest.stockistId,
            stockistName: stockRequest.stockistName,
            requesterId: stockRequest.requesterId,
            approverId: user.id
          }, request);
          return ApiResponseUtil.error('Cannot determine recipient for this stock request. Please contact support.', 400);
        }
      }
      
      // CRITICAL: Ensure recipientUserId is NOT the approver
      if (recipientUserId === user.id) {
        logger.error('CRITICAL: recipientUserId is the approver! This should not happen.', {
          recipientUserId,
          approverId: user.id,
          requesterId: stockRequest.requesterId,
          stockistId: stockRequest.stockistId,
          stockistName: stockRequest.stockistName
        }, request);
        // Don't proceed - this would give stock to the wrong person
        return ApiResponseUtil.error('Cannot approve your own stock request. The approver cannot be the recipient.', 400);
      }
      
      logger.info('Stock recipient determined', {
        requesterId: stockRequest.requesterId,
        stockistId: stockRequest.stockistId,
        recipientUserId,
        approverId: user.id,
        stockistName: stockRequest.stockistName
      }, request);
      
      // DEBUG: Console log for troubleshooting
      console.log('🎯 STOCK APPROVAL DEBUG:', {
        requestId,
        recipientUserId,
        approverId: user.id,
        stockistId: stockRequest.stockistId,
        requesterId: stockRequest.requesterId,
        stockistName: stockRequest.stockistName,
        totalPV,
        totalAmount,
        itemCount: stockRequest.items.length
      });
      
      if (stockRequest.stockistName && stockRequest.stockistName.startsWith('ORDER:')) {
        // Extract orderId from format: "ORDER:ORDER_ID|Customer Name"
        const orderIdMatch = stockRequest.stockistName.match(/^ORDER:([^|]+)/);
        if (orderIdMatch && orderIdMatch[1]) {
          const orderId = orderIdMatch[1];
          
          // Find the order to get the actual customer's userId
          const order = await prisma.order.findFirst({
            where: { orderId: orderId },
            select: { userId: true }
          });
          
          if (order) {
            recipientUserId = order.userId; // Use the customer's ID, not admin's ID
            logger.info('Order-based stock request: using customer ID instead of admin ID', {
              orderId,
              customerUserId: recipientUserId,
              adminStockistId: stockRequest.stockistId,
              requestId
            }, request);
          }
        }
      }
      
      // Update customer's PV (not admin's PV) - ONLY for regular members (not AdminStock)
      // AdminStock recipients get PV via product/inventory only
      const recipientForPV = await prisma.user.findUnique({
        where: { id: recipientUserId },
        select: { storeOwnerLevel: true, pv: true, rank: true, memberId: true, fullName: true }
      });
      const isRecipientAdminStock = recipientForPV?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(recipientForPV.storeOwnerLevel);
      
      let currentPV = 0;
      let newPV = 0;
      
      if (!isRecipientAdminStock && totalPV > 0) {
        currentPV = recipientForPV?.pv || 0;
        newPV = currentPV + totalPV;
        
        // CRITICAL: Update rank BEFORE handlePVChange (same as inventory-service)
        const { shouldUpdateRank } = await import('@/lib/rank');
        const rankUpdateResult = shouldUpdateRank((recipientForPV?.rank as any) || 'Member', newPV);
        const updateData: { pv: number; pvDate: Date; rankOnlyNoPv: false; rank?: string } = {
          pv: newPV,
          pvDate: new Date(),
          rankOnlyNoPv: false
        };
        if (rankUpdateResult.shouldUpdate && rankUpdateResult.newRank) {
          updateData.rank = rankUpdateResult.newRank;
          logger.info('Recipient rank will be upgraded on approval', {
            recipientUserId,
            from: recipientForPV?.rank,
            to: rankUpdateResult.newRank,
            newPV
          }, request);
        }
        
        console.log('📊 Updating user PV/Rank:', { recipientUserId, totalPV, currentPV, newPV });
        await prisma.user.update({
          where: { id: recipientUserId },
          data: updateData
        });
        console.log('✅ User PV/Rank updated successfully');
        
        // CRITICAL: Add PV to sponsor's waiting leg and trigger Daily Match + Matching Bonus
        try {
          const { PVMatchingService } = await import('@/services/pv-matching-service');
          await PVMatchingService.handlePVChange(recipientUserId, currentPV, newPV);
          logger.info('PV added to sponsor waiting PV - Daily Match + Matching Bonus triggered', {
            recipientUserId,
            memberId: recipientForPV?.memberId,
            pvDifference: totalPV
          }, request);
        } catch (pvMatchingError: any) {
          logger.error('Failed to update sponsor waiting PV for binary/daily match', {
            error: pvMatchingError.message,
            recipientUserId,
            pvDifference: totalPV
          }, request);
        }
        
        // Binary Bonus for sponsor (recipient's sponsorId or placementParentId)
        try {
          const recipientWithSponsor = await prisma.user.findUnique({
            where: { id: recipientUserId },
            select: { sponsorId: true, placementParentId: true, position: true }
          });
          const sponsorId = recipientWithSponsor?.sponsorId || recipientWithSponsor?.placementParentId;
          if (sponsorId) {
            const { getCommissionRateByRank } = await import('@/lib/referral-tracking');
            const sponsorUser = await prisma.user.findUnique({
              where: { id: sponsorId },
              select: { rank: true, companyId: true, memberId: true }
            });
            const sponsorRank = sponsorUser?.rank || null;
            const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
            const memberRank = rankUpdateResult.shouldUpdate ? rankUpdateResult.newRank : (recipientForPV?.rank as string);
            const isMemberEligible = memberRank && validRanks.includes((memberRank as string).trim());
            const isSponsorEligible = sponsorRank && validRanks.includes(sponsorRank.trim());
            if (isMemberEligible && isSponsorEligible && totalPV > 0) {
              const commissionRate = getCommissionRateByRank(sponsorRank.trim());
              if (commissionRate > 0) {
                const commissionAmount = Math.round((totalPV * commissionRate) * 100) / 100;
                await prisma.commission.create({
                  data: {
                    userId: sponsorId,
                    amount: commissionAmount,
                    type: 'Binary Bonus',
                    status: 'Paid',
                    date: new Date(),
                    companyId: sponsorUser?.companyId ?? null,
                    description: `Binary Bonus: ${recipientForPV?.fullName || recipientForPV?.memberId} (+${totalPV} PV) via Stock Request #${requestId.substring(0, 8)} - ${totalPV} PV × ${(commissionRate * 100).toFixed(1)}%`
                  }
                });
                const { WalletServiceEnhanced } = await import('@/services/wallet-service-enhanced');
                await prisma.wallet.upsert({
                  where: { userId: sponsorId },
                  create: { userId: sponsorId, balance: 0, currency: 'USD' },
                  update: {}
                });
                const commRef = `stock_request:${requestId}:binary_bonus`;
                await WalletServiceEnhanced.creditWallet(sponsorId, commissionAmount, 'Binary Bonus', commRef, 'commission');
                logger.info('Binary Bonus created for sponsor on stock request approval', {
                  sponsorId,
                  recipientUserId,
                  totalPV,
                  commissionAmount,
                  requestId
                }, request);
              }
            }
          }
          // G2 Binary Bonus for grandparent when G2 member receives PV (works for renew top-ups)
          try {
            const { payG2BinaryBonusForPVTopUp } = await import('@/services/g2-binary-bonus-auto-calc');
            await payG2BinaryBonusForPVTopUp(recipientUserId, totalPV);
          } catch (g2Error: any) {
            logger.warn('G2 Binary Bonus for PV top-up failed', { recipientUserId, totalPV, error: g2Error?.message }, request);
          }
        } catch (binaryBonusError: any) {
          logger.error('Failed to create Binary Bonus on stock request approval', {
            error: binaryBonusError.message,
            recipientUserId,
            totalPV
          }, request);
        }
      } else if (isRecipientAdminStock) {
        console.log('⏭️ Skipping PV/Rank update - recipient is AdminStock');
      }
      
      // Create inventory transactions for the customer/member (this is what makes stock appear in My Stock)
      // Check if InventoryTransaction model exists
      if ((prisma as any).inventoryTransaction) {
        for (const item of stockRequest.items) {
          const quantity = approvedQuantities?.[item.id] || item.requestedQuantity;
          
          // Use the actual product ID that was used during deduction (from the map)
          // This ensures both deduction and addition use the same Product ID
          const productIdForRecipient = actualProductIdMap.get(item.id) || item.productId;
          
          try {
            // Get customer's current inventory for this product to calculate previousQty and newQty
            const existingTransactions = await (prisma as any).inventoryTransaction.findMany({
              where: { 
                userId: recipientUserId, // Use customer's ID, not admin's ID
                productId: productIdForRecipient
              },
              orderBy: { createdAt: 'asc' }
            });

            // Calculate current stock from existing transactions
            let currentStock = 0;
            for (const transaction of existingTransactions) {
              const qty = Number(transaction.quantity) || 0;
              if (transaction.type === 'purchase' || transaction.type === 'transfer' || transaction.type === 'return') {
                currentStock += qty;
              } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
                currentStock -= qty;
              }
            }
            currentStock = Math.max(0, currentStock);

            // Create inventory transaction for the customer/member
            console.log('📦 Creating inventory transaction:', {
              userId: recipientUserId,
              productId: productIdForRecipient,
              productName: item.productName,
              quantity: quantity,
              currentStock,
              newStock: currentStock + quantity
            });
            
            const invTx = await (prisma as any).inventoryTransaction.create({
              data: {
                userId: recipientUserId, // Use customer's ID, not admin's ID
                productId: productIdForRecipient, // Use the same Product ID as deduction
                type: 'transfer',
                quantity: quantity,
                previousQty: currentStock,
                newQty: currentStock + quantity,
                reference: `Stock request approved: ${requestId}`,
                reason: `Stock request approved - ${quantity} units of ${item.productName}`,
                createdBy: user.id
              }
            });
            
            console.log('✅ Inventory transaction created:', invTx.id);
            
            logger.info('Inventory transaction created for customer/member', {
              recipientUserId,
              originalProductId: item.productId,
              usedProductId: productIdForRecipient,
              productName: item.productName,
              quantity: quantity,
              previousQty: currentStock,
              newQty: currentStock + quantity,
              requestId
            }, request);
          } catch (inventoryError: any) {
            logger.error('Failed to create inventory transaction', {
              error: inventoryError.message,
              stack: inventoryError.stack,
              stockistId: stockRequest.stockistId,
              productId: item.productId,
              quantity
            }, request);
            // Continue processing other items even if one fails
          }
        }
      } else {
        logger.warn('InventoryTransaction model not available - stock will not appear in My Stock', {
          requestId,
          stockistId: stockRequest.stockistId
        }, request);
      }
      
      // Get or create wallet for customer/member (for transaction record only)
      // Use recipientUserId (customer's ID for order-based requests, stockistId for regular requests)
      console.log('💰 Looking for wallet for user:', recipientUserId);
      let wallet = await prisma.wallet.findUnique({
        where: { userId: recipientUserId }
      });
      
      if (!wallet) {
        console.log('💰 Creating new wallet for user:', recipientUserId);
        wallet = await prisma.wallet.create({
          data: {
            userId: recipientUserId,
            balance: 0
          }
        });
      }
      console.log('💰 Wallet found/created:', { walletId: wallet.id, userId: recipientUserId });
      
      // Create wallet transaction record for the recipient (PV Points Wallet / E-Comm)
      // IMPORTANT:
      // - `amount` here represents PV, not USD money
      // - E-Comm (PV wallet) uses walletTransaction.amount as PV units
      // - The monetary value is already reflected in the invoice UI; here we track PV movement
      // - `type` should be 'credit' (PV coming in), `referenceType` should be 'stock_transfer' (for PV/Stock tracking)
      console.log('💵 Creating wallet transaction:', {
        walletId: wallet.id,
        recipientUserId,
        totalPV,
        referenceType: 'stock_transfer'
      });
      
      const walletTx = await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'credit', // Credit transaction (PV coming in)
          amount: totalPV, // Use PV amount so it shows correctly in PV wallet history
          balanceBefore: wallet.balance || 0,
          balanceAfter: wallet.balance || 0, // Wallet cash balance unchanged (PV is tracked separately)
          description: `Stock transfer from AdminStock: Request #${requestId.substring(0, 8)} approved (+${totalPV} PV, ${totalAmount} currency for ${stockRequest.items.length} item(s))`,
          status: 'completed',
          referenceType: 'stock_transfer', // This makes it show in PV/Stock
          referenceId: requestId,
          createdAt: new Date(),
        }
      });
      
      console.log('✅ Wallet transaction created:', {
        id: walletTx.id,
        walletId: walletTx.walletId,
        amount: walletTx.amount,
        referenceType: walletTx.referenceType
      });
      
      logger.info('Stock request approved - PV, inventory, and inventory transactions updated', {
        userId: user.id,
        requestId,
        stockistId: stockRequest.stockistId,
        totalPV,
        totalAmount,
        itemCount: stockRequest.items.length
      }, request);
      
      // ========== STOCKIST BONUS COMMISSION ==========
      // When an AdminStock approves a request, they earn commission based on the PV transferred
      // Commission rate depends on the stockist levels: approver (seller) → recipient (buyer)
      if (hasStockistLevel && totalPV > 0) {
        try {
          const { getStockistCommissionRate, stockistLevelCommissions } = await import('@/lib/types');
          
          const approverLevel = userRecord?.storeOwnerLevel as 'S' | 'M' | 'C' | 'D';
          
          // Get recipient's stockist level for differential commission calculation
          const recipientUser = await prisma.user.findUnique({
            where: { id: recipientUserId },
            select: { storeOwnerLevel: true, fullName: true, memberId: true }
          });
          
          const recipientLevel = recipientUser?.storeOwnerLevel as 'S' | 'M' | 'C' | 'D' | null | undefined;
          
          // Calculate commission rate based on sender → recipient levels
          // D→S: 2.2%, D→M: 1.3%, D→C: 0.4%, C→S: 1.8%, C→M: 0.9%, M→S: 0.9%
          // If recipient is same/higher level, no commission (returns 0)
          const commissionPercentage = getStockistCommissionRate(approverLevel, recipientLevel);
          
          logger.info('Calculating stockist bonus commission', {
            approverId: user.id,
            approverLevel,
            recipientId: recipientUserId,
            recipientLevel,
            totalPV,
            commissionPercentage
          }, request);
          
          if (commissionPercentage > 0) {
            // Calculate commission amount: PV × commission percentage / 100
            const commissionAmount = Math.round((totalPV * commissionPercentage / 100) * 100) / 100;
            
            if (commissionAmount > 0) {
              // Create stockist bonus record
              const now = new Date();
              const month = now.getMonth() + 1;
              const year = now.getFullYear();
              const period = `${year}-${month.toString().padStart(2, '0')}`;
              
              await (prisma as any).stockistBonus.create({
                data: {
                  stockistId: user.id, // The approver earns the commission
                  memberId: recipientUserId, // The recipient who received the stock
                  transferredPV: totalPV,
                  bonusRate: commissionPercentage,
                  bonusAmount: commissionAmount,
                  stockistLevel: approverLevel,
                  month,
                  year,
                  period,
                  companyId: null
                }
              });
              
              // Also create a commission record with description for Source column
              await prisma.commission.create({
                data: {
                  userId: user.id, // Approver earns commission
                  amount: commissionAmount,
                  type: `Stockist Bonus (${approverLevel})`,
                  description: `Stock Request #${requestId.substring(0, 8)} - ${totalPV} PV to ${recipientUser?.fullName || recipientUser?.memberId || 'member'}`,
                  status: 'Paid',
                  date: new Date(),
                  companyId: null
                }
              });
              
              // Add commission to approver's e-cash balance
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  eCashBalance: {
                    increment: commissionAmount
                  }
                }
              });
              
              // Create E-Cash transaction record with proper source
              await (prisma as any).eCashTransaction.create({
                data: {
                  userId: user.id,
                  type: 'commission',
                  amount: commissionAmount,
                  balance: 0, // Will be calculated from user's eCashBalance
                  description: `Stockist Bonus (${approverLevel}) - Stock transfer to ${recipientUser?.fullName || 'member'}`,
                  source: `Stock Request #${requestId.substring(0, 8)} - ${totalPV} PV transferred`,
                  referenceId: requestId,
                  referenceType: 'stock_request'
                }
              });
              
              logger.info('Stockist bonus commission created', {
                approverId: user.id,
                approverLevel,
                recipientId: recipientUserId,
                recipientLevel,
                totalPV,
                commissionPercentage,
                commissionAmount,
                requestId
              }, request);
            }
          } else {
            logger.info('No stockist bonus - same/higher level transfer or zero rate', {
              approverLevel,
              recipientLevel,
              commissionPercentage
            }, request);
          }
        } catch (commissionError: any) {
          // Log error but don't fail the approval
          logger.error('Failed to create stockist bonus commission', {
            error: commissionError.message,
            stack: commissionError.stack,
            approverId: user.id,
            recipientId: recipientUserId,
            totalPV
          }, request);
        }
      }
      // ========== END STOCKIST BONUS COMMISSION ==========
      
      // If this stock request came from an order, update the order status
      try {
        // Check if stockistName starts with "ORDER:" - this indicates it came from an order
        if (stockRequest.stockistName && stockRequest.stockistName.startsWith('ORDER:')) {
          // Extract orderId from format: "ORDER:ORDER_ID|Customer Name"
          const orderIdMatch = stockRequest.stockistName.match(/^ORDER:([^|]+)/);
          if (orderIdMatch && orderIdMatch[1]) {
            const orderId = orderIdMatch[1];
            
            // First, check if the order exists
            const existingOrder = await prisma.order.findFirst({
              where: {
                orderId: orderId
              },
              select: {
                id: true,
                orderId: true,
                status: true
              }
            });
            
            if (!existingOrder) {
              logger.warn('Order not found for stock request approval', {
                orderId,
                requestId,
                stockistName: stockRequest.stockistName
              }, request);
            } else if (existingOrder.status === 'Pending' || existingOrder.status === 'pending') {
              // Update the order status to "Fulfilled" (case-insensitive check)
              const updatedOrder = await prisma.order.updateMany({
                where: {
                  orderId: orderId,
                  status: {
                    in: ['Pending', 'pending'] // Handle both cases
                  }
                },
                data: {
                  status: 'Fulfilled'
                }
              });
              
              if (updatedOrder.count > 0) {
                logger.info('Order status updated to Fulfilled after stock request approval', {
                  orderId,
                  requestId,
                  oldStatus: existingOrder.status,
                  updatedCount: updatedOrder.count
                }, request);
              } else {
                logger.warn('Order status update failed - no rows updated', {
                  orderId,
                  requestId,
                  currentStatus: existingOrder.status
                }, request);
                
                // Try updating by ID as a fallback
                try {
                  await prisma.order.update({
                    where: { id: existingOrder.id },
                    data: { status: 'Fulfilled' }
                  });
                  logger.info('Order status updated by ID fallback', {
                    orderId,
                    orderDatabaseId: existingOrder.id,
                    requestId
                  }, request);
                } catch (fallbackError: any) {
                  logger.error('Fallback order update by ID also failed', {
                    error: fallbackError.message,
                    orderId,
                    orderDatabaseId: existingOrder.id,
                    requestId
                  }, request);
                }
              }
            } else {
              logger.info('Order already processed - skipping status update', {
                orderId,
                requestId,
                currentStatus: existingOrder.status
              }, request);
            }
          }
        }
      } catch (orderUpdateError: any) {
        // Log but don't fail the approval if order update fails
        logger.error('Failed to update order status after stock request approval', {
          error: orderUpdateError.message,
          stack: orderUpdateError.stack,
          requestId,
          stockistName: stockRequest.stockistName
        }, request);
      }
      
      // Send notification to customer/member about approval (use recipientUserId, not admin's ID)
      try {
        const itemCount = stockRequest.items.reduce((sum: number, item: any) => {
          const quantity = approvedQuantities?.[item.id] || item.requestedQuantity;
          return sum + quantity;
        }, 0);

        await createNotification(
          recipientUserId, // Send to customer/member, not admin
          'stock-request-approved',
          {
            requestId: requestId.substring(0, 8), // Short ID for display
            itemCount: itemCount.toString()
          },
          'high',
          {
            requestId,
            type: 'stock_request_approved',
            stockRequestId: requestId,
            link: '/my-stock' // Navigate to my-stock page when clicked
          }
        );
        
        logger.info('Approval notification sent to customer/member', {
          recipientUserId,
          stockistId: stockRequest.stockistId,
          isOrderBased: stockRequest.stockistName?.startsWith('ORDER:'),
          requestId
        }, request);
      } catch (notifError: any) {
        // Log but don't fail the approval if notification fails
        logger.error('Failed to send approval notification', {
          error: notifError.message,
          stockistId: stockRequest.stockistId,
          requestId
        }, request);
      }
    } else if (status === 'rejected') {
      // Determine recipient for rejection notification (same logic as approval)
      let recipientUserIdForRejection = stockRequest.stockistId; // Default to stockistId
      
      if (stockRequest.stockistName && stockRequest.stockistName.startsWith('ORDER:')) {
        // Extract orderId from format: "ORDER:ORDER_ID|Customer Name"
        const orderIdMatch = stockRequest.stockistName.match(/^ORDER:([^|]+)/);
        if (orderIdMatch && orderIdMatch[1]) {
          const orderId = orderIdMatch[1];
          
          // Find the order to get the actual customer's userId
          const order = await prisma.order.findFirst({
            where: { orderId: orderId },
            select: { userId: true }
          });
          
          if (order) {
            recipientUserIdForRejection = order.userId; // Use the customer's ID, not admin's ID
          }
        }
      }
      
      // Send notification to customer/member about rejection (use recipientUserIdForRejection, not admin's ID)
      try {
        await createNotification(
          recipientUserIdForRejection, // Send to customer/member, not admin
          'stock-request-rejected',
          {
            requestId: requestId.substring(0, 8), // Short ID for display
          },
          'high',
          {
            requestId,
            type: 'stock_request_rejected',
            stockRequestId: requestId,
            link: '/my-stock' // Navigate to my-stock page when clicked
          }
        );
        
        logger.info('Rejection notification sent to customer/member', {
          recipientUserIdForRejection,
          stockistId: stockRequest.stockistId,
          isOrderBased: stockRequest.stockistName?.startsWith('ORDER:'),
          requestId
        }, request);
      } catch (notifError: any) {
        // Log but don't fail the rejection if notification fails
        logger.error('Failed to send rejection notification', {
          error: notifError.message,
          stockistId: stockRequest.stockistId,
          requestId
        }, request);
      }
    }

    // Update stock request
    const updateData: any = {
      status,
      processedBy: user.id,
      processedDate: new Date()
    };

    const updatedStockRequest = await (prisma as any).stockRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true
          }
        }
      }
    });

    // Update approved quantities if provided
    if (approvedQuantities && typeof approvedQuantities === 'object') {
      const itemUpdatePromises = Object.entries(approvedQuantities).map(([itemId, quantity]) =>
        (prisma as any).stockRequestItem.update({
          where: { id: itemId },
          data: { approvedQuantity: quantity }
        })
      );
      await Promise.all(itemUpdatePromises);
    }

    logger.info('Stock request updated', {
      userId: user.id,
      requestId,
      newStatus: status,
      duration: Date.now() - startTime
    }, request);
    
    if (status === 'approved') {
      console.log('✅ ================== STOCK REQUEST APPROVAL COMPLETED ==================');
      console.log('✅ Request ID:', requestId);
      console.log('✅ Duration:', Date.now() - startTime, 'ms');
    }

      return ApiResponseUtil.success(updatedStockRequest, 'Stock request updated successfully');

    } catch (error) {
      logger.error('Stock request update error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: request.headers.get('x-forwarded-for')
      }, request);

      return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return await requireAuth(async (req: AuthenticatedRequest) => {
    const startTime = Date.now();

    try {
      // Apply rate limiting
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 });
      if (!rateLimitResult.success) {
        return rateLimitResult.response!;
      }

      const user = req.user!;
      const { searchParams } = new URL(request.url);
      const requestId = searchParams.get('id');

      if (!requestId) {
        return ApiResponseUtil.validationError([
          { field: 'id', message: 'Request ID is required as query parameter' }
        ]);
      }

      // Check if StockRequest model is available
      if (!(prisma as any).stockRequest) {
        return ApiResponseUtil.serviceUnavailable('Stock request functionality is not yet available');
      }

      // Find the stock request
      const stockRequest = await (prisma as any).stockRequest.findUnique({
        where: { id: requestId },
        include: {
          items: true
        }
      });

      if (!stockRequest) {
        return ApiResponseUtil.notFound('Stock request not found');
      }

      // Check authorization: Only the requester can delete their own request, and only if it's still pending
      if (stockRequest.requesterId !== user.id) {
        return ApiResponseUtil.forbidden('You can only delete your own stock requests');
      }

      if (stockRequest.status !== 'pending') {
        return ApiResponseUtil.validationError([
          { field: 'status', message: 'Only pending requests can be deleted' }
        ]);
      }

      // Delete the stock request (cascade will delete items)
      await (prisma as any).stockRequest.delete({
        where: { id: requestId }
      });

      const duration = Date.now() - startTime;
      logger.info('Stock request deleted', {
        requestId,
        requesterId: user.id,
        duration,
        ip: request.headers.get('x-forwarded-for')
      }, request);

      // Create notification for the requester
      try {
        await createNotification({
          memberId: user.id,
          type: 'stock_request',
          category: 'request_deleted',
          title: 'Stock Request Deleted',
          body: `Your stock request has been successfully deleted.`,
          data: {
            requestId,
            deletedAt: new Date().toISOString()
          },
          priority: 'low'
        });
      } catch (notificationError) {
        logger.warn('Failed to create deletion notification', {
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          requestId
        }, request);
      }

      return ApiResponseUtil.success(
        { requestId, deletedAt: new Date().toISOString() },
        'Stock request deleted successfully'
      );

    } catch (error) {
      logger.error('Stock request deletion error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: request.headers.get('x-forwarded-for')
      }, request);

      return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
    }
  })(request);
}