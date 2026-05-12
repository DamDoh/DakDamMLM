const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addEcommerceProducts() {
  try {
    console.log('🛍️ Adding 3 products to Product Catalog...\n');

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
        description: 'Premium quality super chitin powder supplement for health and wellness. Rich in nutrients and beneficial compounds.',
        price: 25.00,
        pv: 20.00,
        qty: 100,
        category: 'Supplements',
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
        isActive: true,
        unitType: 'bottle',
        type: 'single',
        originalPrice: 30.00,
        rating: 4.5,
        companyId: adminUser.companyId,
        isGlobalProduct: false
      },
      {
        name: 'Organic Fertilizer (Green Label)',
        description: 'High-quality organic fertilizer for plants and crops. Green label variant with balanced nutrients for optimal plant growth.',
        price: 15.00,
        pv: 12.00,
        qty: 150,
        category: 'Agriculture',
        imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
        isActive: true,
        unitType: 'bottle',
        type: 'single',
        originalPrice: 18.00,
        rating: 4.7,
        companyId: adminUser.companyId,
        isGlobalProduct: false
      },
      {
        name: 'Organic Fertilizer (Orange Label)',
        description: 'Premium organic fertilizer for plants and crops. Orange label variant specially formulated for fruit and vegetable cultivation.',
        price: 15.00,
        pv: 12.00,
        qty: 150,
        category: 'Agriculture',
        imageUrl: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400',
        isActive: true,
        unitType: 'bottle',
        type: 'single',
        originalPrice: 18.00,
        rating: 4.6,
        companyId: adminUser.companyId,
        isGlobalProduct: false
      }
    ];

    for (const product of products) {
      const created = await prisma.product.create({
        data: product
      });

      console.log(`✅ Created: ${created.name}`);
      console.log(`   - Price: $${created.price}`);
      console.log(`   - PV: ${created.pv}`);
      console.log(`   - Quantity: ${created.qty}`);
      console.log(`   - Category: ${created.category}`);
      console.log(`   - Rating: ${created.rating}⭐`);
      console.log(`   - Image: ${created.imageUrl}\n`);
    }

    console.log('🎉 All 3 products added to Product Catalog successfully!');
    console.log('\n📍 View them at: http://localhost:3000/admin/products');

  } catch (error) {
    console.error('❌ Error adding products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addEcommerceProducts();
