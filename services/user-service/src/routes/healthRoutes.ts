import express from 'express';
import { HealthController } from '../controllers/HealthController';

const router = express.Router();
const healthController = new HealthController();

router.get('/', healthController.healthCheck);

export { router as healthRoutes };