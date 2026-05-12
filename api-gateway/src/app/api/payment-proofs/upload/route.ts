import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  return requireAuth(async (req) => {
    try {
      const user = req.user;

    // Get the form data
    const formData = await request.formData();
    const orderId = formData.get('orderId') as string;
    const amount = formData.get('amount') as string;
    const proofFile = formData.get('proof') as File;

    if (!orderId || !proofFile) {
      return NextResponse.json(
        { error: 'Order ID and proof file are required' },
        { status: 400 }
      );
    }

    // Create form data for the microservice
    const microserviceFormData = new FormData();
    microserviceFormData.append('orderId', orderId);
    if (amount) microserviceFormData.append('amount', amount);
    microserviceFormData.append('proof', proofFile);

    // Forward to payment-proof-service
    const response = await fetch(`${process.env.PAYMENT_PROOF_SERVICE_URL}/api/proofs/upload`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('authorization') || '',
      },
      body: microserviceFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Upload failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

    } catch (error) {
      console.error('Payment proof upload error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(request);
}