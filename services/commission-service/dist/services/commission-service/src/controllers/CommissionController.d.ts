import { Request, Response } from 'express';
export declare class CommissionController {
    private commissionService;
    private payoutService;
    private bonusService;
    private ruleService;
    constructor();
    calculateCommissions: (req: Request, res: Response) => Promise<void>;
    getCommissions: (req: Request, res: Response) => Promise<void>;
    getCommission: (req: Request, res: Response) => Promise<any>;
    getUserCommissions: (req: Request, res: Response) => Promise<void>;
    getUserCommissionStats: (req: Request, res: Response) => Promise<void>;
    updateCommissionStatus: (req: Request, res: Response) => Promise<void>;
    deleteCommission: (req: Request, res: Response) => Promise<void>;
    createCommissionRule: (req: Request, res: Response) => Promise<void>;
    getCommissionRules: (req: Request, res: Response) => Promise<void>;
    getCommissionRule: (req: Request, res: Response) => Promise<any>;
    updateCommissionRule: (req: Request, res: Response) => Promise<void>;
    deleteCommissionRule: (req: Request, res: Response) => Promise<void>;
    createPayout: (req: Request, res: Response) => Promise<void>;
    getPayouts: (req: Request, res: Response) => Promise<void>;
    getPayout: (req: Request, res: Response) => Promise<any>;
    getUserPayouts: (req: Request, res: Response) => Promise<void>;
    updatePayoutStatus: (req: Request, res: Response) => Promise<void>;
    calculateBonuses: (req: Request, res: Response) => Promise<void>;
    getBonuses: (req: Request, res: Response) => Promise<void>;
    getBonus: (req: Request, res: Response) => Promise<any>;
    getUserBonuses: (req: Request, res: Response) => Promise<void>;
    getCommissionAnalytics: (req: Request, res: Response) => Promise<void>;
    getPayoutAnalytics: (req: Request, res: Response) => Promise<void>;
    getBonusAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=CommissionController.d.ts.map