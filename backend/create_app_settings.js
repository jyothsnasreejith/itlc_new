import pool from './db.js';

async function run() {
  console.log('Connecting to database and creating app_settings table...');
  const query = `
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(255) PRIMARY KEY,
      setting_value LONGTEXT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  try {
    await pool.query(query);
    console.log('✅ Table "app_settings" has been successfully verified/created in database gravifu1_itlc!');
  } catch (err) {
    console.error('❌ Failed to create table:', err.message);
  }
  process.exit(0);
}

run();
