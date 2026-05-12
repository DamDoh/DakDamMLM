const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateProductImages() {
  try {
    console.log('🖼️ Updating product images...\n');

    // Find the products we just created
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: 'Super Chitin Powder' },
          { name: 'Organic Fertilizer (Green Label)' },
          { name: 'Organic Fertilizer (Orange Label)' }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    if (products.length === 0) {
      console.log('❌ No products found to update');
      return;
    }

    // Image mappings - using local paths from public/images folder
    const imageMap = {
      'Super Chitin Powder': '/images/super-chitin-powder.jpg',
      'Organic Fertilizer (Green Label)': '/images/organic-fertilizer-green.jpg',
      'Organic Fertilizer (Orange Label)': '/images/organic-fertilizer-orange.jpg'
    };

    for (const product of products) {
      const imagePath = imageMap[product.name];
      
      if (imagePath) {
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: imagePath }
        });
        
        console.log(`✅ Updated: ${product.name}`);
        console.log(`   Image: ${imagePath}\n`);
      }
    }

    console.log('🎉 All product images updated!');
    console.log('\n📝 Next steps:');
    console.log('1. Save your 3 product images to: /public/images/');
    console.log('   - super-chitin-powder.jpg (Image 1)');
    console.log('   - organic-fertilizer-green.jpg (Image 2)');
    console.log('   - organic-fertilizer-orange.jpg (Image 3)');
    console.log('\n2. Refresh http://localhost:3000/admin/products to see them!');

  } catch (error) {
    console.error('❌ Error updating images:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateProductImages();
