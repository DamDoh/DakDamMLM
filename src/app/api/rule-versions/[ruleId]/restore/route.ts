import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * POST /api/rule-versions/[ruleId]/restore
 * Restore a rule to a specific version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    return requireAdmin(async (req) => {
      try {
        const body = await request.json();
        const { targetVersion } = body;

        if (!targetVersion || typeof targetVersion !== 'number') {
          return NextResponse.json(
            { error: 'Target version is required' },
            { status: 400 }
          );
        }

        // Get the current rule
        const currentRule = await prisma.businessRule.findUnique({
          where: { id: ruleId }
        });

        if (!currentRule) {
          return NextResponse.json(
            { error: 'Rule not found' },
            { status: 404 }
          );
        }

        // Get the target version
        const targetVersionData = await prisma.ruleVersion.findFirst({
          where: {
            ruleId,
            version: targetVersion
          }
        });

        if (!targetVersionData) {
          return NextResponse.json(
            { error: `Version ${targetVersion} not found for this rule` },
            { status: 404 }
          );
        }

        // Get the rule data from the version
        const versionRuleData = targetVersionData.data as any;

        // Create a new version with current rule state before restoring
        await prisma.ruleVersion.create({
          data: {
            ruleId,
            version: currentRule.version,
            data: currentRule as any,
            changes: {
              restoredFrom: targetVersion,
              restoredAt: new Date().toISOString(),
              restoredBy: req.user?.id || 'system'
            },
            createdBy: req.user?.id || 'system'
          }
        });

        // Restore the rule to the target version
        const updatedRule = await prisma.businessRule.update({
          where: { id: ruleId },
          data: {
            name: versionRuleData.name,
            description: versionRuleData.description || null,
            type: versionRuleData.type,
            category: versionRuleData.category,
            priority: versionRuleData.priority || 0,
            isActive: versionRuleData.isActive !== false,
            conditions: versionRuleData.conditions || [],
            calculation: versionRuleData.calculation || null,
            applicableTo: versionRuleData.applicableTo || ['distributor'],
            frequency: versionRuleData.frequency || 'monthly',
            payoutTiming: versionRuleData.payoutTiming || 'end_of_period',
            tags: versionRuleData.tags || [],
            metadata: versionRuleData.metadata || null,
            version: { increment: 1 },
            updatedAt: new Date()
          }
        });

        // Create a new version record for the restored state
        await prisma.ruleVersion.create({
          data: {
            ruleId,
            version: updatedRule.version,
            data: updatedRule as any,
            changes: {
              restoredFrom: targetVersion,
              note: `Restored from version ${targetVersion}`
            },
            createdBy: req.user?.id || 'system'
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            rule: updatedRule,
            restoredFromVersion: targetVersion,
            newVersion: updatedRule.version
          },
          message: `Successfully restored rule to version ${targetVersion}. New version ${updatedRule.version} created.`
        });
      } catch (error) {
        console.error('Error restoring version:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to restore version' },
          { status: 500 }
        );
      }
    })(request);
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

