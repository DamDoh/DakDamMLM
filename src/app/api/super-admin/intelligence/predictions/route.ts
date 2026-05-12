import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/intelligence/predictions
 * AI-driven forecasts and insights
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const insights = await prisma.aIInsight.findMany({
        where: {
          isResolved: false,
          expiresAt: { gte: new Date() }
        },
        orderBy: { confidence: 'desc' },
        take: 100
      });

      const predictions = insights.map(insight => ({
        id: insight.id,
        type: insight.insightType,
        entityType: insight.entityType,
        entityId: insight.entityId,
        confidence: insight.confidence,
        description: insight.description,
        prediction: insight.prediction,
        recommendedActions: insight.recommendedActions,
        createdAt: insight.createdAt
      }));

      return NextResponse.json({ predictions });
    } catch (error) {
      console.error('Predictions error:', error);
      return NextResponse.json(
        { error: 'Failed to load predictions' },
        { status: 500 }
      );
    }
  })(request);
}
