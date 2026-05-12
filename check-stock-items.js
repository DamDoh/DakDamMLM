const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStockItems() {
  try {
    console.log('📋 Checking all Stock Items in database:\n');
    
    const stockItems = await prisma.stockItem.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        pv: true,
        quantity: true,
        category: true
      }
    });
    
    if (stockItems.length === 0) {
      console.log('❌ No stock items found in database!');
    } else {
      console.log(`✅ Found ${stockItems.length} stock items:\n`);
      
      stockItems.forEach((item, index) => {
        console.log(`${index + 1}. "${item.name}"`);
        console.log(`   - Price: $${item.price}`);
        console.log(`   - PV: ${item.pv}`);
        console.log(`   - Quantity: ${item.quantity}`);
        console.log(`   - Category: ${item.category}`);
        console.log('');
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkStockItems();
