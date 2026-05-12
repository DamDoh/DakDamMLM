/**
 * Backfill script to create stock requests for RiThy VoNg's admin transfers
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillRiThyTransfers() {
  try {
    console.log('🔄 Starting backfill for RiThy VoNg transfers...\n');

    // Find RiThy VoNg
    const ritthy = await prisma.user.findFirst({
      where: {
        OR: [
          { fullName: { contains: 'RiThy', mode: 'insensitive' } },
          { fullName: { contains: 'VoNg', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        fullName: true,
        storeOwnerLevel: true,
        isAdmin: true
      }
    });

    if (!ritthy) {
      console.log('❌ RiThy VoNg not found');
      return;
    }

    console.log(`👤 Found user: ${ritthy.fullName} (ID: ${ritthy.id}, Level: ${ritthy.storeOwnerLevel})\n`);

    // Get admin user
    const admin = await prisma.user.findFirst({
      where: {
        id: 'admin-user-1'
      },
      select: {
        id: true,
        firstName: true,
        surname: true,
        fullName: true
      }
    });

    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }

    const adminName = admin.fullName || `${admin.firstName || ''} ${admin.surname || ''}`.trim() || 'Admin';
    console.log(`👤 Admin: ${adminName}\n`);

    // Find all transfer transactions for RiThy VoNg
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        userId: ritthy.id,
        type: 'transfer',
        createdBy: admin.id
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📦 Found ${transactions.length} transfer transactions\n`);

    if (transactions.length === 0) {
      console.log('✅ No transactions to backfill.');
      return;
    }

    // Group by transfer reference (same transfer = same reference)
    const transferGroups = new Map();

    for (const transaction of transactions) {
      const reference = transaction.reference || `TRANSFER-${transaction.createdAt.getTime()}`;
      
      if (!transferGroups.has(reference)) {
        transferGroups.set(reference, {
          reference,
          createdAt: transaction.createdAt,
          items: []
        });
      }
      
      transferGroups.get(reference).items.push(transaction);
    }

    console.log(`📊 Grouped into ${transferGroups.size} unique transfers\n`);

    let created = 0;
    let skipped = 0;

    // Process each transfer group
    for (const [reference, group] of transferGroups) {
      try {
        // Check if stock request already exists
        const existingRequest = await prisma.stockRequest.findFirst({
          where: {
            stockistId: ritthy.id,
            stockistName: { startsWith: `ADMIN_TRANSFER:${adminName}` },
            items: {
              some: {
                productId: { in: group.items.map(i => i.productId) }
              }
            },
            createdDate: {
              gte: new Date(group.createdAt.getTime() - 60000), // Within 1 minute
              lte: new Date(group.createdAt.getTime() + 60000)
            }
          }
        });

        if (existingRequest) {
          console.log(`⏭️  Skipping: Stock request already exists for transfer ${reference}`);
          skipped++;
          continue;
        }

        // Process items
        let totalValue = 0;
        let totalQuantity = 0;
        const stockRequestItems = [];

        for (const transaction of group.items) {
          // Get product/stockItem details
          let productName = 'Unknown Product';
          let unitPrice = 0;

          // Try Product first
          const product = await prisma.product.findUnique({
            where: { id: transaction.productId },
            select: { name: true, price: true, pv: true }
          }).catch(() => null);

          if (product) {
            productName = product.name;
            unitPrice = product.price || 0;
          } else {
            // Try StockItem
            const stockItem = await prisma.stockItem.findUnique({
              where: { id: transaction.productId },
              select: { name: true, price: true, pv: true }
            }).catch(() => null);

            if (stockItem) {
              productName = stockItem.name;
              unitPrice = stockItem.price || 0;
            }
          }

          const quantity = Number(transaction.quantity) || 0;
          const itemValue = unitPrice * quantity;
          totalValue += itemValue;
          totalQuantity += quantity;

          stockRequestItems.push({
            productId: transaction.productId,
            productName: productName,
            requestedQuantity: quantity,
            unitPrice: unitPrice,
            approvedQuantity: quantity
          });
        }

        // Create stock request
        const stockRequest = await prisma.stockRequest.create({
          data: {
            stockistId: ritthy.id,
            stockistName: `ADMIN_TRANSFER:${adminName}`,
            stockistLevel: ritthy.storeOwnerLevel || 'District',
            status: 'approved',
            processedBy: admin.id,
            processedDate: group.createdAt,
            createdDate: group.createdAt,
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

        console.log(`✅ Created stock request for transfer ${reference}:`);
        console.log(`   - Items: ${stockRequestItems.length}`);
        console.log(`   - Total Quantity: ${totalQuantity}`);
        console.log(`   - Total Value: $${totalValue.toFixed(2)}`);
        console.log(`   - Stock Request ID: ${stockRequest.id}`);
        console.log(`   - Items:`);
        stockRequestItems.forEach(item => {
          console.log(`     • ${item.productName}: ${item.requestedQuantity} x $${item.unitPrice.toFixed(2)} = $${(item.requestedQuantity * item.unitPrice).toFixed(2)}`);
        });
        console.log('');

        created++;
      } catch (error) {
        console.error(`❌ Error processing transfer ${reference}:`, error.message);
        console.error(error.stack);
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Created: ${created} stock requests`);
    console.log(`   ⏭️  Skipped: ${skipped} transfers`);
    console.log('\n✅ Backfill completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

backfillRiThyTransfers();

