import express from 'express';
import { UserController } from '../controllers/UserController';

const router = express.Router();
const userController = new UserController();

router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.get('/', userController.getUsers);

export { router as userRoutes };