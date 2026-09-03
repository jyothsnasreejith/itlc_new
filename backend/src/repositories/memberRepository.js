import pool from '../config/db.js';

export const memberRepository = {
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM members WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findApprovedByPhone(phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const [rows] = await pool.query(
      `SELECT id, email, full_name, phone_number, login_pin, company, designation
       FROM members 
       WHERE (phone_number = ? OR phone_number = ? OR phone_number = ?) AND status = 'approved' 
       LIMIT 1`,
      [phone, cleanPhone, `+91${cleanPhone}`]
    );
    return rows[0] || null;
  },

  async updateResetPin(id, pin, expiresAt) {
    const [result] = await pool.query(
      'UPDATE members SET reset_pin = ?, reset_pin_expires_at = ? WHERE id = ?',
      [pin, expiresAt, id]
    );
    return result;
  },

  async findMembersForInvite({ targetEmail, targetPhone, chapter }) {
    let queryStr = 'SELECT id, email, full_name, itlc_chapter_name FROM members WHERE status = "approved" AND email IS NOT NULL';
    const params = [];

    if (targetEmail) {
      queryStr += ' AND email = ?';
      params.push(targetEmail);
    }

    if (targetPhone) {
      const cleanPhone = String(targetPhone).replace(/\D/g, '');
      queryStr += ' AND (phone_number = ? OR phone_number = ? OR phone_number = ?)';
      params.push(targetPhone, cleanPhone, `+91${cleanPhone}`);
    }

    if (chapter && chapter !== 'all') {
      queryStr += ' AND itlc_chapter_name = ?';
      params.push(chapter);
    }

    const [rows] = await pool.query(queryStr, params);
    return rows;
  }
};
