import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { shouldUpdateRank, getPVForRank } from '@/lib/rank';
import { WalletServiceEnhanced } from '@/services/wallet-service-enhanced';
import { logger } from '@/lib/logger';
import { canTransferStock } from '@/lib/types';
import type { StockistLevel } from '@/lib/types';
import * as Types from '@/lib/types';

export async function POST(request: NextRequest) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    const startTime = Date.now();

    try {
      const authUser = req.user!;
      
      const body = await req.json();
      const { recipientIdentifier, amount } = body;

      // Validate inputs
      if (!recipientIdentifier || !amount) {
        return NextResponse.json(
          { error: 'Recipient identifier and amount are required' },
          { status: 400 }
        );
      }

      if (typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be a positive number' },
          { status: 400 }
        );
      }

      // Find recipient first (doesn't need to be in the transaction)
      const recipient = await prisma.user.findFirst({
        where: {
          OR: [
            { memberId: recipientIdentifier },
            { email: recipientIdentifier.toLowerCase() },
            { phoneNumber: recipientIdentifier }
          ]
        }
      });

      if (!recipient) {
        return NextResponse.json(
          { error: 'Recipient not found' },
          { status: 404 }
        );
      }

      if (recipient.id === authUser.id) {
        return NextResponse.json(
          { error: 'Cannot transfer PV to yourself' },
          { status: 400 }
        );
      }

      // Load recipient level info for stockist check
      const recipientWithLevel = await prisma.user.findUnique({
        where: { id: recipient.id },
        select: {
          storeOwnerLevel: true,
          fullName: true
        }
      });

      // CRITICAL FIX: Perform ALL balance checks and updates inside a single transaction
      // with Serializable isolation to prevent race conditions and double-spending
      const result = await prisma.$transaction(async (tx) => {
        // Step 1: Lock sender's wallet row with SELECT FOR UPDATE (Serializable isolation)
        let senderWallet = await tx.wallet.findUnique({
          where: { userId: authUser.id }
        });

        if (!senderWallet) {
          senderWallet = await tx.wallet.create({
            data: {
              userId: authUser.id,
              balance: 0,
              currency: 'USD',
              isActive: true
            }
          });
        }

        // Step 2: Get sender's full user data including PV and rank (locked)
        const sender = await tx.user.findUnique({
          where: { id: authUser.id },
          select: { id: true, pv: true, rank: true, fullName: true, memberId: true, storeOwnerLevel: true, isAdmin: true }
        });

        if (!sender) {
          throw new Error('Sender not found');
        }

        // Step 3: Calculate available PV balance inside transaction (authoritative)
        const rankPV = sender.rank ? getPVForRank(sender.rank as any) : 0;
        
        const stockTransactions = await tx.walletTransaction.findMany({
          where: {
            walletId: senderWallet.id,
            referenceType: 'stock_transfer',
            amount: {
              gt: 0 // Only credit transactions
            }
          }
        });
        
        const stockBalance = stockTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        
        // Available PV = rankPV + stockBalance
        const availablePV = rankPV + stockBalance;

        // Step 4: Check stockist level restrictions inside transaction
        if (!sender.isAdmin && sender.storeOwnerLevel) {
          if (recipientWithLevel) {
            const senderLevel = sender.storeOwnerLevel as StockistLevel | null;
            const recipientLevel = recipientWithLevel.storeOwnerLevel as StockistLevel | null;

            if (!canTransferStock(senderLevel, recipientLevel)) {
              const senderLevelName = senderLevel ? `(${senderLevel})` : '';
              const recipientLevelName = recipientLevel ? `(${recipientLevel})` : '';
              
              throw new Error(
                `Transfer not allowed: Cannot transfer PV. Stockist level ${senderLevelName} cannot transfer to stockist level ${recipientLevelName}.`
              );
            }
          }
        }

        // Step 5: Verify sufficient balance BEFORE making any changes (final check inside transaction)
        if (availablePV < amount) {
          throw new Error(
            `Insufficient PV balance: have ${availablePV} (${rankPV} rank + ${stockBalance} stock), need ${amount}`
          );
        }

        // Step 6: Calculate how much to deduct from stock balance vs rank PV
        let remainingAmount = amount;
        let stockDeduction = 0;
        let rankPVDeduction = 0;
        
        if (stockBalance > 0) {
          stockDeduction = Math.min(remainingAmount, stockBalance);
          remainingAmount -= stockDeduction;
        }
        
        if (remainingAmount > 0) {
          rankPVDeduction = remainingAmount;
        }

        // Calculate new PV values
        const currentSenderPV = sender.pv || 0;
        const newSenderPV = Math.max(0, currentSenderPV - rankPVDeduction);
        const currentRecipientPV = recipient.pv || 0;
        const newRecipientPV = currentRecipientPV + amount;

        // Step 7: Update sender's PV (only if we need to deduct from rank PV)
        if (rankPVDeduction > 0) {
          await tx.user.update({
            where: { id: authUser.id },
            data: { pv: newSenderPV }
          });
        }

        // Step 8: Update recipient's PV
        await tx.user.update({
          where: { id: recipient.id },
          data: { pv: newRecipientPV }
        });

        // Step 9: Check if recipient's rank should be updated
        const recipientRankUpdate = shouldUpdateRank(recipient.rank as any, newRecipientPV);
        let recipientRankUpdated = false;
        
        if (recipientRankUpdate.shouldUpdate) {
          await tx.user.update({
            where: { id: recipient.id },
            data: { rank: recipientRankUpdate.newRank }
          });
          recipientRankUpdated = true;
        }

        // Step 10: Check if sender's rank should be updated
        const senderRankUpdate = shouldUpdateRank(sender.rank as any, newSenderPV);
        if (senderRankUpdate.shouldUpdate) {
          await tx.user.update({
            where: { id: authUser.id },
            data: { rank: senderRankUpdate.newRank }
          });
        }

        return {
          sender: {
            ...sender,
            newPV: newSenderPV,
            newRank: senderRankUpdate.shouldUpdate ? senderRankUpdate.newRank : sender.rank,
            stockDeduction,
            rankPVDeduction
          },
          recipient: {
            ...recipient,
            newPV: newRecipientPV,
            previousPV: currentRecipientPV,
            newRank: recipientRankUpdate.shouldUpdate ? recipientRankUpdate.newRank : recipient.rank,
            rankUpdated: recipientRankUpdated,
            previousRank: recipient.rank,
            newRankValue: recipientRankUpdate.newRank
          },
          senderWalletId: senderWallet.id
        };
      }, {
        isolationLevel: 'Serializable', // CRITICAL: Prevents concurrent modifications
        timeout: 10000
      });

      // Create wallet transactions for both users (outside main transaction for performance)
      const transferId = `PV-TRANSFER-${Date.now()}`;

      // CRITICAL: These wallet transaction records are created after the main transaction commits
      // This ensures they reflect the final state. If the main transaction failed, we never get here.
      try {
        if (result.sender.stockDeduction > 0) {
          const senderWalletAfter = await prisma.wallet.findUnique({
            where: { id: result.senderWalletId },
            select: { balance: true }
          });
          
          const balanceBefore = senderWalletAfter?.balance || 0;
          
          if (result.sender.rankPVDeduction === 0) {
            await prisma.walletTransaction.create({
              data: {
                walletId: result.senderWalletId,
                type: 'debit',
                amount: -amount,
                balanceBefore,
                balanceAfter: balanceBefore,
                description: `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
                referenceId: transferId,
                referenceType: 'stock_transfer',
                status: 'completed'
              }
            });
          } else {
            await prisma.walletTransaction.create({
              data: {
                walletId: result.senderWalletId,
                type: 'debit',
                amount: -result.sender.stockDeduction,
                balanceBefore,
                balanceAfter: balanceBefore,
                description: `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
                referenceId: transferId,
                referenceType: 'stock_transfer',
                status: 'completed'
              }
            });
            
            await WalletServiceEnhanced.debitWallet(
              authUser.id,
              result.sender.rankPVDeduction,
              `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
              transferId,
              'pv_transfer'
            );
          }
        } else {
          await WalletServiceEnhanced.debitWallet(
            authUser.id,
            amount,
            `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
            transferId,
            'pv_transfer'
          );
        }
      } catch (walletError) {
        console.error('Failed to create debit transaction for sender:', walletError);
        // Log but don't fail - the PV transfer already succeeded atomically
      }

      try {
        await WalletServiceEnhanced.creditWallet(
          recipient.id,
          amount,
          `PV Transfer from ${result.sender.fullName} (${result.sender.memberId})`,
          transferId,
          'pv_transfer'
        );
      } catch (walletError) {
        console.error('Failed to create credit transaction for recipient:', walletError);
      }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Fetch sender's full user data including PV and rank
    const sender = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, pv: true, rank: true, fullName: true, memberId: true, storeOwnerLevel: true, isAdmin: true }
    });

    if (!sender) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      );
    }

    // Calculate available PV balance (rankPV + stockBalance) to match UI calculation
    const rankPV = sender.rank ? getPVForRank(sender.rank as any) : 0;
    
    // Get sender's wallet to find stock balance
    let senderWallet = await prisma.wallet.findUnique({
      where: { userId: sender.id }
    });
    
    if (!senderWallet) {
      senderWallet = await prisma.wallet.create({
        data: {
          userId: sender.id,
          balance: 0,
          currency: 'USD',
          isActive: true
        }
      });
    }
    
    // Get stock balance from wallet transactions with referenceType 'stock_transfer'
    const stockTransactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: senderWallet.id,
        referenceType: 'stock_transfer',
        amount: {
          gt: 0 // Only credit transactions
        }
      }
    });
    
    const stockBalance = stockTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    
    // Available PV = rankPV + stockBalance (matches UI calculation)
    const availablePV = rankPV + stockBalance;

    // Find recipient
    const recipient = await prisma.user.findFirst({
      where: {
        OR: [
          { memberId: recipientIdentifier },
          { email: recipientIdentifier.toLowerCase() },
          { phoneNumber: recipientIdentifier }
        ]
      }
    });

    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }

    if (recipient.id === sender.id) {
      return NextResponse.json(
        { error: 'Cannot transfer PV to yourself' },
        { status: 400 }
      );
    }

    // Check stockist level restrictions: higher level can transfer to lower level
    // Admins can always transfer (skip level check)
    if (!sender.isAdmin && sender.storeOwnerLevel) {
      const recipientWithLevel = await prisma.user.findUnique({
        where: { id: recipient.id },
        select: {
          storeOwnerLevel: true,
          fullName: true
        }
      });

      if (recipientWithLevel) {
        const senderLevel = sender.storeOwnerLevel as StockistLevel | null;
        const recipientLevel = recipientWithLevel.storeOwnerLevel as StockistLevel | null;

        if (!canTransferStock(senderLevel, recipientLevel)) {
          const senderLevelName = senderLevel ? `(${senderLevel})` : '';
          const recipientLevelName = recipientLevel ? `(${recipientLevel})` : '';
          
          return NextResponse.json(
            { 
              error: 'Transfer not allowed',
              message: `Cannot transfer PV. Stockist level ${senderLevelName} cannot transfer to stockist level ${recipientLevelName}. Only higher level stockists can transfer to lower level stockists.`
            },
            { status: 403 }
          );
        }
      }
    }

    // Check sender's available PV balance (rankPV + stockBalance, matches UI)
    if (availablePV < amount) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Insufficient PV balance',
          message: `Insufficient PV balance. You have ${availablePV.toLocaleString()} PV available (${rankPV.toLocaleString()} PV from rank + ${stockBalance.toLocaleString()} PV from stock), but need ${amount.toLocaleString()} PV. Please check your current PV balance.`
        },
        { status: 400 }
      );
    }

    // Perform PV transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Lock both users to prevent race conditions
      const lockedSender = await tx.user.findUnique({
        where: { id: sender.id },
        select: { id: true, pv: true, rank: true, fullName: true, memberId: true }
      });

      const lockedRecipient = await tx.user.findUnique({
        where: { id: recipient.id },
        select: { id: true, pv: true, rank: true, fullName: true, memberId: true }
      });

      if (!lockedSender || !lockedRecipient) {
        throw new Error('User not found during transfer');
      }

      // Recalculate available PV inside transaction (to ensure consistency)
      const currentRankPV = lockedSender.rank ? getPVForRank(lockedSender.rank as any) : 0;
      
      // Get sender's wallet
      let lockedSenderWallet = await tx.wallet.findUnique({
        where: { userId: sender.id }
      });
      
      if (!lockedSenderWallet) {
        lockedSenderWallet = await tx.wallet.create({
          data: {
            userId: sender.id,
            balance: 0,
            currency: 'USD',
            isActive: true
          }
        });
      }
      
      // Get stock balance from wallet transactions
      const currentStockTransactions = await tx.walletTransaction.findMany({
        where: {
          walletId: lockedSenderWallet.id,
          referenceType: 'stock_transfer',
          amount: {
            gt: 0
          }
        }
      });
      
      const currentStockBalance = currentStockTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const currentAvailablePV = currentRankPV + currentStockBalance;
      
      // Double-check sender's available PV balance
      if (currentAvailablePV < amount) {
        throw new Error(`Insufficient PV balance: have ${currentAvailablePV} (${currentRankPV} rank + ${currentStockBalance} stock), need ${amount}`);
      }

      // Calculate how much to deduct from stock balance vs rank PV
      // Deduct from stock balance first, then from rank PV if needed
      let remainingAmount = amount;
      let stockDeduction = 0;
      let rankPVDeduction = 0;
      
      if (currentStockBalance > 0) {
        stockDeduction = Math.min(remainingAmount, currentStockBalance);
        remainingAmount -= stockDeduction;
      }
      
      if (remainingAmount > 0) {
        rankPVDeduction = remainingAmount;
      }

      // Calculate new PV values
      const currentSenderPV = lockedSender.pv || 0;
      const newSenderPV = Math.max(0, currentSenderPV - rankPVDeduction);
      const currentRecipientPV = lockedRecipient.pv || 0;
      const newRecipientPV = currentRecipientPV + amount;

      // Update sender's PV (only if we need to deduct from rank PV)
      if (rankPVDeduction > 0) {
        await tx.user.update({
          where: { id: sender.id },
          data: { pv: newSenderPV }
        });
      }

      // Update recipient's PV
      await tx.user.update({
        where: { id: recipient.id },
        data: { pv: newRecipientPV }
      });
      
      // Store deduction info for transaction creation after the main transaction
      // We'll create ONE transaction that reflects the total amount transferred

      // Check if recipient's rank should be updated
      const recipientRankUpdate = shouldUpdateRank(lockedRecipient.rank as any, newRecipientPV);
      let recipientRankUpdated = false;
      
      if (recipientRankUpdate.shouldUpdate) {
        await tx.user.update({
          where: { id: recipient.id },
          data: { rank: recipientRankUpdate.newRank }
        });
        recipientRankUpdated = true;
      }

      // Check if sender's rank should be updated (if PV decreased significantly)
      // Use the actual PV after deduction (newSenderPV) for rank calculation
      const senderRankUpdate = shouldUpdateRank(lockedSender.rank as any, newSenderPV);
      if (senderRankUpdate.shouldUpdate) {
        await tx.user.update({
          where: { id: sender.id },
          data: { rank: senderRankUpdate.newRank }
        });
      }

      return {
        sender: {
          ...lockedSender,
          newPV: newSenderPV,
          newRank: senderRankUpdate.shouldUpdate ? senderRankUpdate.newRank : lockedSender.rank,
          stockDeduction,
          rankPVDeduction
        },
        recipient: {
          ...lockedRecipient,
          newPV: newRecipientPV,
          previousPV: currentRecipientPV,
          newRank: recipientRankUpdate.shouldUpdate ? recipientRankUpdate.newRank : lockedRecipient.rank,
          rankUpdated: recipientRankUpdated,
          previousRank: lockedRecipient.rank,
          newRankValue: recipientRankUpdate.newRank
        },
        senderWalletId: lockedSenderWallet.id
      };
    });

    // Create wallet transactions for both users
    const transferId = `PV-TRANSFER-${Date.now()}`;

    // Create ONE transaction for the sender that reflects the total deduction
    // If we deducted from stock, create a stock_transfer debit transaction (negative amount)
    // Otherwise, create a regular pv_transfer transaction
    try {
      if (result.sender.stockDeduction > 0) {
        // Deduct from stock balance by creating a debit transaction with referenceType 'stock_transfer'
        // This will reduce the stock balance calculation
        const senderWallet = await prisma.wallet.findUnique({
          where: { id: result.senderWalletId },
          select: { balance: true }
        });
        
        const balanceBefore = senderWallet?.balance || 0;
        const balanceAfter = balanceBefore; // Wallet balance doesn't change, only PV
        
        // Create ONE transaction for stock deduction (if all amount is from stock)
        if (result.sender.rankPVDeduction === 0) {
          // All amount is from stock - create one stock_transfer transaction
          await prisma.walletTransaction.create({
            data: {
              walletId: result.senderWalletId,
              type: 'debit',
              amount: -amount, // Negative for debit (reduces stock balance)
              balanceBefore,
              balanceAfter,
              description: `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
              referenceId: transferId,
              referenceType: 'stock_transfer', // Use 'stock_transfer' so it affects stock balance calculation
              status: 'completed'
            }
          });
        } else {
          // Part from stock, part from rank PV - create two transactions
          await prisma.walletTransaction.create({
            data: {
              walletId: result.senderWalletId,
              type: 'debit',
              amount: -result.sender.stockDeduction,
              balanceBefore,
              balanceAfter,
              description: `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
              referenceId: transferId,
              referenceType: 'stock_transfer',
              status: 'completed'
            }
          });
          
          // Create transaction for rank PV deduction
          await WalletServiceEnhanced.debitWallet(
            sender.id,
            result.sender.rankPVDeduction,
            `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
            transferId,
            'pv_transfer'
          );
        }
      } else {
        // All deduction was from rank PV, create regular pv_transfer transaction
        await WalletServiceEnhanced.debitWallet(
          sender.id,
          amount,
          `PV Transfer to ${result.recipient.fullName} (${result.recipient.memberId})`,
          transferId,
          'pv_transfer'
        );
      }
    } catch (walletError) {
      console.error('Failed to create debit transaction for sender:', walletError);
      // Continue even if wallet transaction fails - PV transfer is already done
    }

    // Credit recipient's wallet (record the PV addition)
    try {
      await WalletServiceEnhanced.creditWallet(
        recipient.id,
        amount,
        `PV Transfer from ${result.sender.fullName} (${result.sender.memberId})`,
        transferId,
        'pv_transfer'
      );
    } catch (walletError) {
      console.error('Failed to create credit transaction for recipient:', walletError);
      // Continue even if wallet transaction fails - PV transfer is already done
    }

    // Calculate Binary Bonus if recipient's rank was updated (from Member to higher rank OR rank upgrade)
    if (result.recipient.rankUpdated && result.recipient.newRankValue !== 'Member') {
      try {
        // Import the function dynamically to avoid circular dependencies
        const { calculateBinaryBonusOnRankChange } = await import('@/lib/referral-tracking');
        // Calculate actual PV amount added
        const pvAdded = result.recipient.newPV - (result.recipient.previousPV || 0);
        // Run in the background without awaiting to avoid blocking the transfer
        calculateBinaryBonusOnRankChange(recipient.id, pvAdded)
          .then(success => {
            if (success) {
              console.log(`[PV Transfer] Binary Bonus calculated for member ${recipient.id}`);
            } else {
              console.log(`[PV Transfer] No Binary Bonus calculated for member ${recipient.id}`);
            }
          })
          .catch(error => {
            console.error(`[PV Transfer] Error calculating Binary Bonus for member ${recipient.id}:`, error);
          });
      } catch (error) {
        console.error('[PV Transfer] Failed to import calculateBinaryBonusOnRankChange:', error);
      }

      // Also trigger G2 Binary Bonus for grandparent when member upgrades from Member rank
      try {
        const recipientWithParent = await prisma.user.findUnique({
          where: { id: recipient.id },
          select: { id: true, placementParentId: true }
        });

        if (recipientWithParent?.placementParentId) {
          const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
          autoCalculateG2BinaryBonus(recipientWithParent.placementParentId, recipient.id)
            .then(() => {
              console.log(`[PV Transfer] G2 Binary Bonus auto-calculated for recipient ${recipient.id}`);
            })
            .catch(g2Error => {
              console.error(`[PV Transfer] Failed to auto-calculate G2 Binary Bonus:`, g2Error);
            });
        }
      } catch (g2Error) {
        console.error('[PV Transfer] Failed to trigger G2 Binary Bonus:', g2Error);
      }
    }

    // Handle PV change for recipient's upline sponsors (recalculate waiting PV)
    if (result.recipient.newPV > result.recipient.previousPV) {
      try {
        const recipientUser = await prisma.user.findUnique({
          where: { id: recipient.id },
          select: { pv: true }
        });
        if (recipientUser) {
          const { PVMatchingService } = await import('@/services/pv-matching-service');
          await PVMatchingService.handlePVChange(
            recipient.id,
            result.recipient.previousPV || 0,
            recipientUser.pv || 0
          );
        }
      } catch (pvError: any) {
        console.error('[PV Transfer] Failed to handle PV change for recipient upline sponsors:', pvError);
        // Don't fail the request if PV matching fails
      }
    }

    // Send notifications to both sender and recipient
    // Create Stockist Bonus commission if sender is an Admin Stock with stockist level
    // This is triggered when Admin Stock transfers PV to members
    try {
      const senderWithLevel = await prisma.user.findUnique({
        where: { id: sender.id },
        select: {
          id: true,
          storeOwnerLevel: true,
          companyId: true,
          active: true,
          isAdmin: true
        }
      });

      // Check if sender is an admin stockist with a valid level (S, M, C, or D)
      if (senderWithLevel && senderWithLevel.active && senderWithLevel.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(senderWithLevel.storeOwnerLevel)) {
        // Get commission percentage based on sender and recipient stockist levels
        // Uses differential rates when transferring to specific stockist levels
        const typesModule = await import('@/lib/types') as any;
        const getStockistCommissionRate = typesModule.getStockistCommissionRate as (sellerLevel: StockistLevel, recipientLevel: StockistLevel | null | undefined) => number;
        
        const senderLevel = senderWithLevel.storeOwnerLevel as 'S' | 'M' | 'C' | 'D';
        const recipientLevel = recipient.storeOwnerLevel as 'S' | 'M' | 'C' | 'D' | null | undefined;
        
        // Get the appropriate commission rate (base or differential)
        // Examples: M→S: 0.9%, C→M: 0.9%, C→S: 1.8%, D→C: 0.4%, D→M: 1.3%, D→S: 2.2%
        const commissionPercentage = getStockistCommissionRate(senderLevel, recipientLevel);
        
        if (commissionPercentage && commissionPercentage > 0) {
          // Calculate commission amount: PV transferred × commission percentage / 100
          // Example: 1000 PV × 0.8% = 1000 × 0.8 / 100 = $8.00
          const commissionAmount = Math.round((amount * commissionPercentage / 100) * 100) / 100;

          if (commissionAmount > 0) {
            // Create commission record
            const commission = await prisma.commission.create({
              data: {
                userId: sender.id,
                amount: commissionAmount,
                type: `Stockist Bonus (${senderWithLevel.storeOwnerLevel})`,
                status: 'Paid',
                date: new Date(),
                companyId: senderWithLevel.companyId || undefined
              }
            });

            // Credit commission to wallet
            try {
              const { WalletService } = await import('@/services/wallet-service');
              await WalletService.creditWallet(
                sender.id,
                commissionAmount,
                `Stockist commission: ${amount} PV transferred (${senderWithLevel.storeOwnerLevel} level - ${commissionPercentage}%)`,
                commission.id,
                'commission'
              );

              console.log(`✅ Stockist Commission Created:`, {
                stockist: sender.id,
                level: senderWithLevel.storeOwnerLevel,
                pvTransferred: amount,
                percentage: `${commissionPercentage}%`,
                commission: `$${commissionAmount.toFixed(2)}`,
                transferId
              });

              logger.info(`Stockist commission created for PV transfer`, {
                stockistId: sender.id,
                stockistLevel: senderWithLevel.storeOwnerLevel,
                recipientId: recipient.id,
                pvTransferred: amount,
                commissionPercentage: `${commissionPercentage}%`,
                commissionAmount: `$${commissionAmount.toFixed(2)}`,
                transferId,
                commissionId: commission.id
              });

              // Send notification to stockist about commission earned
              try {
                await prisma.notification.create({
                  data: {
                    memberId: sender.id,
                    type: 'in_app',
                    category: 'commission',
                    title: `Stockist Bonus Earned: $${commissionAmount.toFixed(2)}`,
                    body: `You earned $${commissionAmount.toFixed(2)} in Stockist Bonus (${senderWithLevel.storeOwnerLevel} level - ${commissionPercentage}%) for transferring ${amount.toLocaleString()} PV to ${recipient.fullName}.`,
                    data: {
                      commissionId: commission.id,
                      commissionType: `Stockist Bonus (${senderWithLevel.storeOwnerLevel})`,
                      amount: commissionAmount,
                      pvTransferred: amount,
                      recipientId: recipient.id,
                      recipientName: recipient.fullName,
                      stockistLevel: senderWithLevel.storeOwnerLevel,
                      link: '/commission' // Navigate to commission page
                    },
                    priority: 'high',
                    isRead: false,
                    isSent: false
                  }
                });
              } catch (notifError: any) {
                // Log but don't fail commission if notification fails
                logger.warn('Failed to create stockist bonus notification for PV transfer', {
                  error: notifError.message,
                  stockistId: sender.id,
                  commissionId: commission.id
                });
              }
            } catch (walletError) {
              console.error('Failed to credit wallet for stockist commission:', walletError);
              // Update commission status back to Pending if wallet credit fails
              await prisma.commission.update({
                where: { id: commission.id },
                data: { status: 'Pending' }
              });
            }
          }
        }
      }
    } catch (commissionError) {
      console.error('❌ Failed to create stockist commission for PV transfer:', commissionError);
      logger.error('Failed to create stockist commission for PV transfer', {
        error: commissionError instanceof Error ? commissionError.message : 'Unknown error',
        senderId: sender.id,
        recipientId: recipient.id,
        amount,
        transferId
      });
      // Don't fail the PV transfer if commission creation fails
    }

    // Send notifications
    try {
      // Notify recipient
      await prisma.notification.create({
        data: {
          memberId: recipient.id,
          type: 'in_app',
          category: 'pv_transfer',
          title: `PV Received: +${amount.toLocaleString()} PV`,
          body: `You received ${amount.toLocaleString()} PV from ${result.sender.fullName} (${result.sender.memberId}). Your new PV balance is ${result.recipient.newPV.toLocaleString()}`,
          data: {
            transferId,
            senderId: result.sender.id,
            senderName: result.sender.fullName,
            amount,
            balance: result.recipient.newPV,
            rankUpdated: result.recipient.rankUpdated,
            newRank: result.recipient.newRank,
            link: '/ecash',
          },
          priority: 'normal',
        },
      });

      // Notify sender
      await prisma.notification.create({
        data: {
          memberId: sender.id,
          type: 'in_app',
          category: 'pv_transfer',
          title: `PV Sent: -${amount.toLocaleString()} PV`,
          body: `You have successfully transferred ${amount.toLocaleString()} PV to ${result.recipient.fullName}. Your new PV balance is ${result.sender.newPV.toLocaleString()}`,
          data: {
            transferId,
            recipientId: recipient.id,
            recipientName: result.recipient.fullName,
            recipientMemberId: result.recipient.memberId,
            amount: -amount,
            balance: result.sender.newPV,
            link: '/ecash',
          },
          priority: 'normal',
        },
      });
    } catch (notifyError) {
      console.error('Failed to send notifications:', notifyError);
      // Continue even if notifications fail
    }

    const duration = Date.now() - startTime;
    logger.info('PV transfer completed', {
      senderId: sender.id,
      recipientId: recipient.id,
      amount,
      duration
    }, req);

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${amount.toLocaleString()} PV to ${result.recipient.fullName}`,
      data: {
        transferId,
        sender: {
          newPV: result.sender.newPV,
          newRank: result.sender.newRank
        },
        recipient: {
          newPV: result.recipient.newPV,
          newRank: result.recipient.newRank,
          rankUpdated: result.recipient.rankUpdated
        }
      }
    });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('PV transfer failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      }, req);

      return NextResponse.json(
        { 
          success: false,
          error: error instanceof Error ? error.message : 'Transfer failed'
        },
        { status: 500 }
      );
    }
  })(request);
}

