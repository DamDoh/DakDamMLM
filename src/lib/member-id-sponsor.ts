/**
 * Sponsor-based Member ID generation.
 * Used by /api/member-id/preview and /api/register/admin so preview and created ID always match.
 */

import { prisma } from '@/lib/database';

const ID_PATTERN = /^([A-Z]+)(\d+)$/;
const MEM_PATTERN = /^MEM(\d+)$/;

export async function getNextMemberIdForSponsor(
  sponsorId: string | null
): Promise<{ nextMemberId: string; prefix: string; nextNumber: number }> {
  let prefix = 'MEM';
  let nextNumber = 1;
  let numberLength = 3;
  let followSponsor = false;

  if (sponsorId) {
    const sponsor = await prisma.user.findFirst({
      where: {
        OR: [{ id: sponsorId }, { memberId: sponsorId }],
      },
      select: { memberId: true },
    });

    if (sponsor?.memberId) {
      const m = sponsor.memberId.match(ID_PATTERN);
      if (m) {
        prefix = m[1]!;
        const sponsorNum = parseInt(m[2]!, 10);
        numberLength = m[2]!.length;
        nextNumber = sponsorNum + 1;
        followSponsor = true;
      }
    }
  }

  if (!followSponsor) {
    const existing = await prisma.user.findMany({
      where: { memberId: { startsWith: 'MEM' }, deleted: false },
      select: { memberId: true },
    });
    const nums = existing
      .map((x) => {
        const m = x.memberId.match(MEM_PATTERN);
        return m ? parseInt(m[1]!, 10) : 0;
      })
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    if (nums.length > 0) {
      for (let i = 0; i < nums.length; i++) {
        if (nums[i] !== i + 1) {
          nextNumber = i + 1;
          break;
        }
      }
      if (nextNumber === 1) nextNumber = Math.max(...nums) + 1;
    }
  } else {
    const existing = await prisma.user.findMany({
      where: { memberId: { startsWith: prefix }, deleted: false },
      select: { memberId: true },
    });
    const prefixRe = new RegExp(`^${prefix}(\\d+)$`);
    const nums = existing
      .map((x) => {
        const m = x.memberId.match(prefixRe);
        return m ? parseInt(m[1]!, 10) : 0;
      })
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    for (const num of nums) {
      if (num >= nextNumber) {
        if (num === nextNumber) nextNumber = num + 1;
        else break;
      }
    }
  }

  let candidateId = `${prefix}${nextNumber.toString().padStart(numberLength, '0')}`;
  let n = 0;
  while (n < 999) {
    const exists = await prisma.user.findUnique({
      where: { memberId: candidateId },
      select: { id: true },
    });
    if (!exists) break;
    nextNumber++;
    candidateId = `${prefix}${nextNumber.toString().padStart(numberLength, '0')}`;
    n++;
  }

  if (n >= 999) {
    candidateId = `${prefix}${Date.now().toString().slice(-6)}`;
  }

  return { nextMemberId: candidateId, prefix, nextNumber };
}
