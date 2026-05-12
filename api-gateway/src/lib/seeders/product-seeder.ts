import { prisma } from '@/lib/database';

interface SeedProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  pv: number;
  qty: number;
  category?: string;
  imageUrl?: string;
  isActive: boolean;
}

export class ProductSeeder {
  private readonly sampleProducts: SeedProduct[] = [
    {
      id: 'prod-1',
      name: 'Vitamin C Supplement',
      description: 'High-quality vitamin C supplement for immune support',
      price: 25.99,
      pv: 20,
      qty: 100,
      category: 'Health & Wellness',
      imageUrl: '/images/vitamin-c.jpg',
      isActive: true
    },
    {
      id: 'prod-2',
      name: 'Protein Powder',
      description: 'Premium whey protein powder for muscle building',
      price: 45.99,
      pv: 35,
      qty: 50,
      category: 'Fitness',
      imageUrl: '/images/protein-powder.jpg',
      isActive: true
    },
    {
      id: 'prod-3',
      name: 'Essential Oils Set',
      description: 'Collection of therapeutic grade essential oils',
      price: 35.99,
      pv: 28,
      qty: 30,
      category: 'Wellness',
      imageUrl: '/images/essential-oils.jpg',
      isActive: true
    },
    {
      id: 'prod-4',
      name: 'Herbal Tea Collection',
      description: 'Assortment of organic herbal teas',
      price: 19.99,
      pv: 15,
      qty: 75,
      category: 'Beverages',
      imageUrl: '/images/herbal-tea.jpg',
      isActive: true
    }
  ];

  async seed(): Promise<number> {
    let count = 0;
    for (const product of this.sampleProducts) {
      try {
        await prisma.product.upsert({
          where: { id: product.id },
          update: {
            name: product.name,
            description: product.description,
            price: product.price,
            pv: product.pv,
            qty: product.qty,
            category: product.category || 'General',
            imageUrl: product.imageUrl,
            isActive: product.isActive,
            updatedAt: new Date(),
          },
          create: {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            pv: product.pv,
            qty: product.qty,
            category: product.category || 'General',
            imageUrl: product.imageUrl,
            isActive: product.isActive,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });
        count++;
      } catch (error) {
        console.error(`Failed to seed product ${product.id}:`, error);
      }
    }

    return count;
  }
}