// Fix for queueCommissionNotifications method to handle Decimal properly
// File: dakdampostgre-devcg\services\commission-service\src\services\CommissionService.ts

private async queueCommissionNotifications(commissions: any[]) {
  for (const commission of commissions) {
    // Send notification via API instead of internal queue
    try {
      await apiClient.sendNotification({
        userId: commission.userId,
        type: 'commission_earned',
        title: 'Commission Earned',
        message: `You have earned $${commission.amount.toFixed(2)} in ${commission.type} commission`,
        data: {
          commissionId: commission.id,
          amount: commission.amount.toString(), // Convert Decimal to string for JSON serialization
          commissionType: commission.type,
          level: commission.level,
        },
      });
    } catch (error) {
      logger.error('Failed to send commission notification', {
        userId: commission.userId,
        commissionId: commission.id,
        error: (error as Error).message,
      });
    }
  }
}