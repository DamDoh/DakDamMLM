import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/lib/api-response';

type SuccessItem = { productId: string; productName: string; quantity: number; price: number; pv: number };

/**
 * POST /api/inventory/transfer-from-catalog
 * Transfer catalog product stock (Product.qty) to a member.
 * Admin only. Deducts from Product.qty, adds to member inventory, and creates a
 * StockRequest record so the transaction is visible to both admin and receiver.
 */
export async function POST(request: NextRequest) {
  try {
    return await requireAuth(async (authenticatedRequest) => {
      const user = authenticatedRequest.user;
      if (!user?.id) {
        return ApiResponseUtil.unauthorized('User authentication failed');
      }
      if (!user.isAdmin) {
        return ApiResponseUtil.forbidden('Only admins can transfer from catalog');
      }

      const body = await request.json();
      const { toUserId, items } = body as { toUserId?: string; items?: Array<{ productId: string; quantity: number }> };

      if (!toUserId || !items || !Array.isArray(items) || items.length === 0) {
        return ApiResponseUtil.error('toUserId and items (array of { productId, quantity }) are required', 400);
      }

      const recipient = await prisma.user.findUnique({
        where: { id: toUserId },
        select: { id: true, fullName: true, storeOwnerLevel: true, pv: true, rank: true },
      });
      if (!recipient) {
        return ApiResponseUtil.error('Recipient not found', 404);
      }

      if (!(prisma as any).inventoryTransaction) {
        return ApiResponseUtil.error('Inventory transaction functionality not available', 500);
      }

      const results: Array<{ productId: string; productName: string; quantity: number; ok: boolean; error?: string }> = [];
      const successItems: SuccessItem[] = [];

      for (const item of items) {
        const productId = item?.productId;
        const quantity = Number(item?.quantity);
        if (!productId || !Number.isInteger(quantity) || quantity < 1) {
          results.push({ productId: productId || '', productName: '', quantity: 0, ok: false, error: 'Invalid item' });
          continue;
        }

        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, name: true, qty: true, price: true, pv: true },
        });

        if (!product) {
          results.push({ productId, productName: '', quantity, ok: false, error: 'Product not found' });
          continue;
        }

        const available = product.qty ?? 0;
        if (available < quantity) {
          results.push({
            productId,
            productName: product.name,
            quantity,
            ok: false,
            error: `Insufficient quantity. Available: ${available}`,
          });
          continue;
        }

        try {
          await prisma.$transaction([
            prisma.product.update({
              where: { id: productId },
              data: { qty: available - quantity },
            }),
            (prisma as any).inventoryTransaction.create({
              data: {
                userId: toUserId,
                productId,
                type: 'transfer',
                quantity,
                previousQty: 0,
                newQty: quantity,
                reference: 'Stock transfer from admin (catalog)',
                reason: `Transfer of ${product.name}`,
                createdBy: user.id,
              },
            }),
          ]);
        } catch (txError: any) {
          logger.error('Transfer from catalog transaction failed', {
            productId,
            toUserId,
            quantity,
            error: txError?.message,
          }, request);
          results.push({
            productId,
            productName: product.name,
            quantity,
            ok: false,
            error: txError?.message || 'Transaction failed',
          });
          continue;
        }

        const price = Number(product.price) || 0;
        const pv = Number(product.pv) || 0;
        results.push({ productId, productName: product.name, quantity, ok: true });
        successItems.push({ productId, productName: product.name, quantity, price, pv });
      }

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0 && failed.length === results.length) {
        return ApiResponseUtil.error(
          failed[0]?.error || 'Transfer failed',
          400
        );
      }

      // Create one StockRequest so the transaction is visible to both admin and receiver
      if (successItems.length > 0 && (prisma as any).stockRequest) {
        try {
          const adminInfo = await prisma.user.findUnique({
            where: { id: user.id },
            select: { firstName: true, surname: true, fullName: true },
          });
          const adminName = adminInfo?.fullName ||
            `${adminInfo?.firstName ?? ''} ${adminInfo?.surname ?? ''}`.trim() || 'Admin';

          const totalValue = successItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
          const totalPV = successItems.reduce((sum, i) => sum + i.pv * i.quantity, 0);
          const itemCount = successItems.reduce((sum, i) => sum + i.quantity, 0);

          const stockRequest = await (prisma as any).stockRequest.create({
            data: {
              stockistId: toUserId,
              stockistName: `ADMIN_TRANSFER:${adminName}`,
              stockistLevel: recipient.storeOwnerLevel || 'District',
              requesterId: toUserId,
              requesterName: recipient.fullName,
              fromUserId: user.id,
              toUserId: toUserId,
              status: 'approved',
              processedBy: user.id,
              processedDate: new Date(),
              totalValue,
              totalPV,
              itemCount,
              notes: 'Catalog transfer from admin',
              items: {
                create: successItems.map((i) => ({
                  productId: i.productId,
                  productName: i.productName,
                  requestedQuantity: i.quantity,
                  approvedQuantity: i.quantity,
                  unitPrice: i.price,
                  pv: i.pv,
                })),
              },
            },
            include: { items: true },
          });

          logger.info('Stock request created for catalog transfer', {
            stockRequestId: stockRequest.id,
            adminId: user.id,
            toUserId,
            itemCount: successItems.length,
          }, request);

          try {
            const { createNotification } = await import('@/services/notification-service');
            await createNotification(
              toUserId,
              'stock-request-approved',
              {
                requestId: stockRequest.id.substring(0, 8),
                itemCount: String(itemCount),
              },
              'high',
              {
                requestId: stockRequest.id,
                type: 'stock_transfer_received',
                stockRequestId: stockRequest.id,
                link: '/my-stock',
              }
            );
          } catch (notifErr) {
            logger.error('Failed to send notification for catalog transfer', {
              error: notifErr instanceof Error ? notifErr.message : 'Unknown',
              toUserId,
            }, request);
          }
        } catch (srError: any) {
          logger.error('Failed to create stock request for catalog transfer', {
            error: srError?.message,
            toUserId,
          }, request);
          // Don't fail the response – transfer already succeeded
        }
      }

      // PV visibility on E-comm: normal member → PV/Product; adminstock → PV/Stock (and My Stock already shows inventory)
      const totalPV = successItems.reduce((sum, i) => sum + i.pv * i.quantity, 0);
      if (totalPV > 0) {
        const hasStockLevel = recipient.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(recipient.storeOwnerLevel);
        const referenceType = hasStockLevel ? 'stock_transfer' : 'product_purchase';
        const productNames = successItems.map((i) => `${i.quantity}x ${i.productName}`).join(', ');
        try {
          let recipientWallet = await prisma.wallet.findUnique({
            where: { userId: toUserId },
          });
          if (!recipientWallet) {
            recipientWallet = await prisma.wallet.create({
              data: {
                userId: toUserId,
                balance: 0,
                currency: 'USD',
                isActive: true,
              },
            });
          }
          const balance = Number(recipientWallet.balance) || 0;
          await prisma.walletTransaction.create({
            data: {
              walletId: recipientWallet.id,
              type: 'credit',
              amount: totalPV,
              balanceBefore: balance,
              balanceAfter: balance,
              description: hasStockLevel
                ? `Stock transfer from Admin (catalog): ${productNames}`
                : `Catalog transfer from Admin: ${productNames}`,
              referenceId: (successItems[0]?.productId) ?? 'catalog-transfer',
              referenceType,
              status: 'completed',
            },
          });
          logger.info('Catalog transfer PV wallet transaction created', {
            toUserId,
            totalPV,
            referenceType,
            hasStockLevel,
          }, request);
        } catch (walletErr: any) {
          logger.error('Failed to create PV wallet transaction for catalog transfer', {
            error: walletErr?.message,
            toUserId,
            totalPV,
          }, request);
        }

        // CRITICAL: Update user PV/rank and sponsor waiting PV so Current Period Volume reflects the transfer
        // Same pattern as stock-requests approval and inventory-service (skip for AdminStock)
        const isRecipientAdminStock = recipient.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(recipient.storeOwnerLevel);
        if (!isRecipientAdminStock) {
          const currentPV = Number(recipient.pv) || 0;
          const newPV = currentPV + totalPV;
          try {
            const { shouldUpdateRank } = await import('@/lib/rank');
            const rankUpdateResult = shouldUpdateRank((recipient.rank as any) || 'Member', newPV);
            const updateData: { pv: number; pvDate: Date; rank?: string } = {
              pv: newPV,
              pvDate: new Date(),
            };
            if (rankUpdateResult.shouldUpdate && rankUpdateResult.newRank) {
              updateData.rank = rankUpdateResult.newRank;
            }
            await prisma.user.update({
              where: { id: toUserId },
              data: updateData,
            });
            const { PVMatchingService } = await import('@/services/pv-matching-service');
            await PVMatchingService.handlePVChange(toUserId, currentPV, newPV);
            logger.info('Catalog transfer: user PV/rank and sponsor waiting PV updated for Current Period Volume', {
              toUserId,
              currentPV,
              newPV,
              pvDifference: totalPV,
            }, request);
          } catch (pvErr: any) {
            logger.error('Failed to update user PV / sponsor waiting PV after catalog transfer', {
              error: pvErr?.message,
              toUserId,
              totalPV,
            }, request);
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: { results, recipient: { id: recipient.id, fullName: recipient.fullName } },
        message: failed.length > 0
          ? `Transferred with ${failed.length} item(s) failed`
          : 'Transfer completed successfully',
      }, { status: 200 });
    })(request);
  } catch (error: any) {
    logger.error('Transfer from catalog error', { error: error?.message }, request);
    return ApiResponseUtil.error(error?.message || 'Transfer failed', 500);
  }
}
