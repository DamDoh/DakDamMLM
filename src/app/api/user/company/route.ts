import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { companyId: true }
    });

    return NextResponse.json({
      companyId: user?.companyId || null
    });
  } catch (error) {
    console.error('Error fetching user company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}