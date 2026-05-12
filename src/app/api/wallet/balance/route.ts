import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  return requireAuth(async (req) => {
    const user = req.user!;

    let wallet = await prisma.wallet.findUnique({
      where: { userId: user.id }
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          currency: 'USD'
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        walletId: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive
      }
    });
  })(request);
}

