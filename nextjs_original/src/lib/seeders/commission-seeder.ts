import { prisma } from '@/lib/database';

interface SeedCommission {
  id: string;
  userId: string;
  date: Date;
  type: string;
  status: string;
  amount: number;
}

export class CommissionSeeder {
  private readonly sampleCommissions: SeedCommission[] = [
    {
      id: 'comm-1',
      userId: 'user-2',
      date: new Date('2024-03-15'),
      type: 'direct_bonus',
      status: 'paid',
      amount: 150.00
    },
    {
      id: 'comm-2',
      userId: 'user-3',
      date: new Date('2024-03-10'),
      type: 'binary_bonus',
      status: 'paid',
      amount: 89.50
    },
    {
      id: 'comm-3',
      userId: 'user-1',
      date: new Date('2024-03-20'),
      type: 'leadership_bonus',
      status: 'pending',
      amount: 500.00
    },
    {
      id: 'comm-4',
      userId: 'user-2',
      date: new Date('2024-03-25'),
      type: 'direct_bonus',
      status: 'paid',
      amount: 75.25
    }
  ];

  async seed(): Promise<number> {
    let count = 0;
    for (const commission of this.sampleCommissions) {
      try {
        await prisma.commission.upsert({
          where: { id: commission.id },
          update: {
            userId: commission.userId,
            date: commission.date,
            type: commission.type,
            status: commission.status,
            amount: commission.amount,
          },
          create: {
            id: commission.id,
            userId: commission.userId,
            date: commission.date,
            type: commission.type,
            status: commission.status,
            amount: commission.amount,
          }
        });
        count++;
      } catch (error) {
        console.error(`Failed to seed commission ${commission.id}:`, error);
      }
    }

    return count;
  }
}