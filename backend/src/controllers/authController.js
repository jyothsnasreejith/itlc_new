import { authService } from '../services/authService.js';

export async function forgotPinHandler(req, res, next) {
  try {
    const { phoneNumber } = req.body;
    const result = await authService.requestPinReset(phoneNumber);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
