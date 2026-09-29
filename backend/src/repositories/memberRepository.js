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

  async findResetPinByMemberId(id) {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, reset_pin, reset_pin_expires_at FROM members WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async updateLoginPin(id, newPin) {
    const [result] = await pool.query(
      'UPDATE members SET login_pin = ?, reset_pin = NULL, reset_pin_expires_at = NULL WHERE id = ?',
      [newPin, id]
    );
    return result.affectedRows > 0;
  },

  async verifyMemberLogin(phone, pin) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const [rows] = await pool.query(
      `SELECT id, email, full_name, phone_number, designation, company, itlc_chapter_name, profile_image, membership_tier, status, login_pin
       FROM members 
       WHERE (phone_number = ? OR phone_number = ? OR phone_number = ?) AND status = 'approved'
       LIMIT 1`,
      [phone, cleanPhone, `+91${cleanPhone}`]
    );
    const member = rows[0] || null;
    if (!member) return { success: false, reason: 'not_found' };
    if (!member.login_pin) return { success: false, reason: 'no_pin_set', member };
    if (member.login_pin !== pin) return { success: false, reason: 'invalid_pin' };
    return { success: true, member };
  },

  async findMembersForInvite({ targetEmail, targetPhone, chapter, groupId }) {
    let queryStr = '';
    const params = [];

    if (groupId) {
      queryStr = `
        SELECT m.id, m.email, m.full_name, m.itlc_chapter_name 
        FROM members m
        INNER JOIN group_members gm ON m.id = gm.member_id
        WHERE gm.group_id = ? AND m.status = 'approved' AND m.email IS NOT NULL
      `;
      params.push(groupId);
    } else {
      queryStr = 'SELECT id, email, full_name, itlc_chapter_name FROM members WHERE status = "approved" AND email IS NOT NULL';

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
    }

    const [rows] = await pool.query(queryStr, params);
    return rows;
  }
};
