import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY are required in .env for migration');
  process.exit(1);
}

// Helper to format ISO timestamps for MySQL TIMESTAMP compatibility
function formatMySQLDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Helper to fetch all records paginated from Supabase PostgREST
async function fetchAllFromSupabase(table, primaryKey, select = '*') {
  let allData = [];
  let from = 0;
  const batchSize = 500; // Large batch size is fast when image columns are excluded
  let hasMore = true;

  console.log(`📡 Fetching data from Supabase table "${table}"...`);
  let useOrder = false; // Disable sorting by default to avoid slow sort operations


  while (hasMore) {
    const to = from + batchSize - 1;
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
    if (useOrder && primaryKey) {
      url += `&order=${primaryKey}.asc`;
    }
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Range': `${from}-${to}`,
        'Connection': 'close'
      },
      signal: AbortSignal.timeout(30000) // 30 seconds timeout
    });


    if (!response.ok) {
      const errText = await response.text();
      // If ordering failed because the column doesn't exist, retry without order
      if (useOrder && (errText.includes('PGRST100') || errText.includes('does not exist') || response.status === 400)) {
        console.warn(`   ⚠️ Ordering by "${primaryKey}" failed. Retrying without sorting...`);
        useOrder = false;
        continue;
      }
      throw new Error(`Failed to fetch from ${table}: ${errText}`);
    }

    const data = await response.json();
    allData = allData.concat(data);

    if (data.length < batchSize) {
      hasMore = false;
    } else {
      from += batchSize;
    }
  }

  console.log(`   Fetched ${allData.length} records.`);
  return allData;
}

// Helper to fetch only rows that have non-null images in small batches
async function fetchImagesForTable(table, primaryKey, imageColumn) {
  console.log(`🖼️ Fetching large images for table "${table}" ("${imageColumn}")...`);
  let allImages = [];
  let from = 0;
  const batchSize = 5; // Fetch only 5 images at a time to avoid statement timeout
  let hasMore = true;

  while (hasMore) {
    const to = from + batchSize - 1;
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${primaryKey},${imageColumn}&${imageColumn}=not.is.null`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Range': `${from}-${to}`,
        'Connection': 'close'
      },
      signal: AbortSignal.timeout(30000)
    });


    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to fetch images from ${table}: ${errText}`);
    }

    const data = await response.json();
    allImages = allImages.concat(data);

    if (data.length < batchSize) {
      hasMore = false;
    } else {
      from += batchSize;
    }
  }

  console.log(`   Fetched ${allImages.length} images for "${table}".`);
  return allImages;
}

async function startMigration() {
  console.log('🔗 Connecting to MySQL server...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '3306')
    });
  } catch (connErr) {
    console.error('❌ Could not connect to MySQL server. Check your credentials in .env:', connErr.message);
    process.exit(1);
  }

  try {
    // 1. Read and parse schema.sql
    console.log('📖 Reading schema.sql...');
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaSqlPath)) {
      throw new Error(`schema.sql not found at ${schemaSqlPath}`);
    }
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

    // Clean comments from schema.sql
    const cleanSql = schemaSql
      .replace(/--.*$/gm, '') // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments

    // Split statements
    const statements = cleanSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Run DDL statements
    console.log('🛠️ Creating MySQL database structure (Tables and Views)...');
    for (const stmt of statements) {
      await connection.query(stmt);
    }
    console.log('✅ Database tables initialized successfully.');
    
    // Close the initial connection
    await connection.end();

    // Create a pool targeting the selected database to manage reconnections and failures gracefully
    console.log('🏊 Creating connection pool targeting database...');
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME || 'itlc',
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0
    });

    // Copy local profile photos from frontend to backend uploads folder
    const srcPhotosDir = path.join(__dirname, '../frontend/src/profile-photos/profile-photos');
    const destPhotosDir = path.join(__dirname, 'uploads');

    if (!fs.existsSync(destPhotosDir)) {
      fs.mkdirSync(destPhotosDir, { recursive: true });
    }

    if (fs.existsSync(srcPhotosDir)) {
      const files = fs.readdirSync(srcPhotosDir);
      console.log(`📂 Found local profile photos directory with ${files.length} files. Copying to backend uploads folder...`);
      let copiedCount = 0;
      for (const file of files) {
        const srcPath = path.join(srcPhotosDir, file);
        const destPath = path.join(destPhotosDir, file);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
          copiedCount++;
        }
      }
      console.log(`   Copied ${copiedCount} files to backend uploads folder.`);
    }


    // Try to set global max allowed packet if user has privileges
    try {
      await pool.query('SET GLOBAL max_allowed_packet = 104857600'); // 100MB
      console.log('🚀 Increased MySQL global max_allowed_packet to 100MB.');
    } catch (e) {
      console.warn('⚠️ Could not increase global max_allowed_packet (requires root privilege). Large base64 images will be automatically skipped/nullified if they exceed size limits.');
    }

    // Disable foreign keys checks during migration import
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Fetch and migrate tables sequentially to maintain relationships
    const tablesToMigrate = [
      { name: 'app_counters', primaryKey: 'id' },
      { name: 'members', primaryKey: 'id', selectFields: 'id,salutation,full_name,phone_number,professional_phone,personal_phone,email,professional_email,personal_email,designation,company,industry_sector,industry_type,industry_category,industry_sub_category,country_of_work,location,itlc_chapter_name,years_of_experience,date_of_birth,area_of_expertise,membership_tier,status,login_pin,reset_pin,reset_pin_expires_at,created_at,updated_at' },
      { name: 'events', primaryKey: 'id', selectFields: 'id,title,description,date,time,location,address,max_registrations,fee,auto_share,status,created_at,updated_at' },
      { name: 'event_counters', primaryKey: 'event_id' },

      { name: 'event_registrations', primaryKey: 'id', selectFields: 'id,event_id,member_id,registration_type,guest_name,guest_designation,guest_email,guest_phone,guest_salutation,guest_company,guest_industry_sector,guest_industry_type,guest_industry_category,guest_industry_sub_category,guest_country_of_work,guest_location,guest_years_of_experience,guest_date_of_birth,guest_area_of_expertise,status,registration_date,payment_status,payment_id,payment_amount,created_at,updated_at' },
      { name: 'event_attendance', primaryKey: 'id' },
      { name: 'member_edit_history', primaryKey: 'id' }
    ];

    for (const tableConfig of tablesToMigrate) {
      const { name: tableName, primaryKey, selectFields, supabaseNames } = tableConfig;
      
      let data = [];
      let fetchSuccess = false;
      const namesToTry = supabaseNames || [tableName];
      const selectParam = selectFields || '*';

      for (const nameToTry of namesToTry) {
        try {
          data = await fetchAllFromSupabase(nameToTry, primaryKey, selectParam);
          fetchSuccess = true;
          break;
        } catch (fetchErr) {
          // If it's a "table not found" error, try next name
          if (fetchErr.message.includes('PGRST205') || fetchErr.message.includes('Could not find the table')) {
            continue;
          } else {
            console.warn(`⚠️ Warning: Failed to fetch table "${nameToTry}" from Supabase: ${fetchErr.message}. Skipping data migration for this table.`);
            break;
          }
        }
      }



      if (!fetchSuccess) {
        console.warn(`⚠️ None of the tables [${namesToTry.join(', ')}] exist in Supabase schema. Skipping data migration, but local MySQL table was initialized.`);
        continue;
      }

      if (data.length === 0) {
        console.log(`   No records to insert for ${tableName}.`);
        continue;
      }

      console.log(`📥 Migrating records into MySQL table "${tableName}"...`);

      // Clear existing records to avoid duplicates
      await pool.query(`TRUNCATE TABLE \`${tableName}\``);

      // Inspect MySQL table columns dynamically
      const [colRows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
      const mysqlColumns = colRows.map(r => r.Field);

      // Prepare insert SQL based on actual MySQL columns
      const columnNamesEscaped = mysqlColumns.map(c => `\`${c}\``).join(', ');
      const placeholders = mysqlColumns.map(() => '?').join(', ');
      const insertSql = `INSERT INTO \`${tableName}\` (${columnNamesEscaped}) VALUES (${placeholders})`;

      let insertedCount = 0;
      for (const row of data) {
        // Map Supabase row properties to MySQL columns with fallback matching
        const values = mysqlColumns.map(col => {
          let val = null;

          if (row[col] !== undefined) {
            val = row[col];
          }

          // Handle JSON arrays/objects - serialize to string
          if (val !== null && typeof val === 'object') {
            val = JSON.stringify(val);
          }
          // Convert date fields to MySQL date strings
          if (col === 'created_at' || col === 'updated_at' || col === 'checked_in_at' || col === 'changed_at' || col === 'registration_date' || col === 'reset_pin_expires_at') {
            val = formatMySQLDate(val);
          }
          return val;
        });

        try {
          await pool.query(insertSql, values);
          insertedCount++;
        } catch (insertErr) {
          console.error(`   ⚠️ Failed to insert row into ${tableName} (${row[primaryKey]}):`, insertErr.message);
        }
      }

      console.log(`✅ Successfully migrated ${insertedCount}/${data.length} records to table "${tableName}".`);

      // Stage 2: Map local photos instead of fetching from Supabase to prevent timeouts
      if (tableName === 'members') {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          console.log(`📸 Mapping local profile photos to members table...`);
          let mappedCount = 0;
          for (const memberRow of data) {
            const matchedFile = files.find(f => f.startsWith(memberRow.id));
            if (matchedFile) {
              const photoUrl = `http://localhost:5000/uploads/${matchedFile}`;
              await pool.query(`UPDATE \`${tableName}\` SET profile_image = ? WHERE id = ?`, [photoUrl, memberRow.id]);
              mappedCount++;
            }
          }
          console.log(`✅ Successfully mapped ${mappedCount} profile photos for members.`);
        }
      } else if (tableName === 'event_registrations') {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          console.log(`📸 Mapping local guest profile photos to event_registrations table...`);
          let mappedCount = 0;
          for (const regRow of data) {
            const matchedFile = files.find(f => f.startsWith(regRow.id));
            if (matchedFile) {
              const photoUrl = `http://localhost:5000/uploads/${matchedFile}`;
              await pool.query(`UPDATE \`${tableName}\` SET guest_profile_image = ? WHERE id = ?`, [photoUrl, regRow.id]);
              mappedCount++;
            }
          }
          console.log(`✅ Successfully mapped ${mappedCount} guest profile photos for event_registrations.`);
        }
      } else if (tableName === 'events') {
        try {
          const imgData = await fetchImagesForTable(tableName, primaryKey, 'image');
          if (imgData.length > 0) {
            console.log(`📥 Updating event banner images in MySQL table "${tableName}"...`);
            let updatedImages = 0;
            for (const imgRow of imgData) {
              let val = imgRow.image;
              if (val) {
                if (val.startsWith('data:image') && val.length > 800000) {
                  console.warn(`   ⚠️ Row (${imgRow.id}) image size is large (${Math.round(val.length / 1024)}KB). Setting to null to avoid packet limits.`);
                  val = null;
                }
                await pool.query(`UPDATE \`${tableName}\` SET image = ? WHERE id = ?`, [val, imgRow.id]);
                updatedImages++;
              }
            }
            console.log(`✅ Successfully updated ${updatedImages} event banner images for table "${tableName}".`);
          }
        } catch (e) {
          // Ignore if table has no image column
        }
      }

    }

    // Re-enable foreign keys checks
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY TO MYSQL DATABASE!');
    await pool.end();

  } catch (err) {
    console.error('💥 Migration failed with error:', err);
  }
}

startMigration();
