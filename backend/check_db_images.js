// Run from: C:\Users\maiya\Downloads\ITLC\backend
// node check_db_images.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'itlc_db',
});

console.log('✅ Connected to MySQL\n');

// Sample 10 members with their profile_image value
const [members] = await conn.query(
  `SELECT id, full_name, profile_image FROM members WHERE profile_image IS NOT NULL LIMIT 10`
);

console.log(`📸 Sample profile_image values (${members.length} rows):`);
for (const m of members) {
  console.log(`  [${m.id.slice(0, 8)}...] ${m.full_name}: ${String(m.profile_image).slice(0, 120)}`);
}

// Count stats
const [[{ total }]] = await conn.query(`SELECT COUNT(*) as total FROM members`);
const [[{ withImage }]] = await conn.query(`SELECT COUNT(*) as withImage FROM members WHERE profile_image IS NOT NULL AND profile_image != ''`);
console.log(`\n📊 ${withImage}/${total} members have a profile_image value`);

await conn.end();
