const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWalletBalances() {
  console.log('🔧 Starting wallet balance recalculation...\n');

  try {
    // Get all wallets
    const wallets = await prisma.wallet.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            memberId: true
          }
        }
      }
    });

    console.log(`Found ${wallets.length} wallets to check\n`);

    for (const wallet of wallets) {
      // Get all transactions for this wallet
      const transactions = await prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'asc' }
      });

      if (transactions.length === 0) {
        console.log(`⏭️  Skipping ${wallet.user.fullName} (${wallet.user.memberId}) - no transactions`);
        continue;
      }

      // Calculate correct balance from transactions
      let calculatedBalance = 0;
      for (const tx of transactions) {
        // Credit transactions (type: 'credit', 'topup', 'commission', etc.) add to balance
        // Debit transactions (type: 'debit', 'withdrawal', 'transfer', etc.) subtract from balance
        const amount = parseFloat(tx.amount) || 0;
        
        if (tx.type === 'credit' || tx.type === 'topup' || tx.type === 'commission') {
          calculatedBalance += amount;
        } else if (tx.type === 'debit' || tx.type === 'withdrawal' || tx.type === 'transfer') {
          calculatedBalance -= Math.abs(amount); // Ensure we subtract
        } else {
          // For unknown types, use the amount as-is (positive = credit, negative = debit)
          calculatedBalance += amount;
        }
      }

      const currentBalance = parseFloat(wallet.balance) || 0;

      if (Math.abs(calculatedBalance - currentBalance) > 0.01) {
        console.log(`\n💰 Fixing wallet for ${wallet.user.fullName} (${wallet.user.memberId})`);
        console.log(`   Current balance: ${currentBalance.toFixed(2)} PV`);
        console.log(`   Calculated balance: ${calculatedBalance.toFixed(2)} PV`);
        console.log(`   Difference: ${(calculatedBalance - currentBalance).toFixed(2)} PV`);
        console.log(`   Transactions: ${transactions.length}`);

        // Update wallet balance
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: calculatedBalance }
        });

        console.log(`   ✅ Updated to ${calculatedBalance.toFixed(2)} PV`);
      } else {
        console.log(`✓ ${wallet.user.fullName} (${wallet.user.memberId}) - balance correct (${currentBalance.toFixed(2)} PV)`);
      }
    }

    console.log('\n✅ Wallet balance recalculation complete!');
  } catch (error) {
    console.error('❌ Error fixing wallet balances:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixWalletBalances()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
