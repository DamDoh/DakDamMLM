import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { ApiResponseUtil } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      firstName,
      surname,
      phoneNumber,
      email,
      password,
      sponsorId,
      parentId,
      position,
      accountType,
      idCardUrl,
      idCardNumber,
      rank,
      pv,
    } = body || {};

    // Validate required fields
    const missingFields: string[] = [];
    if (!firstName) missingFields.push('firstName');
    if (!surname) missingFields.push('surname');
    if (!phoneNumber) missingFields.push('phoneNumber');
    if (!password) missingFields.push('password');
    if (!sponsorId) missingFields.push('sponsorId');
    if (!parentId) missingFields.push('parentId');
    if (!position) missingFields.push('position');
    if (!accountType) missingFields.push('accountType');
    if (!idCardNumber) missingFields.push('idCardNumber');

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Normalize email and phone number for consistent storage
    // Generate a unique email if not provided (required by schema)
    let normalizedEmail: string;
    if (email && email.trim()) {
      normalizedEmail = email.toLowerCase().trim();
    } else {
      // Generate email in format: +<phone_number>@dakdam.app
      const phoneWithPlus = phoneNumber.trim().startsWith('+') 
        ? phoneNumber.trim() 
        : `+${phoneNumber.trim()}`;
      normalizedEmail = `${phoneWithPlus}@dakdam.app`;
    }
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').trim();

    // Check for duplicate email (if provided)
    if (email && email.trim()) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, memberId: true, fullName: true },
      });

      if (existingEmail) {
        return NextResponse.json(
          {
            success: false,
            error: `Email "${email}" is already registered. Member ID: ${existingEmail.memberId}`,
          },
          { status: 400 }
        );
      }
    }

    // Check for duplicate phone number
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      select: { id: true, memberId: true, fullName: true },
    });

    if (existingPhone) {
      return NextResponse.json(
        {
          success: false,
          error: `Phone number "${phoneNumber}" is already registered. Member ID: ${existingPhone.memberId}`,
        },
        { status: 400 }
      );
    }

    // Check for duplicate ID card number
    if (idCardNumber) {
      const existingIdCard = await prisma.user.findUnique({
        where: { idCardNumber: idCardNumber },
        select: { id: true, memberId: true, fullName: true },
      });

      if (existingIdCard) {
        return NextResponse.json(
          {
            success: false,
            error: `ID card number "${idCardNumber}" is already registered. Member ID: ${existingIdCard.memberId}`,
          },
          { status: 400 }
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Verify sponsor and parent exist first (required for sponsor-based member ID)
    const sponsor = await prisma.user.findUnique({
      where: { id: sponsorId },
      select: { id: true, memberId: true },
    });

    if (!sponsor) {
      return NextResponse.json(
        {
          success: false,
          error: `Sponsor with ID ${sponsorId} not found`,
        },
        { status: 400 }
      );
    }

    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: { id: true, memberId: true },
    });

    if (!parent) {
      return NextResponse.json(
        {
          success: false,
          error: `Placement parent with ID ${parentId} not found`,
        },
        { status: 400 }
      );
    }

    // Generate Member ID from sponsor (same logic as /api/member-id/preview)
    const { getNextMemberIdForSponsor } = await import('@/lib/member-id-sponsor');
    const { nextMemberId: memberId } = await getNextMemberIdForSponsor(sponsorId);

    // Check if the position slot is already taken
    const existingChild = await prisma.user.findFirst({
      where: {
        placementParentId: parentId,
        position: position,
      },
    });

    if (existingChild) {
      // Check which position is available
      const leftChild = await prisma.user.findFirst({
        where: {
          placementParentId: parentId,
          position: 'left',
        },
      });
      
      const rightChild = await prisma.user.findFirst({
        where: {
          placementParentId: parentId,
          position: 'right',
        },
      });

      let availablePosition = '';
      if (!leftChild) availablePosition = 'left';
      if (!rightChild) availablePosition = availablePosition ? 'both' : 'right';
      if (!availablePosition) availablePosition = 'none';

      let errorMessage = `The ${position} position under this placement parent is already taken.`;
      if (availablePosition === 'left') {
        errorMessage += ' The left position is available.';
      } else if (availablePosition === 'right') {
        errorMessage += ' The right position is available.';
      } else if (availablePosition === 'both') {
        errorMessage += ' Both positions are available.';
      } else {
        errorMessage += ' No positions are available under this parent. Please select a different placement parent.';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          availablePosition: availablePosition === 'left' ? 'left' : availablePosition === 'right' ? 'right' : null,
        },
        { status: 400 }
      );
    }

    // Determine rank based on PV if provided, otherwise use provided rank or default to "Member"
    let finalRank = rank || 'Member';
    const finalPV = pv ? Number(pv) : 0;
    
    // Auto-determine rank based on PV if rank not explicitly provided
    if (!rank && finalPV > 0) {
      if (finalPV >= 5000) finalRank = 'Double President';
      else if (finalPV >= 4000) finalRank = 'President';
      else if (finalPV >= 3000) finalRank = 'Director';
      else if (finalPV >= 2000) finalRank = 'Manager';
      else if (finalPV >= 1000) finalRank = 'Diamond';
      else if (finalPV >= 500) finalRank = 'Gold';
      else if (finalPV >= 300) finalRank = 'Silver';
      else if (finalPV >= 100) finalRank = 'Bronze';
      else finalRank = 'Member';
    }

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail, // Always required, generated if not provided
        phoneNumber: normalizedPhone,
        password: hashedPassword,
        firstName,
        surname,
        fullName: `${firstName} ${surname}`,
        memberId,
        accountType,
        companyId: companyId || null,
        sponsorId,
        placementParentId: parentId,
        position,
        idCardUrl: idCardUrl || null,
        idCardNumber: idCardNumber || null,
        rank: finalRank,
        pv: finalPV,
        active: true,
        isAdmin: false,
        teamSize: { left: 0, right: 0, total: 0 },
        children: { left: null, right: null },
        addresses: [],
      },
    });

    // Update parent's children map so genealogy tree shows the new member
    if (parentId && position) {
      const parent = await prisma.user.findUnique({
        where: { id: parentId },
        select: { children: true },
      });

      if (parent) {
        const currentChildren = (parent.children as any) || { left: null, right: null };
        const updatedChildren = {
          left: currentChildren.left || null,
          right: currentChildren.right || null,
          [position]: newUser.id,
        };

        await prisma.user.update({
          where: { id: parentId },
          data: { children: updatedChildren },
        });

        // Update teamSize for parent and all upline sponsors
        try {
          const { PVMatchingService } = await import('@/services/pv-matching-service');
          
          // Update direct parent's teamSize
          await PVMatchingService.updateTeamSize(parentId);
          
          // Update all upline sponsors' teamSize (cascade)
          await PVMatchingService.updateUplineTeamSizes(newUser.id);
        } catch (error) {
          console.error('Error updating team sizes:', error);
          // Continue - don't block member creation
        }

        // Auto-trigger Daily Match if parent now has both left and right downlines
        try {
          const { checkAndTriggerDailyMatch, triggerUplineCascade } = await import('@/services/daily-match-trigger');
          
          // 1. Check and trigger Daily Match for direct parent
          await checkAndTriggerDailyMatch(parentId);
          
          // 2. UPLINE CASCADE: Trigger recalculation for ALL upline sponsors
          await triggerUplineCascade(newUser.id);
        } catch (error) {
          console.error('Error auto-triggering Daily Match / Upline Cascade:', error);
          // Continue - don't block member creation
        }

        // Create and pay Binary Bonus commission for the parent when new member is added
        // Commission is calculated based on:
        // - PV Points: Based on new member's rank
        // - Commission Rate: Based on placement parent's (sponsor's) rank
        // Same logic as Add Member dialog - only pay if both are Bronze+ rank
        try {
          // Import commission calculation functions
          const { getPVPointsByRank, getCommissionRateByRank } = await import('@/lib/referral-tracking');
          
          // Get placement parent's rank (sponsor)
          const placementParent = await prisma.user.findUnique({
            where: { id: parentId },
            select: { rank: true, companyId: true }
          });
          
          const sponsorRank = placementParent?.rank || null;
          
          // Get new member's rank
          const newMember = await prisma.user.findUnique({
            where: { id: newUser.id },
            select: { rank: true, companyId: true, fullName: true }
          });
          
          const newMemberRank = newMember?.rank || 'Member';
          
          // Normalize ranks
          const normalizedSponsorRank = sponsorRank ? sponsorRank.trim() : null;
          const normalizedNewMemberRank = newMemberRank ? newMemberRank.trim() : null;
          
          // Valid ranks that have PV points (Bronze and above)
          const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
          
          // Check if new member is Member rank - if so, no commission
          const isNewMemberMember = !normalizedNewMemberRank || 
                                    normalizedNewMemberRank === '' || 
                                    normalizedNewMemberRank.toLowerCase() === 'member' ||
                                    !validRanks.includes(normalizedNewMemberRank);
          
          // Check if sponsor has valid rank
          const isSponsorMember = !normalizedSponsorRank || 
                                  normalizedSponsorRank === '' || 
                                  normalizedSponsorRank.toLowerCase() === 'member';
          const isSponsorValidRank = normalizedSponsorRank && validRanks.includes(normalizedSponsorRank);
          
          // Skip commission if new member is Member rank
          if (isNewMemberMember) {
            console.log(`[Binary Bonus] Skipping - New member rank is Member or invalid: "${newMemberRank}"`);
          } else if (isSponsorMember || !isSponsorValidRank) {
            // Skip if sponsor is Member or invalid rank
            console.log(`[Binary Bonus] Skipping - Sponsor rank is Member or invalid: "${sponsorRank}"`);
          } else {
            // Calculate commission: PV Points (from new member's rank) × Commission Rate (from sponsor's rank)
            const pvPoints = getPVPointsByRank(normalizedNewMemberRank);
            const commissionRate = getCommissionRateByRank(normalizedSponsorRank);
            
            // Final safety check
            if (pvPoints <= 0 || commissionRate <= 0) {
              console.log(`[Binary Bonus] Skipping - Invalid values: PV=${pvPoints}, Rate=${commissionRate}`);
            } else {
              const commissionAmount = Math.round(pvPoints * commissionRate * 100) / 100;
              
              console.log(`[Binary Bonus] Calculation: ${pvPoints} PV (${normalizedNewMemberRank}) × ${(commissionRate * 100).toFixed(1)}% (${normalizedSponsorRank}) = ${commissionAmount}`);
              
              // Check if commission already exists for this new member to prevent duplicates
              const existingCommission = await prisma.commission.findFirst({
                where: {
                  userId: parentId,
                  type: 'Binary Bonus',
                  date: {
                    gte: new Date(Date.now() - 60000) // Last 60 seconds
                  }
                }
              });

              if (existingCommission) {
                console.log('Binary Bonus already exists for recent member addition, skipping duplicate');
              } else {
                console.log('Creating and paying Binary Bonus commission for admin registration:', {
                  parentId,
                  newMemberId: newUser.id,
                  position,
                  newMemberRank: normalizedNewMemberRank,
                  sponsorRank: normalizedSponsorRank,
                  pvPoints,
                  commissionRate,
                  commissionAmount,
                  companyId: newMember?.companyId || placementParent?.companyId
                });
                
                const commission = await prisma.commission.create({
                  data: {
                    userId: parentId,
                    amount: commissionAmount,
                    type: 'Binary Bonus',
                    status: 'Pending',
                    companyId: newMember?.companyId || placementParent?.companyId || undefined,
                    date: new Date(),
                    description: `Binary Bonus: New member ${newMember?.fullName || newUser.fullName} (${normalizedNewMemberRank}, ${pvPoints} PV) added to ${position} leg - ${pvPoints} PV × ${(commissionRate * 100).toFixed(1)}%`
                  }
                });

                // Credit the wallet immediately
                try {
                  const { WalletService } = await import('@/services/wallet-service');
                  await WalletService.creditWallet(
                    parentId,
                    commissionAmount,
                    `Binary Bonus: New member ${newMember?.fullName || newUser.fullName} (${normalizedNewMemberRank}, ${pvPoints} PV) added to ${position} leg - ${pvPoints} PV × ${(commissionRate * 100).toFixed(1)}%`,
                    commission.id,
                    'commission'
                  );
                  
                  // Mark commission as paid
                  await prisma.commission.update({
                    where: { id: commission.id },
                    data: { status: 'Paid' }
                  });
                  
                  console.log('Binary Bonus commission paid and wallet credited:', commission.id);
                } catch (walletError) {
                  console.error('Failed to credit wallet for Binary Bonus:', walletError);
                  // Commission remains as Pending if wallet credit fails
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
              where: { id: parentId },
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
                  newMemberRank: newUser.rank || 'Member'
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
          }
        } catch (commissionError) {
          // Don't fail registration if commission creation fails
          console.error('Failed to create Binary Bonus commission:', commissionError);
        }
      }
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
      console.log('✅ Automatic 31-day maintenance created for new member (admin)', {
        userId: newUser.id,
        memberId: newUser.memberId
      });
    } catch (maintenanceError) {
      console.warn('⚠️ Failed to create automatic maintenance for new member (admin)', {
        userId: newUser.id,
        error: maintenanceError instanceof Error ? maintenanceError.message : 'Unknown error'
      });
      // Don't fail registration if maintenance creation fails
    }

    return ApiResponseUtil.success(newUser, 'Member created successfully');
  } catch (error: any) {
    console.error('Admin register API error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create member';
    
    if (error.code === 'P2002') {
      // Prisma unique constraint violation
      const target = error.meta?.target || [];
      if (target.includes('email')) {
        errorMessage = 'Email already exists';
      } else if (target.includes('phoneNumber')) {
        errorMessage = 'Phone number already exists';
      } else if (target.includes('memberId')) {
        errorMessage = 'Member ID already exists';
      } else if (target.includes('idCardNumber')) {
        errorMessage = 'ID card number already exists';
      } else {
        errorMessage = `Duplicate entry: ${target.join(', ')}`;
      }
    } else if (error.code === 'P2003') {
      // Prisma foreign key constraint violation
      errorMessage = 'Invalid sponsor or placement parent ID';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}


