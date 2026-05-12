import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth, authenticateRequest, AuthenticatedRequest } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

/**
 * GET /api/e-cash
 * Get E-Cash balance and transactions for the authenticated user
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    return await requireAuth(async (req: AuthenticatedRequest) => {
      const user = req.user!;
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const offset = parseInt(searchParams.get('offset') || '0');

      // Get filter parameters
      const filterType = searchParams.get('type');
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');
      
      // Parse dates if provided
      const startDate = startDateParam ? new Date(startDateParam) : null;
      const endDate = endDateParam ? new Date(endDateParam) : null;
      
      // Adjust endDate to end of day if provided
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }

      // Get user's eCashBalance from database (source of truth)
      // This field is updated when commissions are paid, transfers occur, or manual adjustments are made
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { eCashBalance: true } as any
      });
      
      const databaseBalance = Number(userRecord?.eCashBalance || 0);

      // Build date filter for eCash transactions
      const eCashDateFilter: any = {};
      if (startDate || endDate) {
        eCashDateFilter.createdAt = {};
        if (startDate) {
          eCashDateFilter.createdAt.gte = startDate;
        }
        if (endDate) {
          eCashDateFilter.createdAt.lte = endDate;
        }
      }

      // Build type filter for eCash transactions
      const eCashTypeFilter: any = {};
      if (filterType && filterType !== 'all') {
        eCashTypeFilter.type = filterType;
      }

      // Get E-Cash transactions (transfers from E-Comm, withdrawals) - EXCLUDE commission type
      // We'll show commissions directly from the commission table instead
      const eCashTransactions = await (prisma as any).eCashTransaction.findMany({
        where: { 
          userId: user.id,
          type: {
            not: 'commission' // Exclude commission transactions - we'll show commissions directly
          },
          ...eCashDateFilter,
          ...(Object.keys(eCashTypeFilter).length > 0 ? eCashTypeFilter : {})
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
        skip: offset
      });

      // Build date filter for commissions
      const commissionDateFilter: any = {};
      if (startDate || endDate) {
        commissionDateFilter.date = {};
        if (startDate) {
          commissionDateFilter.date.gte = startDate;
        }
        if (endDate) {
          commissionDateFilter.date.lte = endDate;
        }
      }

      // Build type filter for commissions
      // Note: We'll filter commissions after fetching to handle complex types like "Stockist Bonus (D)"
      const commissionTypeFilter: any = {};
      // Don't apply type filter at database level for commissions - we'll filter after

      // Get all commissions (paid) for the user - use the SAME filtering logic as Commissions page
      // Only show specific commission types: Binary Bonus, Matching Bonus, Daily Match, Rank Bonus
      // Exclude PV/E-Comm topup-related commissions
      const allCommissions = await prisma.commission.findMany({
        where: {
          userId: user.id,
          status: 'Paid',
          NOT: {
            type: {
              in: ['PV Top-up Request', 'E-Cash Topup', 'E-Comm Topup', 'PV Topup']
            }
          },
          ...commissionDateFilter,
          ...(Object.keys(commissionTypeFilter).length > 0 ? commissionTypeFilter : {})
        },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          description: true,
          status: true
        },
        take: 1000 // Get all commissions to ensure we show everything
      });

      // Filter commissions - include earnings AND purchases
      const allowedCommissionTypes = [
        'Binary Bonus',
        'Matching Bonus',
        'Daily Match',
        'E-Cash Purchase', // Include purchases to show in transaction history
      ];

      const commissions = allCommissions.filter(c => {
        // Apply type filter if specified
        if (filterType && filterType !== 'all') {
          if (filterType === 'Stockist Bonus') {
            // Match any Stockist Bonus with level indicator
            return /Stockist Bonus\s*\([SMDC]\)/i.test(c.type);
          } else {
            // Exact match for other types
            return c.type === filterType;
          }
        }

        // Always include E-Cash Purchase (negative amounts for purchases)
        if (c.type === 'E-Cash Purchase') {
          return true;
        }
        
        // Include E-Cash from Order commissions (positive amounts for AdminStock/Admin sellers)
        if (c.type && c.type.includes('E-Cash from Order')) {
          return true;
        }
        
        // Reject generic "Stockist Bonus" without level indicator - these are old auto-created commissions
        if (c.type === 'Stockist Bonus') {
          return false; // Exclude old auto-created Stockist Bonus
        }
        
        // Accept "Stockist Bonus (S)", "Stockist Bonus (M)", etc. (from actual stock transfers)
        if (c.type && c.type.includes('Stockist Bonus')) {
          // Only accept if it has level indicator: "Stockist Bonus (S)", "Stockist Bonus (M)", etc.
          return /Stockist Bonus\s*\([SMDC]\)/i.test(c.type);
        }
        
        // Accept other allowed commission types
        return allowedCommissionTypes.includes(c.type) || 
               (c.type && c.type.startsWith('Matching Bonus'));
      });

      // Calculate commission balance from FILTERED commissions (what's actually displayed)
      let commissionBalance = 0;
      try {
        commissionBalance = commissions.reduce((sum, c) => {
          const amount = Number(c.amount) || 0;
          return sum + amount;
        }, 0);
      } catch (error) {
        logger.error('Error calculating commission balance', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: user.id
        }, request);
        commissionBalance = 0;
      }
      
      // Calculate transfer balance for display/verification purposes
      let transferBalance = 0;
      try {
        transferBalance = eCashTransactions.reduce((sum: number, tx: any) => {
          const amountUsd = Number(tx.amountUsd) || 0;
          if (tx.type === 'transfer' && amountUsd > 0) {
            return sum + amountUsd;
          }
          if (tx.type === 'withdrawal') {
            return sum - Math.abs(amountUsd);
          }
          return sum;
        }, 0);
      } catch (error) {
        logger.error('Error calculating transfer balance', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: user.id
        }, request);
        transferBalance = 0;
      }

      // CRITICAL FIX: Use calculated balance from filtered transactions instead of databaseBalance
      // This ensures the total matches what's actually displayed in the transaction list
      // databaseBalance might include commissions that are filtered out (not shown)
      const balance = commissionBalance + transferBalance;
      
      // Log for debugging - compare calculated vs database (only if significant difference)
      if (Math.abs(balance - databaseBalance) > 0.01) {
        logger.info('E-Cash balance mismatch (calculated vs database)', {
          userId: user.id,
          calculatedBalance: balance,
          databaseBalance,
          commissionBalance,
          transferBalance,
          filteredCommissionCount: commissions.length,
          note: 'Using calculated balance to match displayed transactions'
        }, request);
      }

      // Convert commissions to transaction-like format - use commission type as displayed type
      // Commissions are already filtered above
      const commissionTransactions = commissions.map(comm => {
        try {
          const date = comm.date instanceof Date 
            ? comm.date 
            : new Date(comm.date);
          
          return {
            id: `comm-${comm.id}`,
            type: 'commission',
            source: comm.description || null, // Use description as source (for Matching Bonus details, etc.)
            amountUsd: Number(comm.amount) || 0,
            createdAt: date.toISOString(),
            commissionType: comm.type, // The actual commission type (Binary Bonus, Matching Bonus, Daily Match, etc.)
            description: comm.description,
            isCommission: true
          };
        } catch (error) {
          logger.error('Error converting commission to transaction format', {
            error: error instanceof Error ? error.message : 'Unknown error',
            commissionId: comm.id,
            userId: user.id
          }, request);
          // Return a safe default
          return {
            id: `comm-${comm.id}`,
            type: 'commission',
            source: comm.description || null,
            amountUsd: Number(comm.amount) || 0,
            createdAt: new Date().toISOString(),
            commissionType: comm.type || 'Unknown',
            description: comm.description,
            isCommission: true
          };
        }
      });

      // Combine E-Cash transactions (transfers from E-Comm, withdrawals) with commissions
      // No need to deduplicate since we excluded commission-type eCashTransactions above
      const allTransactions = [...eCashTransactions, ...commissionTransactions]
        .sort((a, b) => {
          try {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            if (isNaN(dateA) || isNaN(dateB)) {
              return 0; // If dates are invalid, maintain order
            }
            return dateB - dateA; // Sort descending (newest first)
          } catch (error) {
            logger.error('Error sorting transactions', {
              error: error instanceof Error ? error.message : 'Unknown error',
              userId: user.id
            }, request);
            return 0;
          }
        })
        .slice(offset, offset + limit);

      // Count transactions (non-commission E-Cash transactions + commissions including purchases)
      const eCashCount = await (prisma as any).eCashTransaction.count({
        where: { 
          userId: user.id,
          type: {
            not: 'commission'
          }
        }
      });
      // Include all commissions (earnings + purchases) in the count
      const totalCount = eCashCount + commissions.length;

      const duration = Date.now() - startTime;
      logger.info('E-Cash balance fetched', {
        userId: user.id,
        balance,
        databaseBalance,
        commissionBalance,
        transferBalance,
        transactionCount: allTransactions.length,
        duration
      }, request);

      return NextResponse.json(
        {
          success: true,
          data: {
            balance,
            transactions: allTransactions,
            pagination: {
              total: totalCount,
              limit,
              offset,
              hasNext: offset + limit < totalCount,
              hasPrev: offset > 0
            }
          }
        },
        { status: 200 }
      );
    })(request);
  } catch (error) {
    logger.error('Failed to fetch E-Cash data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

/**
 * POST /api/e-cash/transfer
 * Transfer balance from E-Comm (PV) to E-Cash (USD)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    return await requireAuth(async (req: AuthenticatedRequest) => {
      const user = req.user!;
      const body = await request.json();
      const { amountPv } = body;

      // Validate input
      if (!amountPv || typeof amountPv !== 'number' || amountPv <= 0) {
        return NextResponse.json(
          { error: 'Invalid amount. Amount must be a positive number.' },
          { status: 400 }
        );
      }

      // Get user's current PV and E-Cash balance
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { pv: true, eCashBalance: true } as any
      });

      if (!userRecord) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Check if user has sufficient PV (1 PV = 1 USD conversion)
      const userPv = Number(userRecord.pv) || 0;
      if (userPv < amountPv) {
        return NextResponse.json(
          { error: 'Insufficient E-Comm balance. You do not have enough PV to transfer.' },
          { status: 400 }
        );
      }

      // Convert PV to USD (1 PV = 1 USD)
      const amountUsd = amountPv;

      // Perform transfer in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Deduct PV from user
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            pv: {
              decrement: amountPv
            },
            eCashBalance: {
              increment: amountUsd
            }
          } as any,
          select: { pv: true, eCashBalance: true } as any
        });

        // Create E-Cash transaction record
        const eCashTransaction = await (tx as any).eCashTransaction.create({
          data: {
            userId: user.id,
            type: 'transfer',
            source: 'E-Comm',
            amountUsd: amountUsd
          }
        });

        // Create wallet transaction to record the debit in E-Comm wallet
        // Get or create wallet for the user
        let wallet = await tx.wallet.findUnique({
          where: { userId: user.id }
        });

        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              userId: user.id,
              balance: 0,
              currency: 'USD',
              isActive: true
            }
          });
        }

        // Create debit transaction in wallet (negative amount for transfer out)
        const walletTransaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'debit',
            amount: -amountPv, // Negative amount for debit
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance, // Wallet balance doesn't change, only PV changes
            description: `Transfer to E-Cash`,
            referenceId: eCashTransaction.id,
            referenceType: 'ecash_transfer',
            status: 'completed'
          }
        });

        return { updatedUser, transaction: eCashTransaction, walletTransaction };
      });

      const duration = Date.now() - startTime;
      logger.info('E-Cash transfer completed', {
        userId: user.id,
        amountPv,
        amountUsd,
        newPv: result.updatedUser.pv,
        newECashBalance: result.updatedUser.eCashBalance,
        duration
      }, request);

      return NextResponse.json(
        {
          success: true,
          data: {
            transaction: result.transaction,
            newBalance: result.updatedUser.eCashBalance,
            newPv: result.updatedUser.pv
          },
          message: `Successfully transferred $${amountUsd.toFixed(2)} from E-Comm to E-Cash`
        },
        { status: 200 }
      );
    })(request);
  } catch (error) {
    logger.error('Failed to transfer E-Cash', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

