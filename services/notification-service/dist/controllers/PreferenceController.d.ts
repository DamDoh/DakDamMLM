import { Request, Response } from 'express';
export declare class PreferenceController {
    private preferenceService;
    constructor();
    getUserPreferences: (req: Request, res: Response) => Promise<void>;
    createUserPreferences: (req: Request, res: Response) => Promise<void>;
    updateUserPreferences: (req: Request, res: Response) => Promise<void>;
    bulkUpdatePreferences: (req: Request, res: Response) => Promise<void>;
    getPreferencesAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=PreferenceController.d.ts.map