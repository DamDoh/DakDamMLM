import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  return requireSuperAdmin(async (authenticatedRequest) => {
    try {
      // Generate mock alerts for demonstration
      // In a real implementation, this would check for actual system issues
      const alerts = [
        {
          id: 'alert-1',
          type: 'warning' as const,
          title: 'High CPU Usage Detected',
          description: 'Server CPU usage has exceeded 80% for the last 15 minutes.',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        },
        {
          id: 'alert-2',
          type: 'info' as const,
          title: 'New Company Registration',
          description: 'ABC Nutrition has registered and is pending approval.',
          companyId: 'company-123',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        },
        {
          id: 'alert-3',
          type: 'error' as const,
          title: 'Payment Processing Failed',
          description: 'Multiple payment transactions failed in the last hour.',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        }
      ];

      return NextResponse.json(alerts);

    } catch (error) {
      console.error('Super admin alerts error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch system alerts' },
        { status: 500 }
      );
    }
  })(request);
}