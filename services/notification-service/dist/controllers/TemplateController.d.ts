import { Request, Response } from 'express';
export declare class TemplateController {
    private templateService;
    constructor();
    createTemplate: (req: Request, res: Response) => Promise<void>;
    getTemplates: (req: Request, res: Response) => Promise<void>;
    getTemplate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    updateTemplate: (req: Request, res: Response) => Promise<void>;
    deleteTemplate: (req: Request, res: Response) => Promise<void>;
    renderTemplate: (req: Request, res: Response) => Promise<void>;
    getTemplateAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=TemplateController.d.ts.map