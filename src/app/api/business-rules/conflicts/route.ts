import { NextRequest, NextResponse } from 'next/server';
import { ruleConflictDetector } from '@/lib/rule-conflict-detector';

/**
 * GET /api/business-rules/conflicts
 * Analyze rules for conflicts
 */
export async function GET(request: NextRequest) {
  try {
    // In a real implementation, fetch rules from database
    // For now, return mock conflict analysis
    const mockConflicts: any[] = [
      {
        type: 'calculation_conflict',
        severity: 'medium',
        rules: ['rule1', 'rule2'],
        description: 'Two rules have overlapping calculation methods',
        suggestion: 'Review calculation logic to ensure proper precedence'
      }
    ];

    const summary = ruleConflictDetector.getConflictSummary(mockConflicts);

    return NextResponse.json({
      success: true,
      data: {
        conflicts: mockConflicts,
        summary
      }
    });
  } catch (error) {
    console.error('Error analyzing conflicts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze conflicts' },
      { status: 500 }
    );
  }
}