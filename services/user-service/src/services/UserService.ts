import { userDb as db } from '../config/database';

export class UserService {
  async getUserById(id: string) {
    return await db.user.findUnique({ where: { id } });
  }

  async updateUser(id: string, updates: any) {
    return await db.user.update({
      where: { id },
      data: updates
    });
  }

  async getUsers() {
    return await db.user.findMany();
  }
}