import { Router } from 'express';
import {
  forgotPinHandler,
  resetPinHandler,
  memberLoginHandler
} from '../controllers/authController.js';

const router = Router();

router.post('/forgot-pin', forgotPinHandler);
router.post('/reset-pin', resetPinHandler);
router.post('/member-login', memberLoginHandler);

export default router;
