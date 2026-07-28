import { Router } from 'express';
import { forgotPinHandler } from '../controllers/authController.js';

const router = Router();

router.post('/forgot-pin', forgotPinHandler);

export default router;
