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
        // Use InventoryTransaction to seed initial inventory
        await prisma.inventoryTransaction.create({
          data: {
            productId: inventory.productId,
            userId: inventory.userId,
            type: 'adjustment',
            quantity: inventory.quantity,
            previousQty: 0,
            newQty: inventory.quantity,
            reference: 'initial-seed',
            reason: 'Initial inventory seeding',
            createdBy: 'system-seeder',
          },
        });
        count++;
      } catch (error) {
        console.error(`Failed to seed inventory for ${inventory.userId}-${inventory.productId}:`, error);
      }
    }

    return count;
  }
}