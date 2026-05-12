import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth, authenticateRequest } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import * as inventoryService from '@/services/inventory-service';
import { scheduleCommissionCalculation } from '@/services/commission-queue';
import { parsePaginationParams, calculatePaginationMeta } from '@/lib/pagination-utils';
import { formatCurrency } from '@/lib/utils';

/**
 * Allocate products to customer's account when order is marked as Fulfilled
 * This makes products appear in customer's "My Stock" page
 */
async function allocateProductsToCustomer(
  orderId: string,
  customerId: string,
  orderItems: any[],
  adminUserId: string
): Promise<void> {
  try {
    logger.info('Starting product allocation for fulfilled order', {
      orderId,
      customerId,
      itemCount: orderItems.length,
      items: orderItems.map(item => ({ productId: item.productId, quantity: item.quantity }))
    });

    // Check if InventoryTransaction model exists - try multiple access patterns
    // Prisma generates camelCase model names, so InventoryTransaction becomes inventoryTransaction
    const inventoryTransactionModel = (prisma as any).inventoryTransaction;
    
    if (!inventoryTransactionModel) {
      // Log available Prisma models for debugging
      const availableModels = Object.keys(prisma).filter(key => 
        !key.startsWith('_') && 
        !key.startsWith('$') &&
        typeof (prisma as any)[key] === 'object' &&
        typeof (prisma as any)[key]?.findMany === 'function'
      );
      
      logger.error('CRITICAL: InventoryTransaction model not available for product allocation', {
        orderId,
        customerId,
        availableModels,
        prismaKeys: Object.keys(prisma).filter(key => !key.startsWith('_') && !key.startsWith('$'))
      });
      throw new Error(`InventoryTransaction model not available - cannot allocate products. Available models: ${availableModels.join(', ')}`);
    }

    logger.info('InventoryTransaction model is available', {
      orderId,
      customerId,
      modelType: typeof inventoryTransactionModel,
      hasCreate: typeof inventoryTransactionModel.create === 'function',
      hasFindMany: typeof inventoryTransactionModel.findMany === 'function'
    });

    // Get user record for logging purposes
    // All account types (Customer, Distributor, Stockist) now get products via Fulfilled status
    const customerRecord = await prisma.user.findUnique({
      where: { id: customerId },
      select: { isAdmin: true, storeOwnerLevel: true, accountType: true, companyId: true }
    });

    if (!customerRecord) {
      logger.warn('User record not found for product allocation', {
        orderId,
        customerId
      });
      return;
    }
    
    logger.info('Processing product allocation for all account types', {
      orderId,
      customerId,
      accountType: customerRecord.accountType,
      isAdmin: customerRecord.isAdmin,
      storeOwnerLevel: customerRecord.storeOwnerLevel
    });

    logger.info('Processing items for allocation', {
      orderId,
      customerId,
      itemCount: orderItems.length
    });

    for (const item of orderItems) {
      try {
        logger.info('Processing item for allocation', {
          orderId,
          customerId,
          productId: item.productId,
          quantity: item.quantity
        });

        // Check if products were already allocated for this order
        const existingAllocation = await inventoryTransactionModel.findFirst({
          where: { 
            userId: customerId,
            productId: item.productId,
            reference: `Order ${orderId}`
          }
        }).catch((error: any) => {
          logger.error('Error checking existing allocation', {
            orderId,
            customerId,
            productId: item.productId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          return null;
        });

        // Skip if already allocated (to prevent duplicates)
        if (existingAllocation) {
          logger.info('Products already allocated for order, skipping duplicate allocation', {
            orderId,
            customerId,
            productId: item.productId
          });
          continue;
        }

        // Get product name for logging
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true }
        }).catch(() => null);
        
        const productName = product?.name || item.productId;

        // Get customer's current inventory for this product
        const existingTransactions = await inventoryTransactionModel.findMany({
          where: { 
            userId: customerId,
            productId: item.productId
          },
          orderBy: { createdAt: 'asc' }
        }).catch((error: any) => {
          logger.error('Error fetching existing transactions', {
            orderId,
            customerId,
            productId: item.productId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return [];
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

        // Create inventory transaction for the customer
        // This makes products appear in customer's "My Stock" page
        const transactionData = {
          userId: customerId,
          productId: item.productId,
          type: 'purchase',
          quantity: item.quantity,
          previousQty: currentStock,
          newQty: currentStock + item.quantity,
          reference: `Order ${orderId}`,
          reason: `Order ${orderId} fulfilled - ${item.quantity} units of ${productName}`,
          createdBy: adminUserId,
          ...(customerRecord.companyId && { companyId: customerRecord.companyId })
        };

        logger.info('Creating inventory transaction', {
          orderId,
          customerId,
          productId: item.productId,
          transactionData
        });

        let createdTransaction;
        try {
          createdTransaction = await inventoryTransactionModel.create({
            data: transactionData
          });
          logger.info('Inventory transaction CREATE call succeeded', {
            orderId,
            customerId,
            productId: item.productId,
            transactionId: createdTransaction?.id,
            quantity: transactionData.quantity,
            type: transactionData.type
          });
        } catch (createError) {
          logger.error('CRITICAL: Failed to create inventory transaction', {
            orderId,
            customerId,
            productId: item.productId,
            error: createError instanceof Error ? createError.message : 'Unknown error',
            stack: createError instanceof Error ? createError.stack : undefined,
            transactionData,
            errorCode: (createError as any)?.code,
            errorMeta: (createError as any)?.meta
          });
          throw createError; // Re-throw to be caught by outer try-catch
        }

        // Verify the transaction was created by querying it back
        // Note: inventoryTransactionModel is already declared at the top of the function
        const verifyTransaction = await inventoryTransactionModel.findUnique({
          where: { id: createdTransaction.id }
        }).catch(() => null);

        // Also verify by querying all transactions for this user/product
        const allTransactions = await inventoryTransactionModel.findMany({
          where: { 
            userId: customerId,
            productId: item.productId
          }
        }).catch(() => []);

        const totalQuantity = allTransactions.reduce((sum: number, tx: any) => {
          const qty = Number(tx.quantity) || 0;
          if (tx.type === 'purchase' || tx.type === 'transfer' || tx.type === 'return') {
            return sum + qty;
          } else if (tx.type === 'sale' || tx.type === 'adjustment') {
            return sum - qty;
          }
          return sum;
        }, 0);

        if (!verifyTransaction) {
          logger.error('CRITICAL: Transaction created but cannot be verified!', {
            orderId,
            customerId,
            productId: item.productId,
            transactionId: createdTransaction?.id
          });
        } else {
          logger.info('Transaction verified and total quantity calculated', {
            orderId,
            customerId,
            productId: item.productId,
            transactionId: createdTransaction.id,
            totalTransactions: allTransactions.length,
            totalQuantity: Math.max(0, totalQuantity),
            allTransactionTypes: allTransactions.map((tx: any) => ({
              type: tx.type,
              quantity: tx.quantity,
              reference: tx.reference
            }))
          });
        }

        logger.info('Inventory transaction created successfully for fulfilled order', {
          orderId,
          customerId,
          productId: item.productId,
          productName,
          quantity: item.quantity,
          previousQty: currentStock,
          newQty: currentStock + item.quantity,
          transactionId: createdTransaction?.id,
          companyId: customerRecord.companyId,
          verified: !!verifyTransaction,
          // Log the actual transaction data for debugging
          transactionData: {
            userId: transactionData.userId,
            productId: transactionData.productId,
            type: transactionData.type,
            quantity: transactionData.quantity
          }
        });
      } catch (itemError) {
        logger.error('Failed to allocate product item', {
          orderId,
          customerId,
          productId: item.productId,
          error: itemError instanceof Error ? itemError.message : 'Unknown error'
        });
        // Continue with other items even if one fails
      }
    }
  } catch (error) {
    logger.error('Failed to allocate products to customer', {
      orderId,
      customerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 20 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for order creation', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request and extract user
    let user;
    try {
      const authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Authentication required';
      return NextResponse.json(
        { error: 'Unauthorized', message, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found in token', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Failed to parse request body', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error'
      });
      return ApiResponseUtil.validationError([{
        field: 'body',
        message: 'Invalid request body. Please check your request format.'
      }]);
    }
    
    const { items, totalAmount, companyId, idempotencyKey, stockistId } = body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ApiResponseUtil.validationError([{
        field: 'items',
        message: 'Order must contain at least one item'
      }]);
    }

    // IDEMPOTENCY FIX: Check if order with this key already exists (prevents duplicate orders)
    // NOTE: This requires database migration to add idempotencyKey field
    if (idempotencyKey) {
      try {
        const existingOrder = await prisma.order.findFirst({
          where: {
            // @ts-ignore - idempotencyKey field needs migration
            idempotencyKey: idempotencyKey
          },
          include: { items: true }
        });

        if (existingOrder) {
          logger.info('Duplicate order request detected (idempotency)', {
            userId: user.id,
            orderId: existingOrder.orderId,
            idempotencyKey
          });

          // Calculate PV from items (fix TypeScript error)
          // @ts-ignore - items relation needs proper typing
          const pvAdded = existingOrder.items?.reduce((sum: number, item: any) => sum + (item.pv * item.quantity), 0) || 0;

          // Return existing order instead of creating duplicate
          return ApiResponseUtil.success({
            order: existingOrder,
            pvAdded,
            commissionsTriggered: false,
            duplicate: true
          }, 'Order already exists (returned existing order)');
        }
      } catch (error) {
        // If idempotencyKey field doesn't exist yet, continue with order creation
        logger.warn('Idempotency check failed - field may not exist yet:', { error: String(error) });
      }
    }

    // Validate and calculate totals
    let calculatedTotal = 0;
    let totalPV = 0;
    const validatedItems: any[] = [];

    // CRITICAL FIX: Validate products and reserve stock BEFORE creating order
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: 'Each item must have productId and positive quantity'
        }]);
      }

      // Verify product exists and get details
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: `Product ${item.productId} not found`
        }]);
      }

      if (!product.isActive) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: `Product ${product.name} is not available`
        }]);
      }

      // Ensure product has a valid price
      const productPrice = typeof product.price === 'number' && isFinite(product.price)
        ? product.price
        : 0;

      if (productPrice <= 0) {
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: `Product ${product.name} has invalid price.`
        }]);
      }

      calculatedTotal += productPrice * item.quantity;
      // FIX: Handle null/undefined PV values - default to 0 if not set
      const productPV = product.pv ?? 0;
      totalPV += productPV * item.quantity;
      
      // Store validated item data
      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: productPrice,
        pv: productPV,
        name: product.name
      });
    }

    // Calculate shipping and tax - both are now 0 (hidden from cart)
    const subtotal = calculatedTotal;
    const shipping = 0;
    const tax = 0;
    const calculatedTotalWithFees = subtotal + shipping + tax;

    // Validate total matches (now includes shipping and tax)
    // Allow small rounding differences (0.01 tolerance)
    if (totalAmount && Math.abs(calculatedTotalWithFees - totalAmount) > 0.01) {
      logger.warn('Total amount mismatch', {
        calculated: calculatedTotalWithFees,
        received: totalAmount,
        difference: Math.abs(calculatedTotalWithFees - totalAmount),
        subtotal,
        shipping,
        tax
      });
      
      // In development, show detailed error. In production, be more lenient
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        return ApiResponseUtil.validationError([{
          field: 'totalAmount',
          message: `Total amount mismatch. Expected: ${calculatedTotalWithFees.toFixed(2)} (subtotal: ${subtotal.toFixed(2)}, shipping: ${shipping.toFixed(2)}, tax: ${tax.toFixed(2)}), Received: ${totalAmount}`
        }]);
      } else {
        // In production, use the calculated total instead of rejecting
        logger.info('Using calculated total instead of provided total', {
          calculated: calculatedTotalWithFees,
          provided: totalAmount
        });
      }
    }

    // Check E-Cash balance before processing order
    // Use the SAME calculation as dashboard API to ensure consistency
    // Get all commissions (paid) for the user - use the SAME filtering logic as dashboard
    const allCommissions = await prisma.commission.findMany({
      where: {
        userId: user.id,
        status: 'Paid',
        NOT: {
          type: {
            in: ['PV Top-up Request', 'E-Cash Topup', 'E-Comm Topup', 'PV Topup']
          }
        }
      },
      select: {
        id: true,
        type: true,
        amount: true,
        status: true
      }
    });

    // Filter commissions - include earnings AND purchases (same as dashboard)
    const allowedCommissionTypes = [
      'Binary Bonus',
      'Matching Bonus',
      'Daily Match',
      'E-Cash Purchase', // Include purchases (negative amounts)
    ];

    const commissions = allCommissions.filter(c => {
      // Always include E-Cash Purchase (negative amounts for purchases)
      if (c.type === 'E-Cash Purchase') {
        return true;
      }
      
      // Reject generic "Stockist Bonus" without level indicator
      if (c.type === 'Stockist Bonus') {
        return false;
      }
      
      // Accept "Stockist Bonus (S)", "Stockist Bonus (M)", etc.
      if (c.type && c.type.includes('Stockist Bonus')) {
        return /Stockist Bonus\s*\([SMDC]\)/i.test(c.type);
      }
      
      // Accept other allowed commission types
      return allowedCommissionTypes.includes(c.type) || 
             (c.type && c.type.startsWith('Matching Bonus'));
    });

    // Calculate balance from filtered commissions (same as dashboard)
    const commissionBalance = commissions.reduce((sum, c) => sum + c.amount, 0);
    
    // Also add non-commission E-Cash transactions (transfers from E-Comm)
    const eCashTransactions = await (prisma as any).eCashTransaction.findMany({
      where: { 
        userId: user.id,
        type: {
          not: 'commission'
        }
      }
    }).catch(() => []);

    const transferBalance = (eCashTransactions || []).reduce((sum: number, tx: any) => {
      // Only count transfers (positive amounts) - withdrawals are negative
      if (tx.type === 'transfer' && tx.amountUsd > 0) {
        return sum + (Number(tx.amountUsd) || 0);
      }
      return sum;
    }, 0);

    const ecashBalance = commissionBalance + transferBalance;
    const finalTotal = totalAmount && Math.abs(calculatedTotalWithFees - totalAmount) <= 0.01 
      ? totalAmount 
      : calculatedTotalWithFees;
    
    if (ecashBalance < finalTotal) {
      return ApiResponseUtil.validationError([{
        field: 'totalAmount',
        message: `Insufficient E-Cash balance. Available: $${ecashBalance.toFixed(2)}, Required: $${finalTotal.toFixed(2)}`
      }]);
    }

// Generate order ID
    const orderId = `ORD-${Date.now()}-${user.id.slice(-6)}`;

    let order;
    let sellerRecipient: { id: string; name: string; type: 'adminStock' | 'admin'; storeOwnerLevel?: string | null } | null = null;

    try {
      // CRITICAL FIX: All stock reservation, order creation, and e-cash transfer in ONE transaction
      // This prevents overselling in concurrent scenarios and ensures data integrity
      const transactionResult = await prisma.$transaction(async (tx) => {
        // Step 1: Reserve stock atomically within the transaction
        // Use SELECT FOR UPDATE semantics via Prisma's transaction to lock product rows
        for (const item of validatedItems) {
          // Lock the product row to prevent concurrent modifications
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, qty: true, name: true }
          });

          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }

          if (product.qty < item.quantity) {
            // Release any previously reserved stock in this transaction before throwing
            for (const prevItem of validatedItems.slice(0, validatedItems.indexOf(item))) {
              await tx.product.update({
                where: { id: prevItem.productId },
                data: { qty: { increment: prevItem.quantity } }
              });
            }
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.qty}, Requested: ${item.quantity}`);
          }

          // Reserve stock by decrementing quantity immediately
          await tx.product.update({
            where: { id: item.productId },
            data: { qty: { decrement: item.quantity } }
          });

          // Record inventory transaction for the reservation
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              userId: user.id,
              type: 'sale',
              quantity: item.quantity,
              previousQty: product.qty,
              newQty: product.qty - item.quantity,
              reference: orderId,
              reason: `Order ${orderId} - Stock reserved`,
              createdBy: user.id,
              ...(companyId && { companyId })
            }
          });

          // If there's an AdminStock seller, also deduct from their inventory
          if (sellerInfo && sellerInfo.type === 'adminStock') {
            // Find or create inventory transaction for AdminStock
            let adminStockWallet = await tx.wallet.findUnique({
              where: { userId: sellerInfo.id }
            });

            if (!adminStockWallet) {
              adminStockWallet = await tx.wallet.create({
                data: {
                  userId: sellerInfo.id,
                  balance: 0,
                  currency: 'USD',
                  isActive: true
                }
              });
            }

            // Create stock_transfer debit transaction for the PV
            if (item.pv > 0) {
              const currentBalance = adminStockWallet.balance || 0;
              await tx.walletTransaction.create({
                data: {
                  walletId: adminStockWallet.id,
                  type: 'debit',
                  amount: -(item.pv * item.quantity),
                  balanceBefore: currentBalance,
                  balanceAfter: currentBalance, // Wallet balance unchanged, only PV
                  description: `Stock reserved for Order ${orderId} - ${item.quantity} units of ${item.productId}`,
                  referenceId: orderId,
                  referenceType: 'stock_transfer',
                  status: 'completed',
                  createdAt: new Date()
                }
              });
            }
          }
        }

        // Step 2: Create order with idempotency key
        const newOrder = await tx.order.create({
          data: {
            orderId,
            userId: user.id,
            status: 'Pending',
            itemCount: validatedItems.length,
            amount: calculatedTotal,
            totalAmount: totalAmount && Math.abs(calculatedTotalWithFees - totalAmount) <= 0.01 
              ? totalAmount 
              : calculatedTotalWithFees,
            companyId: companyId || null,
            idempotencyKey: idempotencyKey || null,
            items: {
              create: validatedItems.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                pv: item.pv
              }))
            }
          },
          include: {
            items: true
          }
        });

        // Step 3: Get current E-Cash balance and process payment
        const finalOrderTotal = totalAmount && Math.abs(calculatedTotalWithFees - totalAmount) <= 0.01 
          ? totalAmount 
          : calculatedTotalWithFees;

        // Create E-Cash Purchase commission (negative amount to deduct from balance)
        await tx.commission.create({
          data: {
            userId: user.id,
            date: new Date(),
            type: 'E-Cash Purchase',
            description: `Order ${orderId} - Product purchase`,
            status: 'Paid',
            amount: -finalOrderTotal,
            companyId: companyId || null
          }
        });

        // Also update eCashBalance field if it exists
        try {
          await tx.user.update({
            where: { id: user.id },
            data: {
              eCashBalance: {
                decrement: finalOrderTotal
              }
            } as any
          });
        } catch (error) {
          logger.debug('Could not update eCashBalance field (may not exist)', { error: String(error) });
        }

        // Step 4: Transfer e-cash to Admin Stock or Admin (seller)
        if (sellerInfo) {
          const commissionType = sellerInfo.type === 'adminStock' 
            ? `E-Cash from Order ${orderId} (Admin Stock)` 
            : `E-Cash from Order ${orderId} (Admin)`;
          
          const commission = await tx.commission.create({
            data: {
              userId: sellerInfo.id,
              date: new Date(),
              type: commissionType,
              description: `Order ${orderId} - E-cash received from buyer ${user.id}`,
              status: 'Paid',
              amount: finalOrderTotal,
              companyId: companyId || null
            }
          });

          try {
            await tx.user.update({
              where: { id: sellerInfo.id },
              data: {
                eCashBalance: {
                  increment: finalOrderTotal
                }
              } as any
            });
          } catch (error) {
            logger.debug('Could not update seller eCashBalance field (may not exist)', { error: String(error) });
          }
        }

        // Step 5: Handle PV wallet transactions
        if (totalPV > 0) {
          let wallet = await tx.wallet.findUnique({
            where: { userId: user.id }
          });

          if (!wallet) {
            wallet = await tx.wallet.create({
              data: {
                userId: user.id,
                balance: 0,
                currency: 'USD',
                isActive: true
              }
            });
          }

          const currentWalletBalance = wallet.balance || 0;

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount: totalPV,
              balanceBefore: currentWalletBalance,
              balanceAfter: currentWalletBalance,
              description: `Product Purchase: Order ${orderId}`,
              referenceId: orderId,
              referenceType: 'product_purchase',
              status: 'completed',
              createdAt: new Date()
            }
          });

          // Deduct PV from AdminStock if applicable
          if (sellerInfo && sellerInfo.type === 'adminStock' && totalPV > 0) {
            let adminStockWallet = await tx.wallet.findUnique({
              where: { userId: sellerInfo.id }
            });

            if (!adminStockWallet) {
              adminStockWallet = await tx.wallet.create({
                data: {
                  userId: sellerInfo.id,
                  balance: 0,
                  currency: 'USD',
                  isActive: true
                }
              });
            }

            const adminStockWalletBalance = adminStockWallet.balance || 0;

            await tx.walletTransaction.create({
              data: {
                walletId: adminStockWallet.id,
                type: 'debit',
                amount: -totalPV,
                balanceBefore: adminStockWalletBalance,
                balanceAfter: adminStockWalletBalance,
                description: `PV/Stock Deduction: Member order ${orderId}`,
                referenceId: orderId,
                referenceType: 'stock_transfer',
                status: 'completed',
                createdAt: new Date(),
              }
            });

            // Calculate and add commission to AdminStock
            if (sellerInfo.storeOwnerLevel && totalPV > 0) {
              const commissionRates: Record<string, number> = {
                'S': 0.008,
                'M': 0.017,
                'C': 0.026,
                'D': 0.03
              };

              const commissionRate = commissionRates[sellerInfo.storeOwnerLevel] || 0;
              const commissionAmount = totalPV * commissionRate;

              if (commissionAmount > 0) {
                const memberInfo = await tx.user.findUnique({
                  where: { id: user.id },
                  select: { fullName: true, memberId: true, storeOwnerLevel: true }
                }).catch(() => null);

                const memberName = memberInfo?.fullName || memberInfo?.memberId || 'member';
                const memberLevelText = memberInfo?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(memberInfo.storeOwnerLevel)
                  ? ` (${memberInfo.storeOwnerLevel})`
                  : ' (Regular User)';
                
                const commissionType = `Stockist Bonus (${sellerInfo.storeOwnerLevel})`;
                const description = `Stock Order: ${totalPV} PV to ${memberName}${memberLevelText} - Base Commission (${sellerInfo.storeOwnerLevel} level - ${(commissionRate * 100).toFixed(1)}%)`;

                await tx.commission.create({
                  data: {
                    userId: sellerInfo.id,
                    date: new Date(),
                    type: commissionType,
                    description,
                    status: 'Paid',
                    amount: commissionAmount,
                    companyId: companyId || null
                  }
                });

                try {
                  await tx.user.update({
                    where: { id: sellerInfo.id },
                    data: {
                      eCashBalance: {
                        increment: commissionAmount
                      }
                    } as any
                  });
                } catch (error) {
                  logger.debug('Could not update AdminStock eCashBalance field for commission (may not exist)', { error: String(error) });
                }
              }
            }
          }
        }

        // Step 6: Update order status
        const updatedOrder = await tx.order.update({
          where: { id: newOrder.id },
          data: { status: 'Pending' },
          include: { items: true }
        });

        return { order: updatedOrder, sellerInfo };
      }, {
        isolationLevel: 'Serializable', // CRITICAL: Prevents concurrent stock modifications
        maxWait: 10000,
        timeout: 30000
      });
      
      // Extract order and seller info from transaction result
      order = transactionResult.order;
      sellerRecipient = transactionResult.sellerInfo;
    } catch (txError) {
      // If transaction fails, all changes are automatically rolled back
      // No need to manually release stock - the transaction handles it
      logger.error('Transaction failed, all changes rolled back', {
        error: txError instanceof Error ? txError.message : 'Unknown error',
        orderId,
        userId: user.id
      });
      
      // Re-throw the transaction error to be caught by outer catch
      throw txError;
    }
        }
        
        const product = validatedItems.find(v => v.productId === item.productId);
        return ApiResponseUtil.validationError([{
          field: 'items',
          message: `Unable to reserve ${product?.name}. Product may have been sold. Please try again.`
        }]);
      }
    }

    logger.info('Stock reserved for order', {
      orderId,
      itemCount: validatedItems.length,
      userId: user.id
    });

    // Create order and update PV in transaction
    // Note: Stock already reserved above, so inventory is already updated
    let order;
    let sellerRecipient: { id: string; name: string; type: 'adminStock' | 'admin'; storeOwnerLevel?: string | null } | null = null;
    try {
      const transactionResult = await prisma.$transaction(async (tx) => {
        // Create order with idempotency key
        const newOrder = await tx.order.create({
        data: {
          orderId,
          userId: user.id,
          status: 'Pending',
          itemCount: validatedItems.length,
          amount: calculatedTotal,
          totalAmount: totalAmount && Math.abs(calculatedTotalWithFees - totalAmount) <= 0.01 
            ? totalAmount 
            : calculatedTotalWithFees, // Use provided total if close enough, otherwise use calculated
          companyId: companyId || null,
          idempotencyKey: idempotencyKey || null, // Store for duplicate detection
            items: {
              create: validatedItems.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                pv: item.pv
              }))
            }
          },
          include: {
            items: true
          }
        });

        // Stock already reserved by inventoryService.reserveStock() above
        // No need to update product quantities here

        // Get current E-Cash balance before deduction
        const userCommissionsBefore = await tx.commission.findMany({
          where: { userId: user.id }
        });
        const balanceBefore = userCommissionsBefore.reduce((acc, curr) => acc + curr.amount, 0);
        const finalOrderTotal = totalAmount && Math.abs(calculatedTotalWithFees - totalAmount) <= 0.01 
          ? totalAmount 
          : calculatedTotalWithFees;

        // Create E-Cash Purchase commission (negative amount to deduct from balance)
        await tx.commission.create({
          data: {
            userId: user.id,
            date: new Date(),
            type: 'E-Cash Purchase',
            description: `Order ${orderId} - Product purchase`,
            status: 'Paid',
            amount: -finalOrderTotal, // Negative amount to deduct from E-Cash balance
            companyId: companyId || null
          }
        });

        // Also update eCashBalance field if it exists
        try {
          await tx.user.update({
            where: { id: user.id },
            data: {
              eCashBalance: {
                decrement: finalOrderTotal
              }
            } as any
          });
        } catch (error) {
          // If eCashBalance field doesn't exist, log and continue (balance calculated from commissions)
          logger.debug('Could not update eCashBalance field (may not exist)', { error: String(error) });
        }

        // Transfer e-cash to Admin Stock or Admin (seller)
        // Priority: Use stockistId from order if provided > Find Admin Stock > Admin
        let sellerInfo: { id: string; name: string; type: 'adminStock' | 'admin'; storeOwnerLevel?: string | null } | null = null;
        
        try {
          // If stockistId is provided in the order, use that stockist
          if (stockistId) {
            const specifiedStockist = await tx.user.findUnique({
              where: { id: stockistId },
              select: {
                id: true,
                fullName: true,
                firstName: true,
                surname: true,
                storeOwnerLevel: true,
                isAdmin: true,
                active: true,
                deleted: true
              }
            });

            if (specifiedStockist && !specifiedStockist.deleted && specifiedStockist.active) {
              // Check if it's an Admin Stock (has storeOwnerLevel) or Admin
              if (specifiedStockist.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(specifiedStockist.storeOwnerLevel)) {
                sellerInfo = {
                  id: specifiedStockist.id,
                  name: specifiedStockist.fullName || `${specifiedStockist.firstName || ''} ${specifiedStockist.surname || ''}`.trim() || 'Admin Stock',
                  type: 'adminStock',
                  storeOwnerLevel: specifiedStockist.storeOwnerLevel
                };
                logger.info('Found AdminStock seller from stockistId', {
                  stockistId,
                  sellerId: sellerInfo.id,
                  sellerName: sellerInfo.name,
                  storeOwnerLevel: specifiedStockist.storeOwnerLevel
                });
              } else if (specifiedStockist.isAdmin) {
                sellerInfo = {
                  id: specifiedStockist.id,
                  name: specifiedStockist.fullName || `${specifiedStockist.firstName || ''} ${specifiedStockist.surname || ''}`.trim() || 'Admin',
                  type: 'admin'
                };
                logger.info('Found Admin seller from stockistId', {
                  stockistId,
                  sellerId: sellerInfo.id,
                  sellerName: sellerInfo.name
                });
              } else {
                logger.warn('Specified stockist is not AdminStock or Admin', {
                  stockistId,
                  storeOwnerLevel: specifiedStockist.storeOwnerLevel,
                  isAdmin: specifiedStockist.isAdmin
                });
              }
            } else {
              logger.warn('Specified stockist not found or inactive', {
                stockistId,
                found: !!specifiedStockist,
                active: specifiedStockist?.active,
                deleted: specifiedStockist?.deleted
              });
            }
          }

          // If no stockistId provided or specified stockist not found, default to Admin (for "Ship to Address")
          // When "Ship to Address" is selected, order should go to Admin, not Admin Stock
          if (!sellerInfo) {
            // For "Ship to Address" orders (no stockistId), default to Admin user
            const adminUser = await tx.user.findFirst({
              where: {
                isAdmin: true,
                active: true,
                deleted: false,
                companyId: companyId || undefined
              },
              select: {
                id: true,
                fullName: true,
                firstName: true,
                surname: true
              },
              orderBy: {
                createdAt: 'asc' // Get the first/oldest Admin user
              }
            });

            if (adminUser) {
              sellerInfo = {
                id: adminUser.id,
                name: adminUser.fullName || `${adminUser.firstName || ''} ${adminUser.surname || ''}`.trim() || 'Admin',
                type: 'admin'
              };
              logger.info('Defaulting to Admin for "Ship to Address" order', {
                adminId: sellerInfo.id,
                adminName: sellerInfo.name,
                orderId
              });
            } else {
              // Fallback: If no Admin found, try Admin Stock as last resort
              const adminStockUser = await tx.user.findFirst({
                where: {
                  storeOwnerLevel: { in: ['S', 'M', 'C', 'D'] },
                  active: true,
                  deleted: false,
                  companyId: companyId || undefined
                },
                select: {
                  id: true,
                  fullName: true,
                  firstName: true,
                  surname: true,
                  storeOwnerLevel: true
                },
                orderBy: {
                  createdAt: 'asc'
                }
              });

              if (adminStockUser) {
                sellerInfo = {
                  id: adminStockUser.id,
                  name: adminStockUser.fullName || `${adminStockUser.firstName || ''} ${adminStockUser.surname || ''}`.trim() || 'Admin Stock',
                  type: 'adminStock',
                  storeOwnerLevel: adminStockUser.storeOwnerLevel
                };
                logger.warn('No Admin found, falling back to Admin Stock', {
                  adminStockId: sellerInfo.id,
                  orderId
                });
              }
            }
          }

          // Transfer e-cash to seller (Admin Stock or Admin)
          if (sellerInfo) {
            // Credit the seller with the order amount
            const commissionType = sellerInfo.type === 'adminStock' 
              ? `E-Cash from Order ${orderId} (Admin Stock)` 
              : `E-Cash from Order ${orderId} (Admin)`;
            
            const commission = await tx.commission.create({
              data: {
                userId: sellerInfo.id,
                date: new Date(),
                type: commissionType,
                description: `Order ${orderId} - E-cash received from buyer ${user.id}`,
                status: 'Paid',
                amount: finalOrderTotal, // Positive amount to add to seller's E-Cash balance
                companyId: companyId || null
              }
            });

            logger.info('Commission created for seller', {
              commissionId: commission.id,
              sellerId: sellerInfo.id,
              sellerName: sellerInfo.name,
              sellerType: sellerInfo.type,
              commissionType,
              amount: finalOrderTotal,
              orderId
            });

            // Also update seller's eCashBalance field if it exists
            try {
              await tx.user.update({
                where: { id: sellerInfo.id },
                data: {
                  eCashBalance: {
                    increment: finalOrderTotal
                  }
                } as any
              });
            } catch (error) {
              // If eCashBalance field doesn't exist, log and continue
              logger.debug('Could not update seller eCashBalance field (may not exist)', { error: String(error) });
            }

            logger.info('E-cash transferred to seller', {
              orderId,
              buyerId: user.id,
              sellerId: sellerInfo.id,
              sellerType: sellerInfo.type,
              amount: finalOrderTotal
            });
          } else {
            logger.warn('No Admin Stock or Admin user found to receive e-cash', {
              orderId,
              companyId
            });
          }
        } catch (transferError) {
          // Log error but don't fail the order - e-cash transfer can be handled separately
          logger.error('Failed to transfer e-cash to seller', {
            orderId,
            error: transferError instanceof Error ? transferError.message : 'Unknown error',
            stack: transferError instanceof Error ? transferError.stack : undefined
          });
        }

        // Update order status to 'Pending' after E-Cash payment is confirmed
        // Products will be allocated when admin marks order as 'Fulfilled'
        const updatedOrder = await tx.order.update({
          where: { id: newOrder.id },
          data: { status: 'Pending' },
          include: {
            items: true
          }
        });

        // Add PV to wallet transaction history (for PV Points Wallet display)
        // NOTE: We do NOT update user.pv here - that only happens when user clicks "Top-Up Rank"
        // This ensures rank only upgrades when explicitly requested via the top-up button
        if (totalPV > 0) {
          try {
            // Get or create wallet for the user
            let wallet = await tx.wallet.findUnique({
              where: { userId: user.id }
            });

            if (!wallet) {
              wallet = await tx.wallet.create({
                data: {
                  userId: user.id,
                  balance: 0,
                  currency: 'USD',
                  isActive: true
                }
              });
            }

            // Get current wallet balance for transaction record
            const currentWalletBalance = wallet.balance || 0;

            // Create wallet transaction showing PV credit
            // This will show up in PV Points Wallet as "PV from Product Purchases"
            // The PV will remain here until user explicitly clicks "Top-Up Rank" button
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'credit',
                amount: totalPV, // Positive amount to show as credit
                balanceBefore: currentWalletBalance,
                balanceAfter: currentWalletBalance, // Wallet balance unchanged (PV is not in user.pv yet)
                description: `Product Purchase: Order ${orderId}`,
                referenceId: orderId,
                referenceType: 'product_purchase', // This is what PV Points Wallet filters by
                status: 'completed',
                createdAt: new Date()
              }
            });

            logger.info('PV added to wallet transaction history (awaiting rank top-up)', {
              userId: user.id,
              orderId,
              pv: totalPV,
              note: 'PV will be added to user.pv only when user clicks Top-Up Rank button'
            });

            // Deduct PV from AdminStock's PV/Stock when member receives PV/Product
            // The PV/Product member receives comes from AdminStock's PV/Stock
            if (sellerInfo && sellerInfo.type === 'adminStock' && totalPV > 0) {
              try {
                // Get or create wallet for AdminStock
                let adminStockWallet = await tx.wallet.findUnique({
                  where: { userId: sellerInfo.id }
                });

                if (!adminStockWallet) {
                  adminStockWallet = await tx.wallet.create({
                    data: {
                      userId: sellerInfo.id,
                      balance: 0,
                      currency: 'USD',
                      isActive: true
                    }
                  });
                }

                const adminStockWalletBalance = adminStockWallet.balance || 0;

                // Create stock_transfer debit transaction to deduct from AdminStock's PV/Stock
                // This PV is being transferred to the member as PV/Product
                await tx.walletTransaction.create({
                  data: {
                    walletId: adminStockWallet.id,
                    type: 'debit',
                    amount: -totalPV, // Negative amount to deduct from PV/Stock
                    balanceBefore: adminStockWalletBalance,
                    balanceAfter: adminStockWalletBalance, // Wallet balance unchanged, only PV/Stock changes
                    description: `PV/Stock Deduction: Member order ${orderId} - ${totalPV} PV transferred to member as PV/Product`,
                    referenceId: orderId,
                    referenceType: 'stock_transfer', // This makes it show in PV/Stock calculation
                    status: 'completed',
                    createdAt: new Date(),
                  }
                });

                logger.info('AdminStock PV/Stock deducted for member order', {
                  adminStockId: sellerInfo.id,
                  adminStockName: sellerInfo.name,
                  memberId: user.id,
                  orderId,
                  pvDeducted: totalPV,
                  note: 'PV transferred from AdminStock PV/Stock to member PV/Product'
                });

                // Calculate and add commission to AdminStock based on stock level
                // Commission = (PV deducted from AdminStock's PV/Stock) * Commission Rate
                // Commission rates: S = 0.8%, M = 1.7%, C = 2.6%, D = 3%
                if (sellerInfo.storeOwnerLevel && totalPV > 0) {
                  const commissionRates: Record<string, number> = {
                    'S': 0.008,  // 0.8%
                    'M': 0.017,  // 1.7%
                    'C': 0.026,  // 2.6%
                    'D': 0.03    // 3%
                  };

                  const commissionRate = commissionRates[sellerInfo.storeOwnerLevel] || 0;
                  const commissionAmount = totalPV * commissionRate;

                  if (commissionAmount > 0) {
                    // Get member info for description
                    const memberInfo = await tx.user.findUnique({
                      where: { id: user.id },
                      select: { fullName: true, memberId: true, accountType: true, storeOwnerLevel: true }
                    }).catch(() => null);

                    const memberName = memberInfo?.fullName || memberInfo?.memberId || 'member';
                    // Determine member type: if they have storeOwnerLevel, show it, otherwise "Regular User"
                    const memberLevelText = memberInfo?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(memberInfo.storeOwnerLevel)
                      ? ` (${memberInfo.storeOwnerLevel})`
                      : ' (Regular User)';
                    
                    // Use same format as stock transfer commissions: "Stockist Bonus (D)"
                    const commissionType = `Stockist Bonus (${sellerInfo.storeOwnerLevel})`;
                    
                    // Description format for orders: "Stock Order: 200 PV to member (Regular User) - Base Commission (D level - 3%)"
                    // Note: "Stock Transfer" is used when AdminStock transfers product to member
                    //       "Stock Order" is used when member orders from AdminStock
                    const description = `Stock Order: ${totalPV} PV to ${memberName}${memberLevelText} - Base Commission (${sellerInfo.storeOwnerLevel} level - ${(commissionRate * 100).toFixed(1)}%)`;
                    
                    await tx.commission.create({
                      data: {
                        userId: sellerInfo.id,
                        date: new Date(),
                        type: commissionType,
                        description: description,
                        status: 'Paid',
                        amount: commissionAmount, // Positive amount to add to E-Cash balance
                        companyId: companyId || null
                      }
                    });

                    // Also update AdminStock's eCashBalance field if it exists
                    try {
                      await tx.user.update({
                        where: { id: sellerInfo.id },
                        data: {
                          eCashBalance: {
                            increment: commissionAmount
                          }
                        } as any
                      });
                    } catch (error) {
                      // If eCashBalance field doesn't exist, log and continue
                      logger.debug('Could not update AdminStock eCashBalance field for commission (may not exist)', { error: String(error) });
                    }

                    logger.info('AdminStock commission added for PV/Stock deduction', {
                      adminStockId: sellerInfo.id,
                      adminStockName: sellerInfo.name,
                      storeOwnerLevel: sellerInfo.storeOwnerLevel,
                      pvDeducted: totalPV,
                      commissionRate: `${(commissionRate * 100).toFixed(1)}%`,
                      commissionAmount,
                      orderId
                    });
                  }
                }
              } catch (adminStockDeductError) {
                // Log error but don't fail the order - PV/Stock deduction can be handled separately
                logger.error('Failed to deduct AdminStock PV/Stock for member order', {
                  adminStockId: sellerInfo.id,
                  memberId: user.id,
                  orderId,
                  pv: totalPV,
                  error: adminStockDeductError instanceof Error ? adminStockDeductError.message : 'Unknown error'
                });
              }
            }
          } catch (walletError) {
            // Log error but don't fail the order - wallet transaction is for display only
            logger.error('Failed to create wallet transaction for PV', {
              userId: user.id,
              orderId,
              error: walletError instanceof Error ? walletError.message : 'Unknown error'
            });
          }
        }

        return { order: updatedOrder, sellerInfo };
      }, {
        isolationLevel: 'ReadCommitted', // Changed from Serializable to avoid deadlocks
        maxWait: 10000, // Increased wait time
        timeout: 30000 // Increased timeout
      });
      
      // Extract order and seller info from transaction result
      order = transactionResult.order;
      sellerRecipient = transactionResult.sellerInfo;
    } catch (txError) {
      // If transaction fails, release reserved stock
      logger.error('Transaction failed, releasing reserved stock', {
        error: txError instanceof Error ? txError.message : 'Unknown error',
        orderId,
        userId: user.id
      });
      
      // Release all reserved stock
      for (const item of validatedItems) {
        try {
          await inventoryService.releaseStock(
            item.productId,
            item.quantity,
            orderId,
            user.id,
            companyId
          );
        } catch (releaseError) {
          logger.error('Failed to release stock', {
            productId: item.productId,
            error: releaseError instanceof Error ? releaseError.message : 'Unknown error'
          });
        }
      }
      
      // Re-throw the transaction error to be caught by outer catch
      throw txError;
    }

    logger.info('Order created successfully', {
      userId: user.id,
      orderId: order.orderId,
      itemCount: validatedItems.length,
      totalAmount: calculatedTotalWithFees,
      totalPV,
      duration: Date.now() - startTime
    }, request);

    // REMOVED: Stock request creation for Distributor/Stockist
    // Now all account types (Customer, Distributor, Stockist) follow the same flow:
    // Order → Pending → Admin marks Fulfilled → Products allocated to My Stock
    // No separate stock request flow for e-cash purchases
    logger.info('Order created - waiting for admin approval via order fulfillment', {
      orderId: order.orderId,
      userId: user.id,
      status: 'Pending'
    }, request);

    // PERFORMANCE FIX: Use queue instead of immediate trigger
    // This prevents database overload from concurrent orders
    // Wrap in try-catch to prevent commission scheduling errors from failing the order
    try {
      await scheduleCommissionCalculation(`order:${order.orderId}`, {
        orderId: order.orderId,
        userId: user.id,
        totalPV
      });
    } catch (commissionError) {
      // Log but don't fail the order if commission scheduling fails
      logger.error('Failed to schedule commission calculation', {
        error: commissionError instanceof Error ? commissionError.message : 'Unknown error',
        orderId: order.orderId,
        userId: user.id
      });
    }

    // UPLINE CASCADE: When a member gets PV from an order, trigger recalculation
    // for all upline sponsors since their leg totals have changed
    try {
      const { triggerUplineCascade } = await import('@/services/daily-match-trigger');
      await triggerUplineCascade(user.id);
    } catch (cascadeError) {
      // Log but don't fail the order if cascade fails
      logger.error('Failed to trigger upline cascade', {
        error: cascadeError instanceof Error ? cascadeError.message : 'Unknown error',
        orderId: order.orderId,
        userId: user.id
      });
    }

    // Create notification for order placed
    try {
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true, firstName: true, surname: true }
      });
      const memberName = userRecord?.fullName || `${userRecord?.firstName || ''} ${userRecord?.surname || ''}`.trim() || 'Member';
      
      await prisma.notification.create({
        data: {
          memberId: user.id,
          type: 'in_app',
          category: 'order',
          title: 'Order Placed Successfully',
          body: `Your order #${order.orderId} has been placed and is pending admin approval. Total: ${formatCurrency(calculatedTotalWithFees)}`,
          data: {
            orderId: order.orderId,
            amount: calculatedTotalWithFees,
            itemCount: validatedItems.length,
            link: '/orders'
          },
          priority: 'medium',
          isRead: false,
          isSent: false
        }
      });
    } catch (notifyError) {
      // Log but don't fail the order if notification creation fails
      logger.warn('Failed to create order notification', {
        error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
        orderId: order.orderId,
        userId: user.id
      });
    }

    // Calculate final order total for response
    const finalOrderTotalForResponse = totalAmount && Math.abs(calculatedTotalWithFees - totalAmount) <= 0.01 
      ? totalAmount 
      : calculatedTotalWithFees;

    return ApiResponseUtil.success({
      order,
      pvAdded: totalPV,
      commissionsTriggered: true,
      ecashReceived: sellerRecipient ? {
        recipientId: sellerRecipient.id,
        recipientName: sellerRecipient.name,
        recipientType: sellerRecipient.type,
        amount: finalOrderTotalForResponse
      } : null
    }, 'Order created successfully');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    // Log to console for immediate debugging
    console.error('Order creation failed:', {
      name: errorName,
      message: errorMessage,
      stack: errorStack
    });
    
    logger.error('Order creation error', {
      error: errorMessage,
      errorName,
      stack: errorStack,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    // Return more specific error messages
    if (errorMessage.includes('Unique constraint') || errorMessage.includes('duplicate')) {
      return ApiResponseUtil.validationError([{
        field: 'order',
        message: 'An order with this information already exists. Please try again.'
      }]);
    }

    if (errorMessage.includes('stock') || errorMessage.includes('inventory')) {
      return ApiResponseUtil.validationError([{
        field: 'items',
        message: 'Unable to process order due to inventory issues. Please try again.'
      }]);
    }

    // Return detailed error for debugging (in development)
    const isDevelopment = process.env.NODE_ENV === 'development';
    return ApiResponseUtil.error(
      isDevelopment ? errorMessage : API_MESSAGES.SERVER_ERROR,
      500,
      isDevelopment ? { stack: errorStack } : undefined
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate request and execute handler with authenticated user
    return requireAuth(async (req) => {
      const user = req.user!;
      const { searchParams } = new URL(request.url);
      
      // Use pagination utilities for safe parsing
      const pagination = parsePaginationParams(searchParams, {
        defaultLimit: 50,
        maxLimit: 100
      });
      const { limit, offset } = pagination;
      const status = searchParams.get('status');

      // Check if current user is admin or AdminStock
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true, storeOwnerLevel: true }
      });

      const isAdmin = userRecord?.isAdmin === true;
      const isAdminStock = !isAdmin && userRecord?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(userRecord.storeOwnerLevel);

      // Build where clause for order filtering
      const where: any = {};
      
      // Set userId filter
      const queriedUserId = searchParams.get('userId');
      
      if (isAdmin) {
        // Admin can see all orders
        if (queriedUserId) {
          // Admin querying specific user's orders
          where.userId = queriedUserId;
        } else {
          // Admin viewing all orders - no userId filter (show all orders)
          // where.userId is intentionally not set, so all orders are returned
        }
      } else if (isAdminStock) {
        // AdminStock can see orders where they received e-cash (they are the seller)
        // Find commissions where this AdminStock received e-cash from orders
        const sellerCommissions = await prisma.commission.findMany({
          where: {
            userId: user.id,
            OR: [
              { type: { startsWith: 'E-Cash from Order' } },
              { description: { contains: 'E-cash received from buyer' } }
            ],
            status: 'Paid'
          },
          select: {
            type: true,
            description: true
          }
        });

        // Extract orderIds from commission types/descriptions
        // Format: "E-Cash from Order {orderId} (Admin Stock)" or description: "Order {orderId} - E-cash received from buyer..."
        const orderIds: Set<string> = new Set();
        
        sellerCommissions.forEach(commission => {
          // Try to extract from type: "E-Cash from Order ORD123 (Admin Stock)"
          // Pattern matches: "E-Cash from Order " followed by orderId (ORD- followed by alphanumeric and hyphens)
          if (commission.type) {
            const typeMatch = commission.type.match(/E-Cash from Order\s+(ORD-[A-Z0-9-]+)/i);
            if (typeMatch && typeMatch[1]) {
              orderIds.add(typeMatch[1]);
            }
          }
          
          // Try to extract from description: "Order ORD123 - E-cash received from buyer..."
          // This is more reliable as it's always in the format "Order {orderId} -"
          if (commission.description) {
            const descMatch = commission.description.match(/Order\s+(ORD-[A-Z0-9-]+)\s+-/i);
            if (descMatch && descMatch[1]) {
              orderIds.add(descMatch[1]);
            }
          }
        });

        // Convert Set to Array for Prisma query
        const uniqueOrderIds = Array.from(orderIds);

        if (uniqueOrderIds.length > 0) {
          // Filter orders by the extracted orderIds
          where.orderId = { in: uniqueOrderIds };
          logger.info('AdminStock order filtering', {
            adminStockId: user.id,
            commissionCount: sellerCommissions.length,
            orderIdsFound: uniqueOrderIds.length,
            orderIds: uniqueOrderIds.slice(0, 10) // Log first 10 for debugging
          });
        } else {
          // No orders found for this AdminStock
          where.orderId = { in: [] }; // Empty result set
          logger.info('No orders found for AdminStock', {
            adminStockId: user.id,
            commissionCount: sellerCommissions.length
          });
        }
      } else {
        // Regular user (Customer, Distributor, Stockist) viewing their own orders
        where.userId = user.id;
      }
      
      if (status) {
        where.status = status;
      }

      const orders = await prisma.order.findMany({
        where,
        include: {
          items: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      // Fetch product details for all order items
      if (orders.length > 0) {
        const allProductIds = orders.flatMap(order => 
          order.items.map(item => item.productId)
        );
        const uniqueProductIds = [...new Set(allProductIds)];
        
        if (uniqueProductIds.length > 0) {
          const products = await prisma.product.findMany({
            where: {
              id: {
                in: uniqueProductIds
              }
            },
            select: {
              id: true,
              name: true,
              imageUrl: true,
              price: true,
              pv: true
            }
          });

          // Create product map
          const productMap = new Map(products.map(p => [p.id, p]));
          
          // Attach products to order items
          orders.forEach(order => {
            order.items = order.items.map(item => ({
              ...item,
              product: productMap.get(item.productId) || null
            }));
          });
        }
      }

      const total = await prisma.order.count({ where });

      // Calculate pagination metadata using utilities
      const paginationMeta = calculatePaginationMeta(total, limit, offset);

      logger.info('Orders fetched', {
        userId: user.id,
        count: orders.length,
        total,
        limit,
        offset,
        duration: Date.now() - startTime
      }, request);

      return ApiResponseUtil.paginated(
        orders,
        total,
        limit,
        offset,
        API_MESSAGES.FETCHED
      );
    })(request);

  } catch (error) {
    logger.error('Orders fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

export async function PATCH(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate request first to check if user is admin
    // Admins need higher rate limits for order management
    let user;
    try {
      const authenticatedRequest = await authenticateRequest(request);
      user = authenticatedRequest.user;
    } catch (authError) {
      // If auth fails, still apply rate limiting but with standard limits
      const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 30 });
      if (!rateLimitResult.success) {
        return rateLimitResult.response!;
      }
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }
    
    // Apply rate limiting - higher limits for admins
    const isAdmin = user?.isAdmin === true;
    const rateLimitConfig = isAdmin 
      ? { windowMs: 15 * 60 * 1000, maxRequests: 100000 } // Admins: 100000 requests per 15 minutes (optimized for 100M users)
      : { windowMs: 15 * 60 * 1000, maxRequests: 50000 }; // Regular users: 50000 requests per 15 minutes (optimized for scale)
    
    const rateLimitResult = await rateLimit(request, rateLimitConfig);
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Execute handler with authenticated user
    return requireAuth(async (req) => {
      const user = req.user!;
      const body = await request.json();
      const { orderId, status } = body;

      if (!orderId || !status) {
        return ApiResponseUtil.validationError([
          { field: 'orderId', message: 'Order ID is required' },
          { field: 'status', message: 'Status is required' }
        ]);
      }

      // Get existing order first to check user's accountType
      const existingOrder = await prisma.order.findUnique({
        where: { orderId },
        include: { items: true }
      });

      if (!existingOrder) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      // All account types (Customer, Distributor, Stockist) now use the same order flow
      // Valid statuses: 'Pending', 'Fulfilled', 'Declined'
      const validStatuses = ['Pending', 'Fulfilled', 'Declined'];
      if (!validStatuses.includes(status)) {
        return ApiResponseUtil.validationError([{
          field: 'status',
          message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
        }]);
      }

      // Check if user is AdminStock
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true, storeOwnerLevel: true }
      });

      const isAdmin = userRecord?.isAdmin === true;
      const isAdminStock = !isAdmin && userRecord?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(userRecord.storeOwnerLevel);

      // Non-admins and non-AdminStock can only cancel their own pending orders
      if (!isAdmin && !isAdminStock) {
        if (existingOrder.userId !== user.id) {
          return NextResponse.json(
            { error: 'You can only modify your own orders' },
            { status: 403 }
          );
        }
        if (status !== 'Cancelled' || existingOrder.status !== 'Pending') {
          return NextResponse.json(
            { error: 'You can only cancel pending orders' },
            { status: 403 }
          );
        }
      }

      // AdminStock can only update orders where they are the seller (received e-cash)
      if (isAdminStock) {
        // Check if this AdminStock received e-cash for this order
        const sellerCommission = await prisma.commission.findFirst({
          where: {
            userId: user.id,
            type: { startsWith: 'E-Cash from Order' },
            description: { contains: `Order ${orderId}` }
          }
        });

        if (!sellerCommission) {
          return NextResponse.json(
            { error: 'You can only update orders where you are the seller' },
            { status: 403 }
          );
        }
      }

      // FIXED: Update order status, deduct/restore stock in single transaction
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Update order status
        const updated = await tx.order.update({
          where: { orderId },
          data: { status },
          include: { items: true }
        });

        // If order is being fulfilled (status changed to Fulfilled), deduct from admin stock inventory
        if (status === 'Fulfilled' && existingOrder.status !== 'Fulfilled') {
          logger.info('Deducting product quantities for fulfilled order', {
            orderId,
            itemCount: existingOrder.items.length
          }, request);
          
          // Find the admin stock seller who received e-cash for this order
          const sellerCommission = await tx.commission.findFirst({
            where: {
              type: { startsWith: 'E-Cash from Order' },
              description: { contains: `Order ${orderId}` }
            },
            select: {
              userId: true,
              type: true
            }
          });

          if (sellerCommission) {
            // Check if seller is AdminStock (has storeOwnerLevel)
            const sellerUser = await tx.user.findUnique({
              where: { id: sellerCommission.userId },
              select: {
                id: true,
                storeOwnerLevel: true,
                isAdmin: true,
                fullName: true,
                memberId: true
              }
            });

            const isAdminStockSeller = sellerUser?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(sellerUser.storeOwnerLevel);
            
            if (isAdminStockSeller && (tx as any).inventoryTransaction) {
              // Deduct from AdminStock's inventory (My Stock page)
              logger.info('Deducting from AdminStock inventory', {
                orderId,
                sellerId: sellerUser.id,
                sellerName: sellerUser.fullName,
                sellerLevel: sellerUser.storeOwnerLevel,
                itemCount: existingOrder.items.length
              }, request);

              await Promise.all(
                existingOrder.items.map(async (item: any) => {
                  try {
                    const product = await tx.product.findUnique({
                      where: { id: item.productId },
                      select: { name: true }
                    });

                    if (!product) {
                      logger.warn('Product not found for inventory deduction', {
                        orderId,
                        productId: item.productId
                      }, request);
                      return;
                    }

                    // Get AdminStock's current inventory for this product
                    const existingTransactions = await (tx as any).inventoryTransaction.findMany({
                      where: {
                        userId: sellerUser.id,
                        productId: item.productId
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

                    // Check if sufficient stock available
                    if (currentStock < item.quantity) {
                      logger.warn('Insufficient stock in AdminStock inventory', {
                        orderId,
                        sellerId: sellerUser.id,
                        productId: item.productId,
                        productName: product.name,
                        available: currentStock,
                        required: item.quantity
                      }, request);
                      // Continue with deduction anyway (may be handled by business rules)
                    }

                    // Create inventory transaction to deduct from AdminStock's inventory
                    await (tx as any).inventoryTransaction.create({
                      data: {
                        userId: sellerUser.id,
                        productId: item.productId,
                        type: 'sale',
                        quantity: item.quantity,
                        previousQty: currentStock,
                        newQty: Math.max(0, currentStock - item.quantity),
                        reference: `Order ${orderId}`,
                        reason: `Order ${orderId} fulfilled - Sold ${item.quantity} units of ${product.name} to customer`,
                        createdBy: user.id
                      }
                    });

                    logger.info('AdminStock inventory deducted', {
                      orderId,
                      sellerId: sellerUser.id,
                      productId: item.productId,
                      productName: product.name,
                      quantityDeducted: item.quantity,
                      oldQty: currentStock,
                      newQty: Math.max(0, currentStock - item.quantity)
                    }, request);
                  } catch (inventoryError) {
                    logger.error('Failed to deduct from AdminStock inventory', {
                      orderId,
                      productId: item.productId,
                      sellerId: sellerUser.id,
                      error: inventoryError instanceof Error ? inventoryError.message : 'Unknown error'
                    }, request);
                    // Continue with other items even if one fails
                  }
                })
              );
            } else {
              // If seller is Admin (not AdminStock) or inventoryTransaction not available, deduct from product catalog
              logger.info('Deducting product quantities from catalog (Admin seller or inventoryTransaction not available)', {
                orderId,
                sellerId: sellerUser?.id,
                sellerType: sellerUser?.isAdmin ? 'admin' : 'unknown',
                itemCount: existingOrder.items.length
              }, request);
              
              await Promise.all(
                existingOrder.items.map(async (item: any) => {
                  try {
                    const product = await tx.product.findUnique({
                      where: { id: item.productId },
                      select: { qty: true, name: true }
                    });
                    
                    if (!product) {
                      logger.warn('Product not found for quantity deduction', {
                        orderId,
                        productId: item.productId
                      }, request);
                      return;
                    }
                    
                    const currentQty = product.qty || 0;
                    const newQty = Math.max(0, currentQty - item.quantity);
                    
                    await tx.product.update({
                      where: { id: item.productId },
                      data: {
                        qty: newQty
                      }
                    });
                    
                    logger.info('Product quantity deducted from catalog', {
                      orderId,
                      productId: item.productId,
                      productName: product.name,
                      quantityDeducted: item.quantity,
                      oldQty: currentQty,
                      newQty: newQty
                    }, request);
                  } catch (productError) {
                    logger.error('Failed to deduct product quantity', {
                      orderId,
                      productId: item.productId,
                      error: productError instanceof Error ? productError.message : 'Unknown error'
                    }, request);
                    // Continue with other items even if one fails
                  }
                })
              );
            }
          } else {
            // No seller commission found - deduct from product catalog as fallback
            logger.warn('No seller commission found for order, deducting from product catalog', {
              orderId,
              itemCount: existingOrder.items.length
            }, request);
            
            await Promise.all(
              existingOrder.items.map(async (item: any) => {
                try {
                  const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { qty: true, name: true }
                  });
                  
                  if (!product) {
                    logger.warn('Product not found for quantity deduction', {
                      orderId,
                      productId: item.productId
                    }, request);
                    return;
                  }
                  
                  const currentQty = product.qty || 0;
                  const newQty = Math.max(0, currentQty - item.quantity);
                  
                  await tx.product.update({
                    where: { id: item.productId },
                    data: {
                      qty: newQty
                    }
                  });
                  
                  logger.info('Product quantity deducted from catalog (fallback)', {
                    orderId,
                    productId: item.productId,
                    productName: product.name,
                    quantityDeducted: item.quantity,
                    oldQty: currentQty,
                    newQty: newQty
                  }, request);
                } catch (productError) {
                  logger.error('Failed to deduct product quantity', {
                    orderId,
                    productId: item.productId,
                    error: productError instanceof Error ? productError.message : 'Unknown error'
                  }, request);
                  // Continue with other items even if one fails
                }
              })
            );
          }
        }

        // NOTE: We no longer restore stock when order is declined/cancelled
        // because stock is only deducted when order is fulfilled (approved by admin)
        // Stock is checked for availability when order is created, but not deducted until fulfillment

        // Store flag to allocate products after transaction commits
        // We'll handle allocation outside the transaction since inventoryTransaction
        // might not be accessible via transaction client

        return updated;
      }, {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 10000
      });

      logger.info('Order status updated', {
        userId: user.id,
        orderId,
        oldStatus: existingOrder.status,
        newStatus: status,
        duration: Date.now() - startTime
      }, request);

      // AUTO-CALCULATE G2 Binary Bonus when order is completed/delivered
      // If the order owner is a G2 downline, trigger G2 Binary Bonus recalculation for grandparent
      if ((status === 'Completed' || status === 'Delivered') && (existingOrder.status !== 'Completed' && existingOrder.status !== 'Delivered')) {
        try {
          // Get order owner's placement parent (G1)
          const orderOwner = await prisma.user.findUnique({
            where: { id: existingOrder.userId },
            select: {
              id: true,
              placementParentId: true,
              memberId: true
            }
          });

          if (orderOwner?.placementParentId) {
            // Check if order owner is a G2 (has a G1 parent who has a grandparent)
            const g1Parent = await prisma.user.findUnique({
              where: { id: orderOwner.placementParentId },
              select: {
                id: true,
                placementParentId: true,
                memberId: true
              }
            });

            // If G1 has a parent (grandparent), trigger G2 Binary Bonus auto-calculation
            if (g1Parent?.placementParentId) {
              console.log(`🔄 Order completed - Auto-calculating G2 Binary Bonus for grandparent:`, {
                orderId,
                orderOwnerId: orderOwner.memberId,
                g1Id: g1Parent.memberId,
                grandparentId: g1Parent.placementParentId
              });

              const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
              await autoCalculateG2BinaryBonus(g1Parent.id, orderOwner.id);
            }
          }
        } catch (g2Error) {
          // Log but don't fail order update if G2 calculation fails
          logger.warn('Failed to auto-calculate G2 Binary Bonus on order completion', {
            orderId,
            userId: existingOrder.userId,
            error: g2Error instanceof Error ? g2Error.message : 'Unknown error'
          }, request);
        }
      }

      // After transaction commits, allocate products if order is marked as Fulfilled
      // Products will appear in customer's "My Stock" page
      // IMPORTANT: Always check if products need allocation when order is Fulfilled
      // This handles both new fulfillments and retroactive allocation for orders that were fulfilled before allocation code was added
      const shouldAllocate = status === 'Fulfilled';
      
      if (shouldAllocate) {
        // Check if products were already allocated by looking for inventory transactions
        const inventoryTransactionModel = (prisma as any).inventoryTransaction;
        let needsAllocation = false;
        
        if (inventoryTransactionModel) {
          try {
            // Check if any items from this order have been allocated
            const existingAllocations = await Promise.all(
              existingOrder.items.map((item: any) =>
                inventoryTransactionModel.findFirst({
                  where: {
                    userId: existingOrder.userId,
                    productId: item.productId,
                    reference: `Order ${orderId}`
                  }
                }).catch(() => null)
              )
            );
            
            // If any item is missing allocation, we need to allocate
            needsAllocation = existingAllocations.some(alloc => alloc === null);
            
            if (!needsAllocation && existingOrder.status === 'Fulfilled') {
              logger.info('Order already fulfilled and products already allocated', {
                orderId,
                customerId: existingOrder.userId,
                itemCount: existingOrder.items.length
              }, request);
            }
          } catch (checkError) {
            // If check fails, assume allocation is needed
            needsAllocation = true;
            logger.warn('Failed to check existing allocations, will attempt allocation', {
              orderId,
              error: checkError instanceof Error ? checkError.message : 'Unknown error'
            }, request);
          }
        } else {
          // If model doesn't exist, we can't allocate but log it
          logger.warn('InventoryTransaction model not available, cannot allocate products', {
            orderId,
            customerId: existingOrder.userId
          }, request);
          needsAllocation = false;
        }
        
        if (needsAllocation) {
          logger.info('Order marked as Fulfilled, starting product allocation', {
            orderId,
            customerId: existingOrder.userId,
            itemCount: existingOrder.items.length,
            isNewFulfillment: existingOrder.status !== 'Fulfilled',
            items: existingOrder.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity
            }))
          }, request);
          
          // Run allocation outside transaction since inventoryTransaction might not be in Prisma schema
          // Await to ensure products are allocated before responding
          try {
            await allocateProductsToCustomer(orderId, existingOrder.userId, existingOrder.items, user.id);
            logger.info('Products allocated to customer successfully', {
              orderId,
              customerId: existingOrder.userId,
              itemCount: existingOrder.items.length
            }, request);

            // Note: Commissions are now auto-paid immediately when stock is transferred
            // No need to release pending commissions as all commissions are paid upfront
          } catch (allocationError) {
            // Log error but don't fail the order update - this is critical so log it clearly
            logger.error('CRITICAL: Failed to allocate products to customer after order fulfillment', {
              orderId,
              customerId: existingOrder.userId,
              itemCount: existingOrder.items.length,
              error: allocationError instanceof Error ? allocationError.message : 'Unknown error',
              stack: allocationError instanceof Error ? allocationError.stack : undefined
            }, request);
          }
        }
      } else {
        logger.info('Order status update - no product allocation needed', {
          orderId,
          oldStatus: existingOrder.status,
          newStatus: status,
          customerId: existingOrder.userId
        }, request);
      }

      // Create notification for order status change
      try {
        const customerRecord = await prisma.user.findUnique({
          where: { id: existingOrder.userId },
          select: { fullName: true, firstName: true, surname: true }
        });
        
        let notificationTitle = '';
        let notificationBody = '';
        
        if (status === 'Fulfilled') {
          notificationTitle = 'Order Fulfilled';
          notificationBody = `Your order #${orderId} has been fulfilled! ${existingOrder.items.length} item(s) have been added to your stock. Check "My Stock" to view your products.`;
        } else if (status === 'Declined') {
          notificationTitle = 'Order Declined';
          notificationBody = `Your order #${orderId} has been declined. If you have questions, please contact support.`;
        } else if (status === 'Cancelled') {
          notificationTitle = 'Order Cancelled';
          notificationBody = `Your order #${orderId} has been cancelled.`;
        }
        
        if (notificationTitle && notificationBody) {
          await prisma.notification.create({
            data: {
              memberId: existingOrder.userId,
              type: 'in_app',
              category: 'order',
              title: notificationTitle,
              body: notificationBody,
              data: {
                orderId: orderId,
                status: status,
                link: '/orders'
              },
              priority: status === 'Fulfilled' ? 'high' : 'medium',
              isRead: false,
              isSent: false
            }
          });
        }
      } catch (notifyError) {
        // Log but don't fail the order update if notification creation fails
        logger.warn('Failed to create order status notification', {
          error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
          orderId: orderId,
          userId: existingOrder.userId
        });
      }

      return ApiResponseUtil.success(updatedOrder, 'Order updated successfully');
    })(request);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Order update error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

/**
 * Retroactively allocate products for fulfilled orders that are missing inventory transactions
 * This endpoint can be called to fix orders that were fulfilled before allocation code was added
 * Usage: PUT /api/orders with body: { orderId: "..." } or { userId: "..." }
 */
export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 10 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate request and execute handler with authenticated user
    return requireAuth(async (req) => {
      const user = req.user!;
      
      // Only admins can trigger retroactive allocation
      if (!user.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Only admins can trigger retroactive allocation' },
          { status: 403 }
        );
      }

      const body = await request.json().catch(() => ({}));
      const { orderId, userId } = body;

      // If orderId provided, allocate for that specific order
      if (orderId) {
        const order = await prisma.order.findUnique({
          where: { orderId },
          include: { items: true }
        });

        if (!order) {
          return ApiResponseUtil.error('Order not found', 404);
        }

        if (order.status !== 'Fulfilled') {
          return ApiResponseUtil.error('Order is not fulfilled. Only fulfilled orders can be retroactively allocated.', 400);
        }

        // Check if already allocated
        const inventoryTransactionModel = (prisma as any).inventoryTransaction;
        if (inventoryTransactionModel) {
          const existingAllocations = await Promise.all(
            order.items.map((item: any) =>
              inventoryTransactionModel.findFirst({
                where: {
                  userId: order.userId,
                  productId: item.productId,
                  reference: `Order ${orderId}`
                }
              }).catch(() => null)
            )
          );

          const needsAllocation = existingAllocations.some(alloc => alloc === null);
          
          if (!needsAllocation) {
            return ApiResponseUtil.success(
              { message: 'Products already allocated for this order', orderId },
              'Products already allocated'
            );
          }
        }

        try {
          await allocateProductsToCustomer(orderId, order.userId, order.items, user.id);
          return ApiResponseUtil.success(
            { orderId, itemCount: order.items.length },
            'Products allocated successfully'
          );
        } catch (allocationError) {
          logger.error('Failed to retroactively allocate products', {
            orderId,
            error: allocationError instanceof Error ? allocationError.message : 'Unknown error'
          }, request);
          return ApiResponseUtil.error(
            `Failed to allocate products: ${allocationError instanceof Error ? allocationError.message : 'Unknown error'}`,
            500
          );
        }
      }

      // If userId provided, allocate for all fulfilled orders for that user
      if (userId) {
        const fulfilledOrders = await prisma.order.findMany({
          where: {
            userId,
            status: 'Fulfilled'
          },
          include: { items: true }
        });

        const results = {
          total: fulfilledOrders.length,
          allocated: 0,
          alreadyAllocated: 0,
          failed: 0,
          errors: [] as string[]
        };

        const inventoryTransactionModel = (prisma as any).inventoryTransaction;
        
        for (const order of fulfilledOrders) {
          try {
            // Check if already allocated
            if (inventoryTransactionModel) {
              const existingAllocations = await Promise.all(
                order.items.map((item: any) =>
                  inventoryTransactionModel.findFirst({
                    where: {
                      userId: order.userId,
                      productId: item.productId,
                      reference: `Order ${order.orderId}`
                    }
                  }).catch(() => null)
                )
              );

              const needsAllocation = existingAllocations.some(alloc => alloc === null);
              
              if (!needsAllocation) {
                results.alreadyAllocated++;
                continue;
              }
            }

            await allocateProductsToCustomer(order.orderId, order.userId, order.items, user.id);
            results.allocated++;
          } catch (error) {
            results.failed++;
            results.errors.push(`Order ${order.orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return ApiResponseUtil.success(results, `Processed ${fulfilledOrders.length} orders`);
      }

      return ApiResponseUtil.validationError([{
        field: 'orderId',
        message: 'Either orderId or userId must be provided'
      }]);
    })(request);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Retroactive allocation error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}