import { Router } from 'express';
import { verifyMemberPhoneHandler, cleanupTestRegistrationsHandler } from '../controllers/onamController.js';

const router = Router();

router.post('/verify-member-phone', verifyMemberPhoneHandler);
router.post('/cleanup-test-registrations', cleanupTestRegistrationsHandler);

export default router;
