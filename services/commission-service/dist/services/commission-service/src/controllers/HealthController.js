"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const CommissionService_1 = require("../services/CommissionService");
class HealthController {
    constructor() {
        this.healthCheck = async (req, res) => {
            const resAny = res;
            const health = await this.commissionService.healthCheck();
            resAny.json(health);
        };
        this.commissionService = new CommissionService_1.CommissionService();
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=HealthController.js.map