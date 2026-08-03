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

  console.log('Connected to MySQL database:', process.env.DB_NAME);

  const cpanelBase = 'https://gravity-innovations.com/itlc';

  // 1. Update members table
  const [members] = await connection.query(
    "SELECT id, profile_image FROM members WHERE profile_image LIKE '%localhost%' OR profile_image LIKE '%/uploads/%'"
  );
  console.log(`Found ${members.length} members with localhost/uploads image URLs.`);
  let updatedMembers = 0;
  for (const m of members) {
    if (!m.profile_image) continue;
    const filename = m.profile_image.split('/').pop();
    const folder = filename.toLowerCase().includes('event') ? 'events' : 'members';
    const newUrl = `${cpanelBase}/${folder}/${filename}`;
    if (m.profile_image !== newUrl) {
      await connection.query('UPDATE members SET profile_image = ? WHERE id = ?', [newUrl, m.id]);
      updatedMembers++;
    }
  }
  console.log(`Updated ${updatedMembers} members profile_image URLs.`);

  // 2. Update event_registrations table
  const [regs] = await connection.query(
    "SELECT id, guest_profile_image FROM event_registrations WHERE guest_profile_image LIKE '%localhost%' OR guest_profile_image LIKE '%/uploads/%'"
  );
  console.log(`Found ${regs.length} event_registrations with localhost/uploads image URLs.`);
  let updatedRegs = 0;
  for (const r of regs) {
    if (!r.guest_profile_image) continue;
    const filename = r.guest_profile_image.split('/').pop();
    const folder = filename.toLowerCase().includes('event') ? 'events' : 'members';
    const newUrl = `${cpanelBase}/${folder}/${filename}`;
    if (r.guest_profile_image !== newUrl) {
      await connection.query('UPDATE event_registrations SET guest_profile_image = ? WHERE id = ?', [newUrl, r.id]);
      updatedRegs++;
    }
  }
  console.log(`Updated ${updatedRegs} event_registrations guest_profile_image URLs.`);

  // 3. Update events table
  const [events] = await connection.query(
    "SELECT id, image, poster_template FROM events WHERE image LIKE '%localhost%' OR image LIKE '%/uploads/%' OR poster_template LIKE '%localhost%' OR poster_template LIKE '%/uploads/%'"
  );
  console.log(`Found ${events.length} events with localhost/uploads image URLs.`);
  let updatedEvents = 0;
  for (const e of events) {
    let newImg = e.image;
    let newTpl = e.poster_template;
    if (e.image && (e.image.includes('localhost') || e.image.includes('/uploads/'))) {
      const filename = e.image.split('/').pop();
      newImg = `${cpanelBase}/events/${filename}`;
    }
    if (e.poster_template && (e.poster_template.includes('localhost') || e.poster_template.includes('/uploads/'))) {
      const filename = e.poster_template.split('/').pop();
      newTpl = `${cpanelBase}/events/${filename}`;
    }
    if (newImg !== e.image || newTpl !== e.poster_template) {
      await connection.query('UPDATE events SET image = ?, poster_template = ? WHERE id = ?', [newImg, newTpl, e.id]);
      updatedEvents++;
    }
  }
  console.log(`Updated ${updatedEvents} events image URLs.`);

  await connection.end();
  console.log('Database fix complete!');
}

main().catch(err => {
  console.error('Error fixing DB image URLs:', err);
  process.exit(1);
});
