import { Request, Response } from 'express';
export declare class UserController {
    private userService;
    constructor();
    getUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    updateUser: (req: Request, res: Response) => Promise<void>;
    getUsers: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=UserController.d.ts.map