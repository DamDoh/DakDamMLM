import { prisma } from '@/lib/database';

interface SeedOrder {
  id: string;
  userId: string;
  orderId: string;
  totalAmount: number;
  status: string;
  items?: SeedOrderItem[];
}

interface SeedOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  pv: number;
}

export class OrderSeeder {
  private readonly sampleOrders: SeedOrder[] = [
    {
      id: 'order-1',
      userId: 'user-2',
      orderId: 'ORD001',
      totalAmount: 71.98,
      status: 'completed',
      items: [
        {
          id: 'item-1-1',
          orderId: 'order-1',
          productId: 'prod-1',
          quantity: 2,
          price: 25.99,
          pv: 20
        },
        {
          id: 'item-1-2',
          orderId: 'order-1',
          productId: 'prod-4',
          quantity: 1,
          price: 19.99,
          pv: 15
        }
      ]
    },
    {
      id: 'order-2',
      userId: 'user-3',
      orderId: 'ORD002',
      totalAmount: 45.99,
      status: 'completed',
      items: [
        {
          id: 'item-2-1',
          orderId: 'order-2',
          productId: 'prod-2',
          quantity: 1,
          price: 45.99,
          pv: 35
        }
      ]
    },
    {
      id: 'order-3',
      userId: 'user-4',
      orderId: 'ORD003',
      totalAmount: 35.99,
      status: 'pending',
      items: [
        {
          id: 'item-3-1',
          orderId: 'order-3',
          productId: 'prod-3',
          quantity: 1,
          price: 35.99,
          pv: 28
        }
      ]
    }
  ];

  async seed(): Promise<number> {
    let count = 0;
    for (const order of this.sampleOrders) {
      try {
        await prisma.order.upsert({
          where: { id: order.id },
          update: {
            userId: order.userId,
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            status: order.status,
            updatedAt: new Date(),
          },
          create: {
            id: order.id,
            userId: order.userId,
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            status: order.status,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });

        // Seed order items if they exist
        if (order.items) {
          for (const item of order.items) {
            await prisma.orderItem.upsert({
              where: { id: item.id },
              update: {
                quantity: item.quantity,
                price: item.price,
                pv: item.pv,
              },
              create: {
                id: item.id,
                orderId: item.orderId,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                pv: item.pv,
              }
            });
          }
        }

        count++;
      } catch (error) {
        console.error(`Failed to seed order ${order.id}:`, error);
      }
    }

    return count;
  }
}