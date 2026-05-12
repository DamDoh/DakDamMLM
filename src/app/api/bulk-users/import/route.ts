import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { hashPassword, registerMLMUser } from '@/lib/auth-service';
import { generateUniqueMemberId } from '@/lib/member-id-generator';
import { parse } from 'csv-parse/sync';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin/super admin
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file content
    const csvContent = await file.text();

    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const results = {
      total: records.length,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      try {
        // Generate member ID
        const memberId = await generateUniqueMemberId();

        // Generate a temporary password (user will need to reset)
        const tempPassword = Math.random().toString(36).slice(-12) + 'Temp123!';

        // Prepare user data
        const userData = {
          email: record.email.trim().toLowerCase(),
          password: tempPassword,
          firstName: record.firstName.trim(),
          surname: record.surname.trim(),
          phoneNumber: record.phoneNumber ? record.phoneNumber.trim() : '',
          sponsorId: record.sponsorId ? record.sponsorId.trim() : undefined,
          companyId: user.companyId || record.companyId, // Use admin's company or from CSV
          accountType: record.accountType || 'Customer',
          referralCode: record.referralCode ? record.referralCode.trim() : undefined
        };

        // Register the user
        const registeredUser = await registerMLMUser(userData);

        // Log the bulk import
        await prisma.auditLog.create({
          data: {
            userId: user.id, // Admin who performed the import
            action: 'bulk_import_create',
            entity: 'user',
            entityId: registeredUser.id,
            changes: {
              operation: 'bulk_import',
              source: 'csv_upload',
              tempPassword: true // Flag that password needs to be reset
            },
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            userAgent: request.headers.get('user-agent') || '',
            companyId: user.companyId
          }
        });

        results.successful++;

        logger.info('Bulk user import successful', {
          userId: registeredUser.id,
          email: userData.email,
          importedBy: user.id
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        results.failed++;
        results.errors.push({
          row: rowNumber,
          email: record.email || '',
          error: errorMessage
        });

        logger.error('Bulk user import failed', {
          row: rowNumber,
          email: record.email,
          error: errorMessage,
          importedBy: user.id
        });
      }
    }

    // Log the bulk operation completion
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'bulk_import_complete',
        entity: 'bulk_operation',
        entityId: `bulk_import_${Date.now()}`,
        changes: {
          total: results.total,
          successful: results.successful,
          failed: results.failed,
          fileName: file.name,
          fileSize: file.size
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent') || '',
        companyId: user.companyId
      }
    });

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Bulk user import error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\bulk-users\import\route.ts