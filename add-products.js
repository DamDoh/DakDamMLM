const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addProducts() {
  try {
    console.log('🌟 Adding 3 products...\n');

    // Get the admin user's company
    const adminUser = await prisma.user.findFirst({
      where: { isAdmin: true },
      select: { id: true, companyId: true }
    });

    if (!adminUser) {
      console.error('❌ No admin user found');
      return;
    }

    const products = [
      {
        name: 'Super Chitin Powder',
        price: 25.00,
        pv: 20.00,
        quantity: 100,
        code: 'SCP-001',
        category: 'Supplements',
        description: 'Premium quality super chitin powder supplement for health and wellness'
      },
      {
        name: 'Organic Fertilizer (Green Label)',
        price: 15.00,
        pv: 12.00,
        quantity: 150,
        code: 'ORG-001',
        category: 'Agriculture',
        description: 'Organic fertilizer for plants and crops - Green label variant'
      },
      {
        name: 'Organic Fertilizer (Orange Label)',
        price: 15.00,
        pv: 12.00,
        quantity: 150,
        code: 'ORG-002',
        category: 'Agriculture',
        description: 'Organic fertilizer for plants and crops - Orange label variant'
      }
    ];

    for (const product of products) {
      const created = await prisma.stockItem.create({
        data: {
          ...product,
          companyId: adminUser.companyId
        }
      });

      console.log(`✅ Created: ${created.name}`);
      console.log(`   - Price: $${created.price}`);
      console.log(`   - PV: ${created.pv}`);
      console.log(`   - Quantity: ${created.quantity}`);
      console.log(`   - Code: ${created.code}`);
      console.log(`   - Category: ${created.category}\n`);
    }

    console.log('🎉 All 3 products added successfully!');

  } catch (error) {
    console.error('❌ Error adding products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addProducts();
