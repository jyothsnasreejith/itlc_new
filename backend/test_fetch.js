import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function run() {
  console.log('📡 Starting diagnostics on event_registrations...');
  
  // Test 1: Fetch 1 row, select=*
  try {
    console.log('1️⃣ Fetching 1 row (select=*)...');
    const start = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?select=*&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    const time = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Success! Took ${time}ms. Columns present:`, Object.keys(data[0] || {}));
    } else {
      console.error(`❌ Failed! Status: ${res.status}. Text:`, await res.text());
    }
  } catch (e) {
    console.error('❌ Error during Test 1:', e.message);
  }

  // Test 2: Get total count of rows
  try {
    console.log('2️⃣ Getting total count of rows...');
    const start = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?select=id`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    const time = Date.now() - start;
    if (res.ok) {
      console.log(`✅ Success! Took ${time}ms. Count header:`, res.headers.get('content-range'));
    } else {
      console.error(`❌ Failed! Status: ${res.status}. Text:`, await res.text());
    }
  } catch (e) {
    console.error('❌ Error during Test 2:', e.message);
  }

  // Test 3: Fetch all event_registrations rows with the select query
  try {
    const selectFields = 'id,event_id,member_id,registration_type,guest_name,guest_designation,guest_email,guest_phone,guest_salutation,guest_company,guest_industry_sector,guest_industry_type,guest_industry_category,guest_industry_sub_category,guest_country_of_work,guest_location,guest_years_of_experience,guest_date_of_birth,guest_area_of_expertise,status,registration_date,payment_status,payment_id,payment_amount,created_at,updated_at';
    console.log('3️⃣ Fetching all 238 rows of event_registrations (excluding guest_profile_image)...');
    const start = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?select=${selectFields}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    const time = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Success! Took ${time}ms. Fetched ${data.length} records.`);
    } else {
      console.error(`❌ Failed! Status: ${res.status}. Text:`, await res.text());
    }
  } catch (e) {
    console.error('❌ Error during Test 3:', e.message);
  }

  // Test 4: Fetch with Range header
  try {
    const selectFields = 'id,event_id,member_id,registration_type,guest_name,guest_designation,guest_email,guest_phone,guest_salutation,guest_company,guest_industry_sector,guest_industry_type,guest_industry_category,guest_industry_sub_category,guest_country_of_work,guest_location,guest_years_of_experience,guest_date_of_birth,guest_area_of_expertise,status,registration_date,payment_status,payment_id,payment_amount,created_at,updated_at';
    console.log('4️⃣ Fetching event_registrations with Range: 0-499 header...');
    const start = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/event_registrations?select=${selectFields}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Range': '0-499'
      }
    });
    const time = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Success! Took ${time}ms. Fetched ${data.length} records.`);
    } else {
      console.error(`❌ Failed! Status: ${res.status}. Text:`, await res.text());
    }
  } catch (e) {
    console.error('❌ Error during Test 4:', e.message);
  }

  // Test 5: Check profile_image column values in Supabase members table
  try {
    console.log('5️⃣ Fetching profile_image values from Supabase members (where not null)...');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,profile_image,profile_image_url&profile_image_url=not.is.null&limit=5`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Success! Found ${data.length} rows. Sample values:`);
      data.forEach(row => {
        console.log(`Row ID: ${row.id}`);
        console.log(`  profile_image:`, row.profile_image ? (row.profile_image.startsWith('data:') ? row.profile_image.slice(0, 50) + '...' : row.profile_image) : null);
        console.log(`  profile_image_url:`, row.profile_image_url);
      });
    } else {
      console.error(`❌ Failed! Status: ${res.status}. Text:`, await res.text());
    }
  } catch (e) {
    console.error('❌ Error during Test 5:', e.message);
  }
}





run();
