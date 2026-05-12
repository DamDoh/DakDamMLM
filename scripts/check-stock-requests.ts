import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { fullName: { contains: 'RiThy', mode: 'insensitive' } },
          { firstName: { contains: 'RiThy', mode: 'insensitive' } }
        ]
      },
      select: { id: true, memberId: true, fullName: true }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    // Check for stock requests related to the deleted order
    const stockRequests = await (prisma as any).stockRequest.findMany({
      where: {
        stockistName: { contains: 'RiThy' }
      },
      include: { items: true }
    });

    console.log(`Found ${stockRequests.length} stock request(s) for RiThy VoNg:\n`);
    
    stockRequests.forEach((sr: any) => {
      console.log(`   - Stock Request ID: ${sr.id}`);
      console.log(`     Stockist Name: ${sr.stockistName}`);
      console.log(`     Status: ${sr.status}`);
      console.log(`     Total Value: $${sr.totalValue}`);
      console.log(`     Created: ${sr.createdDate.toLocaleDateString()}`);
      console.log('');
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
