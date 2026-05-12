'use server';

import { addMemberToDb, findFirstAvailablePosition } from '@/services/server-actions';
import type { AccountType, Member, StockistLevel } from '@/lib/types';
import { initializeMemberOnboarding } from '@/services/server-actions';
import { getAllMembers } from '@/services/server-actions';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth-service';
import { generateUniqueMemberId } from '@/lib/member-id-generator';


export async function createMemberDocument(data: {
  userId?: string;
  firstName: string;
  surname: string;
  email: string | null;
  accountType: string;
  companyId?: string;
  sponsorId: string | null;
  parentId: string | null;
  position: 'left' | 'right' | null;
  phoneNumber: string;
  idCardUrl: string | undefined;
  idCardNumber?: string;
  password?: string;
  isAdmin?: boolean;
  referralCode?: string;
  storeOwnerLevel?: string | null;
  currentUserId?: string; // ID of the user making the request (for admin check)
}) {
  try {
    // Server-side check: Verify user can only add members to their own downline
    // Admins and AdminStock users (D, C, M, S levels) can add members to any user's downline
    if (data.currentUserId && data.parentId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: data.currentUserId },
        select: { id: true, isAdmin: true, storeOwnerLevel: true }
      });
      
      if (!currentUser) {
        throw new Error('User not found.');
      }
      
      // Check if user is AdminStock (has storeOwnerLevel D, C, M, or S)
      const isAdminStock = currentUser.storeOwnerLevel && 
                          ['D', 'C', 'M', 'S'].includes(currentUser.storeOwnerLevel);
      
      // Skip downline validation for admins and AdminStock users
      if (!currentUser.isAdmin && !isAdminStock) {
        // Check if parentId is in the current user's downline
        // Get all downline members recursively
        const getDownlineIds = async (userId: string): Promise<Set<string>> => {
          const downlineIds = new Set<string>();
          const queue = [userId];
          
          while (queue.length > 0) {
            const currentId = queue.shift()!;
            
            // Get direct children
            const children = await prisma.user.findMany({
              where: {
                placementParentId: currentId,
                deleted: false
              },
              select: { id: true }
            });
            
            for (const child of children) {
              if (!downlineIds.has(child.id)) {
                downlineIds.add(child.id);
                queue.push(child.id);
              }
            }
          }
          
          return downlineIds;
        };
        
        const downlineIds = await getDownlineIds(data.currentUserId);
        
        // Allow if parentId is the current user themselves (direct child) or in their downline
        if (data.parentId !== data.currentUserId && !downlineIds.has(data.parentId)) {
          throw new Error('You can only add members to your own downline.');
        }
      }
    }

    // --- Server-side Phone Number Uniqueness Check ---
    // Using Prisma instead of Firebase
    const existingPhone = await prisma.user.findFirst({
      where: { phoneNumber: data.phoneNumber }
    });
    if (existingPhone) {
        throw new Error('Phone number is already in use.');
    }
    // --- End Check ---

    // --- Generate member ID following sponsor's pattern ---
    // If sponsor is SK3480, new member gets SK3481, SK3482, etc.
    // Uses same logic as preview API to ensure consistency
    let memberId: string = '';
    let userId = data.userId;
    if (!userId) {
      // Pattern to match: prefix (letters) + number (digits)
      // Examples: SK3480, MEM001, AB1234
      const idPattern = /^([A-Z]+)(\d+)$/;
      let prefix = 'MEM';
      let nextNumber = 1;
      let numberLength = 3; // Default padding length
      let followSponsor = false;

      // Check if sponsor exists and extract their ID pattern
      if (data.sponsorId) {
        const sponsor = await prisma.user.findFirst({
          where: {
            OR: [
              { id: data.sponsorId },
              { memberId: data.sponsorId }
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

      // Extract last 4 digits from ID card number to use as password if provided
      let password: string;
      if (data.idCardNumber && data.idCardNumber.length >= 4) {
        password = data.idCardNumber.slice(-4);
      } else if (data.password) {
        password = data.password;
      } else {
        password = `temp${Math.random().toString(36).slice(-8)}`;
      }
      const hashedPassword = await hashPassword(password);

      // Normalize email and phone number for consistent storage
      // Generate email in format: +<phone_number>@dakdam.app if not provided
      const normalizedEmail = data.email 
        ? data.email.toLowerCase().trim() 
        : (() => {
            const phoneWithPlus = data.phoneNumber.trim().startsWith('+') 
              ? data.phoneNumber.trim() 
              : `+${data.phoneNumber.trim()}`;
            return `${phoneWithPlus}@dakdam.app`;
          })();
      const normalizedPhone = data.phoneNumber.replace(/[\s\-\(\)]/g, '').trim();

      // Create the user first
      const newUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          password: hashedPassword,
          firstName: data.firstName,
          surname: data.surname,
          fullName: `${data.firstName} ${data.surname}`,
          memberId,
          accountType: data.accountType || 'Distributor',
          companyId: data.companyId || null,
          idCardNumber: data.idCardNumber,
          active: true,
          teamSize: { left: 0, right: 0, total: 0 },
          children: { left: null, right: null },
          addresses: [],
        },
      });

      userId = newUser.id;
    }
    // --- End User Creation ---


    // --- Server-side Placement Logic ---
    let parentId: string | null = data.parentId;
    let position: 'left' | 'right' | null = data.position;

    const allMembersList = await getAllMembers();
    const allMembersMap = new Map(allMembersList.map(m => [m.id, m]));
    
    // If parent and position aren't directly provided (e.g., from admin placement)
    if (!parentId || !position) {
        const sponsorMember = data.sponsorId ? allMembersList.find(m => m.memberId === data.sponsorId || m.id === data.sponsorId) : null;
        
        let placementRootId: string | undefined;

        if (sponsorMember) {
            placementRootId = sponsorMember.id;
        } else {
            // Default to placing under the first member (root admin) if no sponsor
            const rootAdmin = allMembersList.find(m => !m.placementParentId);
            if (rootAdmin) {
                placementRootId = rootAdmin.id;
            }
        }

        if (placementRootId) {
            // CRITICAL: Check if placementRootId is superadmin - cannot place under superadmin
            const { isSuperAdmin } = await import('@/lib/superadmin-helper');
            const isSuperadminPlacement = await isSuperAdmin(placementRootId);
            
            if (isSuperadminPlacement) {
                console.warn(`⚠️ Cannot place member under superadmin ${placementRootId}. Finding alternative placement.`);
                // Skip superadmin and find alternative placement
                placementRootId = undefined;
        }

        if (placementRootId) {
            const placement = await findFirstAvailablePosition(placementRootId, allMembersMap);
            if (placement) {
                    // Double-check the placement parent is not superadmin
                    const isPlacementParentSuperadmin = await isSuperAdmin(placement.parentId);
                    if (!isPlacementParentSuperadmin) {
                parentId = placement.parentId;
                position = placement.position;
            } else {
                        placementRootId = undefined; // Try fallback
                    }
                }
            }
            
            if (!parentId) {
                 // Fallback: If no spot under sponsor, try sponsor's parent, and so on.
                 let currentUplineId = sponsorMember?.placementParentId;
                 while(currentUplineId) {
                    // Skip superadmin in fallback chain
                    const isUplineSuperadmin = await isSuperAdmin(currentUplineId);
                    if (isUplineSuperadmin) {
                        currentUplineId = allMembersMap.get(currentUplineId)?.placementParentId || null;
                        continue;
                    }
                    
                    const uplinePlacement = await findFirstAvailablePosition(currentUplineId, allMembersMap);
                    if (uplinePlacement) {
                        const isPlacementParentSuperadmin = await isSuperAdmin(uplinePlacement.parentId);
                        if (!isPlacementParentSuperadmin) {
                        parentId = uplinePlacement.parentId;
                        position = uplinePlacement.position;
                        break;
                        }
                    }
                    currentUplineId = allMembersMap.get(currentUplineId)?.placementParentId || null;
                 }

                 // Absolute fallback: place under the very first NON-SUPERADMIN member of the tree
                 if (!parentId && allMembersList.length > 0) {
                    // Find first non-superadmin member
                    let absoluteRoot = allMembersList.find(m => !m.placementParentId);
                    if (absoluteRoot) {
                        const isRootSuperadmin = await isSuperAdmin(absoluteRoot.id);
                        if (isRootSuperadmin) {
                            absoluteRoot = allMembersList.find(m => m.id !== absoluteRoot!.id && !m.placementParentId) || allMembersList[0];
                        }
                    } else {
                        absoluteRoot = allMembersList[0];
                    }
                    
                    // Make sure absolute root is not superadmin
                    if (absoluteRoot) {
                        const isRootSuperadmin = await isSuperAdmin(absoluteRoot.id);
                        if (!isRootSuperadmin) {
                    const ultimatePlacement = await findFirstAvailablePosition(absoluteRoot.id, allMembersMap);
                    if (ultimatePlacement) {
                                const isPlacementParentSuperadmin = await isSuperAdmin(ultimatePlacement.parentId);
                                if (!isPlacementParentSuperadmin) {
                        parentId = ultimatePlacement.parentId;
                        position = ultimatePlacement.position;
                                }
                            }
                        }
                    }
                 }
            }
        }
    }
    // If no members exist at all, parentId and position will remain null, creating the root user.
    // --- End Placement Logic ---

    const sponsorMemberForRecord = data.sponsorId ? allMembersList.find(m => m.memberId === data.sponsorId || m.id === data.sponsorId) : null;

    // Check if any admins exist; if not, make this user an admin
    const existingAdmin = await prisma.user.findFirst({
      where: { isAdmin: true }
    });
    const hasAdmins = !!existingAdmin;
    const isAdmin = data.isAdmin || (!hasAdmins && data.accountType === 'Distributor'); // Make first distributor admin

    // Track referral conversion if this came from a referral link
    const referralCode = data.referralCode;
    if (referralCode && sponsorMemberForRecord && userId) {
      const { trackReferralConversion } = await import('@/lib/referral-tracking');
      await trackReferralConversion(referralCode, userId);
    }

    if (!userId) {
      throw new Error('User ID is required but was not generated');
    }

    const newMemberData: Omit<Member, 'teamSize' | 'children' | 'active' | 'memberId' | 'rank' | 'pv' | 'avatarUrl' | 'fullName'> & { parentId?: string | null, position?: 'left' | 'right' | null } = {
        id: userId,
        firstName: data.firstName,
        surname: data.surname,
        accountType: data.accountType as AccountType,
        joinDate: new Date().toISOString().split('T')[0],
        sponsorId: sponsorMemberForRecord ? sponsorMemberForRecord.id : null,
        placementParentId: parentId,
        position: position,
        phoneNumber: data.phoneNumber,
        email: data.email,
        isAdmin: isAdmin,
        addresses: [],
        storeOwnerLevel: (data.storeOwnerLevel as StockistLevel | null) || null,
    };

    // Only add idCardUrl if it exists
    if (data.idCardUrl !== undefined) {
        newMemberData.idCardUrl = data.idCardUrl;
    }

    await addMemberToDb(newMemberData);
    await initializeMemberOnboarding(userId);

    // Create automatic 31-day maintenance for new member
    try {
      const { createNewMemberMaintenance } = await import('@/lib/maintenance');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, rank: true }
      });
      if (user) {
        await createNewMemberMaintenance(
          userId,
          user.fullName,
          user.rank || 'Member',
          new Date()
        );
      }
    } catch (maintenanceError) {
      console.error('Failed to create automatic maintenance for new member:', maintenanceError);
      // Don't fail registration if maintenance creation fails
    }

    // Get the memberId that was set when creating the user
    const finalMemberId = userId ? (await prisma.user.findUnique({
      where: { id: userId },
      select: { memberId: true }
    }))?.memberId || '' : '';

    return { success: true, userId, memberId: finalMemberId };

  } catch (error: any) {
    console.error("Error in createMemberDocument:", error);
    return { success: false, error: error.message || 'A database error occurred during member creation.', errorCode: error.code };
  }
}
