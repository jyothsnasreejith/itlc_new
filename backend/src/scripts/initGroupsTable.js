import pool from '../config/db.js';

export async function initGroupsTables() {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS member_groups (
          id VARCHAR(191) NOT NULL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT NULL,
          color VARCHAR(50) DEFAULT '#4f46e5',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS group_members (
          id VARCHAR(191) NOT NULL PRIMARY KEY,
          group_id VARCHAR(191) NOT NULL,
          member_id VARCHAR(191) NOT NULL,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_group_member (group_id, member_id),
          INDEX idx_group (group_id),
          INDEX idx_member (member_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('✅ member_groups and group_members tables ensured with utf8mb4_unicode_ci.');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ Error initializing groups tables:', err.message);
  }
}

if (process.argv[1]?.endsWith('initGroupsTable.js')) {
  initGroupsTables().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
