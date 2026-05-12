'use server';

import { prisma } from '@/lib/database';
import type { Product } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// Helper to seed initial products (executed on module load)
async function seedInitialProducts() {
  try {
    const productCount = await prisma.product.count();

    if (productCount === 0) {
      console.log('No products found, seeding initial data...');

      const initialProducts: Omit<Product, 'id'>[] = [
        {
          name: 'Wellness Shake',
          description: 'A balanced nutritional shake for daily health.',
          price: 49.99,
          pv: 40,
          qty: 100,
          category: 'Nutrition',
          imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'tub',
        },
        {
          name: 'Energy Boost Capsules',
          description: 'Natural energy booster for your active lifestyle.',
          price: 29.99,
          pv: 25,
          qty: 200,
          category: 'Supplements',
          imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'bottle',
        },
        {
          name: 'Youthful Glow Serum',
          description: 'Advanced formula for radiant and youthful skin.',
          price: 79.99,
          pv: 65,
          qty: 50,
          category: 'Skincare',
          imageUrl: 'https://images.unsplash.com/photo-1556228720-da4a4cb0ccb5?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'bottle',
        },
        {
          name: 'Immune Support Tincture',
          description: 'Herbal blend to support a strong immune system.',
          price: 34.99,
          pv: 30,
          qty: 150,
          category: 'Wellness',
          imageUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'bottle',
        },
        {
          name: 'Organic Greens Powder',
          description: 'A scoop of daily greens to alkalize your body.',
          price: 54.99,
          pv: 45,
          qty: 80,
          category: 'Nutrition',
          imageUrl: 'https://images.unsplash.com/photo-1606787947360-698bdc0f45b5?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'tub',
        },
        {
          name: 'Restful Sleep Aid',
          description: "Natural ingredients to promote a restful night's sleep.",
          price: 44.99,
          pv: 35,
          qty: 120,
          category: 'Wellness',
          imageUrl: 'https://images.unsplash.com/photo-1506220926022-cc5c12acdb35?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'bottle',
        },
        {
          name: 'Joint Mobility Complex',
          description: 'Support for healthy and flexible joints.',
          price: 64.99,
          pv: 50,
          qty: 90,
          category: 'Supplements',
          imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'bottle',
        },
        {
          name: 'Probiotic Gut Health',
          description: 'Enhance your digestive wellness with our probiotic blend.',
          price: 39.99,
          pv: 32,
          qty: 110,
          category: 'Wellness',
          imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&h=400&fit=crop',
          isActive: true,
          type: 'single',
          unitType: 'bottle',
        },
        {
          name: 'Starter Kit',
          description:
            'A curated package of our best-selling products to kickstart your journey.',
          price: 199.99,
          pv: 150,
          qty: 20,
          category: 'Packages',
          imageUrl: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop',
          isActive: true,
          type: 'package',
          unitType: 'kit',
        },
      ];

      for (let index = 0; index < initialProducts.length; index++) {
        const product = initialProducts[index];
        const id = `prod_${String(index + 1).padStart(3, '0')}`;

        await prisma.product.create({
          data: {
            id,
            name: product.name,
            description: product.description,
            price: product.price,
            pv: product.pv || 0,
            qty: product.qty,
          category: product.category,
          imageUrl: product.imageUrl || null,
          isActive: product.isActive,
            unitType: product.unitType,
            type: product.type,
          },
        });
      }

      console.log('Initial product data seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding products:', error);
  }
}

export async function addProduct(productData: Omit<Product, 'id'>): Promise<Product> {
  try {
    const productId = `prod_${String(Date.now()).padStart(3, '0')}`;

    const newProduct = {
      id: productId,
      name: productData.name,
      description: productData.description,
      price: productData.price,
      pv: productData.pv || 0,
      qty: productData.qty,
      // Category is required in the Prisma schema; default to "General" if not provided
      category: productData.category ?? 'General',
      imageUrl: productData.imageUrl,
      isActive: productData.isActive ?? true,
      unitType: productData.unitType,
      type: productData.type,
      originalPrice: productData.originalPrice,
      // Prisma JSON fields require casting to any for complex types
      packageItems: productData.packageItems !== null ? (productData.packageItems as any) : undefined,
      rating: productData.rating,
    };

    const createdProduct = await prisma.product.create({
      data: newProduct,
    });

    revalidatePath('/admin/products');
    revalidatePath('/product');
    
    // Transform Prisma result to match Product type (handle nullable fields and JSON types)
    return {
      ...createdProduct,
      description: createdProduct.description ?? '',
      imageUrl: createdProduct.imageUrl ?? '',
      packageItems: createdProduct.packageItems ? (createdProduct.packageItems as any) : undefined,
    } as Product;
  } catch (error) {
    console.error('Error creating product:', error);
    throw new Error('Failed to create product');
  }
}

export async function updateProduct(
  productId: string,
  productData: Partial<Product>
): Promise<void> {
  try {
    const updateData: any = {};

    if (productData.name !== undefined) updateData.name = productData.name;
    if (productData.description !== undefined) updateData.description = productData.description;
    if (productData.price !== undefined) updateData.price = productData.price;
    if (productData.pv !== undefined) updateData.pv = productData.pv;
    if (productData.qty !== undefined) updateData.qty = productData.qty;
    if (productData.category !== undefined) updateData.category = productData.category;
    if (productData.imageUrl !== undefined) updateData.imageUrl = productData.imageUrl;
    if (productData.isActive !== undefined) updateData.isActive = productData.isActive;
    if (productData.unitType !== undefined) updateData.unitType = productData.unitType;
    if (productData.type !== undefined) updateData.type = productData.type;
    if (productData.originalPrice !== undefined) updateData.originalPrice = productData.originalPrice;
    if (productData.packageItems !== undefined) updateData.packageItems = productData.packageItems;
    if (productData.rating !== undefined) updateData.rating = productData.rating;

    await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    revalidatePath('/admin/products');
    revalidatePath('/product');
  } catch (error) {
    console.error('Error updating product:', error);
    throw new Error('Failed to update product');
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  try {
    // Actually delete the product from the database
    await prisma.product.delete({
      where: { id: productId },
    });

    revalidatePath('/admin/products');
    revalidatePath('/product');
  } catch (error) {
    console.error('Error deleting product:', error);
    throw new Error('Failed to delete product');
  }
}

export async function deleteAllProducts(): Promise<{ count: number }> {
  try {
    // Delete all products from the database
    const result = await prisma.product.deleteMany({});
    
    revalidatePath('/admin/products');
    revalidatePath('/product');
    
    return { count: result.count };
  } catch (error) {
    console.error('Error deleting all products:', error);
    throw new Error('Failed to delete all products');
  }
}

// Function to reset all products (delete and add new ones)
export async function resetAllProducts(): Promise<void> {
  try {
    console.log('Starting product reset...');

    // Delete all existing products
    const deleteResult = await prisma.product.deleteMany({});
    console.log(`Deleted ${deleteResult.count} existing products`);

    // New products with valid structure and placeholder images
    const newProducts: Omit<Product, 'id'>[] = [
      {
        name: 'Premium Wellness Shake',
        description: 'A nutritious shake packed with vitamins and minerals for optimal health.',
        price: 59.99,
        pv: 50,
        qty: 150,
        category: 'Nutrition',
        imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'tub',
      },
      {
        name: 'Super Energy Capsules',
        description: 'Sustained energy boost with natural ingredients for peak performance.',
        price: 39.99,
        pv: 35,
        qty: 250,
        category: 'Supplements',
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'bottle',
      },
      {
        name: 'Age-Defying Serum',
        description: 'Advanced anti-aging formula with collagen and peptides for radiant skin.',
        price: 89.99,
        pv: 75,
        qty: 75,
        category: 'Skincare',
        imageUrl: 'https://images.unsplash.com/photo-1556228720-da4a4cb0ccb5?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'bottle',
      },
      {
        name: 'Immune Defense Complex',
        description: 'Powerful herbal blend to strengthen your immune system naturally.',
        price: 44.99,
        pv: 40,
        qty: 180,
        category: 'Wellness',
        imageUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'bottle',
      },
      {
        name: 'Super Greens Powder',
        description: 'Organic superfood blend for daily detox and energy boost.',
        price: 64.99,
        pv: 55,
        qty: 100,
        category: 'Nutrition',
        imageUrl: 'https://images.unsplash.com/photo-1606787947360-698bdc0f45b5?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'tub',
      },
      {
        name: 'Deep Sleep Formula',
        description: 'Natural sleep support with melatonin and calming herbs for restful nights.',
        price: 49.99,
        pv: 42,
        qty: 140,
        category: 'Wellness',
        imageUrl: 'https://images.unsplash.com/photo-1506220926022-cc5c12acdb35?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'bottle',
      },
      {
        name: 'Joint Support Complex',
        description: 'Comprehensive joint health formula with glucosamine and MSM.',
        price: 69.99,
        pv: 60,
        qty: 110,
        category: 'Supplements',
        imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'bottle',
      },
      {
        name: 'Digestive Health Probiotics',
        description: 'High-potency probiotic blend for optimal gut health and digestion.',
        price: 54.99,
        pv: 48,
        qty: 160,
        category: 'Wellness',
        imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&h=400&fit=crop',
        isActive: true,
        type: 'single',
        unitType: 'bottle',
      },
      {
        name: 'Ultimate Starter Pack',
        description: 'Complete wellness package including our top 5 best-selling products.',
        price: 249.99,
        pv: 200,
        qty: 30,
        category: 'Packages',
        imageUrl: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop',
        isActive: true,
        type: 'package',
        unitType: 'kit',
      },
    ];

    // Create new products
    for (let index = 0; index < newProducts.length; index++) {
      const product = newProducts[index];
      const id = `prod_${String(index + 1).padStart(3, '0')}`;

      await prisma.product.create({
        data: {
          id,
          name: product.name,
          description: product.description,
          price: product.price,
          pv: product.pv || 0,
          qty: product.qty,
          category: product.category,
          imageUrl: product.imageUrl || null,
          isActive: product.isActive,
          unitType: product.unitType,
          type: product.type,
        },
      });
    }

    console.log(`Successfully created ${newProducts.length} new products.`);
    revalidatePath('/admin/products');
    revalidatePath('/product');
  } catch (error) {
    console.error('Error resetting products:', error);
    throw new Error('Failed to reset products');
  }
}

// Seed initial products on startup (non-blocking)
seedInitialProducts().catch(console.error);


