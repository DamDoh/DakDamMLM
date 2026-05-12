import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-service';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
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

    const preview: any[] = [];
    const errors: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    // Validate each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 because CSV has header + 1-based indexing
      const rowErrors: string[] = [];

      // Required fields validation
      if (!record.email || !record.email.trim()) {
        rowErrors.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email.trim())) {
        rowErrors.push('Invalid email format');
      }

      if (!record.firstName || !record.firstName.trim()) {
        rowErrors.push('First name is required');
      }

      if (!record.surname || !record.surname.trim()) {
        rowErrors.push('Surname is required');
      }

      // Optional validations
      if (record.phoneNumber && record.phoneNumber.trim()) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        if (!phoneRegex.test(record.phoneNumber.trim())) {
          rowErrors.push('Invalid phone number format');
        }
      }

      // Check for duplicates within the file
      const duplicateInFile = records.find((r, idx) =>
        idx !== i && r.email?.trim().toLowerCase() === record.email?.trim().toLowerCase()
      );
      if (duplicateInFile) {
        rowErrors.push('Duplicate email in file');
      }

      // Check for existing users in database
      if (record.email && record.email.trim()) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: record.email.trim().toLowerCase() },
            select: { id: true }
          });

          if (existingUser) {
            rowErrors.push('User already exists');
          }
        } catch (dbError) {
          logger.warn('Database check failed for email validation:', dbError);
        }
      }

      const isValid = rowErrors.length === 0;
      const status = isValid ? 'valid' : rowErrors.includes('User already exists') ? 'duplicate' : 'invalid';

      if (isValid) validCount++;
      else invalidCount++;

      preview.push({
        email: record.email || '',
        firstName: record.firstName || '',
        surname: record.surname || '',
        phoneNumber: record.phoneNumber || '',
        status,
        errors: rowErrors
      });

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          email: record.email || '',
          error: rowErrors.join(', ')
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: records.length,
      successful: validCount,
      failed: invalidCount,
      errors,
      preview: preview.slice(0, 50) // Limit preview to first 50 rows
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Bulk user validation error', {
      error: errorMessage,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\app\api\bulk-users\validate\route.ts