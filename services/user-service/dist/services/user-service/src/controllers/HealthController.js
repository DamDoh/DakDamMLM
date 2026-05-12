"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const AuthService_1 = require("../services/AuthService");
class HealthController {
    constructor() {
        this.healthCheck = async (req, res) => {
            const health = await this.authService.healthCheck();
            res.json(health);
        };
        this.authService = new AuthService_1.AuthService();
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=HealthController.js.map