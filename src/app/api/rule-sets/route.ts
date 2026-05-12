import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/rule-sets
 * Get all rule sets
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const companyId = searchParams.get('companyId');

    const where: any = {};
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }
    if (companyId) {
      where.companyId = companyId;
    }

    const ruleSets = await prisma.ruleSet.findMany({
      where,
      include: {
        rules: {
          include: {
            rule: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the RuleSet interface
    const transformedRuleSets = ruleSets.map(ruleSet => ({
      id: ruleSet.id,
      name: ruleSet.name,
      description: ruleSet.description || '',
      isActive: ruleSet.isActive,
      effectiveDate: ruleSet.effectiveDate.toISOString(),
      expiryDate: ruleSet.expiryDate?.toISOString(),
      companyId: ruleSet.companyId || undefined,
      createdAt: ruleSet.createdAt.toISOString(),
      updatedAt: ruleSet.updatedAt.toISOString(),
      createdBy: ruleSet.createdBy,
      version: ruleSet.version,
      tags: (ruleSet.tags as any) || [],
      rules: ruleSet.rules.map(rsb => ({
        ...rsb.rule,
        conditions: rsb.rule.conditions as any,
        calculation: rsb.rule.calculation as any,
        applicableTo: rsb.rule.applicableTo as any,
        tags: rsb.rule.tags as any,
        description: rsb.rule.description || '',
        createdAt: rsb.rule.createdAt.toISOString(),
        updatedAt: rsb.rule.updatedAt.toISOString()
      }))
    }));

      return NextResponse.json({
        success: true,
        data: transformedRuleSets
      });
    })(request);
  } catch (error) {
    console.error('Error fetching rule sets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rule sets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rule-sets
 * Create a new rule set
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const body = await request.json();
    const { name, description, effectiveDate, expiryDate, isActive, ruleIds, tags, companyId } = body;

    // Validate required fields
    if (!name || !effectiveDate) {
      return NextResponse.json(
        { error: 'Name and effective date are required' },
        { status: 400 }
      );
    }

    if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one rule must be selected' },
        { status: 400 }
      );
    }

    // Verify all rules exist
    const rules = await prisma.businessRule.findMany({
      where: {
        id: { in: ruleIds }
      }
    });

    if (rules.length !== ruleIds.length) {
      return NextResponse.json(
        { error: 'One or more selected rules do not exist' },
        { status: 400 }
      );
    }

    // Create the rule set
    const ruleSet = await prisma.ruleSet.create({
      data: {
        name,
        description: description || null,
        isActive: isActive ?? false,
        effectiveDate: new Date(effectiveDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        companyId: companyId || null,
        createdBy: req.user?.id || 'system',
        version: 1,
        tags: tags || [],
        rules: {
          create: ruleIds.map((ruleId: string, index: number) => ({
            ruleId,
            order: index
          }))
        }
      },
      include: {
        rules: {
          include: {
            rule: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    // Transform the response
    const transformedRuleSet = {
      id: ruleSet.id,
      name: ruleSet.name,
      description: ruleSet.description || '',
      isActive: ruleSet.isActive,
      effectiveDate: ruleSet.effectiveDate.toISOString(),
      expiryDate: ruleSet.expiryDate?.toISOString(),
      companyId: ruleSet.companyId || undefined,
      createdAt: ruleSet.createdAt.toISOString(),
      updatedAt: ruleSet.updatedAt.toISOString(),
      createdBy: ruleSet.createdBy,
      version: ruleSet.version,
      tags: (ruleSet.tags as any) || [],
      rules: ruleSet.rules.map(rsb => ({
        ...rsb.rule,
        conditions: rsb.rule.conditions as any,
        calculation: rsb.rule.calculation as any,
        applicableTo: rsb.rule.applicableTo as any,
        tags: rsb.rule.tags as any,
        description: rsb.rule.description || '',
        createdAt: rsb.rule.createdAt.toISOString(),
        updatedAt: rsb.rule.updatedAt.toISOString()
      }))
    };

      return NextResponse.json({
        success: true,
        data: transformedRuleSet
      }, { status: 201 });
    })(request);
  } catch (error) {
    console.error('Error creating rule set:', error);
    return NextResponse.json(
      { error: 'Failed to create rule set' },
      { status: 500 }
    );
  }
}

