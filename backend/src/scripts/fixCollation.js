import pool from '../config/db.js';

export async function fixCollation() {
  const connection = await pool.getConnection();
  try {
    console.log('Converting member_groups and group_members to utf8mb4_unicode_ci...');
    await connection.query(`
      ALTER TABLE member_groups CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    await connection.query(`
      ALTER TABLE group_members CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('✅ Tables converted to utf8mb4_unicode_ci successfully!');
  } catch (err) {
    console.error('Error converting collation:', err.message);
  } finally {
    connection.release();
  }
}

if (process.argv[1]?.endsWith('fixCollation.js')) {
  fixCollation().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
