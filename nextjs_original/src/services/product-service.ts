
'use server';

import { prisma } from '@/lib/database';
import type { Product } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// Helper to seed initial products
async function seedInitialProducts() {
    try {
        const productCount = await prisma.product.count();

        if (productCount === 0) {
            console.log('No products found, seeding initial data...');

            const initialProducts: Omit<Product, 'id'>[] = [
                { name: "Wellness Shake", description: "A balanced nutritional shake for daily health.", price: 49.99, pv: 40, qty: 100, category: "Nutrition", imageUrl: "prod_001_img", isActive: true, type: 'single', unitType: 'tub' },
                { name: "Energy Boost Capsules", description: "Natural energy booster for your active lifestyle.", price: 29.99, pv: 25, qty: 200, category: "Supplements", imageUrl: "prod_002_img", isActive: true, type: 'single', unitType: 'bottle' },
                { name: "Youthful Glow Serum", description: "Advanced formula for radiant and youthful skin.", price: 79.99, pv: 65, qty: 50, category: "Skincare", imageUrl: "prod_003_img", isActive: true, type: 'single', unitType: 'bottle' },
                { name: "Immune Support Tincture", description: "Herbal blend to support a strong immune system.", price: 34.99, pv: 30, qty: 150, category: "Wellness", imageUrl: "prod_004_img", isActive: true, type: 'single', unitType: 'bottle' },
                { name: "Organic Greens Powder", description: "A scoop of daily greens to alkalize your body.", price: 54.99, pv: 45, qty: 80, category: "Nutrition", imageUrl: "prod_005_img", isActive: true, type: 'single', unitType: 'tub' },
                { name: "Restful Sleep Aid", description: "Natural ingredients to promote a restful night's sleep.", price: 44.99, pv: 35, qty: 120, category: "Wellness", imageUrl: "prod_006_img", isActive: true, type: 'single', unitType: 'bottle' },
                { name: "Joint Mobility Complex", description: "Support for healthy and flexible joints.", price: 64.99, pv: 50, qty: 90, category: "Supplements", imageUrl: "prod_007_img", isActive: true, type: 'single', unitType: 'bottle' },
                { name: "Probiotic Gut Health", description: "Enhance your digestive wellness with our probiotic blend.", price: 39.99, pv: 32, qty: 110, category: "Wellness", imageUrl: "prod_008_img", isActive: true, type: 'single', unitType: 'bottle' },
                { name: "Starter Kit", description: "A curated package of our best-selling products to kickstart your journey.", price: 199.99, pv: 150, qty: 20, category: "Packages", imageUrl: "prod_001_img", isActive: true, type: 'package', unitType: 'kit' },
            ];

            // Create products in database
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
                    }
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
        // Generate a product ID
        const productId = `prod_${String(Date.now()).padStart(3, '0')}`;

        const newProduct: any = {
            id: productId,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            pv: productData.pv || 0,
            qty: productData.qty,
            category: productData.category,
            imageUrl: productData.imageUrl,
            isActive: productData.isActive ?? true,
            unitType: productData.unitType,
            type: productData.type,
            originalPrice: productData.originalPrice,
            packageItems: productData.packageItems ? JSON.parse(JSON.stringify(productData.packageItems)) : undefined,
            rating: productData.rating,
        };

        const createdProduct = await prisma.product.create({
            data: newProduct
        });

        revalidatePath('/admin/products');
        revalidatePath('/product');
        return {
            ...createdProduct,
            description: createdProduct.description || '',
            imageUrl: createdProduct.imageUrl || '',
            type: createdProduct.type as 'single' | 'package',
            packageItems: createdProduct.packageItems ? (createdProduct.packageItems as any) : undefined,
        } as Product;
    } catch (error) {
        console.error('Error creating product:', error);
        throw new Error('Failed to create product');
    }
}

export async function updateProduct(productId: string, productData: Partial<Product>): Promise<void> {
    try {
        const updateData: any = {};

        // Map Product type fields to Prisma fields
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
            data: updateData
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
        await prisma.product.update({
            where: { id: productId },
            data: { isActive: false }
        });

        revalidatePath('/admin/products');
        revalidatePath('/product');
    } catch (error) {
        console.error('Error deleting product:', error);
        throw new Error('Failed to delete product');
    }
}

// Ensure products exist on startup
seedInitialProducts().catch(console.error);
