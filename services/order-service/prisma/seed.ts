import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting order service database seeding');

  // Create sample users (if they don't exist)
  const sampleUsers = [
    {
      id: 'user-1',
      email: 'john.doe@example.com',
      fullName: 'John Doe',
      memberId: 'M001',
      rank: 'Gold',
      isAdmin: false,
    },
    {
      id: 'user-2',
      email: 'jane.smith@example.com',
      fullName: 'Jane Smith',
      memberId: 'M002',
      rank: 'Silver',
      isAdmin: false,
    },
    {
      id: 'admin-1',
      email: 'admin@example.com',
      fullName: 'System Admin',
      memberId: 'ADMIN001',
      rank: 'Diamond',
      isAdmin: true,
    },
  ];

  for (const user of sampleUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user as any,
      create: user as any,
    });
  }

  logger.info(`Seeded ${sampleUsers.length} sample users`);

  // Create sample products
  const sampleProducts = [
    {
      name: 'Premium Protein Shake',
      description: 'High-quality protein supplement for muscle recovery and growth',
      sku: 'PPS-001',
      price: 49.99,
      pv: 25,
      cost: 15.00,
      category: 'Nutrition',
      brand: 'FitLife',
      images: ['https://example.com/images/protein-shake.jpg'],
      stockQuantity: 150,
      minStockLevel: 20,
      maxStockLevel: 200,
      tags: ['protein', 'supplement', 'fitness'],
      seoTitle: 'Premium Protein Shake - Muscle Recovery Supplement',
      seoDescription: 'Boost your muscle recovery with our premium protein shake. High-quality ingredients for optimal results.',
    },
    {
      name: 'Vitamin C Complex',
      description: 'Immune system support with natural vitamin C sources',
      sku: 'VCC-002',
      price: 29.99,
      pv: 15,
      cost: 8.00,
      category: 'Supplements',
      brand: 'HealthPlus',
      images: ['https://example.com/images/vitamin-c.jpg'],
      stockQuantity: 200,
      minStockLevel: 30,
      maxStockLevel: 250,
      tags: ['vitamin-c', 'immune', 'supplement'],
      seoTitle: 'Vitamin C Complex - Immune System Support',
      seoDescription: 'Strengthen your immune system with our natural vitamin C complex supplement.',
    },
    {
      name: 'Omega-3 Fish Oil',
      description: 'Heart and brain health support with pure omega-3 fatty acids',
      sku: 'O3F-003',
      price: 39.99,
      pv: 20,
      cost: 12.00,
      category: 'Supplements',
      brand: 'OceanPure',
      images: ['https://example.com/images/omega3.jpg'],
      stockQuantity: 120,
      minStockLevel: 15,
      maxStockLevel: 150,
      tags: ['omega-3', 'heart-health', 'brain-health'],
      seoTitle: 'Omega-3 Fish Oil - Heart & Brain Health',
      seoDescription: 'Support heart and brain health with our pure omega-3 fish oil supplement.',
    },
    {
      name: 'Collagen Peptides',
      description: 'Skin, hair, and joint support with hydrolyzed collagen',
      sku: 'CP-004',
      price: 44.99,
      pv: 22,
      cost: 14.00,
      category: 'Beauty',
      brand: 'GlowLife',
      images: ['https://example.com/images/collagen.jpg'],
      stockQuantity: 80,
      minStockLevel: 10,
      maxStockLevel: 100,
      tags: ['collagen', 'skin', 'joints', 'beauty'],
      seoTitle: 'Collagen Peptides - Skin & Joint Health',
      seoDescription: 'Promote healthy skin, hair, and joints with our premium collagen peptides.',
    },
    {
      name: 'Multivitamin Complex',
      description: 'Complete daily nutrition with essential vitamins and minerals',
      sku: 'MVC-005',
      price: 34.99,
      pv: 17,
      cost: 10.00,
      category: 'Supplements',
      brand: 'DailyHealth',
      images: ['https://example.com/images/multivitamin.jpg'],
      stockQuantity: 300,
      minStockLevel: 50,
      maxStockLevel: 400,
      tags: ['multivitamin', 'daily', 'nutrition'],
      seoTitle: 'Multivitamin Complex - Complete Daily Nutrition',
      seoDescription: 'Get your daily essential vitamins and minerals with our comprehensive multivitamin.',
    },
    {
      name: 'Probiotic Blend',
      description: 'Gut health support with multiple probiotic strains',
      sku: 'PB-006',
      price: 37.99,
      pv: 19,
      cost: 11.00,
      category: 'Supplements',
      brand: 'GutHealth',
      images: ['https://example.com/images/probiotic.jpg'],
      stockQuantity: 90,
      minStockLevel: 12,
      maxStockLevel: 120,
      tags: ['probiotic', 'gut-health', 'digestive'],
      seoTitle: 'Probiotic Blend - Gut Health Support',
      seoDescription: 'Support digestive health with our multi-strain probiotic blend.',
    },
  ];

  for (const product of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: product.sku } as any,
      update: product as any,
      create: product as any,
    });
  }

  logger.info(`Seeded ${sampleProducts.length} sample products`);

  // Create carts for sample users
  for (const user of sampleUsers) {
    await (prisma as any).cart.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        items: [],
        totalAmount: 0,
      },
    });
  }

  logger.info('Seeded carts for sample users');

  // Create sample orders
  const sampleOrders = [
    {
      userId: 'user-1',
      orderNumber: 'ORD-2025001',
      status: 'DELIVERED',
      totalAmount: 84.98,
      taxAmount: 6.80,
      shippingAmount: 0,
      discountAmount: 0,
      currency: 'USD',
      paymentMethod: 'credit_card',
      paymentStatus: 'PAID',
      orderedAt: new Date('2025-01-15T10:00:00Z'),
      shippedAt: new Date('2025-01-16T14:00:00Z'),
      deliveredAt: new Date('2025-01-18T11:00:00Z'),
      items: [
        {
          productId: 'PPS-001',
          productName: 'Premium Protein Shake',
          quantity: 1,
          unitPrice: 49.99,
          totalPrice: 49.99,
          pv: 25,
          sku: 'PPS-001',
        },
        {
          productId: 'VCC-002',
          productName: 'Vitamin C Complex',
          quantity: 1,
          unitPrice: 29.99,
          totalPrice: 29.99,
          pv: 15,
          sku: 'VCC-002',
        },
      ],
    },
    {
      userId: 'user-2',
      orderNumber: 'ORD-2025002',
      status: 'SHIPPED',
      totalAmount: 39.99,
      taxAmount: 3.20,
      shippingAmount: 0,
      discountAmount: 0,
      currency: 'USD',
      paymentMethod: 'paypal',
      paymentStatus: 'PAID',
      orderedAt: new Date('2025-01-20T09:30:00Z'),
      shippedAt: new Date('2025-01-21T16:00:00Z'),
      items: [
        {
          productId: 'O3F-003',
          productName: 'Omega-3 Fish Oil',
          quantity: 1,
          unitPrice: 39.99,
          totalPrice: 39.99,
          pv: 20,
          sku: 'O3F-003',
        },
      ],
    },
  ];

  for (const orderData of sampleOrders) {
    const { items, ...orderFields } = orderData;
    const order = await prisma.order.create({
      data: {
        ...orderFields,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            pv: item.pv,
            sku: item.sku,
          })),
        },
      } as any,
    });

    logger.info('Sample order created', {
      orderId: order.id,
      orderNumber: (order as any).orderNumber || order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
    });
  }

  logger.info(`Seeded ${sampleOrders.length} sample orders`);

  logger.info('Order service database seeding completed successfully');
}

main()
  .catch((e) => {
    logger.error('Error during database seeding', { error: e.message, stack: e.stack });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });