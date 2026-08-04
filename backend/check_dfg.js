import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [rows] = await connection.query("SELECT id, full_name, profile_image, created_at FROM members WHERE full_name LIKE '%dfg%' ORDER BY created_at DESC");
  console.log('Member dfg rows:', JSON.stringify(rows, null, 2));

  await connection.end();
}

main().catch(console.error);
