import pool from '../config/db.js';
import { memberRepository } from '../repositories/memberRepository.js';

export async function verifyMemberPhoneHandler(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const member = await memberRepository.findApprovedByPhone(phone);
    if (!member) {
      return res.status(200).json({
        success: false,
        verified: false,
        message: 'Not registered mobile no, try another'
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        phone_number: member.phone_number
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function cleanupTestRegistrationsHandler(req, res, next) {
  try {
    const [result] = await pool.query(
      `DELETE FROM event_registrations WHERE id LIKE 'ONAM-%'`
    );
    return res.status(200).json({ success: true, deletedCount: result.affectedRows });
  } catch (err) {
    next(err);
  }
}
