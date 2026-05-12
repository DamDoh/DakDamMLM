import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { transformUserToMember } from '@/lib/shared-utils';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        deleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });
    const members = users.map(transformUserToMember);
    return NextResponse.json({ success: true, data: members }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}


