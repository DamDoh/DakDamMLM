import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { ApiResponseUtil } from '@/lib/api-response';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { canTransferStock, type StockistLevel } from '@/lib/types';

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
      if (!sender.isAdmin && !sender.storeOwnerLevel) {
        return ApiResponseUtil.forbidden('Only admins and stockists can transfer stock');
      }

      // For non-admin users, check if recipient is in their downline (direct or indirect)
      if (!sender.isAdmin) {
        // First check if it's a direct downline
        if (!isDirectDownline) {
          // Check if recipient is anywhere in the sender's downline tree
          const isInDownlineTree = await isUserInDownline(sender.id, toUserId);
          if (!isInDownlineTree) {
            return ApiResponseUtil.forbidden('You can only transfer stock to members in your downline');
          }
        }
      }

      // Check stockist level restrictions: higher level can transfer to lower level
      if (!sender.isAdmin && sender.storeOwnerLevel) {
        const recipientWithLevel = await prisma.user.findUnique({
          where: { id: toUserId },
          select: {
            storeOwnerLevel: true,
            fullName: true
          }
        });

        if (recipientWithLevel) {
          const senderLevel = sender.storeOwnerLevel as StockistLevel | null;
          const recipientLevel = recipientWithLevel.storeOwnerLevel as StockistLevel | null;

          if (!canTransferStock(senderLevel, recipientLevel)) {
            const senderLevelName = senderLevel ? `(${senderLevel})` : '';
            const recipientLevelName = recipientLevel ? `(${recipientLevel})` : '';
            
            return ApiResponseUtil.forbidden(
              `Cannot transfer stock. Stockist level ${senderLevelName} cannot transfer to stockist level ${recipientLevelName}. Only higher level stockists can transfer to lower level stockists.`
            );
          }
        }
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

      // Handle stock transfer using StockItems
      console.log('📞 Processing stock transfer with StockItems...');
      
      const transferId = `STOCK-TRANSFER-${Date.now()}`;
      let totalPVValue = 0;
      
      // Process each stock item
      for (const item of items) {
        // Get the stock item
        const stockItem = await prisma.stockItem.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, quantity: true, pv: true, price: true, description: true }
        });
        
        if (!stockItem) {
          console.error(`❌ Stock item not found: ${item.productId}`);
          return ApiResponseUtil.error(`Stock item not found: ${item.productName}`);
        }
        
        if (stockItem.quantity < item.quantity) {
          console.error(`❌ Insufficient stock: ${stockItem.name}`);
          return ApiResponseUtil.error(`Insufficient stock for ${stockItem.name}. Available: ${stockItem.quantity}, Requested: ${item.quantity}`);
        }
        
        // Deduct from stock item quantity
        await prisma.stockItem.update({
          where: { id: item.productId },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        });
        
        // Get current inventory for stock item to calculate new quantity
        const existingStockTransactions = await prisma.inventoryTransaction.findMany({
          where: { userId: toUserId, productId: item.productId },
          orderBy: { createdAt: 'asc' }
        });
        
        let currentStockQty = 0;
        for (const tx of existingStockTransactions) {
          if (tx.type === 'purchase' || tx.type === 'transfer' || tx.type === 'return') {
            currentStockQty += Number(tx.quantity) || 0;
          } else if (tx.type === 'sale' || tx.type === 'adjustment') {
            currentStockQty -= Number(tx.quantity) || 0;
          }
        }
        
        // Create inventory transaction for recipient to track received stock item
        await prisma.inventoryTransaction.create({
          data: {
            userId: toUserId,
            productId: item.productId,
            quantity: item.quantity,
            previousQty: currentStockQty,
            newQty: currentStockQty + item.quantity,
            type: 'transfer',
            reference: transferId,
            reason: `Stock transfer from ${sender.fullName}: ${stockItem.name}`,
            createdBy: authUser.id,
            companyId: sender.companyId || undefined
          }
        });
        
        console.log(`📝 Created inventory transaction for stock item: ${stockItem.name} x${item.quantity}`);
        
        // Parse products from stock item description if it contains "Contains:"
        // Format: "Contains: Product1 (qty1), Product2 (qty2), ..."
        if (stockItem.description && stockItem.description.includes('Contains:')) {
          console.log(`📦 Parsing products from stock item description: ${stockItem.description}`);
          
          const containsText = stockItem.description.split('Contains:')[1].trim();
          const productEntries = containsText.split(',').map(entry => entry.trim());
          console.log(`📋 Parsed product entries:`, productEntries);
          
          // Get all products to match by name (filter by company if applicable)
          // Also try without company filter if no products found
          let allProducts = await prisma.product.findMany({
            where: {
              isActive: true,
              ...(sender.companyId ? { companyId: sender.companyId } : {})
            },
            select: {
              id: true,
              name: true
            }
          });
          
          // If no products found and we filtered by company, try without company filter
          if (allProducts.length === 0 && sender.companyId) {
            console.log(`⚠️  No products found with companyId, trying without filter...`);
            allProducts = await prisma.product.findMany({
              where: {
                isActive: true
              },
              select: {
                id: true,
                name: true
              }
            });
          }
          
          console.log(`📦 Found ${allProducts.length} products in catalog`);
          console.log(`📋 Product names:`, allProducts.map(p => p.name));
          
          // Process each product entry
          for (const productEntry of productEntries) {
            console.log(`🔍 Processing product entry: "${productEntry}"`);
            
            // Parse format: "Product Name (quantity)"
            const match = productEntry.match(/^(.+?)\s*\((\d+)\)$/);
            if (!match) {
              console.warn(`⚠️  Could not parse product entry format: "${productEntry}"`);
              continue;
            }
            
            const productName = match[1].trim();
            const productQtyPerStock = parseInt(match[2], 10);
            
            console.log(`📦 Looking for product: "${productName}" with quantity ${productQtyPerStock} per stock`);
            
            // Calculate total quantity: qty per stock item * number of stock items transferred
            const totalProductQty = productQtyPerStock * item.quantity;
            console.log(`📊 Total quantity to transfer: ${totalProductQty} (${productQtyPerStock} x ${item.quantity} stock items)`);
            
            // Find product by name (try exact match first, then partial match, then normalized match)
            const normalizedProductName = productName.trim().toLowerCase();
            const product = allProducts.find(p => {
              const normalizedPName = p.name.trim().toLowerCase();
              // Try multiple matching strategies
              const matches = (
                p.name.trim() === productName || // Exact match
                normalizedPName === normalizedProductName || // Case-insensitive exact
                p.name.includes(productName) || // Contains
                productName.includes(p.name) || // Reverse contains
                normalizedPName.includes(normalizedProductName) || // Normalized contains
                normalizedProductName.includes(normalizedPName) // Reverse normalized contains
              );
              if (matches) {
                console.log(`✅ Product match found: "${productName}" -> "${p.name}"`);
              }
              return matches;
            });
              
            if (product) {
              console.log(`✅ Found product match: "${productName}" -> "${product.name}" (ID: ${product.id})`);
              
              // Get current inventory for this product to calculate new quantity
              const existingTransactions = await prisma.inventoryTransaction.findMany({
                where: { userId: toUserId, productId: product.id },
                orderBy: { createdAt: 'asc' }
              });
              
              let currentQty = 0;
              for (const tx of existingTransactions) {
                if (tx.type === 'purchase' || tx.type === 'transfer' || tx.type === 'return') {
                  currentQty += Number(tx.quantity) || 0;
                } else if (tx.type === 'sale' || tx.type === 'adjustment') {
                  currentQty -= Number(tx.quantity) || 0;
                }
              }
              
              // Create inventory transaction for the product with companyId
              await prisma.inventoryTransaction.create({
                data: {
                  userId: toUserId,
                  productId: product.id,
                  quantity: totalProductQty,
                  previousQty: currentQty,
                  newQty: currentQty + totalProductQty,
                  type: 'transfer',
                  reference: transferId,
                  reason: `Product from stock transfer: ${stockItem.name} (${item.quantity}x) - ${product.name} x${totalProductQty}`,
                  createdBy: authUser.id,
                  companyId: sender.companyId || undefined
                }
              });
              
              console.log(`✅ Created inventory transaction for product: ${product.name} x${totalProductQty} (from ${item.quantity}x ${stockItem.name}, currentQty: ${currentQty}, newQty: ${currentQty + totalProductQty})`);
            } else {
              console.warn(`⚠️  Product not found in catalog: "${productName}"`);
              console.warn(`📋 Available products:`, allProducts.map(p => p.name).slice(0, 10));
            }
          }
        }
        
        // Calculate PV for this item
        const itemPV = (stockItem.pv || 0) * item.quantity;
        totalPVValue += itemPV;
        
        console.log(`📦 Transferred: ${stockItem.name} x${item.quantity}, PV: ${itemPV}`);
      }
      
      console.log(`💰 Total PV to credit: ${totalPVValue}`);
      
      // Credit recipient's e-cash wallet with PV
      if (totalPVValue > 0) {
        try {
          const { WalletServiceEnhanced } = await import('@/services/wallet-service-enhanced');
          
          const walletResult = await WalletServiceEnhanced.creditWallet(
            toUserId,
            totalPVValue,
            `Stock Transfer: ${items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}`,
            transferId,
            'stock_transfer'
          );
          
          console.log('✅✅✅ WALLET CREDITED SUCCESSFULLY ✅✅✅', {
            recipientId: toUserId,
            pvAmount: totalPVValue,
            walletBalance: walletResult.balance
          });
        } catch (walletError) {
          console.error('❌ Failed to credit wallet:', walletError);
          // Don't fail the transfer if wallet credit fails
        }
      }
      
      const result = { success: true, transferId };

      // Create stock request for admin transfers to adminstock
      // This allows both admin and adminstock to see the transaction/invoice
      if (sender.isAdmin) {
        try {
          // Check if recipient is adminstock (isAdmin OR has stockist level S/M/C/D)
          const recipientInfo = await prisma.user.findUnique({
            where: { id: toUserId },
            select: {
              id: true,
              isAdmin: true,
              storeOwnerLevel: true,
              firstName: true,
              surname: true,
              fullName: true
            }
          });

          if (recipientInfo) {
            const isAdminstock = recipientInfo.isAdmin === true;
            const hasStockistLevel = recipientInfo.storeOwnerLevel && 
              ['S', 'M', 'C', 'D'].includes(recipientInfo.storeOwnerLevel);
            
            // Only create stock request if recipient is adminstock
            if (isAdminstock || hasStockistLevel) {
              // Get admin user info
              const adminInfo = await prisma.user.findUnique({
                where: { id: authUser.id },
                select: {
                  firstName: true,
                  surname: true,
                  fullName: true
                }
              });

              const adminName = adminInfo?.fullName || 
                `${adminInfo?.firstName || ''} ${adminInfo?.surname || ''}`.trim() || 
                'Admin';

              // Calculate total value and prepare items
              let totalValue = 0;
              let totalQuantity = 0;
              const stockRequestItems = [];

              for (const item of items) {
                const quantity = item.quantity || 0;

                // ---- Determine correct product and unit price ----
                // 1) Try to find matching Product by ID or name (for regular products)
                const product = await prisma.product.findFirst({
                  where: {
                    OR: [
                      { id: item.productId },
                      { name: { contains: item.productName, mode: 'insensitive' } }
                    ]
                  },
                  select: { id: true, name: true, price: true }
                }).catch(() => null);

                // 2) If no Product found, treat productId as StockItem ID (Admin stock item)
                const stockItem = !product
                  ? await prisma.stockItem.findUnique({
                      where: { id: item.productId },
                      select: { id: true, name: true, price: true }
                    }).catch(() => null)
                  : null;

                // 3) Prefer explicit unitPrice from request, otherwise fall back to Product/StockItem price
                let unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
                if (product?.price != null) {
                  unitPrice = product.price;
                } else if (stockItem?.price != null) {
                  unitPrice = stockItem.price;
                }

                const itemValue = unitPrice * quantity;
                totalValue += itemValue;
                totalQuantity += quantity;

                stockRequestItems.push({
                  // Use real Product ID if we found one, otherwise fall back to StockItem/posted ID
                  productId: product?.id || stockItem?.id || item.productId,
                  // Prefer real product/stock item name, otherwise use name from request
                  productName: product?.name || stockItem?.name || item.productName || 'Unknown Product',
                  requestedQuantity: quantity,
                  unitPrice,
                  approvedQuantity: quantity
                });
              }

              // Create stock request with special format for admin transfers
              if ((prisma as any).stockRequest) {
                const stockRequest = await (prisma as any).stockRequest.create({
                  data: {
                    stockistId: toUserId, // Recipient (adminstock) - so they see it
                    stockistName: `ADMIN_TRANSFER:${adminName}`, // Admin who transferred
                    stockistLevel: recipientInfo.storeOwnerLevel || 'District',
                    status: 'approved', // Mark as approved since it's already transferred
                    processedBy: authUser.id, // Admin who processed it
                    processedDate: new Date(), // When it was processed
                    totalValue,
                    itemCount: totalQuantity,
                    items: {
                      create: stockRequestItems
                    }
                  },
                  include: {
                    items: true
                  }
                });

                logger.info('Stock request created for binary stock admin transfer', {
                  stockRequestId: stockRequest.id,
                  adminId: authUser.id,
                  adminstockId: toUserId,
                  transferId: result.transferId,
                  itemCount: items.length,
                  totalValue
                }, req);
              }
            }
          }
        } catch (stockRequestError: any) {
          // Log but don't fail the transfer if stock request creation fails
          logger.error('Failed to create stock request for binary stock admin transfer', {
            error: stockRequestError.message,
            stack: stockRequestError.stack,
            adminId: authUser.id,
            adminstockId: toUserId,
            transferId: result.transferId
          }, req);
        }
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
      console.error('❌ Binary stock transfer error:', error);
      logger.error('Binary stock transfer failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, req);
      return ApiResponseUtil.error('Failed to transfer stock');
    }
  })(request);
}
