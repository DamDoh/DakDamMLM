import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  return requireAuth(async (req) => {
    const user = req.user;
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
      select: { id: true }
    });

    if (!wallet) {
      return NextResponse.json({
        success: true,
        data: {
          transactions: [],
          pagination: { limit, offset, total: 0 }
        }
      });
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.walletTransaction.count({
      where: { walletId: wallet.id }
    });

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          description: tx.description,
          referenceId: tx.referenceId,
          referenceType: tx.referenceType,
          status: tx.status,
          createdAt: tx.createdAt
        })),
        pagination: { limit, offset, total }
      }
    });
  })(request);
}

