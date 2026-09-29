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

export async function resetPinHandler(req, res, next) {
  try {
    const { phoneNumber, resetCode, newPin } = req.body;
    const result = await authService.resetPin({ phoneNumber, resetCode, newPin });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function memberLoginHandler(req, res, next) {
  try {
    const { phoneNumber, pin } = req.body;
    const result = await authService.memberLogin({ phoneNumber, pin });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
