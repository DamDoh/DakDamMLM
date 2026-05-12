import { NextRequest, NextResponse } from 'next/server';
import { registerMLMUser, generateTokens, ValidationError, validateEmail, validatePhoneNumber } from '@/lib/auth-service';
import { rateLimit, createAuthRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/database';
import { findFirstAvailablePosition } from '@/services/user-service';
import { transformUserToMember } from '@/lib/shared-utils';
import { triggerWelcomeNotification } from '@/services/notification-service';
import { InputSanitizer, validateRequestSafety } from '@/lib/input-sanitization';

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
      position,
      referralCode
    } = sanitizedBody;

    // Validate required fields using centralized validation
    if (!phoneNumber || !firstName || !surname || !idCardNumber) {
      return NextResponse.json(
        { error: 'Phone number, first name, surname, and ID card number are required' },
        { status: 400 }
      );
    }

    // Extract last 4 digits from ID card number to use as password
    const idCardNumberStr = String(idCardNumber).trim();
    if (idCardNumberStr.length < 4) {
      return NextResponse.json(
        { error: 'ID card number must be at least 4 digits long' },
        { status: 400 }
      );
    }
    
    // Use last 4 digits of ID card number as password (always use this, ignore provided password)
    const extractedPassword = idCardNumberStr.slice(-4);
    // Always use the last 4 digits of ID card number as the password
    const finalPassword = extractedPassword;

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

    // Normalize email to lowercase for consistency (PostgreSQL is case-sensitive)
    // Generate email in format: +<phone_number>@dakdam.app if not provided
    const normalizedEmail = email 
      ? email.toLowerCase().trim() 
      : (() => {
          const phoneWithPlus = phoneNumber.trim().startsWith('+') 
            ? phoneNumber.trim() 
            : `+${phoneNumber.trim()}`;
          return `${phoneWithPlus}@dakdam.app`;
        })();
    
    // Normalize phone number (remove formatting for consistent storage)
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').trim();

    // Check if email already exists (with normalized email)
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Check if phone number already exists (with normalized phone)
    const existingUserByPhone = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone }
    });

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'An account with this phone number already exists' },
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
    // Password is always the last 4 digits of ID card number (already validated to be 4 digits)
    // No additional validation needed for 4-digit password from ID card

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

    // Generate unique member ID following sponsor's pattern (same logic as preview API)
    // If sponsor is SK3480, new member gets SK3481, SK3482, etc.
    const idPattern = /^([A-Z]+)(\d+)$/;
    let prefix = 'MEM';
    let nextNumber = 1;
    let numberLength = 3; // Default padding length
    let followSponsor = false;

    // Check if sponsor exists and extract their ID pattern
    if (sponsorId) {
      const sponsor = await prisma.user.findFirst({
        where: {
          OR: [
            { id: sponsorId },
            { memberId: sponsorId }
          ]
        },
        select: { memberId: true }
      });

      if (sponsor && sponsor.memberId) {
        const sponsorMatch = sponsor.memberId.match(idPattern);
        if (sponsorMatch) {
          // Sponsor has pattern: extract prefix and number
          prefix = sponsorMatch[1]; // e.g., "SK" or "MEM"
          const sponsorNumber = parseInt(sponsorMatch[2], 10);
          numberLength = sponsorMatch[2].length; // Preserve original padding length
          nextNumber = sponsorNumber + 1; // Start from sponsor's number + 1
          followSponsor = true;
        }
      }
    }

    // If not following sponsor, use MEM pattern as default
    if (!followSponsor) {
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
    } else {
      // When following sponsor, check for existing IDs with same prefix to find next available
      const existingSamePrefix = await prisma.user.findMany({
        where: {
          memberId: {
            startsWith: prefix
          },
          deleted: false
        },
        select: {
          memberId: true
        }
      });

      // Extract numbers from same prefix IDs
      const prefixPattern = new RegExp(`^${prefix}(\\d+)$`);
      const existingNumbers = existingSamePrefix
        .map(m => {
          const match = m.memberId.match(prefixPattern);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0)
        .sort((a, b) => a - b);

      // Find next available number (start from sponsor's number + 1, but check for gaps)
      if (existingNumbers.length > 0) {
        // Find first available number >= nextNumber
        for (const num of existingNumbers) {
          if (num >= nextNumber) {
            if (num === nextNumber) {
              nextNumber = num + 1; // This number is taken, try next
            } else {
              break; // Found a gap, use nextNumber
            }
          }
        }
      }
    }

    // Generate ID with prefix and zero-padded number
    let candidateId = `${prefix}${nextNumber.toString().padStart(numberLength, '0')}`;
    
    // Double-check for uniqueness and find next available if needed
    let counter = 0;
    let memberId = '';
    while (counter < 999) {
        const existing = await prisma.user.findUnique({
        where: { memberId: candidateId }
        });
      
      if (!existing) {
        memberId = candidateId;
        break;
      }
      
      // If this number is taken, try next one
      nextNumber++;
      candidateId = `${prefix}${nextNumber.toString().padStart(numberLength, '0')}`;
      counter++;
      }

    if (counter >= 999 || !memberId) {
      // Fallback: use timestamp-based ID if we can't find a unique ID
      memberId = `${prefix}${Date.now().toString().slice(-6)}`;
    }

    // Use centralized MLM registration function
    const authUser = await registerMLMUser({
      email: normalizedEmail,
      password: finalPassword,
      firstName,
      surname,
      phoneNumber: normalizedPhone,
      sponsorId,
      companyId,
      idCardNumber,
      idCardUrl,
      placementParentId,
      position,
      referralCode,
      accountType
    });

    // Get the created user for response
    const newUser = await prisma.user.findUnique({
      where: { id: authUser.id }
    });

    if (!newUser) {
      throw new Error('User creation failed');
    }

    // Generate tokens
    const tokens = await generateTokens(authUser);

    const duration = Date.now() - startTime;
    logger.info('Registration successful', {
      userId: newUser.id,
      memberId: newUser.memberId,
      email: newUser.email,
      sponsorId,
      placementParentId: newUser.placementParentId,
      position: newUser.position,
      duration
    }, request);
          }
          
          // Fetch sponsor's rank only if sponsorIdToUse exists
          if (sponsorIdToUse) {
            const sponsorUser = await prisma.user.findUnique({
              where: { id: sponsorIdToUse },
              select: { rank: true }
            });
            sponsorRank = sponsorUser?.rank || null;
          }
          
          // Get new member's rank
          const newMemberRank = newUser.rank || 'Member';
          
          // Normalize ranks
          const normalizedSponsorRank = sponsorRank ? sponsorRank.trim() : null;
          const normalizedNewMemberRank = newMemberRank ? newMemberRank.trim() : null;
          
          // Valid ranks that have PV points (Bronze and above)
          const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
          
          // Check if new member is Member rank
          const isNewMemberMember = !normalizedNewMemberRank || 
                                    normalizedNewMemberRank === '' || 
                                    normalizedNewMemberRank.toLowerCase() === 'member' ||
                                    !validRanks.includes(normalizedNewMemberRank);
          
          // Check if sponsor has valid rank
          const isSponsorMember = !normalizedSponsorRank || 
                                  normalizedSponsorRank === '' || 
                                  normalizedSponsorRank.toLowerCase() === 'member';
          const isSponsorValidRank = normalizedSponsorRank && validRanks.includes(normalizedSponsorRank);
          
          // Skip commission if no direct sponsor found
          if (!sponsorIdToUse) {
            console.log(`[Binary Bonus] Skipping - No direct sponsor (sponsorId) found for new member`);
            logger.info('Binary Bonus skipped - no direct sponsor', {
              newMemberId: newUser.id,
              sponsorId,
              placementParentId: finalPlacementParentId
            }, request);
          }
          // Skip commission if new member is Member rank
          else if (isNewMemberMember) {
            console.log(`[Binary Bonus] Skipping - New member rank is Member or invalid: "${newMemberRank}"`);
            logger.info('Binary Bonus skipped - new member is Member rank', {
              newMemberId: newUser.id,
              newMemberRank,
              sponsorId: sponsorIdToUse
            }, request);
          }
          // Skip if sponsor is Member or invalid rank
          else if (isSponsorMember || !isSponsorValidRank) {
            console.log(`[Binary Bonus] Skipping - Sponsor rank is Member or invalid: "${sponsorRank}"`);
            logger.info('Binary Bonus skipped - sponsor is Member rank', {
              newMemberId: newUser.id,
              sponsorRank,
              sponsorId: sponsorIdToUse
            }, request);
          } else {
            // Calculate commission: PV Points (from new member's rank) × Commission Rate (from sponsor's rank)
            const pvPoints = getPVPointsByRank(normalizedNewMemberRank);
            const commissionRate = getCommissionRateByRank(normalizedSponsorRank);
            
            // Final safety check
            if (pvPoints <= 0 || commissionRate <= 0) {
              console.log(`[Binary Bonus] Skipping - Invalid values: PV=${pvPoints}, Rate=${commissionRate}`);
              logger.info('Binary Bonus skipped - invalid PV or rate', {
                newMemberId: newUser.id,
                pvPoints,
                commissionRate,
                newMemberRank: normalizedNewMemberRank,
                sponsorRank: normalizedSponsorRank
              }, request);
            } else {
              const commissionAmount = Math.round(pvPoints * commissionRate * 100) / 100;
              
              console.log(`[Binary Bonus] Calculation: ${pvPoints} PV (${normalizedNewMemberRank}) × ${(commissionRate * 100).toFixed(1)}% (${normalizedSponsorRank}) = ${commissionAmount}`);
              
              // CRITICAL FIX: Check existing commissions for DIRECT SPONSOR, not placement parent
              // Check if commission already exists for this new member to prevent duplicates
              const existingCommission = await prisma.commission.findFirst({
                where: {
                  userId: sponsorIdToUse, // Use direct sponsorId, not finalPlacementParentId
                  type: 'Binary Bonus',
                  date: {
                    gte: new Date(Date.now() - 60000) // Last 60 seconds
                  }
                }
              });

              if (existingCommission) {
                console.log('Binary Bonus already exists for recent member addition, skipping duplicate');
                logger.info('Binary Bonus commission already exists, skipping duplicate', {
                  sponsorId: sponsorIdToUse,
                  existingCommissionId: existingCommission.id
                }, request);
              } else {
                console.log('Creating and paying Binary Bonus commission:', {
                  sponsorId: sponsorIdToUse, // CRITICAL FIX: Use sponsorId, not placementParentId
                  newMemberId: newUser.id,
                  position: finalPosition,
                  newMemberRank: normalizedNewMemberRank,
                  sponsorRank: normalizedSponsorRank,
                  pvPoints,
                  commissionRate,
                  amount: commissionAmount,
                  companyId
                });
                
                // CRITICAL FIX: Commission goes to DIRECT SPONSOR, not placement parent
                const commission = await prisma.commission.create({
                  data: {
                    userId: sponsorIdToUse, // Use direct sponsorId, not finalPlacementParentId
                    amount: commissionAmount,
                    type: 'Binary Bonus',
                    status: 'Paid',
                    companyId: companyId || undefined,
                    date: new Date()
                  }
                });

                // Credit the wallet immediately
                try {
                  const { WalletService } = await import('@/services/wallet-service');
                  // CRITICAL FIX: Credit DIRECT SPONSOR's wallet, not placement parent
                  await WalletService.creditWallet(
                    sponsorIdToUse, // Use direct sponsorId, not finalPlacementParentId
                    commissionAmount,
                    `Binary Bonus: New member ${newUser.fullName} (${normalizedNewMemberRank}, ${pvPoints} PV) referred by sponsor - ${pvPoints} PV × ${(commissionRate * 100).toFixed(1)}%`,
                    commission.id,
                    'commission'
                  );
                  console.log('Binary Bonus commission paid and wallet credited:', commission.id);
                } catch (walletError) {
                  console.error('Failed to credit wallet for Binary Bonus:', walletError);
                  // Update commission status back to Pending if wallet credit fails
                  await prisma.commission.update({
                    where: { id: commission.id },
                    data: { status: 'Pending' }
                  });
                }
              }
            }
          }

          // AUTO-CALCULATE G2 Binary Bonus for grandparent (sponsor with Manager+ rank) when G1 has downlines
          // This happens when a new member (G2) is added under G1
          // Instead of manually calculating, trigger commission recalculation which includes G2 bonus
          try {
            // Get the placement parent (G1) to find their parent (grandparent/sponsor)
            const g1Parent = await prisma.user.findUnique({
              where: { id: finalPlacementParentId },
              select: { 
                id: true,
                placementParentId: true,
                position: true,
                rank: true
              }
            });

            // Check if G1 has a placement parent (grandparent/sponsor)
            if (g1Parent?.placementParentId) {
              // Get grandparent (sponsor) to check if they're Manager+ rank
              const grandparent = await prisma.user.findUnique({
                where: { id: g1Parent.placementParentId },
                select: { 
                  id: true,
                  rank: true,
                  memberId: true,
                  active: true,
                  deleted: true
                }
              });

              // G2 rates for Manager+ ranks
              const g2Rates: Record<string, number> = {
                'Manager': 0.01,   // 1% G2
                'Director': 0.03,  // 3% G2
                'President': 0.03, // 3% G2
                'Double President': 0.03 // 3% G2
              };

              const sponsorG2Rate = grandparent?.rank ? (g2Rates[grandparent.rank] || 0) : 0;

              // Trigger G2 Binary Bonus auto-calculation if grandparent is Manager+
              // NOTE: We always trigger calculation regardless of new member's rank
              // The calculation service will find all eligible G2 downlines and calculate properly
              if (sponsorG2Rate > 0 && grandparent && grandparent.active && !grandparent.deleted) {
                console.log(`🔄 Auto-calculating G2 Binary Bonus for grandparent ${grandparent.memberId} (${grandparent.rank}):`, {
                  grandparentId: grandparent.id,
                  grandparentMemberId: grandparent.memberId,
                  grandparentRank: grandparent.rank,
                  g1Id: g1Parent.id,
                  g2Id: newUser.id,
                  g2MemberId: newUser.memberId,
                  newMemberRank: normalizedNewMemberRank || 'Member'
                });

                // Trigger G2 Binary Bonus auto-calculation service
                // Use setTimeout to ensure user data is fully committed to database
                try {
                  const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
                  
                  // Run immediately first
                  await autoCalculateG2BinaryBonus(g1Parent.id, newUser.id);
                  
                  // Also schedule a delayed check in case the first one runs before data is committed
                  setTimeout(async () => {
                    try {
                      console.log(`🔄 [G2 Delayed] Running delayed G2 calculation for grandparent ${grandparent.memberId}`);
                      await autoCalculateG2BinaryBonus(g1Parent.id, newUser.id);
                    } catch (delayedError) {
                      console.error('Delayed G2 calculation failed:', delayedError);
                    }
                  }, 2000); // 2 second delay
                } catch (calcError) {
                  console.error('Failed to auto-calculate G2 Binary Bonus for grandparent:', calcError);
                  // Don't fail registration if commission calculation fails
                }
              } else {
                if (!sponsorG2Rate || !grandparent) {
                  console.log(`⏭️ G2 Binary Bonus not available: Grandparent ${g1Parent.placementParentId} rank is not Manager+ (${grandparent?.rank || 'not found'})`);
                }
              }
            }
          } catch (g2Error) {
            // Don't fail registration if G2 commission calculation fails
            console.error('Failed to auto-calculate G2 Binary Bonus commission:', g2Error);
            logger.warn('Failed to auto-calculate G2 Binary Bonus commission for grandparent', {
              newMemberId: newUser.id,
              g1ParentId: finalPlacementParentId,
              error: g2Error instanceof Error ? g2Error.message : 'Unknown error'
            }, request);
          }
        } catch (commissionError) {
          // Don't fail registration if commission creation fails
          console.error('Failed to create Binary Bonus commission:', commissionError);
          logger.warn('Failed to create Binary Bonus commission for new member', {
            parentId: finalPlacementParentId,
            newMemberId: newUser.id,
            error: commissionError instanceof Error ? commissionError.message : 'Unknown error',
            stack: commissionError instanceof Error ? commissionError.stack : undefined
          }, request);
        }
      } else {
        console.warn('Parent not found for Binary Bonus commission:', finalPlacementParentId);
      }
    } else {
      console.warn('Cannot create Binary Bonus: missing placementParentId or position', {
        placementParentId: finalPlacementParentId,
        position: finalPosition
      });
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

    // Track referral conversion if this came from a referral link
    if (referralCode) {
      try {
        const { trackReferralConversion, getSponsorFromReferralCode } = await import('@/lib/referral-tracking');
        
        // Validate referral code is active before allowing registration
        const referralData = await getSponsorFromReferralCode(referralCode);
        if (!referralData) {
          logger.warn('Registration attempted with inactive/expired referral code', {
            userId: newUser.id,
            referralCode
          }, request);
          // Note: We don't fail registration, but we don't track the conversion either
          // The referral code validation should have happened on the frontend
        } else {
          // Only track conversion if referral code is valid and active
          const conversionResult = await trackReferralConversion(referralCode, newUser.id);
          if (conversionResult) {
            logger.info('Referral conversion tracked', {
              userId: newUser.id,
              referralCode
            }, request);
          } else {
            logger.warn('Failed to track referral conversion - link may be inactive', {
              userId: newUser.id,
              referralCode
            }, request);
          }
        }
      } catch (refError) {
        logger.warn('Failed to track referral conversion', {
          userId: newUser.id,
          referralCode,
          error: refError instanceof Error ? refError.message : 'Unknown error'
        }, request);
        // Don't fail registration if referral tracking fails
      }
    }

    // Trigger welcome notification
    try {
      await triggerWelcomeNotification(newUser.id, newUser.fullName);
    } catch (notifError) {
      logger.warn('Failed to send welcome notification', {
        userId: newUser.id,
        error: notifError instanceof Error ? notifError.message : 'Unknown error'
      }, request);
    }

    // Create automatic 31-day maintenance for new member
    try {
      const { createNewMemberMaintenance } = await import('@/lib/maintenance');
      await createNewMemberMaintenance(
        newUser.id,
        newUser.fullName,
        newUser.rank || 'Member',
        new Date() // Registration date
      );
      logger.info('Automatic 31-day maintenance created for new member', {
        userId: newUser.id,
        memberId: newUser.memberId
      }, request);
    } catch (maintenanceError) {
      logger.warn('Failed to create automatic maintenance for new member', {
        userId: newUser.id,
        error: maintenanceError instanceof Error ? maintenanceError.message : 'Unknown error'
      }, request);
      // Don't fail registration if maintenance creation fails
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