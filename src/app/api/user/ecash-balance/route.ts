import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { getPVForRank } from '@/lib/rank';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for balance checks - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 }); // 100000 per minute (optimized for scale)
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for ecash balance API', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate request using bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Calculate E-Cash balance from PV (rankPV + stockBalance) instead of wallet balance
    // This ensures it matches the PV Points Wallet calculation (no extra 24 PV)
    
    // Get user data with rank
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { rank: true }
    });
    
    // Get user's rank PV requirement
    const rankPV = userData?.rank ? getPVForRank(userData.rank as any) : 0;
    
    // Get wallet to get walletId
    let wallet = await prisma.wallet.findUnique({
      where: { userId: user.id }
    });
    
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          currency: 'USD',
          isActive: true
        }
      });
    }
    
    // Get stock balance from wallet transactions with referenceType 'stock_transfer'
    // Include both positive (credits) and negative (debits) amounts
    const stockTransactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        referenceType: 'stock_transfer'
        // Include both positive and negative amounts (no amount filter)
      }
    });
    
    // Sum all amounts (positive for credits, negative for debits)
    const stockBalance = stockTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    
    // E-Cash balance = rankPV + stockBalance (1 PV = $1)
    const balance = rankPV + stockBalance;

    const duration = Date.now() - startTime;
    logger.info('E-cash balance retrieved', {
      userId: user.id,
      balance,
      duration
    }, request);

    return NextResponse.json({
      success: true,
      data: {
        balance,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('E-cash balance API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch e-cash balance' },
      { status: 500 }
    );
  }
}