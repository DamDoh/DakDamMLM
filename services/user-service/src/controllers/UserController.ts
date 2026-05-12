import { Request, Response } from 'express';
import { UserService } from '../services/UserService';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getUser = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const user = await this.userService.getUserById(id);
      if (!user) {
        return (res as any).status(404).json({ error: 'User not found' });
      }
      (res as any).json(user);
    } catch (error: any) {
      (res as any).status(500).json({ error: error.message });
    }
  };

  updateUser = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const updates = req.body as any;
      const user = await this.userService.updateUser(id, updates);
      (res as any).json(user);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  getUsers = async (req: Request, res: Response) => {
    try {
      const users = await this.userService.getUsers();
      (res as any).json(users);
    } catch (error: any) {
      (res as any).status(500).json({ error: error.message });
    }
  };
}