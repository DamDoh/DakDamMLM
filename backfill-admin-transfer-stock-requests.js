/**
 * Backfill script to create stock requests for existing admin transfers
 * This creates transaction/invoice records for admin transfers that happened before the feature was added
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillAdminTransferStockRequests() {
  try {
    console.log('🔄 Starting backfill of admin transfer stock requests...\n');

    // Find all inventory transactions that are transfers from admin
    // These are transactions where:
    // 1. type = 'transfer'
    // 2. reference contains 'admin' or 'Stock transfer from admin'
    // 3. createdBy is an admin user
    const inventoryTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        type: 'transfer',
        OR: [
          { reference: { contains: 'admin', mode: 'insensitive' } },
          { reference: { contains: 'Stock transfer from admin', mode: 'insensitive' } }
        ]
      },
      include: {
        // We'll need to get user info separately
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📦 Found ${inventoryTransactions.length} potential admin transfer transactions\n`);

    if (inventoryTransactions.length === 0) {
      console.log('✅ No transactions to backfill.');
      return;
    }

    // Get all admin users
    const adminUsers = await prisma.user.findMany({
      where: {
        isAdmin: true,
        active: true,
        deleted: false
      },
      select: {
        id: true,
        firstName: true,
        surname: true,
        fullName: true
      }
    });

    const adminIds = new Set(adminUsers.map(a => a.id));
    const adminMap = new Map(adminUsers.map(a => [a.id, a]));

    console.log(`👤 Found ${adminUsers.length} admin users\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Group transactions by userId (recipient) and createdBy (admin)
    const transactionGroups = new Map();

    for (const transaction of inventoryTransactions) {
      // Check if createdBy is an admin
      if (!transaction.createdBy || !adminIds.has(transaction.createdBy)) {
        skipped++;
        continue;
      }

      const key = `${transaction.userId}_${transaction.createdBy}_${transaction.productId}`;
      
      if (!transactionGroups.has(key)) {
        transactionGroups.set(key, {
          userId: transaction.userId,
          createdBy: transaction.createdBy,
          productId: transaction.productId,
          transactions: []
        });
      }
      
      transactionGroups.get(key).transactions.push(transaction);
    }

    console.log(`📊 Grouped into ${transactionGroups.size} unique transfer groups\n`);

    // Process each group
    for (const [key, group] of transactionGroups) {
      try {
        // Get recipient info
        const recipient = await prisma.user.findUnique({
          where: { id: group.userId },
          select: {
            id: true,
            isAdmin: true,
            storeOwnerLevel: true,
            firstName: true,
            surname: true,
            fullName: true
          }
        });

        if (!recipient) {
          console.log(`⚠️  Skipping: Recipient ${group.userId} not found`);
          skipped++;
          continue;
        }

        // Check if recipient is adminstock
        const isAdminstock = recipient.isAdmin === true;
        const hasStockistLevel = recipient.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(recipient.storeOwnerLevel);

        if (!isAdminstock && !hasStockistLevel) {
          console.log(`⚠️  Skipping: Recipient ${recipient.fullName} is not adminstock/stockist`);
          skipped++;
          continue;
        }

        // Check if stock request already exists for this transfer
        const adminInfo = adminMap.get(group.createdBy);
        const adminName = adminInfo?.fullName || 
          `${adminInfo?.firstName || ''} ${adminInfo?.surname || ''}`.trim() || 
          'Admin';

        const existingRequest = await prisma.stockRequest.findFirst({
          where: {
            stockistId: group.userId,
            stockistName: { startsWith: `ADMIN_TRANSFER:${adminName}` },
            items: {
              some: {
                productId: group.productId
              }
            }
          }
        });

        if (existingRequest) {
          console.log(`⏭️  Skipping: Stock request already exists for ${recipient.fullName} - ${group.productId}`);
          skipped++;
          continue;
        }

        // Calculate total quantity and get product details
        const totalQuantity = group.transactions.reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);
        const firstTransaction = group.transactions[0];

        // Get product/stockItem details
        let productName = 'Unknown Product';
        let unitPrice = 0;
        let productPV = 0;

        // Try Product first
        const product = await prisma.product.findUnique({
          where: { id: group.productId },
          select: { name: true, price: true, pv: true }
        }).catch(() => null);

        if (product) {
          productName = product.name;
          unitPrice = product.price || 0;
          productPV = product.pv || 0;
        } else {
          // Try StockItem
          const stockItem = await prisma.stockItem.findUnique({
            where: { id: group.productId },
            select: { name: true, price: true, pv: true }
          }).catch(() => null);

          if (stockItem) {
            productName = stockItem.name;
            unitPrice = stockItem.price || 0;
            productPV = stockItem.pv || 0;
          }
        }

        const totalValue = unitPrice * totalQuantity;

        // Create stock request
        const stockRequest = await prisma.stockRequest.create({
          data: {
            stockistId: group.userId,
            stockistName: `ADMIN_TRANSFER:${adminName}`,
            stockistLevel: recipient.storeOwnerLevel || 'District',
            status: 'approved',
            processedBy: group.createdBy,
            processedDate: firstTransaction.createdAt,
            totalValue,
            itemCount: totalQuantity,
            items: {
              create: [{
                productId: group.productId,
                productName: productName,
                requestedQuantity: totalQuantity,
                unitPrice: unitPrice,
                approvedQuantity: totalQuantity
              }]
            }
          },
          include: {
            items: true
          }
        });

        console.log(`✅ Created stock request for ${recipient.fullName}:`);
        console.log(`   - Product: ${productName}`);
        console.log(`   - Quantity: ${totalQuantity}`);
        console.log(`   - Total Value: $${totalValue.toFixed(2)}`);
        console.log(`   - Stock Request ID: ${stockRequest.id}\n`);

        created++;
      } catch (error) {
        console.error(`❌ Error processing group ${key}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Created: ${created} stock requests`);
    console.log(`   ⏭️  Skipped: ${skipped} transactions`);
    console.log(`   ❌ Errors: ${errors} transactions`);
    console.log('\n✅ Backfill completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillAdminTransferStockRequests();

