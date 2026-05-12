import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for inventory API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request and process in handler
    return await requireAuth(async (authenticatedRequest) => {
      const user = authenticatedRequest.user;
      if (!user || !user.id) {
        logger.error('User not found in authenticated request', {
          hasUser: !!user,
          userId: user?.id
        }, request);
        return ApiResponseUtil.unauthorized('User authentication failed');
      }

      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000);
      const offset = parseInt(searchParams.get('offset') || '0');

      // Users can see their own inventory, or their downline's inventory if they're a stockist/admin
      const queriedUserId = searchParams.get('userId');
      let targetUserId = user.id;
      
      if (queriedUserId && queriedUserId !== user.id) {
        // User is requesting another user's inventory
        if (user.isAdmin) {
          // Admins can see anyone's inventory
          targetUserId = queriedUserId;
        } else {
          // Check if the queried user is in the current user's downline (for stockists)
          // Fetch user's storeOwnerLevel from database
          const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { storeOwnerLevel: true }
          });
          const userHasStockistLevel = fullUser?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(fullUser.storeOwnerLevel);
          if (userHasStockistLevel) {
            // Allow stockists to view their downline's inventory
            targetUserId = queriedUserId;
            logger.info('Stockist viewing downline inventory', {
              stockistId: user.id,
              stockistLevel: fullUser.storeOwnerLevel,
              targetUserId: queriedUserId
            }, request);
          } else {
            // Non-stockist, non-admin users can only see their own inventory
            targetUserId = user.id;
            logger.warn('User attempted to view another user\'s inventory without permission', {
              userId: user.id,
              queriedUserId
            }, request);
          }
        }
      }
    
      if (!targetUserId) {
        logger.warn('No target user ID for inventory fetch', {
          userId: user.id,
          queriedUserId
        }, request);
        return ApiResponseUtil.error('User ID is required', 400);
      }

      // Calculate stock from InventoryTransaction records
      // Check if model exists first
      if (!(prisma as any).inventoryTransaction) {
        logger.warn('InventoryTransaction model not available', {
          userId: user.id
        }, request);
        
        return ApiResponseUtil.paginated(
          [],
          0,
          limit,
          offset,
          'Inventory transactions not available'
        );
      }

      // Get all transactions for this user and aggregate by product
      // Process in chronological order (oldest first) to build up stock correctly
      let transactions: any[] = [];
      try {
        transactions = await (prisma as any).inventoryTransaction.findMany({
          where: { userId: targetUserId },
          orderBy: { createdAt: 'asc' } // Oldest first for correct calculation
        });
        
        logger.info('Inventory transactions fetched', {
          userId: user.id,
          targetUserId,
          transactionCount: transactions.length
        }, request);
      } catch (dbError: any) {
        logger.error('Failed to fetch inventory transactions', {
          error: dbError.message,
          stack: dbError.stack,
          targetUserId
        }, request);
        // Return empty array instead of crashing
        transactions = [];
      }

      // Aggregate transactions by productId to get current stock
      const stockMap = new Map<string, { productId: string; quantity: number; lastUpdated: Date | string }>();
      
      for (const transaction of transactions) {
        if (!transaction.productId) {
          logger.warn('Transaction missing productId', { transactionId: transaction.id }, request);
          continue;
        }

        const transactionDate = transaction.createdAt instanceof Date 
          ? transaction.createdAt 
          : new Date(transaction.createdAt);

        const current = stockMap.get(transaction.productId) || { 
          productId: transaction.productId, 
          quantity: 0, 
          lastUpdated: transactionDate 
        };
        
        // Add or subtract based on transaction type
        const quantity = Number(transaction.quantity) || 0;
        if (transaction.type === 'purchase' || transaction.type === 'transfer' || transaction.type === 'return') {
          current.quantity += quantity;
        } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
          current.quantity -= quantity;
        }
        
        // Always update last updated time to the most recent transaction
        const currentDate = current.lastUpdated instanceof Date 
          ? current.lastUpdated 
          : new Date(current.lastUpdated);
        
        if (transactionDate > currentDate) {
          current.lastUpdated = transactionDate;
        }
        
        stockMap.set(transaction.productId, current);
      }

      // Fetch Product details for each productId
      const productIds = Array.from(stockMap.keys());
      let products: any[] = [];
      
      if (productIds.length > 0) {
        try {
          // Fetch products directly - they have the stockist level in names
          products = await prisma.product.findMany({
            where: {
              id: {
                in: productIds
              }
            },
            select: {
              id: true,
              name: true,
              price: true,
              pv: true,
              category: true,
              description: true,
              imageUrl: true,
              qty: true
            }
          });
          
          console.log('🔍 DEBUG: Products fetched for inventory:', products.length);
          products.forEach((product, index) => {
            console.log(`📦 Product ${index + 1}:`, {
              id: product.id,
              name: product.name,
              price: product.price,
              qty: product.qty
            });
          });
        } catch (error) {
          logger.warn('Failed to fetch product details', { error }, request);
        }
      }

      // Create product map for easy lookup
      const productMap = new Map();
      if (products && products.length > 0) {
        products.forEach((product: any) => {
          productMap.set(product.id, product);
        });
      }

      // Convert map to array and format as inventory items
      const inventoryItems = Array.from(stockMap.values()).map(item => {
        const lastUpdated = item.lastUpdated instanceof Date 
          ? item.lastUpdated 
          : new Date(item.lastUpdated);
        
        const product = productMap.get(item.productId);
        
        // Use product information - this has the stockist level in the name
        return {
          id: `stock-${item.productId}`,
          productId: item.productId,
          name: product?.name || 'Unknown Item',
          price: product?.price || 0,
          category: product?.category || null,
          code: product?.description || null,
          quantity: Math.max(0, item.quantity), // Ensure non-negative
          lastUpdated: lastUpdated.toISOString(),
          // Include product information for filtering
          productName: product?.name || 'Unknown Item',
          productPv: product?.pv || 0,
          productCategory: product?.category || null,
          productQty: product?.qty || 0
        };
      });

      const total = inventoryItems.length;

      const duration = Date.now() - startTime;
      logger.info('Inventory fetched', {
        userId: user.id,
        targetUserId,
        count: inventoryItems.length,
        duration
      }, request);
      
      // Debug logging for inventory items
      console.log('🔍 DEBUG: Final inventory items being returned:', inventoryItems.length);
      inventoryItems.forEach((item, index) => {
        console.log(`📦 Inventory Item ${index + 1}:`, {
          productId: item.productId,
          name: item.name,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          hasStockistLevel: /\([SMCD]\)/.test(item.productName || '')
        });
      });

      return ApiResponseUtil.paginated(
        inventoryItems,
        total,
        limit,
        offset,
        API_MESSAGES.FETCHED
      );
    })(request);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to fetch inventory', {
      error: errorMessage,
      stack: errorStack,
      ip: request.headers.get('x-forwarded-for'),
      userId: (request as any).user?.id
    }, request);

    // Return more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return ApiResponseUtil.error(
        `Failed to fetch inventory: ${errorMessage}`,
        500,
        { stack: errorStack }
      );
    }

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await requireAuth(async (authenticatedRequest) => {
      const user = authenticatedRequest.user;
      if (!user || !user.id) {
        return ApiResponseUtil.unauthorized('User authentication failed');
      }

      // Only admins can add inventory
      if (!user.isAdmin) {
        return ApiResponseUtil.forbidden('Only admins can add inventory');
      }

      const body = await request.json();
      const { userId, productId, productName, quantity, price, operation } = body;

      if (!userId || !productId || !quantity) {
        return ApiResponseUtil.error('userId, productId, and quantity are required', 400);
      }

      // Check if InventoryTransaction model exists
      if (!(prisma as any).inventoryTransaction) {
        return ApiResponseUtil.error('Inventory transaction functionality not available', 500);
      }

      // Create inventory transaction
      const transaction = await (prisma as any).inventoryTransaction.create({
        data: {
          userId,
          productId,
          type: 'transfer',
          quantity: parseInt(quantity),
          previousQty: 0,
          newQty: parseInt(quantity),
          reference: `Stock transfer from admin`,
          reason: `Transfer of ${productName || productId}`,
          createdBy: user.id
        }
      });

      logger.info('Inventory added successfully', {
        userId,
        productId,
        quantity,
        transactionId: transaction.id
      }, request);

      // Create stock request record for adminstock transfers
      // This allows both admin and adminstock to see the transaction/invoice
      try {
        // Check if recipient is adminstock (isAdmin OR has stockist level S/M/C/D)
        const recipient = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isAdmin: true,
            storeOwnerLevel: true,
            firstName: true,
            surname: true,
            fullName: true
          }
        });

        if (recipient) {
          const isAdminstock = recipient.isAdmin === true;
          const hasStockistLevel = recipient.storeOwnerLevel && 
            ['S', 'M', 'C', 'D'].includes(recipient.storeOwnerLevel);
          
          // Only create stock request if recipient is adminstock
          if (isAdminstock || hasStockistLevel) {
            // Get admin user info
            const adminInfo = await prisma.user.findUnique({
              where: { id: user.id },
              select: {
                firstName: true,
                surname: true,
                fullName: true
              }
            });

            const adminName = adminInfo?.fullName || 
              `${adminInfo?.firstName || ''} ${adminInfo?.surname || ''}`.trim() || 
              'Admin';

            // Get product/stockItem details for unit price
            // Note: productId might be a StockItem id, not a Product id
            let unitPrice = price || 0;
            let productPV = 0;
            
            // Try to find as Product first
            const product = await prisma.product.findUnique({
              where: { id: productId },
              select: { price: true, pv: true }
            }).catch(() => null);
            
            if (product) {
              unitPrice = price || product.price || 0;
              productPV = product.pv || 0;
            } else {
              // If not found as Product, try as StockItem
              const stockItem = await prisma.stockItem.findUnique({
                where: { id: productId },
                select: { price: true, pv: true }
              }).catch(() => null);
              
              if (stockItem) {
                unitPrice = price || stockItem.price || 0;
                productPV = stockItem.pv || 0;
              }
            }
            
            const totalValue = unitPrice * parseInt(quantity);

            // Create stock request with special format for admin transfers
            // Format: "ADMIN_TRANSFER:Admin Name" - allows identification
            // stockistId = recipient (adminstock) so they see it in their Stock Transfer Requests
            // Admins will also see it because adminstock is in the stockistIds list
            if ((prisma as any).stockRequest) {
              try {
                const stockRequest = await (prisma as any).stockRequest.create({
                  data: {
                    stockistId: userId, // Recipient (adminstock) - so they see it
                    stockistName: `ADMIN_TRANSFER:${adminName}`, // Admin who transferred
                    stockistLevel: recipient.storeOwnerLevel || 'District',
                    status: 'approved', // Mark as approved since it's already transferred
                    processedBy: user.id, // Admin who processed it
                    processedDate: new Date(), // When it was processed
                    totalValue,
                    itemCount: parseInt(quantity),
                    items: {
                      create: [{
                        productId: productId, // Can be Product id or StockItem id
                        productName: productName || 'Unknown Product',
                        requestedQuantity: parseInt(quantity),
                        unitPrice: unitPrice,
                        approvedQuantity: parseInt(quantity) // Already approved/transferred
                      }]
                    }
                  },
                  include: {
                    items: true
                  }
                });

                logger.info('Stock request created for admin transfer', {
                  stockRequestId: stockRequest.id,
                  adminId: user.id,
                  adminstockId: userId,
                  productId,
                  productName,
                  quantity,
                  totalValue,
                  status: 'approved'
                }, request);

                // Send notification to adminstock about the transfer
                try {
                  const { createNotification } = await import('@/services/notification-service');
                  await createNotification(
                    userId,
                    'stock-request-approved',
                    {
                      requestId: stockRequest.id.substring(0, 8),
                      itemCount: quantity.toString()
                    },
                    'high',
                    {
                      requestId: stockRequest.id,
                      type: 'stock_transfer_received',
                      stockRequestId: stockRequest.id,
                      link: '/my-stock'
                    }
                  );
                } catch (notifError) {
                  logger.error('Failed to send notification for admin transfer', {
                    error: notifError instanceof Error ? notifError.message : 'Unknown error',
                    adminstockId: userId
                  }, request);
                }
              } catch (createError: any) {
                // Log detailed error for debugging
                logger.error('Failed to create stock request for admin transfer', {
                  error: createError.message,
                  stack: createError.stack,
                  errorCode: createError.code,
                  adminId: user.id,
                  adminstockId: userId,
                  productId,
                  productName,
                  quantity,
                  totalValue
                }, request);
                // Don't throw - inventory transfer already succeeded
              }
            }
          }
        }
      } catch (stockRequestError) {
        // Log but don't fail the inventory transfer if stock request creation fails
        logger.error('Failed to create stock request for admin transfer', {
          error: stockRequestError instanceof Error ? stockRequestError.message : 'Unknown error',
          userId,
          productId,
          quantity
        }, request);
      }

      return NextResponse.json({
        success: true,
        data: transaction,
        message: 'Inventory added successfully'
      }, { status: 201 });
    })(request);
  } catch (error: any) {
    logger.error('Failed to add inventory', {
      error: error.message,
      stack: error.stack
    }, request);
    return ApiResponseUtil.error('Failed to add inventory');
  }
}