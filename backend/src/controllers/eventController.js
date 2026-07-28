import { eventService } from '../services/eventService.js';

export async function sendEventInvitesHandler(req, res, next) {
  try {
    const result = await eventService.sendInvites(req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
