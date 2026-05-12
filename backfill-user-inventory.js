const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillInventory() {
  try {
    console.log('🔄 Starting inventory backfill for RiThy VoNg...\n');
    
    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { fullName: { contains: 'RiThy', mode: 'insensitive' } },
          { fullName: { contains: 'VoNg', mode: 'insensitive' } }
        ]
      },
      select: { id: true, fullName: true, memberId: true }
    });

    if (!user) {
      console.error('❌ User not found');
      return;
    }

    console.log(`✅ Found user: ${user.fullName} (${user.memberId})`);
    console.log(`   User ID: ${user.id}\n`);

    // Find stock transfer transactions for this user
    const stockTransfers = await prisma.inventoryTransaction.findMany({
      where: {
        userId: user.id,
        type: 'transfer',
        reason: {
          contains: 'Stock transfer'
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📦 Found ${stockTransfers.length} stock transfer transactions\n`);

    let created = 0;

    for (const transaction of stockTransfers) {
      const stockItem = await prisma.stockItem.findUnique({
        where: { id: transaction.productId },
        select: { id: true, name: true, description: true }
      });

      if (!stockItem || !stockItem.description || !stockItem.description.includes('Contains:')) {
        continue;
      }

      console.log(`📋 Processing: ${stockItem.name}`);
      console.log(`   Transaction: ${transaction.id}`);

      const transferQty = Number(transaction.quantity) || 1;
      const containsText = stockItem.description.split('Contains:')[1].trim();
      const productEntries = containsText.split(',').map(e => e.trim());

      // Get all products
      const allProducts = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      });

      for (const entry of productEntries) {
        const match = entry.match(/^(.+?)\s*\((\d+)\)$/);
        if (!match) continue;

        const productName = match[1].trim();
        const qtyPerStock = parseInt(match[2], 10);
        const totalQty = qtyPerStock * transferQty;

        // Find product
        const normalizedName = productName.toLowerCase();
        const product = allProducts.find(p => {
          const pName = p.name.toLowerCase();
          return p.name.trim() === productName || 
                 pName === normalizedName ||
                 p.name.includes(productName) ||
                 productName.includes(p.name);
        });

        if (!product) {
          console.warn(`   ⚠️  Product not found: ${productName}`);
          continue;
        }

        // Check if transaction already exists
        const exists = await prisma.inventoryTransaction.findFirst({
          where: {
            userId: user.id,
            productId: product.id,
            type: 'transfer',
            reference: transaction.reference,
            reason: { contains: `Product from stock transfer: ${stockItem.name}` }
          }
        });

        if (exists) {
          console.log(`   ✓ Already exists: ${product.name}`);
          continue;
        }

        // Get current inventory
        const existing = await prisma.inventoryTransaction.findMany({
          where: { userId: user.id, productId: product.id },
          orderBy: { createdAt: 'asc' }
        });

        let currentQty = 0;
        for (const tx of existing) {
          if (['purchase', 'transfer', 'return'].includes(tx.type)) {
            currentQty += Number(tx.quantity) || 0;
          } else if (['sale', 'adjustment'].includes(tx.type)) {
            currentQty -= Number(tx.quantity) || 0;
          }
        }

        // Create transaction
        await prisma.inventoryTransaction.create({
          data: {
            userId: user.id,
            productId: product.id,
            quantity: totalQty,
            previousQty: currentQty,
            newQty: currentQty + totalQty,
            type: 'transfer',
            reference: transaction.reference || `BACKFILL-${Date.now()}`,
            reason: `Product from stock transfer (backfilled): ${stockItem.name} (${transferQty}x) - ${product.name} x${totalQty}`,
            createdBy: transaction.createdBy || 'system',
            companyId: transaction.companyId || undefined,
            createdAt: transaction.createdAt
          }
        });

        console.log(`   ✅ Created: ${product.name} x${totalQty} (qty: ${currentQty} -> ${currentQty + totalQty})`);
        created++;
      }
    }

    console.log(`\n✅ Backfill completed! Created ${created} product transactions.`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillInventory();
