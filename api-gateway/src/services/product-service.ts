'use server';

import { prisma } from '@/lib/database';
import type { Product, PackageItem } from '@/lib/types';
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
          imageUrl: 'prod_001_img',
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
          imageUrl: 'prod_002_img',
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
          imageUrl: 'prod_003_img',
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
          imageUrl: 'prod_004_img',
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
          imageUrl: 'prod_005_img',
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
          imageUrl: 'prod_006_img',
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
          imageUrl: 'prod_007_img',
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
          imageUrl: 'prod_008_img',
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
          imageUrl: 'prod_001_img',
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
            imageUrl: product.imageUrl,
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
      packageItems: productData.packageItems ? JSON.stringify(productData.packageItems) : null,
      rating: productData.rating,
    };

    const createdProduct = await prisma.product.create({
      data: newProduct as any,
    });

    revalidatePath('/admin/products');
    revalidatePath('/product');
    // Convert Prisma result to Product type with proper packageItems handling
    const product: Product = {
      ...createdProduct,
      description: createdProduct.description || '',
      imageUrl: createdProduct.imageUrl || '',
      type: createdProduct.type as 'single' | 'package',
      originalPrice: createdProduct.originalPrice ?? undefined,
      rating: createdProduct.rating ?? undefined,
      companyId: createdProduct.companyId ?? undefined,
      packageItems: createdProduct.packageItems 
        ? (typeof createdProduct.packageItems === 'string' 
            ? (JSON.parse(createdProduct.packageItems) as PackageItem[])
            : (createdProduct.packageItems as any) as PackageItem[])
        : undefined
    };
    return product;
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

// Seed initial products on startup (non-blocking)
seedInitialProducts().catch(console.error);


