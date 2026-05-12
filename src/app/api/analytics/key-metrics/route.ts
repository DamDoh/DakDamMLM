import { NextRequest, NextResponse } from 'next/server';
import { getKeyMetricsServer } from '@/services/analytics-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'quarter') || 'month';

    const metrics = await getKeyMetricsServer(period);

    // Always respond 200 with a data array (may be empty on internal errors)
    return NextResponse.json({
      success: true,
      message: 'Key metrics retrieved successfully',
      data: metrics,
    });
  } catch (error) {
    console.error('Key metrics API error:', error);
    // Fall back to empty metrics but still return 200 so the UI doesn't break
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch key metrics',
      data: [],
    });
  }
}
