import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const groupRepository = {
  async getAllGroups() {
    const [rows] = await pool.query(`
      SELECT 
        g.id,
        g.name,
        g.description,
        g.color,
        g.created_at,
        g.updated_at,
        COUNT(gm.id) AS member_count
      FROM member_groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id
      ORDER BY g.name ASC
    `);
    return rows;
  },

  async getGroupById(id) {
    const [rows] = await pool.query(`
      SELECT 
        g.id,
        g.name,
        g.description,
        g.color,
        g.created_at,
        g.updated_at,
        COUNT(gm.id) AS member_count
      FROM member_groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id = ?
      GROUP BY g.id
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  },

  async createGroup({ name, description, color = '#4f46e5' }) {
    const id = uuidv4();
    await pool.query(
      'INSERT INTO member_groups (id, name, description, color) VALUES (?, ?, ?, ?)',
      [id, name, description || null, color]
    );
    return this.getGroupById(id);
  },

  async updateGroup(id, { name, description, color }) {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE member_groups SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    return this.getGroupById(id);
  },

  async deleteGroup(id) {
    await pool.query('DELETE FROM group_members WHERE group_id = ?', [id]);
    const [result] = await pool.query('DELETE FROM member_groups WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async getGroupMembers(groupId) {
    const [rows] = await pool.query(`
      SELECT 
        m.id,
        m.full_name,
        m.email,
        m.phone_number,
        m.designation,
        m.company,
        m.itlc_chapter_name,
        m.profile_image,
        m.status,
        gm.added_at
      FROM group_members gm
      INNER JOIN members m ON gm.member_id = m.id
      WHERE gm.group_id = ?
      ORDER BY m.full_name ASC
    `, [groupId]);
    return rows;
  },

  async addMemberToGroup(groupId, memberId) {
    const id = uuidv4();
    const [result] = await pool.query(`
      INSERT INTO group_members (id, group_id, member_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE member_id = VALUES(member_id)
    `, [id, groupId, memberId]);
    return result;
  },

  async addMembersToGroup(groupId, memberIds = []) {
    if (!memberIds || memberIds.length === 0) return { inserted: 0 };

    let inserted = 0;
    for (const memberId of memberIds) {
      const id = uuidv4();
      await pool.query(`
        INSERT INTO group_members (id, group_id, member_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE member_id = VALUES(member_id)
      `, [id, groupId, memberId]);
      inserted++;
    }
    return { inserted };
  },

  async removeMemberFromGroup(groupId, memberId) {
    const [result] = await pool.query(
      'DELETE FROM group_members WHERE group_id = ? AND member_id = ?',
      [groupId, memberId]
    );
    return result.affectedRows > 0;
  },

  async getAvailableMembersForGroup(groupId, search = '', chapter = '') {
    let queryStr = `
      SELECT 
        m.id,
        m.full_name,
        m.email,
        m.phone_number,
        m.designation,
        m.company,
        m.itlc_chapter_name,
        m.profile_image
      FROM members m
      WHERE m.status = 'approved'
      AND m.id NOT IN (
        SELECT member_id FROM group_members WHERE group_id = ?
      )
    `;
    const params = [groupId];

    if (chapter && chapter !== 'all') {
      queryStr += ' AND m.itlc_chapter_name = ?';
      params.push(chapter);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      queryStr += ` AND (
        m.full_name LIKE ? OR 
        m.email LIKE ? OR 
        m.phone_number LIKE ? OR 
        m.company LIKE ? OR 
        m.designation LIKE ?
      )`;
      params.push(term, term, term, term, term);
    }

    queryStr += ' ORDER BY m.full_name ASC LIMIT 100';

    const [rows] = await pool.query(queryStr, params);
    return rows;
  }
};
