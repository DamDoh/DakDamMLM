interface TemplateQuery {
    page: number;
    limit: number;
    type?: string;
    channel?: string;
    isActive?: boolean;
}
interface TemplateAnalyticsQuery {
    period: string;
}
export declare class TemplateService {
    createTemplate(templateData: any): Promise<any>;
    getTemplates(query: TemplateQuery): Promise<{
        templates: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getTemplateById(templateId: string): Promise<any>;
    updateTemplate(templateId: string, updates: any): Promise<any>;
    deleteTemplate(templateId: string): Promise<void>;
    renderTemplate(templateId: string, variables: Record<string, any>): Promise<{
        title: string;
        body: string;
        templateId: string;
        variables: Record<string, any>;
    }>;
    getTemplateAnalytics(templateId: string, query: TemplateAnalyticsQuery): Promise<{
        templateId: string;
        period: string;
        startDate: Date;
        endDate: Date;
        totalUsage: any;
        totalSent: any;
        totalFailed: any;
        deliveryRate: number;
    }>;
    private getDateRange;
}
export {};
//# sourceMappingURL=TemplateService.d.ts.map