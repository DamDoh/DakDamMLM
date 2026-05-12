import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/intelligence/risk-heatmap
 * Geographic/categorical risk visualization data
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const riskProfiles = await prisma.riskProfile.findMany({
        where: {
          entityType: 'company',
          riskScore: { gte: 50 }
        },
        take: 100
      });

      // Fetch company details for each risk profile
      const companyIds = riskProfiles.map(rp => rp.entityId).filter(Boolean);
      const companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true, country: true, city: true }
      });

      const companyMap = new Map(companies.map(c => [c.id, c]));

      const heatmapData = riskProfiles.map(profile => {
        const company = companyMap.get(profile.entityId);
        return {
          entityId: profile.entityId,
          entityName: company?.name || 'Unknown',
          country: company?.country || 'Unknown',
          city: company?.city,
          riskScore: profile.riskScore,
          riskLevel: profile.alertLevel,
          factors: profile.riskFactors
        };
      });

      return NextResponse.json({ heatmap: heatmapData });
    } catch (error) {
      console.error('Risk heatmap error:', error);
      return NextResponse.json(
        { error: 'Failed to generate risk heatmap' },
        { status: 500 }
      );
    }
  })(request);
}
