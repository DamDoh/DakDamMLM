import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { ruleConflictDetector } from '@/lib/rule-conflict-detector';

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

    // Validate the updated rule
    const validation = ruleConflictDetector.validateRule(body);
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

    // Check for conflicts with the updated rule
    const existingRules = await prisma.businessRule.findMany({
      where: { isActive: true, id: { not: id } }
    });

    // Add the updated rule to the list for conflict checking
    const allRules = [...existingRules, body];
    ruleConflictDetector.loadRules(allRules);
    const conflicts = ruleConflictDetector.analyzeConflicts();

    if (conflicts.some(c => c.severity === 'high')) {
      return NextResponse.json(
        {
          success: false,
          error: 'High severity conflicts detected',
          conflicts: conflicts.filter(c => c.severity === 'high')
        },
        { status: 409 }
      );
    }

    // Get current rule for versioning
    const currentRule = await prisma.businessRule.findUnique({
      where: { id }
    });

    if (!currentRule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

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
    return NextResponse.json(
      { success: false, error: 'Failed to update business rule' },
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
  try {
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

    // Soft delete by deactivating
    await prisma.businessRule.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    // Log the deletion
    await prisma.ruleValidationLog.create({
      data: {
        ruleId: id,
        action: 'delete',
        isValid: true,
        errors: [],
        warnings: ['Rule deactivated (soft delete)'],
        suggestions: [],
        validatedAt: new Date(),
        validatedBy: 'system'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Rule deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting business rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete business rule' },
      { status: 500 }
    );
  }
}