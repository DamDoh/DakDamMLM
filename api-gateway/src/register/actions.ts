
'use server';

import { addMemberToDb, findFirstAvailablePosition } from '@/services/server-actions';
import type { AccountType, Member } from '@/lib/types';
import { initializeMemberOnboarding } from '@/services/server-actions';
import { getAllMembers } from '@/services/server-actions';
import { prisma } from '@/lib/database';


export async function createMemberDocument(data: {
  userId: string;
  firstName: string;
  surname: string;
  email: string | null;
  accountType: string;
  sponsorId: string | null;
  parentId: string | null;
  position: 'left' | 'right' | null;
  phoneNumber: string;
  idCardUrl: string | undefined;
  isAdmin?: boolean;
  referralCode?: string;
}) {
  try {

    // --- Server-side Phone Number Uniqueness Check ---
    // Using Prisma instead of Firebase
    const existingPhone = await prisma.user.findFirst({
      where: { phoneNumber: data.phoneNumber }
    });
    if (existingPhone) {
        throw new Error('Phone number is already in use.');
    }
    // --- End Check ---


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
            const placement = await findFirstAvailablePosition(placementRootId, allMembersMap);
            if (placement) {
                parentId = placement.parentId;
                position = placement.position;
            } else {
                 // Fallback: If no spot under sponsor, try sponsor's parent, and so on.
                 let currentUplineId = sponsorMember?.placementParentId;
                 while(currentUplineId) {
                    const uplinePlacement = await findFirstAvailablePosition(currentUplineId, allMembersMap);
                    if (uplinePlacement) {
                        parentId = uplinePlacement.parentId;
                        position = uplinePlacement.position;
                        break;
                    }
                    currentUplineId = allMembersMap.get(currentUplineId)?.placementParentId;
                 }

                 // Absolute fallback: place under the very first member of the tree
                 if (!parentId && allMembersList.length > 0) {
                    const absoluteRoot = allMembersList.find(m => !m.placementParentId) || allMembersList[0];
                    const ultimatePlacement = await findFirstAvailablePosition(absoluteRoot.id, allMembersMap);
                    if (ultimatePlacement) {
                        parentId = ultimatePlacement.parentId;
                        position = ultimatePlacement.position;
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
    if (referralCode && sponsorMemberForRecord) {
      const { trackReferralConversion } = await import('@/lib/referral-tracking');
      await trackReferralConversion(referralCode, data.userId);
    }

    const newMemberData: Omit<Member, 'teamSize' | 'children' | 'active' | 'memberId' | 'rank' | 'storeOwnerLevel' | 'pv' | 'avatarUrl' | 'fullName'> & { parentId?: string | null, position?: 'left' | 'right' | null } = {
        id: data.userId,
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
    };

    // Only add idCardUrl if it exists
    if (data.idCardUrl !== undefined) {
        newMemberData.idCardUrl = data.idCardUrl;
    }

    const memberId = await addMemberToDb(newMemberData);
    await initializeMemberOnboarding(data.userId);

    return { success: true, userId: data.userId, memberId };

  } catch (error: any) {
    console.error("Error in createMemberDocument:", error);
    return { success: false, error: error.message || 'A database error occurred during member creation.', errorCode: error.code };
  }
}
