import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const startTime = Date.now();
  
  return requireSuperAdmin(async (authenticatedRequest) => {
    try {
      const { action } = await request.json();

      if (!companyId) {
        return NextResponse.json(
          { error: 'Company ID is required' },
          { status: 400 }
        );
      }

      // Check if company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId }
      });

      if (!company) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }

      let updateData: any = {};

      switch (action) {
        case 'approve':
          updateData = { 
            isVerified: true, 
            isActive: true 
          };
          break;
        case 'suspend':
          updateData = { isActive: false };
          break;
        case 'unsuspend':
          updateData = { isActive: true };
          break;
        case 'reject':
          updateData = { 
            isVerified: false, 
            isActive: false 
          };
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          );
      }

      // Update the company in the database
      const updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: updateData
      });

      const duration = Date.now() - startTime;
      logger.info('Super admin company action performed', {
        companyId,
        action,
        companyName: updatedCompany.name,
        duration
      }, request);

      return NextResponse.json({
        success: true,
        message: `Company ${action} successfully`,
        data: updatedCompany
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Super admin company action error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        companyId,
        duration
      }, request);

      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to perform company action' },
        { status: 500 }
      );
    }
  })(request);
}