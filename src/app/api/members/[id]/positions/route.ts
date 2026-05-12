import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params;

    if (!parentId) {
      return NextResponse.json(
        { error: 'Parent ID is required' },
        { status: 400 }
      );
    }

    // Check if parent exists
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: { id: true },
    });

    if (!parent) {
      return NextResponse.json(
        { error: 'Parent not found' },
        { status: 404 }
      );
    }

    // Check which positions are available
    const leftChild = await prisma.user.findFirst({
      where: {
        placementParentId: parentId,
        position: 'left',
        deleted: false,
      },
      select: { id: true },
    });

    const rightChild = await prisma.user.findFirst({
      where: {
        placementParentId: parentId,
        position: 'right',
        deleted: false,
      },
      select: { id: true },
    });

    return NextResponse.json({
      left: !leftChild,
      right: !rightChild,
    });
  } catch (error) {
    console.error('Error checking available positions:', error);
    return NextResponse.json(
      { error: 'Failed to check available positions' },
      { status: 500 }
    );
  }
}

