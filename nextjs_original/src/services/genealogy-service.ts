import type { Member, Rank } from '@/lib/types';
import { prisma } from '@/lib/database';
import { businessRules } from '@/lib/business-rules';
import { ranks } from '@/lib/types';
import { triggerRankAdvancementNotification } from './notification-service';
import { transformUserToMember } from '@/lib/shared-utils';
import { logger } from '@/lib/logger';

// In-memory cache for volume calculations within a single run
const volumeCache = new Map<string, number>();

export async function getGroupPV(memberId: string): Promise<number> {
    const allMembersData = await prisma.user.findMany({
      select: {
        id: true,
        active: true,
        children: true,
        pv: true,
      }
    });
    const allMembers = new Map(allMembersData.map(member => [member.id, transformUserToMember(member)]));
    return await calculateGroupPV(memberId, allMembers);
}

export async function calculateGroupPV(memberId: string | null, allMembers: Map<string, Member>): Promise<number> {
    if (!memberId) return 0;
    const member = allMembers.get(memberId);
    if (!member) return 0;

    // Check cache first
    if (volumeCache.has(memberId)) {
        return volumeCache.get(memberId)!;
    }

    let groupPV = 0;
    const queue: string[] = [];
    const visited = new Set<string>();

    if (member.children.left) {
      queue.push(member.children.left);
      visited.add(member.children.left);
    }
    if (member.children.right) {
      queue.push(member.children.right);
      visited.add(member.children.right);
    }

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentMember = allMembers.get(currentId);
        if (currentMember) {
            groupPV += currentMember.pv;
            if (currentMember.children.left && !visited.has(currentMember.children.left)) {
                queue.push(currentMember.children.left);
                visited.add(currentMember.children.left);
            }
            if (currentMember.children.right && !visited.has(currentMember.children.right)) {
                queue.push(currentMember.children.right);
                visited.add(currentMember.children.right);
            }
        }
    }

    // Cache the result
    volumeCache.set(memberId, groupPV);
    return groupPV;
};

export async function updateRank(
    member: Member,
    directRecruits: number,
    allMembers: Map<string, Member>
  ): Promise<any | null> {
  const currentRankIndex = ranks.indexOf(member.rank);

  for (let i = businessRules.rankRequirements.length - 1; i >= 0; i--) {
    const requirement = businessRules.rankRequirements[i];
    const requirementRankIndex = ranks.indexOf(requirement.rank as Rank);

    if (requirementRankIndex > currentRankIndex) {
      const groupPV = await calculateGroupPV(member.id, allMembers);

      if (
        member.pv >= requirement.personalPV &&
        groupPV >= requirement.groupPV &&
        directRecruits >= requirement.directRecruits
      ) {
        // Update member rank in database
        await prisma.user.update({
          where: { id: member.id },
          data: { rank: requirement.rank }
        });

        const bonusCommission: any = {
          id: `RANK-${member.id}-${requirement.rank}`,
          userId: member.id,
          date: new Date().toISOString(),
          type: `Rank Achievement: ${requirement.rank}`,
          status: 'Paid',
          amount: requirement.bonus,
        };

        await triggerRankAdvancementNotification(member.id, member.fullName, requirement.rank);

        return bonusCommission;
      }
    }
  }
  return null;
};

export async function getLegVolume(memberId: string | null, allMembers: Map<string, Member>): Promise<number> {
    if (!memberId) return 0;

    // Check cache first
    if (volumeCache.has(memberId)) {
        return volumeCache.get(memberId)!;
    }

    let totalVolume = 0;
    const queue = [memberId];
    const visited = new Set<string>();
    visited.add(memberId);

    while(queue.length > 0) {
        const currentId = queue.shift()!;
        const member = allMembers.get(currentId);

        if (member) {
            totalVolume += member.pv;

            if (member.children.left && !visited.has(member.children.left)) {
                queue.push(member.children.left);
                visited.add(member.children.left);
            }
            if (member.children.right && !visited.has(member.children.right)) {
                queue.push(member.children.right);
                visited.add(member.children.right);
            }
          }
       }

    // Cache the result
    volumeCache.set(memberId, totalVolume);
    return totalVolume;
};

export async function compressTree(): Promise<{
    compressedCount: number;
    errors: number;
    details: Array<{ memberId: string; status: 'success' | 'error'; reason?: string }>;
}> {
    let compressedCount = 0;
    let errorCount = 0;
    const compressionDetails: Array<{ memberId: string; status: 'success' | 'error'; reason?: string }> = [];

    try {
        const inactiveThreshold = new Date();
        inactiveThreshold.setDate(inactiveThreshold.getDate() - businessRules.inactivityPeriodForCompression);

        // OPTIMIZED: Single query to get all needed data
        const allMembersData = await prisma.user.findMany({
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

        // Separate inactive members from result set
        const inactiveMembers = allMembersData.filter(m =>
            m.active &&
            m.pv === 0 &&
            m.lastActivityDate &&
            new Date(m.lastActivityDate) <= inactiveThreshold
        );

        if (inactiveMembers.length === 0) {
            return { compressedCount: 0, errors: 0, details: [] };
        }
        const allMembers = new Map(allMembersData.map(member => [member.id, {
          id: member.id,
          memberId: member.memberId || '',
          firstName: member.firstName,
          surname: member.surname,
          fullName: member.fullName,
          email: member.email,
          avatarUrl: member.avatarUrl || '/images/default-avatar.png',
          rank: member.rank as any,
          storeOwnerLevel: member.storeOwnerLevel as any,
          accountType: 'Distributor', // Default value since not in Prisma schema
          pv: member.pv,
          pvDate: member.pvDate?.toString() || undefined,
          teamSize: (member.teamSize as any) || { left: 0, right: 0, total: 0 },
          joinDate: member.createdAt.toISOString(),
          sponsorId: member.sponsorId,
          placementParentId: member.placementParentId,
          position: member.position as any,
          children: (member.children as any) || { left: null, right: null },
          active: member.active,
          phoneNumber: member.phoneNumber,
          lastActivityDate: member.lastActivityDate?.toString() || undefined,
          isAdmin: member.isAdmin,
          addresses: (member.addresses as any) || [],
        } as Member]));

        // Process each inactive member with detailed tracking
        for (const member of inactiveMembers) {
            try {
                const memberData = allMembers.get(member.id);
                if (!memberData) {
                    compressionDetails.push({
                        memberId: member.memberId,
                        status: 'error',
                        reason: 'Member data not found in cache'
                    });
                    errorCount++;
                    continue;
                }

                const hasActiveDownline = memberData.teamSize.total > 0;

                if (hasActiveDownline) {
                    let upline = memberData.placementParentId ? allMembers.get(memberData.placementParentId) : null;
                    while(upline && !upline.active) {
                        upline = upline.placementParentId ? allMembers.get(upline.placementParentId) : null;
                    }

                    if (upline) {
                        // Move children to upline
                        const updates = [];

                        ['left', 'right'].forEach(pos => {
                            const childId = memberData.children[pos as 'left' | 'right'];
                            if (childId) {
                                updates.push(
                                    prisma.user.update({
                                        where: { id: childId },
                                        data: { placementParentId: upline!.id }
                                    })
                                );
                            }
                        });

                        // Remove member from original parent's children
                        if (memberData.placementParentId) {
                            const parent = allMembers.get(memberData.placementParentId);
                            if (parent && memberData.position) {
                                const updatedChildren = { ...(parent.children as any) };
                                updatedChildren[memberData.position] = null;
                                
                                updates.push(
                                    prisma.user.update({
                                        where: { id: memberData.placementParentId },
                                        data: { children: updatedChildren }
                                    })
                                );
                            }
                        }

                        // Mark member as compressed
                        updates.push(
                            prisma.user.update({
                                where: { id: member.id },
                                data: {
                                    active: false,
                                    deleted: true,
                                    deletedDate: new Date(),
                                    teamSize: { left: 0, right: 0, total: 0 }
                                }
                            })
                        );

                        await Promise.all(updates);
                        compressedCount++;
                        compressionDetails.push({
                            memberId: member.memberId,
                            status: 'success',
                            reason: `Compressed with downline - moved to ${upline.memberId}`
                        });
                    } else {
                        errorCount++;
                        compressionDetails.push({
                            memberId: member.memberId,
                            status: 'error',
                            reason: 'No active upline found to place downline'
                        });
                    }
                } else {
                    await prisma.user.update({
                        where: { id: member.id },
                        data: {
                            active: false,
                            deleted: true,
                            deletedDate: new Date()
                        }
                    });
                    compressedCount++;
                    compressionDetails.push({
                        memberId: member.memberId,
                        status: 'success',
                        reason: 'Compressed without downline'
                    });
                }
            } catch (memberError) {
                errorCount++;
                compressionDetails.push({
                    memberId: member.memberId,
                    status: 'error',
                    reason: memberError instanceof Error ? memberError.message : 'Unknown error during compression'
                });
                logger.error('Tree compression error for member', {
                    memberId: member.memberId,
                    error: memberError instanceof Error ? memberError.message : 'Unknown error'
                });
            }
        }

        logger.info('Tree compression completed', {
            total: inactiveMembers.length,
            compressed: compressedCount,
            errors: errorCount
        });

        return { compressedCount, errors: errorCount, details: compressionDetails };

    } catch (error) {
        console.error("Error during tree compression:", error);
        return { compressedCount: 0, errors: 1, details: [] };
    }
}