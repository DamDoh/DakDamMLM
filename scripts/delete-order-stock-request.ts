import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const orderId = 'ORD-1767865549817-yjlg84';
    
    // Find stock request for this order
    const stockRequest = await (prisma as any).stockRequest.findFirst({
      where: {
        stockistName: { startsWith: `ORDER:${orderId}|` }
      },
      include: { items: true }
    });

    if (!stockRequest) {
      console.log('✅ No stock request found for this order (already cleaned up)');
      return;
    }

    console.log(`Found stock request: ${stockRequest.id}`);
    console.log(`   Stockist Name: ${stockRequest.stockistName}`);
    console.log(`   Status: ${stockRequest.status}`);
    console.log(`   Items: ${stockRequest.items.length}\n`);

    // Delete stock request items first
    await (prisma as any).stockRequestItem.deleteMany({
      where: { stockRequestId: stockRequest.id }
    });

    // Delete stock request
    await (prisma as any).stockRequest.delete({
      where: { id: stockRequest.id }
    });

    console.log('✅ Stock request deleted successfully');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
