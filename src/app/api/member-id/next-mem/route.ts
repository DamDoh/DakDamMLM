import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Find all existing MEM-prefixed member IDs to determine next available number
    const existingMemMembers = await prisma.user.findMany({
      where: {
        memberId: {
          startsWith: 'MEM'
        },
        deleted: false  // Only count non-deleted members
      },
      select: {
        memberId: true
      }
    });

    // Extract all numbers from MEM-prefixed IDs
    const memPattern = /^MEM(\d+)$/;
    const existingNumbers = existingMemMembers
      .map(m => {
        const match = m.memberId.match(memPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0)
      .sort((a, b) => a - b); // Sort ascending

    // Find the next available number
    let nextNumber = 1;
    if (existingNumbers.length > 0) {
      // Find the first gap or use the highest number + 1
      for (let i = 0; i < existingNumbers.length; i++) {
        const expected = i + 1;
        if (existingNumbers[i] !== expected) {
          nextNumber = expected;
          break;
        }
      }
      // If no gap found, use the highest number + 1
      if (nextNumber === 1) {
        nextNumber = Math.max(...existingNumbers) + 1;
      }
    }

    // Generate next MEM-prefixed ID with zero-padded number (3 digits: MEM001, MEM002, etc.)
    const nextMemberId = `MEM${nextNumber.toString().padStart(3, '0')}`;

    return NextResponse.json({ 
      nextMemberId,
      nextNumber 
    }, { status: 200 });
  } catch (error) {
    console.error('Error getting next MEM ID:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get next MEM ID' },
      { status: 500 }
    );
  }
}

