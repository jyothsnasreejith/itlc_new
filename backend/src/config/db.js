import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'itlc_db',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  timezone: '+05:30', // Enforce Indian Standard Time (IST) for database session
  dateStrings: true   // Return raw date strings without UTC conversions
});

// Test connection silently
try {
  const connection = await pool.getConnection();
  console.log(' Successfully connected to MySQL database pool.');
  connection.release();
} catch (err) {
  console.error(' Error connecting to MySQL database:', err.message);
}

export default pool;
