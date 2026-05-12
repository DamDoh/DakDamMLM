import { prisma } from '@/lib/database';

export interface ReferralLink {
  id: string;
  sponsorId: string;
  companyId: string;
  code: string;
  url: string;
  clicks: number;
  conversions: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Generate a unique referral code
 */
export function generateReferralCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a referral link for a sponsor
 */
export async function createReferralLink(
  sponsorId: string,
  companyId: string,
  options: {
    expiresIn?: number; // days
    metadata?: Record<string, unknown>;
  } = {}
): Promise<ReferralLink> {
  const code = generateReferralCode();
  const expiresAt = options.expiresIn
    ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
    : undefined;

  const referralLink = await prisma.referralLink.create({
    data: {
      sponsorId,
      companyId,
      code,
      clicks: 0,
      conversions: 0,
      isActive: true,
      expiresAt,
      metadata: options.metadata || {},
    }
  });

  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/register?ref=${code}`;

  return {
    ...referralLink,
    url,
    expiresAt: referralLink.expiresAt || undefined,
    metadata: (referralLink.metadata as Record<string, unknown>) || undefined,
  };
}

/**
 * Track a referral link click
 */
export async function trackReferralClick(referralCode: string, metadata?: Record<string, unknown>): Promise<ReferralLink | null> {
  try {
    const referralLink = await prisma.referralLink.findUnique({
      where: { code: referralCode }
    });

    if (!referralLink || !referralLink.isActive) {
      return null;
    }

    // Check if expired
    if (referralLink.expiresAt && referralLink.expiresAt < new Date()) {
      return null;
    }

    // Update click count
    const updatedLink = await prisma.referralLink.update({
      where: { id: referralLink.id },
      data: {
        clicks: { increment: 1 },
        metadata: {
          ...(referralLink.metadata as Record<string, unknown> || {}),
          lastClickAt: new Date().toISOString(),
          clickMetadata: metadata,
        }
      }
    });

    return {
      ...updatedLink,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/register?ref=${updatedLink.code}`,
      expiresAt: updatedLink.expiresAt || undefined,
      metadata: (updatedLink.metadata as Record<string, unknown>) || undefined,
    };
  } catch (error) {
    console.error('Error tracking referral click:', error);
    return null;
  }
}

/**
 * Track a referral conversion (successful registration)
 */
export async function trackReferralConversion(referralCode: string, newMemberId: string): Promise<boolean> {
  try {
    const referralLink = await prisma.referralLink.findUnique({
      where: { code: referralCode }
    });

    if (!referralLink) {
      return false;
    }

    // Update conversion count
    await prisma.referralLink.update({
      where: { id: referralLink.id },
      data: {
        conversions: { increment: 1 },
        metadata: {
          ...(referralLink.metadata as Record<string, unknown> || {}),
          lastConversionAt: new Date().toISOString(),
          convertedMemberId: newMemberId,
        }
      }
    });

    // Create referral relationship record
    await prisma.referralRelationship.create({
      data: {
        referralLinkId: referralLink.id,
        sponsorId: referralLink.sponsorId,
        memberId: newMemberId,
        companyId: referralLink.companyId,
        status: 'active',
      }
    });

    return true;
  } catch (error) {
    console.error('Error tracking referral conversion:', error);
    return false;
  }
}

/**
 * Get referral statistics for a sponsor
 */
export async function getReferralStats(sponsorId: string, companyId?: string) {
  const whereClause = companyId
    ? { sponsorId, companyId }
    : { sponsorId };

  const links = await prisma.referralLink.findMany({
    where: whereClause,
    include: {
      _count: {
        select: {
          relationships: true,
        }
      }
    }
  });

  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
  const totalConversions = links.reduce((sum, link) => sum + link.conversions, 0);
  const activeLinks = links.filter(link => link.isActive).length;

  return {
    totalLinks: links.length,
    activeLinks,
    totalClicks,
    totalConversions,
    conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    links: links.map(link => ({
      ...link,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/register?ref=${link.code}`,
      relationships: link._count.relationships,
    }))
  };
}

/**
 * Get sponsor information from referral code
 */
export async function getSponsorFromReferralCode(code: string) {
  const referralLink = await prisma.referralLink.findUnique({
    where: { code },
    include: {
      sponsor: {
        select: {
          id: true,
          firstName: true,
          surname: true,
          fullName: true,
          memberId: true,
          companyId: true,
        }
      },
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        }
      }
    }
  });

  if (!referralLink || !referralLink.isActive) {
    return null;
  }

  // Check if expired
  if (referralLink.expiresAt && referralLink.expiresAt < new Date()) {
    return null;
  }

  return {
    sponsor: referralLink.sponsor,
    company: referralLink.company,
    referralCode: code,
  };
}

/**
 * Deactivate a referral link
 */
export async function deactivateReferralLink(linkId: string, sponsorId: string): Promise<boolean> {
  try {
    await prisma.referralLink.updateMany({
      where: {
        id: linkId,
        sponsorId, // Ensure only the owner can deactivate
      },
      data: {
        isActive: false,
      }
    });
    return true;
  } catch (error) {
    console.error('Error deactivating referral link:', error);
    return false;
  }
}