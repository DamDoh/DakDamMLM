import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Get the user ID from command line or use a test user
    const userId = process.argv[2];
    
    if (!userId) {
      console.log('Usage: npx tsx scripts/check-ecash-balance.ts <userId>');
      console.log('\nFinding users with recent activity...\n');
      
      // Find a user with recent commissions
      const recentCommission = await prisma.commission.findFirst({
        orderBy: { date: 'desc' },
        select: { userId: true },
        take: 1
      });
      
      if (recentCommission) {
        const user = await prisma.user.findUnique({
          where: { id: recentCommission.userId },
          select: { id: true, memberId: true, fullName: true, firstName: true, surname: true }
        });
        
        if (user) {
          console.log(`Found user: ${user.fullName || `${user.firstName} ${user.surname}`} (${user.memberId})`);
          console.log(`User ID: ${user.id}\n`);
          console.log('Run again with: npx tsx scripts/check-ecash-balance.ts ' + user.id);
          return;
        }
      }
      
      console.log('No users found. Please provide a userId.');
      return;
    }
    
    console.log(`🔍 Checking E-Cash balance for user: ${userId}\n`);
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, memberId: true, fullName: true, firstName: true, surname: true }
    });
    
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return;
    }
    
    console.log(`User: ${user.fullName || `${user.firstName} ${user.surname}`} (${user.memberId})\n`);
    
    // Get ALL commissions for the user
    const allCommissions = await prisma.commission.findMany({
      where: { userId: userId },
      orderBy: { date: 'desc' }
    });
    
    console.log(`📊 Total commissions found: ${allCommissions.length}\n`);
    
    // Separate by type
    const byType: Record<string, any[]> = {};
    allCommissions.forEach(c => {
      if (!byType[c.type]) {
        byType[c.type] = [];
      }
      byType[c.type].push(c);
    });
    
    // Calculate totals by type
    console.log('💰 Commissions by Type:\n');
    let totalBalance = 0;
    
    for (const [type, commissions] of Object.entries(byType)) {
      const typeTotal = commissions.reduce((sum, c) => sum + c.amount, 0);
      totalBalance += typeTotal;
      
      const positiveCount = commissions.filter(c => c.amount > 0).length;
      const negativeCount = commissions.filter(c => c.amount < 0).length;
      
      console.log(`  ${type}:`);
      console.log(`    Count: ${commissions.length} (${positiveCount} positive, ${negativeCount} negative)`);
      console.log(`    Total: $${typeTotal.toFixed(2)}`);
      
      // Show recent transactions
      const recent = commissions.slice(0, 5);
      if (recent.length > 0) {
        console.log(`    Recent transactions:`);
        recent.forEach(c => {
          const sign = c.amount >= 0 ? '+' : '';
          const date = new Date(c.date).toLocaleDateString();
          console.log(`      ${sign}$${c.amount.toFixed(2)} on ${date} - ${c.description || 'No description'}`);
        });
      }
      console.log('');
    }
    
    console.log(`\n📈 E-Cash Balance Calculation:`);
    console.log(`   Sum of ALL commissions: $${totalBalance.toFixed(2)}`);
    
    // Check if there are any purchases
    const purchases = allCommissions.filter(c => c.type === 'E-Cash Purchase');
    if (purchases.length > 0) {
      const purchaseTotal = purchases.reduce((sum, c) => sum + c.amount, 0);
      console.log(`\n🛒 Purchase Summary:`);
      console.log(`   Total purchases: ${purchases.length}`);
      console.log(`   Total deducted: $${Math.abs(purchaseTotal).toFixed(2)}`);
      
      console.log(`\n   Recent purchases:`);
      purchases.slice(0, 10).forEach(c => {
        const date = new Date(c.date).toLocaleDateString();
        console.log(`     -$${Math.abs(c.amount).toFixed(2)} on ${date} - ${c.description || 'No description'}`);
      });
    }
    
    // Check earnings
    const earnings = allCommissions.filter(c => c.amount > 0 && c.type !== 'E-Cash Purchase');
    if (earnings.length > 0) {
      const earningsTotal = earnings.reduce((sum, c) => sum + c.amount, 0);
      console.log(`\n💵 Earnings Summary:`);
      console.log(`   Total earnings: ${earnings.length} transactions`);
      console.log(`   Total earned: $${earningsTotal.toFixed(2)}`);
    }
    
    console.log(`\n✅ Final E-Cash Balance: $${totalBalance.toFixed(2)}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
