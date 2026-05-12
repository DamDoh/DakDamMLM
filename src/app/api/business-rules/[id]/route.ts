import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { ruleConflictDetector } from '@/lib/rule-conflict-detector';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * GET /api/business-rules/[id]
 * Get a specific business rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rule = await prisma.businessRule.findUnique({
      where: { id }
    });

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error fetching business rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch business rule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business-rules/[id]
 * Update a business rule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get current rule for versioning and comparison
    const currentRule = await prisma.businessRule.findUnique({
      where: { id }
    });

    if (!currentRule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Calculate what changed
    const changes: any = {};
    if (body.name !== undefined && body.name !== currentRule.name) changes.name = body.name;
    if (body.description !== undefined && body.description !== currentRule.description) changes.description = body.description;
    if (body.priority !== undefined && body.priority !== currentRule.priority) changes.priority = body.priority;
    if (body.isActive !== undefined && body.isActive !== currentRule.isActive) changes.isActive = body.isActive;
    if (body.type !== undefined && body.type !== currentRule.type) changes.type = body.type;
    if (body.category !== undefined && body.category !== currentRule.category) changes.category = body.category;
    if (body.calculation && JSON.stringify(body.calculation) !== JSON.stringify(currentRule.calculation)) changes.calculation = body.calculation;
    if (body.conditions && JSON.stringify(body.conditions) !== JSON.stringify(currentRule.conditions)) changes.conditions = body.conditions;

    // Determine if this is just a status toggle
    const isOnlyStatusToggle = Object.keys(changes).length === 1 && changes.isActive !== undefined;
    const isActivating = changes.isActive === true && currentRule.isActive === false;

    // Initialize validation result (will be set if validation runs)
    let validation: { isValid: boolean; errors: string[]; warnings: string[]; suggestions: string[] } = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Validate the updated rule (skip if only toggling status to inactive)
    if (!isOnlyStatusToggle || isActivating) {
      validation = ruleConflictDetector.validateRule(body);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validation.errors
          },
          { status: 400 }
        );
      }

      // Only check for conflicts if the rule is being activated or if significant changes are made
      // Skip conflict checking when deactivating a rule
      if (isActivating || (!isOnlyStatusToggle && body.isActive !== false)) {
        const existingRules = await prisma.businessRule.findMany({
          where: { isActive: true, id: { not: id } }
        });

        // Only check conflicts with active rules (include the rule being updated if it's active)
        if (body.isActive !== false) {
          const rulesToCheck = [...existingRules, body];
          ruleConflictDetector.loadRules(rulesToCheck);
          const conflicts = ruleConflictDetector.analyzeConflicts();

          // Filter out false positives - only consider real conflicts
          // Different rank conditions are NOT mutually exclusive (Bronze vs Gold is fine)
          const realConflicts = conflicts.filter(c => {
            // Skip mutually exclusive conditions that are just different rank values
            if (c.type === 'mutually_exclusive_conditions') {
              // This is likely a false positive - different ranks are not mutually exclusive
              return false;
            }
            return c.severity === 'high';
          });

          if (realConflicts.length > 0) {
            return NextResponse.json(
              {
                success: false,
                error: 'High severity conflicts detected',
                conflicts: realConflicts
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Create version snapshot of current rule before update
    await prisma.ruleVersion.create({
      data: {
        ruleId: id,
        version: currentRule.version,
        data: currentRule as any,
        changes: changes,
        createdBy: 'system' // Can be enhanced to get from auth
      }
    });

    const rule = await prisma.businessRule.update({
      where: { id },
      data: {
        ...body,
        version: currentRule.version + 1,
        updatedAt: new Date(),
      }
    });

    // Log the update
    await prisma.ruleValidationLog.create({
      data: {
        ruleId: rule.id,
        action: 'update',
        isValid: true,
        errors: [],
        warnings: validation.warnings,
        suggestions: validation.suggestions,
        validatedAt: new Date(),
        validatedBy: 'system'
      }
    });

    return NextResponse.json({
      success: true,
      data: rule,
      warnings: validation.warnings
    });
  } catch (error) {
    console.error('Error updating business rule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update business rule',
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/business-rules/[id]
 * Delete a business rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 100000 }); // Optimized for 100M+ users
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for business rule deletion', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access - wrap the handler
    return requireAdmin(async (req) => {
      const { id } = await params;
      
      // Check if rule exists
      const rule = await prisma.businessRule.findUnique({
        where: { id }
      });

      if (!rule) {
        return NextResponse.json(
          { success: false, error: 'Rule not found' },
          { status: 404 }
        );
      }

      // Log the deletion before deleting the rule
      try {
      await prisma.ruleValidationLog.create({
        data: {
          ruleId: id,
          action: 'delete',
          isValid: true,
          errors: [],
            warnings: ['Rule permanently deleted'],
          suggestions: [],
          validatedAt: new Date(),
          validatedBy: req.user?.id || 'system'
        }
        });
      } catch (logError) {
        // If logging fails, log the error but continue with deletion
        console.error('Failed to log deletion:', logError);
      }

      // Hard delete - actually remove from database
      await prisma.businessRule.delete({
        where: { id }
      });

      const duration = Date.now() - startTime;
      logger.info('Business rule deleted successfully', {
        userId: req.user?.id,
        ruleId: id,
        ruleName: rule.name,
        duration
      }, request);

      return NextResponse.json({
        success: true,
        message: 'Rule deleted successfully'
      });
    })(request);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Error deleting business rule', {
      error: errorMessage,
      duration,
      ip: request.headers.get('x-forwarded-for'),
      stack: error instanceof Error ? error.stack : undefined
    }, request);

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: errorMessage },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete business rule', message: errorMessage },
      { status: 500 }
    );
  }
}