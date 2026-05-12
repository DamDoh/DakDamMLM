import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, generateTokens, ValidationError, validateEmail, validatePhoneNumber } from '@/lib/auth-service';
import { generateUniqueMemberId } from '@/lib/member-id-generator';
import { rateLimit, createAuthRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/database';
import { findFirstAvailablePosition } from '@/services/user-service';
import { transformUserToMember } from '@/lib/shared-utils';
import { triggerWelcomeNotification } from '@/services/notification-service';
import { InputSanitizer, validateRequestSafety } from '@/lib/input-sanitization'; 
import type { Member } from "@/lib/types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate request safety first
    const safetyCheck = validateRequestSafety(request);
    if (!safetyCheck.safe) {
      logger.security('Unsafe registration attempt blocked', undefined, {
        reason: safetyCheck.reason,
        ip: request.headers.get('x-forwarded-for')
      }, request);
      return NextResponse.json(
        { error: 'Request blocked for security reasons' },
        { status: 403 }
      );
    }

    // Apply rate limiting for registration
    const rateLimitResult = await rateLimit(request, createAuthRateLimit());
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for registration attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    const bodyText = await request.text();
    const body = InputSanitizer.sanitizeJSON(bodyText);
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
    // Sanitize all string inputs
    const sanitizedBody = InputSanitizer.sanitizeObject(body as Record<string, any>, {
      allowHTML: false,
      maxLength: 1000
    });

    const {
      email,
      phoneNumber,
      password,
      firstName,
      surname,
      accountType,
      sponsorId,
      companyId,
      idCardUrl,
      idCardNumber,
      placementParentId,
      position
    } = sanitizedBody;

    // Validate required fields using centralized validation
    if (!phoneNumber || !password || !firstName || !surname || !idCardNumber) {
      return NextResponse.json(
        { error: 'Phone number, password, first name, surname, and ID card number are required' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Check if ID card number already exists in this company
    const existingUserByIdCard = await prisma.user.findFirst({
      where: {
        idCardNumber: idCardNumber as string,
        companyId
      } as any,
      select: { id: true, active: true }
    });

    if (existingUserByIdCard) {
      return NextResponse.json(
        { error: 'An account with this ID card number already exists in this company. Each person is allowed only one account per company.' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 12) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters long' },
        { status: 400 }
      );
    }

    // Password complexity check
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return NextResponse.json(
        { error: 'Password must contain uppercase, lowercase, numbers, and special characters' },
        { status: 400 }
      );
    }

    // Validate sponsor exists if provided
    if (sponsorId) {
      const sponsor = await prisma.user.findUnique({
        where: { id: sponsorId },
        select: { id: true, active: true }
      });

      if (!sponsor) {
        return NextResponse.json(
          { error: 'Invalid sponsor ID' },
          { status: 400 }
        );
      }

      if (!sponsor.active) {
        return NextResponse.json(
          { error: 'Sponsor account is not active' },
          { status: 400 }
        );
      }
    }

    // Generate unique member ID
    const memberId = await generateUniqueMemberId(
      firstName,
      surname,
      phoneNumber,
      async (id) => {
        const existing = await prisma.user.findUnique({
          where: { memberId: id }
        });
        return !!existing;
      }
    );

    // Determine genealogy placement
    let finalPlacementParentId = placementParentId;
    let finalPosition = position as 'left' | 'right' | null;

    // If no placement specified, find first available position under sponsor
    if (!finalPlacementParentId && sponsorId) {
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          memberId: true,
          firstName: true,
          surname: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          rank: true,
          storeOwnerLevel: true,
          pv: true,
          pvDate: true,
          teamSize: true,
          sponsorId: true,
          placementParentId: true,
          position: true,
          children: true,
          active: true,
          phoneNumber: true,
          lastActivityDate: true,
          isAdmin: true,
          addresses: true,
          createdAt: true
        }
      });
      type SelectedUser = (typeof allUsers)[number];

      const allMembers: Map<string, Member> = new Map(
        allUsers.map((u: SelectedUser): [string, Member] => [
          u.id,
          transformUserToMember(u)
        ])
      );
      
      const placement = await findFirstAvailablePosition(sponsorId, allMembers);

      if (placement) {
        finalPlacementParentId = placement.parentId;
        finalPosition = placement.position;
      }
    }

    // Use centralized password hashing with consistent rounds
    const hashedPassword = await hashPassword(password);

    // Register user with proper genealogy placement
    const newUser = await prisma.user.create({
      data: {
        email: email || `${phoneNumber}@dakdam.app`,
        phoneNumber,
        password: hashedPassword,
        firstName,
        surname,
        fullName: `${firstName} ${surname}`,
        memberId,
        accountType: accountType || 'Customer',
        sponsorId,
        companyId,
        idCardUrl,
        idCardNumber: idCardNumber as string,
        placementParentId: finalPlacementParentId,
        position: finalPosition,
        active: true,
        isAdmin: false,
        rank: 'Member',
        pv: 0,
        teamSize: { left: 0, right: 0, total: 0 },
        children: { left: null, right: null },
        failedLoginAttempts: 0
      } as any
    });

    // Update parent's children if placement was made
    if (finalPlacementParentId && finalPosition) {
      const parent = await prisma.user.findUnique({
        where: { id: finalPlacementParentId },
        select: { children: true }
      });

      if (parent) {
        const updatedChildren = { ...(parent.children as any) };
        updatedChildren[finalPosition] = newUser.id;

        await prisma.user.update({
          where: { id: finalPlacementParentId },
          data: { children: updatedChildren }
        });
      }
    }

    // Generate authentication tokens
    const authUser = {
      id: newUser.id,
      email: newUser.email || '',
      memberId: newUser.memberId,
      fullName: newUser.fullName,
      isAdmin: newUser.isAdmin,
      accountType: (newUser.accountType || 'Customer') as 'Customer' | 'Distributor'
    };

    const tokens = generateTokens(authUser);

    // Trigger welcome notification
    try {
      await triggerWelcomeNotification(newUser.id, newUser.fullName);
    } catch (notifError) {
      logger.warn('Failed to send welcome notification', {
        userId: newUser.id,
        error: notifError instanceof Error ? notifError.message : 'Unknown error'
      }, request);
    }

    const duration = Date.now() - startTime;
    logger.info('Registration successful', {
      userId: newUser.id,
      memberId: newUser.memberId,
      placementParentId: finalPlacementParentId,
      position: finalPosition,
      duration
    }, request);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        surname: newUser.surname,
        memberId: newUser.memberId,
        fullName: newUser.fullName
      },
      token: tokens.accessToken
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Registration error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      ip: request.headers.get('x-forwarded-for')
    }, request);
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    let errorMessage = 'Registration failed';
    if (error.message && error.message.includes('Unique constraint')) {
      errorMessage = 'Phone number or email already registered';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}