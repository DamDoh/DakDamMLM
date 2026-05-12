/**
 * MEDIUM PRIORITY FIX #11: Email/Phone Uniqueness Validation
 * 
 * Ensures email and phone numbers remain unique even during updates.
 * Prevents duplicate accounts and user confusion.
 */

import { prisma } from '@/lib/prisma';

export interface UniqueFieldCheck {
  field: 'email' | 'phoneNumber' | 'idCardNumber' | 'memberId';
  value: string;
  isUnique: boolean;
  conflictingUserId?: string;
  conflictingUserName?: string;
}

export class UniquenessValidationService {
  /**
   * Check if email is unique (excluding current user)
   */
  static async checkEmailUniqueness(
    email: string,
    excludeUserId?: string
  ): Promise<UniqueFieldCheck> {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deleted: false,
        ...(excludeUserId && { id: { not: excludeUserId } })
      },
      select: {
        id: true,
        firstName: true,
        surname: true,
        memberId: true
      }
    });

    return {
      field: 'email',
      value: email,
      isUnique: !existingUser,
      conflictingUserId: existingUser?.id,
      conflictingUserName: existingUser ? `${existingUser.firstName} ${existingUser.surname}` : undefined
    };
  }

  /**
   * Check if phone number is unique (excluding current user)
   */
  static async checkPhoneUniqueness(
    phoneNumber: string,
    excludeUserId?: string
  ): Promise<UniqueFieldCheck> {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phoneNumber.replace(/[\s\-().]/g, '');

    const existingUser = await prisma.user.findFirst({
      where: {
        phoneNumber: normalizedPhone,
        deleted: false,
        ...(excludeUserId && { id: { not: excludeUserId } })
      },
      select: {
        id: true,
        firstName: true,
        surname: true,
        memberId: true
      }
    });

    return {
      field: 'phoneNumber',
      value: phoneNumber,
      isUnique: !existingUser,
      conflictingUserId: existingUser?.id,
      conflictingUserName: existingUser ? `${existingUser.firstName} ${existingUser.surname}` : undefined
    };
  }

  /**
   * Check if ID card number is unique (excluding current user)
   */
  static async checkIdCardUniqueness(
    idCardNumber: string,
    excludeUserId?: string
  ): Promise<UniqueFieldCheck> {
    const existingUser = await prisma.user.findFirst({
      where: {
        idCardNumber,
        deleted: false,
        ...(excludeUserId && { id: { not: excludeUserId } })
      },
      select: {
        id: true,
        firstName: true,
        surname: true,
        memberId: true
      }
    });

    return {
      field: 'idCardNumber',
      value: idCardNumber,
      isUnique: !existingUser,
      conflictingUserId: existingUser?.id,
      conflictingUserName: existingUser ? `${existingUser.firstName} ${existingUser.surname}` : undefined
    };
  }

  /**
   * Check if member ID is unique (excluding current user)
   */
  static async checkMemberIdUniqueness(
    memberId: string,
    excludeUserId?: string
  ): Promise<UniqueFieldCheck> {
    const existingUser = await prisma.user.findFirst({
      where: {
        memberId,
        deleted: false,
        ...(excludeUserId && { id: { not: excludeUserId } })
      },
      select: {
        id: true,
        firstName: true,
        surname: true
      }
    });

    return {
      field: 'memberId',
      value: memberId,
      isUnique: !existingUser,
      conflictingUserId: existingUser?.id,
      conflictingUserName: existingUser ? `${existingUser.firstName} ${existingUser.surname}` : undefined
    };
  }

  /**
   * Validate multiple fields at once
   * Returns array of failed checks (empty if all unique)
   */
  static async validateUniqueFields(
    fields: {
      email?: string;
      phoneNumber?: string;
      idCardNumber?: string;
      memberId?: string;
    },
    excludeUserId?: string
  ): Promise<UniqueFieldCheck[]> {
    const checks: UniqueFieldCheck[] = [];

    if (fields.email) {
      const emailCheck = await this.checkEmailUniqueness(fields.email, excludeUserId);
      if (!emailCheck.isUnique) {
        checks.push(emailCheck);
      }
    }

    if (fields.phoneNumber) {
      const phoneCheck = await this.checkPhoneUniqueness(fields.phoneNumber, excludeUserId);
      if (!phoneCheck.isUnique) {
        checks.push(phoneCheck);
      }
    }

    if (fields.idCardNumber) {
      const idCheck = await this.checkIdCardUniqueness(fields.idCardNumber, excludeUserId);
      if (!idCheck.isUnique) {
        checks.push(idCheck);
      }
    }

    if (fields.memberId) {
      const memberIdCheck = await this.checkMemberIdUniqueness(fields.memberId, excludeUserId);
      if (!memberIdCheck.isUnique) {
        checks.push(memberIdCheck);
      }
    }

    return checks;
  }

  /**
   * Validate before user update
   * Throws error if any field is not unique
   */
  static async validateBeforeUpdate(
    userId: string,
    updateData: {
      email?: string;
      phoneNumber?: string;
      idCardNumber?: string;
      memberId?: string;
    }
  ): Promise<void> {
    const conflicts = await this.validateUniqueFields(updateData, userId);

    if (conflicts.length > 0) {
      const errorMessages = conflicts.map(c => 
        `${c.field} "${c.value}" is already in use by ${c.conflictingUserName} (ID: ${c.conflictingUserId})`
      );

      throw new Error(
        `Cannot update user: ${errorMessages.join('; ')}`
      );
    }
  }

  /**
   * Validate before user creation
   * Throws error if any field is not unique
   */
  static async validateBeforeCreate(
    userData: {
      email: string;
      phoneNumber: string;
      idCardNumber?: string;
      memberId?: string;
    }
  ): Promise<void> {
    const conflicts = await this.validateUniqueFields(userData);

    if (conflicts.length > 0) {
      const errorMessages = conflicts.map(c => 
        `${c.field} "${c.value}" is already in use`
      );

      throw new Error(
        `Cannot create user: ${errorMessages.join('; ')}`
      );
    }
  }

  /**
   * Find duplicate users by email
   * Returns users with same email (shouldn't exist but good for cleanup)
   */
  static async findDuplicateEmails(
    companyId?: string
  ): Promise<Array<{ email: string; count: number; userIds: string[] }>> {
    const duplicates = await prisma.$queryRaw<
      Array<{ email: string; count: bigint; user_ids: string }>
    >`
      SELECT 
        email,
        COUNT(*) as count,
        STRING_AGG(id::text, ',') as user_ids
      FROM users
      WHERE deleted = false
        ${companyId ? prisma.$queryRawUnsafe(`AND company_id = '${companyId}'`) : prisma.$queryRawUnsafe('')}
      GROUP BY email
      HAVING COUNT(*) > 1
    `;

    return duplicates.map(d => ({
      email: d.email,
      count: Number(d.count),
      userIds: d.user_ids.split(',')
    }));
  }

  /**
   * Find duplicate users by phone
   */
  static async findDuplicatePhones(
    companyId?: string
  ): Promise<Array<{ phoneNumber: string; count: number; userIds: string[] }>> {
    const duplicates = await prisma.$queryRaw<
      Array<{ phone_number: string; count: bigint; user_ids: string }>
    >`
      SELECT 
        phone_number,
        COUNT(*) as count,
        STRING_AGG(id::text, ',') as user_ids
      FROM users
      WHERE deleted = false
        ${companyId ? prisma.$queryRawUnsafe(`AND company_id = '${companyId}'`) : prisma.$queryRawUnsafe('')}
      GROUP BY phone_number
      HAVING COUNT(*) > 1
    `;

    return duplicates.map(d => ({
      phoneNumber: d.phone_number,
      count: Number(d.count),
      userIds: d.user_ids.split(',')
    }));
  }

  /**
   * Audit all unique field violations
   * Returns summary of duplicates found
   */
  static async auditUniqueFields(
    companyId?: string
  ): Promise<{
    duplicateEmails: number;
    duplicatePhones: number;
    totalViolations: number;
  }> {
    const [duplicateEmails, duplicatePhones] = await Promise.all([
      this.findDuplicateEmails(companyId),
      this.findDuplicatePhones(companyId)
    ]);

    return {
      duplicateEmails: duplicateEmails.length,
      duplicatePhones: duplicatePhones.length,
      totalViolations: duplicateEmails.length + duplicatePhones.length
    };
  }
}
