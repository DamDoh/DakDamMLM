import { Request, Response } from 'express';
export declare class HealthController {
    healthCheck: (req: Request, res: Response) => Promise<void>;
    private performHealthChecks;
    private checkDatabase;
    private checkCache;
    private checkMetrics;
}
//# sourceMappingURL=HealthController.d.ts.map