import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { CommissionCalculationEngineEnhanced } from '@/services/commission-calculation-engine';

/**
 * Manual endpoint to calculate Matching Bonus for a specific user
 * This can be called to retroactively calculate Matching Bonus for existing Daily Match commissions
 */
export async function POST(request: NextRequest) {
  try {
    const authenticatedRequest = await authenticateRequest(request);
    const user = authenticatedRequest.user;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        rank: true,
        active: true,
        deleted: true,
        placementParentId: true
      }
    });

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!dbUser.active || dbUser.deleted || !dbUser.rank) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not eligible (inactive, deleted, or no rank)' 
      }, { status: 400 });
    }

    // Calculate Matching Bonus for last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log(`🔄 Manual Matching Bonus calculation for user ${dbUser.id} (rank: ${dbUser.rank})`);
    
    const matchingBonuses = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
      dbUser.id,
      thirtyDaysAgo,
      now,
      dbUser.rank
    );

    const validMatchingBonuses = matchingBonuses.filter(b => b.amount > 0);

    if (validMatchingBonuses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Matching Bonus calculated',
        matchingBonuses: [],
        reason: 'No eligible downlines with Daily Match commissions found'
      }, { status: 200 });
    }

    // Process each Matching Bonus entry
    const createdCommissions = [];
    for (const matchingBonus of validMatchingBonuses) {
      // Check if already exists (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const existingMatchingBonus = await prisma.commission.findFirst({
        where: {
          userId: dbUser.id,
          type: 'Matching Bonus',
          date: {
            gte: sevenDaysAgo
          },
          status: { in: ['Paid', 'Pending'] }
        },
        orderBy: {
          date: 'desc'
        }
      });

      if (!existingMatchingBonus) {
        // Create Matching Bonus commission
        const matchingBonusCommission = await prisma.commission.create({
          data: {
            userId: dbUser.id,
            amount: matchingBonus.amount,
            type: 'Matching Bonus',
            description: matchingBonus.description,
            status: 'Pending',
            date: new Date(),
            metadata: matchingBonus.metadata as any
          }
        });

        // Pay commission immediately
        const { CommissionService } = await import('@/services/commission-service');
        await CommissionService.payCommission(matchingBonusCommission.id);

        createdCommissions.push({
          id: matchingBonusCommission.id,
          amount: matchingBonus.amount,
          description: matchingBonus.description,
          status: 'Paid'
        });

        console.log(`✅ Matching Bonus commission created for user ${dbUser.id}: $${matchingBonus.amount}`);
      } else {
        // Update if amount changed
        if (Math.abs(matchingBonus.amount - existingMatchingBonus.amount) > 0.01) {
          await prisma.commission.update({
            where: { id: existingMatchingBonus.id },
            data: {
              amount: matchingBonus.amount,
              description: matchingBonus.description
            }
          });

          if (existingMatchingBonus.status === 'Paid') {
            const difference = matchingBonus.amount - existingMatchingBonus.amount;
            if (difference > 0) {
              const { WalletServiceEnhanced } = await import('@/services/wallet-service-enhanced');
              await WalletServiceEnhanced.creditWallet(
                dbUser.id,
                difference,
                'Matching Bonus Update',
                `matching_bonus_update_${existingMatchingBonus.id}`,
                'commission'
              );
            }
          }

          createdCommissions.push({
            id: existingMatchingBonus.id,
            amount: matchingBonus.amount,
            description: matchingBonus.description,
            status: 'Updated'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Matching Bonus calculated',
      matchingBonuses: createdCommissions,
      total: createdCommissions.reduce((sum, c) => sum + c.amount, 0)
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error calculating Matching Bonus:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

