import { prisma } from '@/lib/database';

export class InventorySeeder {
  private readonly sampleInventory = [
    {
      userId: 'user-2',
      productId: 'prod-1',
      quantity: 5
    },
    {
      userId: 'user-2',
      productId: 'prod-4',
      quantity: 3
    },
    {
      userId: 'user-3',
      productId: 'prod-2',
      quantity: 2
    },
    {
      userId: 'user-1',
      productId: 'prod-3',
      quantity: 1
    }
  ];

  async seed(): Promise<number> {
    let count = 0;
    for (const inventory of this.sampleInventory) {
      try {
        // Note: InventoryItem model may not exist in Prisma schema
        if (!(prisma as any).inventoryItem) {
          console.warn('InventoryItem model not available, skipping inventory seeding');
          return 0;
        }
        await (prisma as any).inventoryItem.upsert({
          where: {
            userId_productId: {
              userId: inventory.userId,
              productId: inventory.productId
            }
          },
          update: {
            quantity: inventory.quantity,
            lastUpdated: new Date(),
          },
          create: {
            userId: inventory.userId,
            productId: inventory.productId,
            quantity: inventory.quantity,
            lastUpdated: new Date(),
          }
        });
        count++;
      } catch (error) {
        console.error(`Failed to seed inventory for ${inventory.userId}-${inventory.productId}:`, error);
      }
    }

    return count;
  }
}