import { NextRequest, NextResponse } from 'next/server';
import { getKeyMetricsServer } from '../../../services/analytics-service';
import { ResponseUtils } from '../../../services/shared/utils';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'quarter') || 'month';

    const metrics = await getKeyMetricsServer(period);

    const response = ResponseUtils.success(metrics, 'Key metrics retrieved successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('Key metrics API error:', error);
    const errorResponse = ResponseUtils.error('Failed to fetch key metrics');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
