import { NextRequest, NextResponse } from 'next/server';
import { enhancedRuleEngine } from '@/lib/enhanced-rule-engine';
import { ruleValidationEngine } from '@/lib/rule-validation-engine';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import type { BusinessRule } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const ruleSetId = searchParams.get('ruleSetId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    let rules: BusinessRule[] = [];

    if (ruleSetId) {
      // Get rules from specific rule set
      const ruleSet = await prisma.businessRule.findMany({
        where: {
          companyId,
          // For now, we'll get all company rules - rule sets can be filtered later
        }
      });

      if (ruleSet) {
        rules = ruleSet.map(rule => ({
          ...rule,
          companyId: rule.companyId || undefined,
          conditions: rule.conditions as any,
          calculation: rule.calculation as any,
          applicableTo: rule.applicableTo as any,
          tags: rule.tags as any,
          description: rule.description || '',
          type: rule.type as any,
          category: rule.category as any,
          frequency: rule.frequency as any,
          payoutTiming: rule.payoutTiming as any,
          metadata: (rule.metadata as any) || undefined,
          createdAt: rule.createdAt.toISOString(),
          updatedAt: rule.updatedAt.toISOString()
        }));
      }
    } else {
      // Get all rules for company
      const dbRules = await prisma.businessRule.findMany({
        where: {
          OR: [
            { companyId },
            { companyId: null } // System-wide rules
          ]
        },
        orderBy: { priority: 'desc' }
      });

      rules = dbRules.map(rule => ({
        ...rule,
        companyId: rule.companyId || undefined,
        conditions: rule.conditions as any,
        calculation: rule.calculation as any,
        applicableTo: rule.applicableTo as any,
        tags: rule.tags as any,
        description: rule.description || '',
        type: rule.type as any,
        category: rule.category as any,
        frequency: rule.frequency as any,
        payoutTiming: rule.payoutTiming as any,
        metadata: (rule.metadata as any) || undefined,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString()
      }));
    }

    // Load rules into engine
    enhancedRuleEngine.loadCompanyRules(companyId, rules);

    return NextResponse.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching enhanced rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch enhanced rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, ...ruleData } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Validate rule
    const fullRule: BusinessRule = {
      id: `rule-${Date.now()}`,
      name: ruleData.name || '',
      description: ruleData.description || '',
      type: ruleData.type || 'custom_bonus',
      category: ruleData.category || 'bonus',
      priority: ruleData.priority || 100,
      isActive: ruleData.isActive ?? true,
      conditions: ruleData.conditions || [],
      calculation: ruleData.calculation || { type: 'fixed_amount', baseValue: 0 },
      applicableTo: ruleData.applicableTo || ['distributor'],
      frequency: ruleData.frequency || 'monthly',
      payoutTiming: ruleData.payoutTiming || 'end_of_period',
      companyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: ruleData.createdBy || 'admin',
      version: 1,
      tags: ruleData.tags || []
    };

    const validation = ruleValidationEngine.validateRule(fullRule);
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

    // Create rule in database
    const rule = await prisma.businessRule.create({
      data: {
        name: fullRule.name,
        description: fullRule.description,
        type: fullRule.type,
        category: fullRule.category,
        priority: fullRule.priority,
        isActive: fullRule.isActive,
        conditions: JSON.stringify(fullRule.conditions),
        calculation: JSON.stringify(fullRule.calculation),
        applicableTo: JSON.stringify(fullRule.applicableTo),
        frequency: fullRule.frequency,
        payoutTiming: fullRule.payoutTiming,
        companyId: fullRule.companyId,
        createdBy: fullRule.createdBy,
        version: fullRule.version,
        tags: JSON.stringify(fullRule.tags)
      }
    });

    // Load into engine
    enhancedRuleEngine.loadCompanyRules(companyId, [{
      ...rule,
      companyId: rule.companyId || undefined,
      conditions: rule.conditions as any,
      calculation: rule.calculation as any,
      applicableTo: rule.applicableTo as any,
      tags: rule.tags as any,
      description: rule.description || '',
      type: rule.type as any,
      category: rule.category as any,
      frequency: rule.frequency as any,
      payoutTiming: rule.payoutTiming as any,
      metadata: (rule.metadata as any) || undefined,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString()
    }]);

    return NextResponse.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error creating enhanced rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create enhanced rule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, companyId, ...updates } = body;

    if (!id || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Rule ID and Company ID are required' },
        { status: 400 }
      );
    }

    // Get existing rule
    const existing = await prisma.businessRule.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Create updated rule for validation
    const updatedRule: BusinessRule = {
      ...existing,
      ...updates,
      conditions: updates.conditions || existing.conditions,
      calculation: updates.calculation || existing.calculation,
      applicableTo: updates.applicableTo || existing.applicableTo,
      tags: updates.tags || existing.tags,
      updatedAt: new Date().toISOString()
    };

    const validation = ruleValidationEngine.validateRule(updatedRule);
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

    // Update in database
    const rule = await prisma.businessRule.update({
      where: { id },
      data: {
        ...updates,
        conditions: updates.conditions ? JSON.stringify(updates.conditions) : undefined,
        calculation: updates.calculation ? JSON.stringify(updates.calculation) : undefined,
        applicableTo: updates.applicableTo ? JSON.stringify(updates.applicableTo) : undefined,
        tags: updates.tags ? JSON.stringify(updates.tags) : undefined,
        updatedAt: new Date().toISOString()
      }
    });

    // Reload rules into engine
    const allDbRules = await prisma.businessRule.findMany({
      where: {
        OR: [
          { companyId },
          { companyId: null }
        ]
      }
    });
    const allRules = allDbRules.map(rule => ({
      ...rule,
      companyId: rule.companyId || undefined,
      conditions: rule.conditions as any,
      calculation: rule.calculation as any,
      applicableTo: rule.applicableTo as any,
      tags: rule.tags as any,
      description: rule.description || '',
      type: rule.type as any,
      category: rule.category as any,
      frequency: rule.frequency as any,
      payoutTiming: rule.payoutTiming as any,
      metadata: (rule.metadata as any) || undefined,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString()
    })) as BusinessRule[];
    enhancedRuleEngine.loadCompanyRules(companyId, allRules);

    return NextResponse.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error updating enhanced rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update enhanced rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const companyId = searchParams.get('companyId');

    if (!id || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Rule ID and Company ID are required' },
        { status: 400 }
      );
    }

    // Delete from database
    await prisma.businessRule.delete({
      where: { id }
    });

    // Reload rules into engine
    const allDbRules = await prisma.businessRule.findMany({
      where: {
        OR: [
          { companyId },
          { companyId: null }
        ]
      }
    });
    const allRules = allDbRules.map(rule => ({
      ...rule,
      companyId: rule.companyId || undefined,
      conditions: rule.conditions as any,
      calculation: rule.calculation as any,
      applicableTo: rule.applicableTo as any,
      tags: rule.tags as any,
      description: rule.description || '',
      type: rule.type as any,
      category: rule.category as any,
      frequency: rule.frequency as any,
      payoutTiming: rule.payoutTiming as any,
      metadata: (rule.metadata as any) || undefined,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString()
    })) as BusinessRule[];
    enhancedRuleEngine.loadCompanyRules(companyId, allRules);

    return NextResponse.json({
      success: true,
      message: 'Enhanced rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting enhanced rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete enhanced rule' },
      { status: 500 }
    );
  }
}