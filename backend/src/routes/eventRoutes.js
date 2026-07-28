import { Router } from 'express';
import { sendEventInvitesHandler } from '../controllers/eventController.js';

const router = Router();

router.post('/send-event-invites', sendEventInvitesHandler);

export default router;
