import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { transformUserToMember } from '@/lib/shared-utils';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const withoutStockLevel = searchParams.get('withoutStockLevel') === 'true';
    const searchQuery = searchParams.get('search') || '';
    const placementParentId = searchParams.get('placementParentId') || '';
    
    // Build where clause with proper structure for combining conditions
    const conditions: any[] = [{ deleted: false }];
    
    // Filter by placementParentId if provided (for binary stock downline relationships)
    if (placementParentId) {
      conditions.push({ placementParentId: placementParentId });
    }
    
    // Filter by users without stock level if requested
    if (withoutStockLevel) {
      conditions.push({
        OR: [
          { storeOwnerLevel: null },
          { storeOwnerLevel: '' },
        ],
      });
      // Exclude admin users from the list
      conditions.push({ isAdmin: false });
    }
    
    // Add search filter if provided
    if (searchQuery) {
      conditions.push({
        OR: [
          { fullName: { contains: searchQuery, mode: 'insensitive' } },
          { memberId: { contains: searchQuery, mode: 'insensitive' } },
        ],
      });
    }
    
    const whereClause = conditions.length === 1 ? conditions[0] : { AND: conditions };
    
    // Try to fetch with all columns first
    let users: any[];
    let hasTeamSize = true;
    let hasWaitingPV = true;
    
    try {
      // Try to fetch with all columns (including optional ones that may not exist)
      // Using 'as any' to allow columns that may have been removed from database
      users = await (prisma.user.findMany as any)({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          firstName: true,
          surname: true,
          fullName: true,
          memberId: true,
          accountType: true,
          sponsorId: true,
          companyId: true,
          idCardUrl: true,
          idCardNumber: true,
          active: true,
          isAdmin: true,
          rank: true,
          teamSize: true,
          children: true,
          placementParentId: true,
          position: true,
          storeOwnerLevel: true,
          avatarUrl: true,
          addresses: true,
          lastActivityDate: true,
          deleted: true,
          deletedDate: true,
          deletedBy: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          lastFailedLogin: true,
          createdAt: true,
          updatedAt: true,
          pv: true,
          pvDate: true,
          rankId: true,
          walletId: true,
        },
      });
    } catch (columnError: any) {
      // If columns don't exist, retry without them
      const errorMessage = columnError?.message || '';
      if (
        errorMessage.includes('Unknown column') ||
        errorMessage.includes('column') ||
        errorMessage.includes('P2001') || // Record not found (but also used for missing columns sometimes)
        errorMessage.includes('does not exist')
      ) {
        console.warn('⚠️  Some columns may not exist, fetching without teamSize/waitingPV columns');
        hasTeamSize = false;
        hasWaitingPV = false;
        
        users = await prisma.user.findMany({
          where: whereClause,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            firstName: true,
            surname: true,
            fullName: true,
            memberId: true,
            accountType: true,
            sponsorId: true,
            companyId: true,
            idCardUrl: true,
            idCardNumber: true,
            active: true,
            isAdmin: true,
            rank: true,
            children: true,
            placementParentId: true,
            position: true,
            storeOwnerLevel: true,
            avatarUrl: true,
            addresses: true,
            lastActivityDate: true,
            deleted: true,
            deletedDate: true,
            deletedBy: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            lastFailedLogin: true,
            createdAt: true,
            updatedAt: true,
            pv: true,
            pvDate: true,
            rankId: true,
            walletId: true,
          },
        });
      } else {
        throw columnError;
      }
    }
    
    // Safely transform users, handling any invalid teamSize data
    const members = users.map((user) => {
      try {
        // Ensure teamSize is valid JSON (or use default if column doesn't exist)
        let teamSize = hasTeamSize && user.teamSize ? user.teamSize : { left: 0, right: 0, total: 0 };
        if (!teamSize || typeof teamSize !== 'object') {
          teamSize = { left: 0, right: 0, total: 0 };
        }
        
        return transformUserToMember({
          ...user,
          teamSize,
        });
      } catch (transformError) {
        console.error(`Error transforming user ${user.id}:`, transformError);
        // Return user with safe defaults
        return transformUserToMember({
          ...user,
          teamSize: { left: 0, right: 0, total: 0 },
        });
      }
    });
    
    // Add aggressive cache control headers to prevent stale data across all browsers
    return NextResponse.json({ success: true, data: members }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'Last-Modified': new Date().toUTCString(),
      },
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Failed to fetch members:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    // If database is unavailable (demo mode), return empty array instead of error
    if (
      errorMessage.includes("Can't reach database server") ||
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('Connection') ||
      errorMessage.includes('credentials') ||
      errorMessage.includes('P1001') || // Prisma connection error
      errorMessage.includes('P2002')   // Prisma unique constraint error
    ) {
      console.warn('Database unavailable - returning empty array for demo mode');
      return NextResponse.json([], {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    
    // For other errors, return error response with more details in development
    return NextResponse.json({ 
      error: 'Failed to fetch members',
      ...(process.env.NODE_ENV === 'development' ? { 
        details: errorMessage,
        stack: errorStack 
      } : {})
    }, { status: 500 });
  }
}


