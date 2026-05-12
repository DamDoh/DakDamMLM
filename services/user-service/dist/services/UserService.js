"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_1 = require("../config/database");
class UserService {
    async getUserById(id) {
        return await database_1.userDb.user.findUnique({ where: { id } });
    }
    async updateUser(id, updates) {
        return await database_1.userDb.user.update({
            where: { id },
            data: updates
        });
    }
    async getUsers() {
        return await database_1.userDb.user.findMany();
    }
}
exports.UserService = UserService;
//# sourceMappingURL=UserService.js.map