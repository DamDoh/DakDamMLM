"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const GenealogyService_1 = require("../services/GenealogyService");
class HealthController {
    constructor() {
        this.healthCheck = async (req, res) => {
            const health = await this.genealogyService.healthCheck();
            res.json(health);
        };
        this.genealogyService = new GenealogyService_1.GenealogyService();
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=HealthController.js.map