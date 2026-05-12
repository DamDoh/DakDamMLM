import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAuth, authenticateRequest, AuthenticatedRequest } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';

/**
 * POST /api/e-cash/transfer-to-member
 * Transfer E-Cash (USD) from admin to a member
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    return await requireAuth(async (req: AuthenticatedRequest) => {
      const user = req.user!;
      const body = await request.json();
      const { recipientIdentifier, amount } = body;

      // Validate input
      if (!recipientIdentifier || typeof recipientIdentifier !== 'string') {
        return NextResponse.json(
          { error: 'Recipient identifier (Member ID, Email, or Phone) is required.' },
          { status: 400 }
        );
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json(
          { error: 'Invalid amount. Amount must be a positive number.' },
          { status: 400 }
        );
      }

      // Get sender's E-Cash balance from database
      const senderRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { eCashBalance: true, isAdmin: true, fullName: true, memberId: true } as any
      });

      if (!senderRecord) {
        return NextResponse.json(
          { error: 'Sender not found' },
          { status: 404 }
        );
      }

      // Check if sender is admin (only admins can transfer E-Cash to members)
      if (!senderRecord.isAdmin) {
        return NextResponse.json(
          { error: 'Only admins can transfer E-Cash to members.' },
          { status: 403 }
        );
      }

      const senderBalance = Number(senderRecord.eCashBalance || 0);

      // Check if sender has sufficient balance
      if (senderBalance < amount) {
        return NextResponse.json(
          { error: `Insufficient E-Cash balance. You have $${senderBalance.toFixed(2)}, but need $${amount.toFixed(2)}.` },
          { status: 400 }
        );
      }

      // Find recipient by member ID, email, or phone
      const recipientResult = await prisma.user.findFirst({
        where: {
          OR: [
            { memberId: recipientIdentifier },
            { email: recipientIdentifier.toLowerCase() },
            { phoneNumber: recipientIdentifier }
          ],
          active: { not: false },
          deleted: { not: true }
        },
        select: { id: true, fullName: true, memberId: true, eCashBalance: true } as any
      });

      if (!recipientResult || Array.isArray(recipientResult)) {
        return NextResponse.json(
          { error: `Recipient "${recipientIdentifier}" not found.` },
          { status: 404 }
        );
      }

      // Type assertion: recipient is a single object with the selected fields
      const recipient: { id: string; fullName: string | null; memberId: string; eCashBalance: number } = recipientResult as any;

      if (recipient.id === user.id) {
        return NextResponse.json(
          { error: 'Cannot transfer E-Cash to yourself.' },
          { status: 400 }
        );
      }

      // Perform transfer in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Deduct from sender's E-Cash balance
        const updatedSender = await tx.user.update({
          where: { id: user.id },
          data: {
            eCashBalance: {
              decrement: amount
            }
          } as any,
          select: { eCashBalance: true } as any
        });

        // Add to recipient's E-Cash balance
        const updatedRecipient = await tx.user.update({
          where: { id: recipient.id },
          data: {
            eCashBalance: {
              increment: amount
            }
          } as any,
          select: { eCashBalance: true } as any
        });

        // Create E-Cash transaction record for sender (debit)
        const senderTransaction = await (tx as any).eCashTransaction.create({
          data: {
            userId: user.id,
            type: 'transfer',
            source: `Transfer to ${recipient.fullName || recipient.memberId}`,
            amountUsd: -amount, // Negative for debit
          }
        });

        // Create E-Cash transaction record for recipient (credit)
        // NOTE: We do NOT create a commission record for transfers
        // Transfers are handled via eCashBalance updates and eCashTransaction records only
        // Commissions are only for actual earnings (bonuses, matching, etc.)
        const recipientTransaction = await (tx as any).eCashTransaction.create({
          data: {
            userId: recipient.id,
            type: 'transfer',
            source: `Transfer from ${senderRecord.fullName || senderRecord.memberId || 'Admin'}`,
            amountUsd: amount, // Positive for credit
          }
        });

        return { 
          updatedSender, 
          updatedRecipient, 
          senderTransaction, 
          recipientTransaction 
        };
      });

      const duration = Date.now() - startTime;
      logger.info('E-Cash transfer to member completed', {
        senderId: user.id,
        recipientId: recipient.id,
        amount,
        senderNewBalance: result.updatedSender.eCashBalance,
        recipientNewBalance: result.updatedRecipient.eCashBalance,
        duration
      }, request);

      return NextResponse.json(
        {
          success: true,
          data: {
            transaction: result.senderTransaction,
            newBalance: result.updatedSender.eCashBalance,
            recipient: {
              id: recipient.id,
              name: recipient.fullName || recipient.memberId,
              newBalance: result.updatedRecipient.eCashBalance
            }
          },
          message: `Successfully transferred $${amount.toFixed(2)} to ${recipient.fullName || recipient.memberId}`
        },
        { status: 200 }
      );
    })(request);
  } catch (error) {
    logger.error('Failed to transfer E-Cash to member', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}
