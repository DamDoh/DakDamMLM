interface CampaignQuery {
    page: number;
    limit: number;
    status?: string;
    type?: string;
}
interface CampaignAnalyticsQuery {
    period: string;
}
export declare class CampaignService {
    createCampaign(campaignData: any): Promise<any>;
    getCampaigns(query: CampaignQuery): Promise<{
        campaigns: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getCampaignById(campaignId: string): Promise<any>;
    updateCampaign(campaignId: string, updates: any): Promise<any>;
    deleteCampaign(campaignId: string): Promise<void>;
    executeCampaign(campaignId: string): Promise<{
        campaignId: string;
        totalRecipients: number;
        sentCount: number;
        failedCount: number;
        results: {
            userId: string;
            success: boolean;
            error: any;
        }[];
    }>;
    scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<any>;
    cancelCampaign(campaignId: string): Promise<any>;
    getCampaignAnalytics(campaignId: string): Promise<{
        campaignId: string;
        campaignName: any;
        totalRecipients: any;
        sentCount: any;
        deliveredCount: any;
        openedCount: any;
        clickedCount: any;
        bouncedCount: any;
        deliveryRate: number;
        openRate: number;
        clickRate: number;
        bounceRate: number;
    }>;
    getCampaignsAnalytics(query: CampaignAnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalCampaigns: any;
        totalRecipients: any;
        totalSent: any;
        totalDelivered: any;
        totalOpened: any;
        totalClicked: any;
        overallDeliveryRate: number;
        overallOpenRate: number;
        overallClickRate: number;
        performanceByType: any;
    }>;
    private getTargetUsers;
    private sendCampaignNotification;
    private getDateRange;
}
export {};
//# sourceMappingURL=CampaignService.d.ts.map