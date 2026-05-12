import { NextRequest, NextResponse } from 'next/server';
import { runSeed } from '@/lib/migration';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting data seeding...');

    const result = await runSeed();

    console.log('Seeding completed:', result);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Seeding completed. Created ${result.members} members, ${result.commissions} commissions, ${result.orders} orders, and ${result.products} products.`
    });

  } catch (error) {
    console.error('Seeding failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Seeding failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}