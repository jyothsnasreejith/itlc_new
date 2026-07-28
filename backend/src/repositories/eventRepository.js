import pool from '../config/db.js';

export const eventRepository = {
  async findById(eventId) {
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [eventId]);
    return rows[0] || null;
  },

  async getAllEvents() {
    const [rows] = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
    return rows;
  }
};
