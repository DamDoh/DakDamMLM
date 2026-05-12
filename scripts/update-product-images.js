const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Map product names to image URLs
const imageMap = {
  'Wellness Shake': 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop',
  'Energy Boost Capsules': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop',
  'Youthful Glow Serum': 'https://images.unsplash.com/photo-1556228720-da4a4cb0ccb5?w=400&h=400&fit=crop',
  'Immune Support Tincture': 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=400&fit=crop',
  'Organic Greens Powder': 'https://images.unsplash.com/photo-1606787947360-698bdc0f45b5?w=400&h=400&fit=crop',
  'Restful Sleep Aid': 'https://images.unsplash.com/photo-1506220926022-cc5c12acdb35?w=400&h=400&fit=crop',
  'Joint Mobility Complex': 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop',
  'Probiotic Gut Health': 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&h=400&fit=crop',
  'Starter Kit': 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop',
  'Premium Wellness Shake': 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop',
  'Super Energy Capsules': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop',
  'Age-Defying Serum': 'https://images.unsplash.com/photo-1556228720-da4a4cb0ccb5?w=400&h=400&fit=crop',
  'Immune Defense Complex': 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=400&fit=crop',
  'Super Greens Powder': 'https://images.unsplash.com/photo-1606787947360-698bdc0f45b5?w=400&h=400&fit=crop',
  'Deep Sleep Formula': 'https://images.unsplash.com/photo-1506220926022-cc5c12acdb35?w=400&h=400&fit=crop',
  'Joint Support Complex': 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop',
  'Digestive Health Probiotics': 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&h=400&fit=crop',
  'Ultimate Starter Pack': 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop',
};

async function updateProductImages() {
  try {
    console.log('Updating product images...');
    
    const products = await prisma.product.findMany();
    
    let updatedCount = 0;
    
    for (const product of products) {
      // Check if product needs image update (empty, null, or old format)
      if (!product.imageUrl || 
          product.imageUrl === '' || 
          product.imageUrl.startsWith('prod_') && product.imageUrl.endsWith('_img')) {
        
        const imageUrl = imageMap[product.name] || 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop';
        
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl },
        });
        
        console.log(`Updated ${product.name} with image URL`);
        updatedCount++;
      }
    }
    
    console.log(`\nCompleted! Updated ${updatedCount} products.`);
  } catch (error) {
    console.error('Error updating product images:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateProductImages();

