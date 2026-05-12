import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/rule-sets/[id]
 * Get a specific rule set
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Apply rate limiting - optimized for 100M+ users
    const rateLimitResult = await rateLimit(request, { windowMs: 60 * 1000, maxRequests: 100000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      const ruleSet = await prisma.ruleSet.findUnique({
        where: { id },
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

      if (!ruleSet) {
        return NextResponse.json(
          { error: 'Rule set not found' },
          { status: 404 }
        );
      }

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
      });
    })(request);
  } catch (error) {
    console.error('Error fetching rule set:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rule set' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rule-sets/[id]
 * Update a rule set
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      try {
        const body = await request.json();
        const { name, description, effectiveDate, expiryDate, isActive, ruleIds, tags } = body;

        // Check if rule set exists
        const existingRuleSet = await prisma.ruleSet.findUnique({
          where: { id }
        });

        if (!existingRuleSet) {
          return NextResponse.json(
            { error: 'Rule set not found' },
            { status: 404 }
          );
        }

        // If ruleIds are provided, verify they exist
        if (ruleIds && Array.isArray(ruleIds)) {
          if (ruleIds.length === 0) {
            return NextResponse.json(
              { error: 'At least one rule must be selected' },
              { status: 400 }
            );
          }

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
        }

        // Update the rule set
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (effectiveDate !== undefined) updateData.effectiveDate = new Date(effectiveDate);
        if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
        if (tags !== undefined) updateData.tags = tags;
        updateData.version = existingRuleSet.version + 1;

        // If ruleIds are provided, update the rules relationship
        if (ruleIds && Array.isArray(ruleIds)) {
          // Delete existing rule relationships
          await prisma.ruleSetBusinessRule.deleteMany({
            where: { ruleSetId: id }
          });

          // Create new rule relationships
          updateData.rules = {
            create: ruleIds.map((ruleId: string, index: number) => ({
              ruleId,
              order: index
            }))
          };
        }

        const ruleSet = await prisma.ruleSet.update({
          where: { id },
          data: updateData,
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
        });
      } catch (error) {
        console.error('Error updating rule set:', error);
        return NextResponse.json(
          { error: 'Failed to update rule set' },
          { status: 500 }
        );
      }
    })(request);
  } catch (error) {
    console.error('Error in PUT handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rule-sets/[id]
 * Delete a rule set
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      try {
        // Check if rule set exists
        const existingRuleSet = await prisma.ruleSet.findUnique({
          where: { id }
        });

        if (!existingRuleSet) {
          return NextResponse.json(
            { error: 'Rule set not found' },
            { status: 404 }
          );
        }

        // Delete the rule set (cascade will delete related RuleSetBusinessRule records)
        await prisma.ruleSet.delete({
          where: { id }
        });

        return NextResponse.json({
          success: true,
          message: 'Rule set deleted successfully'
        });
      } catch (error) {
        console.error('Error deleting rule set:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to delete rule set' },
          { status: 500 }
        );
      }
    })(request);
  } catch (error) {
    console.error('Error in DELETE handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

