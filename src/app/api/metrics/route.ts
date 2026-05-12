// Prometheus Metrics API Route
// Exposes metrics for Prometheus scraping

import { NextRequest } from 'next/server';
import { advancedMonitoringService } from '@/services/advanced-monitoring-service';

// GET /api/metrics - Prometheus metrics endpoint
export async function GET(request: NextRequest) {
  try {
    const metrics = await advancedMonitoringService.getMetrics();

    return new Response(metrics, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Failed to generate metrics:', error);
    return new Response('Error generating metrics', { status: 500 });
  }
}