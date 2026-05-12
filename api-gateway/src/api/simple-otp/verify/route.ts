// Simple OTP Verify API Route
// Works with traditional web hosting - no third-party dependencies

import { NextRequest, NextResponse } from 'next/server';
import { verifySimpleOTPServer, SimpleOTPVerification } from '@/services/simple-otp-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, code, purpose, companyId } = body;

    // Basic validation
    if (!identifier || !code || !purpose) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: identifier, code, purpose'
      }, { status: 400 });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({
        success: false,
        error: 'Code must be a 6-digit number'
      }, { status: 400 });
    }

    // Create verification request
    const verifyRequest: SimpleOTPVerification = {
      identifier,
      code,
      purpose,
      companyId
    };

    // Verify OTP
    const result = await verifySimpleOTPServer(verifyRequest);

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
    console.error('Simple OTP verify error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// GET endpoint for testing (optional)
export async function GET() {
  return NextResponse.json({
    message: 'Simple OTP Verify API',
    usage: 'POST with { identifier, code, purpose, companyId? }',
    example: {
      identifier: 'user@example.com',
      code: '123456',
      purpose: 'verification'
    }
  });
}