"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const UserService_1 = require("../services/UserService");
class UserController {
    constructor() {
        this.getUser = async (req, res) => {
            try {
                const { id } = req.params;
                const user = await this.userService.getUserById(id);
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                res.json(user);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        };
        this.updateUser = async (req, res) => {
            try {
                const { id } = req.params;
                const updates = req.body;
                const user = await this.userService.updateUser(id, updates);
                res.json(user);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.getUsers = async (req, res) => {
            try {
                const users = await this.userService.getUsers();
                res.json(users);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        };
        this.userService = new UserService_1.UserService();
    }
}
exports.UserController = UserController;
//# sourceMappingURL=UserController.js.map