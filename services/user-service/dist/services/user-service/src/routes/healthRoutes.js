"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = __importDefault(require("express"));
const HealthController_1 = require("../controllers/HealthController");
const router = express_1.default.Router();
exports.healthRoutes = router;
const healthController = new HealthController_1.HealthController();
router.get('/', healthController.healthCheck);
//# sourceMappingURL=healthRoutes.js.map