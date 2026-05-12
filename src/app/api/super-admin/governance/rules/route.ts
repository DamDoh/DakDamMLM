import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

/**
 * GET /api/super-admin/governance/rules
 * List all governance rules
 */
export async function GET(request: NextRequest) {
  return requireSuperAdmin(async () => {
    try {
      const rules = await prisma.governanceRule.findMany({
        orderBy: { severity: 'desc', name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          ruleType: true,
          severity: true,
          isActive: true,
          lastTriggeredAt: true,
          lastExecutedAt: true,
          executionCount: true,
          successRate: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return NextResponse.json({ rules });
    } catch (error) {
      console.error('Get governance rules error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve governance rules' },
        { status: 500 }
      );
    }
  })(request);
}

/**
 * POST /api/super-admin/governance/rules
 * Create new governance rule
 */
export async function POST(request: NextRequest) {
  return requireSuperAdmin(async (req) => {
    try {
      const body = await request.json();
      const { name, description, ruleType, condition, action, severity } = body;

      if (!name || !ruleType || !condition || !action) {
        return NextResponse.json(
          { error: 'Missing required fields: name, ruleType, condition, action' },
          { status: 400 }
        );
      }

      const rule = await prisma.governanceRule.create({
        data: {
          name,
          description,
          ruleType,
          condition,
          action,
          severity: severity || 'medium',
          isActive: true,
          lastTriggeredAt: null,
          lastExecutedAt: null,
          executionCount: 0,
          successRate: null
        }
      });

      return NextResponse.json({
        success: true,
        rule
      });
    } catch (error) {
      console.error('Create governance rule error:', error);
      return NextResponse.json(
        { error: 'Failed to create governance rule' },
        { status: 500 }
      );
    }
  })(request);
}
