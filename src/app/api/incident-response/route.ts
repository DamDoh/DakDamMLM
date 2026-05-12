import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { incidentResponseService } from '@/services/incident-response-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || (!user.isAdmin && user.accountType !== 'SuperAdmin')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { action, incidentType, severity, description, data } = body;

    if (action === 'create_test_incident') {
      // For testing purposes - create a test incident
      const incident = await incidentResponseService.createTestIncident();

      return NextResponse.json({
        success: true,
        incident,
        message: 'Test incident created and automated response triggered'
      });
    }

    if (action === 'detect_incident') {
      if (!incidentType || !severity || !description) {
        return NextResponse.json(
          { error: 'incidentType, severity, and description are required' },
          { status: 400 }
        );
      }

      const incident = await incidentResponseService.detectIncident(
        incidentType,
        severity,
        description,
        data
      );

      return NextResponse.json({
        success: true,
        incident,
        message: 'Incident detected and automated response initiated'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Incident response API error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || (!user.isAdmin && user.accountType !== 'SuperAdmin')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Return incident response capabilities info
    return NextResponse.json({
      success: true,
      capabilities: {
        supportedIncidentTypes: [
          'security_breach',
          'system_failure',
          'performance_degradation',
          'data_anomaly'
        ],
        supportedSeverities: ['low', 'medium', 'high', 'critical'],
        automatedActions: [
          'isolate_systems',
          'block_ips',
          'lock_accounts',
          'restart_services',
          'scale_resources',
          'clear_caches',
          'quarantine_data',
          'create_backups',
          'send_notifications'
        ]
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Incident response GET error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\incident-response\route.ts