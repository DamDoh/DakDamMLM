// Simple OTP Generate API Route
// Works with traditional web hosting - no third-party dependencies

import { NextRequest, NextResponse } from 'next/server';
import { generateSimpleOTPServer, SimpleOTPRequest } from '@/services/simple-otp-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, type, purpose, companyId } = body;

    // Basic validation
    if (!identifier || !type || !purpose) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: identifier, type, purpose'
      }, { status: 400 });
    }

    // Create OTP request
    const otpRequest: SimpleOTPRequest = {
      identifier,
      type,
      purpose,
      companyId
    };

    // Generate OTP
    const result = await generateSimpleOTPServer(otpRequest);

    if (result.success) {
      return NextResponse.json({
        success: true,
        otpId: result.otpId,
        message: result.message
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Simple OTP generate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// GET endpoint for testing (optional)
export async function GET() {
  return NextResponse.json({
    message: 'Simple OTP Generate API',
    usage: 'POST with { identifier, type, purpose, companyId? }',
    example: {
      identifier: 'user@example.com',
      type: 'email',
      purpose: 'verification'
    }
  });
}