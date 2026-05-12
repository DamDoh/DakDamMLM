import express from 'express';
import { GenealogyController } from '../controllers/GenealogyController';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware';
import { validateUserId, validateMoveDownline, validateTreeDepth } from '../middleware/validationMiddleware';

const router = express.Router();
const genealogyController = new GenealogyController();

// Apply authentication to all routes
router.use(authenticateToken);

// Genealogy routes with validation
router.get('/tree/:userId',
  validateUserId,
  validateTreeDepth,
  genealogyController.getGenealogyTree
);

router.get('/downline/:userId',
  validateUserId,
  genealogyController.getDownline
);

router.get('/upline/:userId',
  validateUserId,
  genealogyController.getUpline
);

router.post('/move',
  validateMoveDownline,
  requireAdmin, // Only admins can move downlines
  genealogyController.moveDownline
);

router.get('/stats/:userId',
  validateUserId,
  genealogyController.getGenealogyStats
);

router.get('/placement/:userId',
  validateUserId,
  genealogyController.getPlacementInfo
);

router.get('/binary-tree/:userId',
  validateUserId,
  validateTreeDepth,
  genealogyController.getBinaryTree
);

router.get('/downline-paginated/:userId',
  validateUserId,
  genealogyController.getDownlinePaginated
);

router.post('/validate-placement',
  genealogyController.validatePlacement
);

router.get('/metrics/:userId',
  validateUserId,
  genealogyController.getGenealogyMetrics
);

router.post('/bulk-update',
  genealogyController.bulkUpdateGenealogy
);

export { router as genealogyRoutes };