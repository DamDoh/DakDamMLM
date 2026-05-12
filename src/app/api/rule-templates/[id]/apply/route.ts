import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * POST /api/rule-templates/[id]/apply
 * Apply a template to create actual business rules
 */
export async function POST(
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
        const { createAsActive = true } = body;

        // Get the template
        const template = await prisma.ruleTemplate.findUnique({
          where: { id }
        });

        if (!template) {
          return NextResponse.json(
            { error: 'Template not found' },
            { status: 404 }
          );
        }

        const templateRules = (template.rules as any) || [];
        if (templateRules.length === 0) {
          return NextResponse.json(
            { error: 'Template has no rules to apply' },
            { status: 400 }
          );
        }

        // Create business rules from template
        const createdRules = [];
        for (const ruleData of templateRules) {
          try {
            const rule = await prisma.businessRule.create({
              data: {
                name: ruleData.name,
                description: ruleData.description || '',
                type: ruleData.type,
                category: ruleData.category || template.category,
                priority: ruleData.priority || 0,
                isActive: createAsActive ? (ruleData.isActive !== false) : false,
                conditions: ruleData.conditions || [],
                calculation: ruleData.calculation || null,
                applicableTo: ruleData.applicableTo || ['distributor'],
                frequency: ruleData.frequency || 'monthly',
                payoutTiming: ruleData.payoutTiming || 'end_of_period',
                tags: ruleData.tags || [],
                createdBy: req.user?.id || 'system'
              }
            });
            createdRules.push(rule);
          } catch (error) {
            console.error(`Error creating rule "${ruleData.name}":`, error);
            // Continue with other rules even if one fails
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            rulesCreated: createdRules.length,
            rules: createdRules
          },
          message: `Successfully created ${createdRules.length} rule(s) from template.`
        });
      } catch (error) {
        console.error('Error applying template:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to apply template' },
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

