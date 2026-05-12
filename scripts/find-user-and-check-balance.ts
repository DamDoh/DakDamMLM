import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Search for user "RiThy VoNg" or similar
    const searchName = process.argv[2] || 'RiThy';
    
    console.log(`🔍 Searching for users with name containing: "${searchName}"\n`);
    
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { fullName: { contains: searchName, mode: 'insensitive' } },
          { firstName: { contains: searchName, mode: 'insensitive' } },
          { surname: { contains: searchName, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        firstName: true,
        surname: true
      },
      take: 10
    });
    
    if (users.length === 0) {
      console.log('No users found. Checking all users with commissions...\n');
      // Find users by checking if they have any commissions
      const commissionUserIds = await prisma.commission.findMany({
        select: {
          userId: true
        },
        distinct: ['userId'],
        take: 10
      });
      
      const userIds = commissionUserIds.map(c => c.userId);
      
      const usersWithCommissions = await prisma.user.findMany({
        where: {
          id: {
            in: userIds
          }
        },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          firstName: true,
          surname: true
        },
        take: 10
      });
      
      console.log('Users with commissions:');
      usersWithCommissions.forEach(u => {
        console.log(`  - ${u.fullName || `${u.firstName} ${u.surname}`} (${u.memberId}) - ID: ${u.id}`);
      });
      return;
    }
    
    console.log(`Found ${users.length} user(s):\n`);
    
    for (const user of users) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`User: ${user.fullName || `${user.firstName} ${user.surname}`} (${user.memberId})`);
      console.log(`ID: ${user.id}`);
      console.log(`${'='.repeat(60)}\n`);
      
      // Get ALL commissions
      const allCommissions = await prisma.commission.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' }
      });
      
      // Calculate balance (sum of ALL commissions)
      const balance = allCommissions.reduce((sum, c) => sum + c.amount, 0);
      
      console.log(`📊 Commission Summary:`);
      console.log(`   Total commissions: ${allCommissions.length}`);
      console.log(`   E-Cash Balance: $${balance.toFixed(2)}\n`);
      
      // Group by type
      const byType: Record<string, { count: number; total: number; items: any[] }> = {};
      allCommissions.forEach(c => {
        if (!byType[c.type]) {
          byType[c.type] = { count: 0, total: 0, items: [] };
        }
        byType[c.type].count++;
        byType[c.type].total += c.amount;
        byType[c.type].items.push(c);
      });
      
      console.log(`💰 Breakdown by Type:\n`);
      for (const [type, data] of Object.entries(byType)) {
        const sign = data.total >= 0 ? '+' : '';
        console.log(`   ${type}:`);
        console.log(`     Transactions: ${data.count}`);
        console.log(`     Total: ${sign}$${data.total.toFixed(2)}`);
        
        // Show first 3 transactions
        if (data.items.length > 0) {
          console.log(`     Sample transactions:`);
          data.items.slice(0, 3).forEach(c => {
            const date = new Date(c.date).toLocaleDateString();
            const sign = c.amount >= 0 ? '+' : '';
            console.log(`       ${sign}$${c.amount.toFixed(2)} on ${date} - ${c.description || 'No description'}`);
          });
        }
        console.log('');
      }
      
      // Show purchases separately
      const purchases = allCommissions.filter(c => c.type === 'E-Cash Purchase');
      const purchaseTotal = purchases.length > 0 ? purchases.reduce((sum, c) => sum + c.amount, 0) : 0;
      
      // Show earnings
      const earnings = allCommissions.filter(c => c.amount > 0 && c.type !== 'E-Cash Purchase');
      const earningsTotal = earnings.length > 0 ? earnings.reduce((sum, c) => sum + c.amount, 0) : 0;
      
      if (purchases.length > 0) {
        console.log(`\n🛒 Purchase Details:`);
        console.log(`   Total purchases: ${purchases.length}`);
        console.log(`   Total deducted: $${Math.abs(purchaseTotal).toFixed(2)}\n`);
      }
      
      if (earnings.length > 0) {
        console.log(`\n💵 Earnings Summary:`);
        console.log(`   Total earnings transactions: ${earnings.length}`);
        console.log(`   Total earned: $${earningsTotal.toFixed(2)}`);
      }
      
      if (purchases.length > 0 && earnings.length > 0) {
        console.log(`\n📊 Balance Calculation:`);
        console.log(`   Total Earnings: $${earningsTotal.toFixed(2)}`);
        console.log(`   Total Purchases: -$${Math.abs(purchaseTotal).toFixed(2)}`);
        console.log(`   ─────────────────────────`);
        console.log(`   Available Balance: $${balance.toFixed(2)}`);
      }
      
      console.log(`\n✅ Final E-Cash Balance: $${balance.toFixed(2)}\n`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
