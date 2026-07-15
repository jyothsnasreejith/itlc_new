import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Check if running in a serverless environment (like Vercel) where the filesystem is read-only
const isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' || process.env.NOW_REGION !== undefined;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));

// Body parser limits increased to handle base64 image strings
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ensure uploads folder exists (skip in serverless environments to prevent EROFS errors)
const uploadsDir = path.join(__dirname, 'uploads');
if (!isServerless && !fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create uploads directory:', err.message);
  }
}

// Serve uploaded files statically (checks local files first, redirects to cPanel if not found)
app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const localPath = path.join(uploadsDir, filename);
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }

  const cpanelUrl = process.env.CPANEL_UPLOAD_URL;
  if (cpanelUrl) {
    const filenameLower = filename.toLowerCase();
    let folder = 'members';
    if (filenameLower.includes('event')) {
      folder = 'events';
    }
    const cpanelBase = cpanelUrl.substring(0, cpanelUrl.lastIndexOf('/'));
    return res.redirect(`${cpanelBase}/${folder}/${filename}`);
  }

  return res.status(404).send('File not found');
});

// Helper to safely write base64 image data to a file and return the filename
function saveBase64ToFile(base64Str, idPrefix) {
  if (!base64Str) return null;
  const cleanStr = base64Str.trim();
  if (!cleanStr.startsWith('data:image/')) return null;

  const semiColonIndex = cleanStr.indexOf(';base64,');
  if (semiColonIndex === -1) return null;

  const mimeType = cleanStr.substring(5, semiColonIndex);
  const base64Data = cleanStr.substring(semiColonIndex + 8).replace(/\s/g, ''); // strip any spaces/newlines
  
  const extParts = mimeType.split('/');
  let ext = extParts[1] || 'png';
  if (ext.includes('+')) {
    ext = ext.split('+')[0];
  }
  if (ext === 'jpeg') ext = 'jpg';

  const filename = `${idPrefix}-${Date.now()}.${ext}`;
  const destPath = path.join(uploadsDir, filename);
  fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
  return filename;
}

// Asynchronous helper to save image (local in development, cPanel in production)
async function saveImage(base64Str, idPrefix, folder) {
  if (!base64Str) return null;
  const cleanStr = base64Str.trim();
  if (!cleanStr.startsWith('data:image/')) return null;

  const semiColonIndex = cleanStr.indexOf(';base64,');
  if (semiColonIndex === -1) return null;

  const mimeType = cleanStr.substring(5, semiColonIndex);
  const base64Data = cleanStr.substring(semiColonIndex + 8).replace(/\s/g, ''); // strip any spaces/newlines
  
  const extParts = mimeType.split('/');
  let ext = extParts[1] || 'png';
  if (ext.includes('+')) {
    ext = ext.split('+')[0];
  }
  if (ext === 'jpeg') ext = 'jpg';

  const filename = `${idPrefix}-${Date.now()}.${ext}`;

  const cpanelUploadUrl = process.env.CPANEL_UPLOAD_URL;

  if (cpanelUploadUrl) {
    try {
      console.log(`📤 Uploading base64 image ${filename} to cPanel...`);
      const response = await fetch(cpanelUploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64: cleanStr,
          filename: filename,
          folder: folder
        })
      });

      if (!response.ok) {
        throw new Error(`cPanel upload returned status ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      if (result.success && result.url) {
        console.log(`✅ Uploaded to cPanel successfully: ${result.url}`);
        return result.url;
      } else {
        throw new Error(result.error || 'Unknown cPanel upload error');
      }
    } catch (err) {
      console.error('❌ Failed to upload base64 to cPanel:', err.message);
      if (isServerless) {
        return null;
      }
    }
  }

  // Fallback to local storage (development mode only, if cpanelUploadUrl is not set or failed)
  if (!isServerless) {
    console.log(`💾 Falling back to local storage for image ${filename}...`);
    const destPath = path.join(uploadsDir, filename);
    fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
    const appUrl = process.env.APP_URL || `http://localhost:${PORT || 5000}`;
    return `${appUrl}/uploads/${filename}`;
  }
}

// Intercept base64 fields in queries and replace them with local static or remote URLs
async function processBase64FieldsAsync(dataRow, idPrefix) {
  if (!dataRow || typeof dataRow !== 'object') return dataRow;
  const row = { ...dataRow };

  if (row.profile_image && typeof row.profile_image === 'string' && row.profile_image.startsWith('data:image/')) {
    const url = await saveImage(row.profile_image, idPrefix || 'member', 'members');
    if (url) {
      row.profile_image = url;
    }
  }
  if (row.guest_profile_image && typeof row.guest_profile_image === 'string' && row.guest_profile_image.startsWith('data:image/')) {
    const url = await saveImage(row.guest_profile_image, idPrefix || 'guest', 'guests');
    if (url) {
      row.guest_profile_image = url;
    }
  }
  if (row.image && typeof row.image === 'string' && row.image.startsWith('data:image/')) {
    const url = await saveImage(row.image, idPrefix || 'event', 'events');
    if (url) {
      row.image = url;
    }
  }

  return row;
}

// Multer Storage Configuration (Memory in serverless/cPanel mode, Disk in local development fallback)
const storage = (isServerless || process.env.CPANEL_UPLOAD_URL)
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
      }
    });

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 1. File Upload Endpoint (Mocks Supabase Storage)
app.post('/api/storage/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cpanelUploadUrl = process.env.CPANEL_UPLOAD_URL;

    if (cpanelUploadUrl) {
      try {
        // Generate a clean filename for cPanel
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(req.file.originalname);
        const filename = req.file.fieldname + '-' + uniqueSuffix + ext;

        console.log(`📤 Uploading file ${filename} to cPanel...`);
        const fileBuffer = req.file.buffer;
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });
        const formData = new FormData();
        formData.append('file', blob, filename);

        let folder = 'uploads';
        const filenameLower = filename.toLowerCase();
        if (filenameLower.includes('member')) folder = 'members';
        else if (filenameLower.includes('event')) folder = 'events';
        else if (filenameLower.includes('guest')) folder = 'guests';
        formData.append('folder', folder);

        const response = await fetch(cpanelUploadUrl, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`cPanel upload status ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();
        if (result.success && result.url) {
          console.log(`✅ File uploaded to cPanel successfully: ${result.url}`);
          return res.status(200).json({
            path: result.path,
            publicUrl: result.url
          });
        } else {
          throw new Error(result.error || 'Unknown cPanel upload error');
        }
      } catch (err) {
        console.error('❌ Failed to upload file to cPanel:', err.message);
        if (isServerless) {
          return res.status(500).json({ error: 'cPanel upload failed: ' + err.message });
        }
      }
    }

    // Fallback to local storage (development mode)
    if (!isServerless && req.file && req.file.filename) {
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const fileUrl = `${appUrl}/uploads/${req.file.filename}`;
      
      return res.status(200).json({
        path: `uploads/${req.file.filename}`,
        publicUrl: fileUrl
      });
    }

    return res.status(500).json({ error: 'cPanel upload failed and local storage is not available in serverless mode.' });
  } catch (err) {
    console.error('Upload Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 1b. Debug: check what profile_image values are in the DB
app.get('/api/debug-images', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT id, full_name, profile_image FROM members ORDER BY full_name LIMIT 20`
    );
    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    conn.release();
    return res.json({
      uploadsCount: files.length,
      uploadFiles: files.slice(0, 10),
      members: rows.map(r => ({
        id: r.id,
        name: r.full_name,
        profile_image: r.profile_image
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 1c. Repair: scan uploads dir and set profile_image for all matching members
app.post('/api/repair-images', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    // Each file is named: <uuid>-<timestamp>.<ext>
    // UUID is exactly 36 chars: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    let updated = 0;
    for (const file of files) {
      // Extract UUID: first 36 characters
      const possibleUuid = file.slice(0, 36);
      // Validate it looks like a UUID
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(possibleUuid)) continue;

      const photoUrl = `${appUrl}/uploads/${file}`;
      const [result] = await conn.query(
        `UPDATE members SET profile_image = ? WHERE id = ? AND (profile_image IS NULL OR profile_image = '' OR profile_image NOT LIKE '%localhost%')`,
        [photoUrl, possibleUuid]
      );
      if (result.affectedRows > 0) updated++;
    }

    // Also update members that already have a localhost URL (in case port changed)
    const [allFiles] = await conn.query(`SELECT id, profile_image FROM members WHERE profile_image IS NOT NULL`);
    let repointed = 0;
    for (const row of allFiles) {
      if (row.profile_image && row.profile_image.includes('/uploads/')) {
        const filename = row.profile_image.split('/uploads/').pop();
        if (files.includes(filename)) {
          const correctUrl = `${appUrl}/uploads/${filename}`;
          if (row.profile_image !== correctUrl) {
            await conn.query(`UPDATE members SET profile_image = ? WHERE id = ?`, [correctUrl, row.id]);
            repointed++;
          }
        }
      }
    }

    conn.release();
    return res.json({ success: true, newlyMapped: updated, repointed, totalFiles: files.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Mock Edge Function: forgot-pin
app.post('/api/functions/forgot-pin', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Find member by phone number
    const [members] = await pool.query(
      `SELECT id, email, full_name, phone_number, login_pin 
       FROM members 
       WHERE (phone_number = ? OR phone_number = ? OR phone_number = ?) AND status = 'approved' 
       LIMIT 1`,
      [phoneNumber, cleanPhone, `+91${cleanPhone}`]
    );

    if (members.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found or not approved' });
    }

    const member = members[0];
    if (!member.email) {
      return res.status(400).json({ success: false, message: 'No email address found for this member' });
    }

    // Generate 6 digit temporary pin
    const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Update member record with reset pin
    await pool.query(
      'UPDATE members SET reset_pin = ?, reset_pin_expires_at = ? WHERE id = ?',
      [tempPin, expiryTime, member.id]
    );

    // Send email via Mailtrap (or print to console if Mailtrap is not configured)
    const mailtrapToken = process.env.MAILTRAP_TOKEN;
    if (mailtrapToken) {
      const senderEmail = process.env.MAILTRAP_SENDER_EMAIL || 'noreply@yourdomain.com';
      const senderName = process.env.MAILTRAP_SENDER_NAME || 'ITLC Support Team';

      const emailPayload = {
        from: { email: senderEmail, name: senderName },
        to: [{ email: member.email, name: member.full_name }],
        subject: 'Your PIN Reset Code - ITLC Kerala',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px;">PIN Reset Code</h2>
              <p>Hello ${member.full_name},</p>
              <p>You have requested to reset your PIN. Here is your temporary reset code:</p>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; font-family: monospace;">${tempPin}</div>
              <p style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 6px;"><strong>Warning:</strong> This code will expire in 15 minutes.</p>
            </div>
          </div>
        `
      };

      const response = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mailtrapToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send Mailtrap email:', errorText);
      }
    } else {
      console.log(`[DEV MODE] Forgot PIN request for ${member.email}. Temp PIN is: ${tempPin}`);
    }

    return res.status(200).json({
      success: true,
      message: 'PIN reset code sent to your email',
      emailSent: !!mailtrapToken
    });

  } catch (err) {
    console.error('Forgot PIN error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Mock Edge Function: send-event-invites
app.post('/api/functions/send-event-invites', async (req, res) => {
  try {
    const { eventId, chapter, targetEmail, targetPhone } = req.body;

    // Fetch event details
    const [events] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [eventId]);
    if (events.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const event = events[0];

    // Build member query
    let queryStr = 'SELECT id, email, full_name, itlc_chapter_name FROM members WHERE status = "approved" AND email IS NOT NULL';
    const params = [];

    if (targetEmail) {
      queryStr += ' AND email = ?';
      params.push(targetEmail);
    }

    if (targetPhone) {
      const cleanPhone = String(targetPhone).replace(/\D/g, '');
      queryStr += ' AND (phone_number = ? OR phone_number = ? OR phone_number = ?)';
      params.push(targetPhone, cleanPhone, `+91${cleanPhone}`);
    }

    if (chapter && chapter !== 'all') {
      queryStr += ' AND itlc_chapter_name = ?';
      params.push(chapter);
    }

    const [members] = await pool.query(queryStr, params);

    if (members.length === 0) {
      return res.status(400).json({ success: false, message: 'No members found for invitation criteria' });
    }

    const mailtrapToken = process.env.MAILTRAP_TOKEN;
    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';

    if (mailtrapToken) {
      const senderEmail = process.env.MAILTRAP_SENDER_EMAIL || 'noreply@yourdomain.com';
      const senderName = process.env.MAILTRAP_SENDER_NAME || 'ITLC Events Team';

      const emailPromises = members.map(async (member) => {
        const registrationUrl = `${frontendUrl}/event-registration/${event.id}?member=${member.id}`;
        
        const emailPayload = {
          from: { email: senderEmail, name: senderName },
          to: [{ email: member.email, name: member.full_name }],
          subject: `You're Invited: ${event.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                  <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">You're Invited</span>
                  <h1 style="color: #1a1a1a; margin-top: 10px;">Event Invitation</h1>
                </div>
                <p>Dear ${member.full_name},</p>
                <p>We are delighted to invite you to: <strong>${event.title}</strong></p>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <p><strong>Date:</strong> ${event.date}</p>
                  <p><strong>Time:</strong> ${event.time || 'N/A'}</p>
                  <p><strong>Location:</strong> ${event.location || 'N/A'}</p>
                </div>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${registrationUrl}&action=accept" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">✓ Accept Invitation</a>
                  <a href="${registrationUrl}&action=decline" style="background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">✗ Decline</a>
                </p>
              </div>
            </div>
          `
        };

        const response = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mailtrapToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        if (!response.ok) {
          console.error(`Failed to send invite email to ${member.email}`);
        }
      });

      await Promise.all(emailPromises);
    } else {
      console.log(`[DEV MODE] Mailtrap not configured. Printing invites to console:`);
      members.forEach(m => {
        console.log(`- Invite for ${m.full_name} (${m.email}) to event: "${event.title}"`);
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${members.length} invitations`,
      count: members.length
    });

  } catch (err) {
    console.error('Send event invites error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Centralized Query Execution Endpoint (Translates Supabase JS query syntax to MySQL queries)
app.post('/api/query', async (req, res) => {
  const { table, action, select, filters, limit, order, range, data, onConflict, single, maybeSingle, countOnly } = req.body;
  
  if (!table) {
    return res.status(400).json({ error: 'Table is required' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      let sql = '';
      const params = [];

      // A. Build query for SELECT
      if (action === 'select') {
        const selectStr = select || '*';
        const hasEventJoin = selectStr.includes('event:event_id');

        if (hasEventJoin) {
          sql = `SELECT t.*, 
                 e.id as event__id, e.title as event__title, e.description as event__description,
                 e.date as event__date, e.time as event__time, e.location as event__location,
                 e.address as event__address, e.max_registrations as event__max_registrations,
                 e.fee as event__fee, e.auto_share as event__auto_share, e.status as event__status,
                 e.image as event__image, e.created_at as event__created_at, e.updated_at as event__updated_at
                 FROM \`${table}\` t
                 LEFT JOIN events e ON t.event_id = e.id`;
        } else {
          sql = `SELECT * FROM \`${table}\` t`;
        }

        // Apply filters
        const whereClauses = [];
        if (filters && Array.isArray(filters)) {
          for (const filter of filters) {
            if (filter.type === 'eq') {
              if (filter.value === null || filter.value === 'null') {
                whereClauses.push(`t.\`${filter.column}\` IS NULL`);
              } else {
                whereClauses.push(`t.\`${filter.column}\` = ?`);
                params.push(filter.value);
              }
            } else if (filter.type === 'gte') {
              whereClauses.push(`t.\`${filter.column}\` >= ?`);
              params.push(filter.value);
            } else if (filter.type === 'lt') {
              whereClauses.push(`t.\`${filter.column}\` < ?`);
              params.push(filter.value);
            } else if (filter.type === 'not') {
              // Handle "is null" negation
              if (filter.value === null || filter.value === 'null' || (typeof filter.value === 'string' && filter.value.toLowerCase() === 'is.null')) {
                whereClauses.push(`t.\`${filter.column}\` IS NOT NULL`);
              } else {
                whereClauses.push(`t.\`${filter.column}\` != ?`);
                params.push(filter.value);
              }
            } else if (filter.type === 'in') {
              if (Array.isArray(filter.value) && filter.value.length > 0) {
                const placeholders = filter.value.map(() => '?').join(', ');
                whereClauses.push(`t.\`${filter.column}\` IN (${placeholders})`);
                params.push(...filter.value);
              } else {
                // Return empty if empty array
                whereClauses.push('1 = 0');
              }
            } else if (filter.type === 'or') {
              // Split on comma but NOT inside values — Supabase OR strings use:
              // "col.op.val,col.op.val" where val may contain dots (emails) or % (ilike)
              // We split on the pattern ",<col>." to avoid splitting values
              const rawParts = filter.value.split(/,(?=[a-zA-Z0-9_]+\.)/);
              const conditions = [];
              for (const part of rawParts) {
                // Match: columnName.operator.value  (value may contain dots/%)
                const match = part.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z]+)\.(.+)$/);
                if (match) {
                  const [_, col, op, val] = match;
                  if (op === 'eq') {
                    conditions.push(`t.\`${col}\` = ?`);
                    params.push(val);
                  } else if (op === 'ilike') {
                    conditions.push(`t.\`${col}\` LIKE ?`);
                    params.push(val);
                  } else if (op === 'is' && val === 'null') {
                    conditions.push(`t.\`${col}\` IS NULL`);
                  }
                }
              }
              if (conditions.length > 0) {
                whereClauses.push(`(${conditions.join(' OR ')})`);
              }
            }
          }
        }

        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        // Apply order
        if (order) {
          const { column, ascending } = order;
          sql += ` ORDER BY t.\`${column}\` ${ascending ? 'ASC' : 'DESC'}`;
        }

        // Snapshot params before LIMIT/OFFSET is appended (used for COUNT queries)
        const filterParams = [...params];

        // Apply limit/range
        if (range) {
          const { from, to } = range;
          const limitCount = to - from + 1;
          sql += ` LIMIT ? OFFSET ?`;
          params.push(limitCount, from);
        } else if (limit) {
          sql += ` LIMIT ?`;
          params.push(limit);
        }

        const [rows] = await connection.query(sql, params);
        let resultData = rows;

        // Shape join objects if required
        if (hasEventJoin) {
          resultData = rows.map(row => {
            const newRow = { ...row };
            if (row.event__id) {
              newRow.event = {
                id: row.event__id,
                title: row.event__title,
                description: row.event__description,
                date: row.event__date,
                time: row.event__time,
                location: row.event__location,
                address: row.event__address,
                max_registrations: row.event__max_registrations,
                fee: row.event__fee,
                auto_share: row.event__auto_share,
                status: row.event__status,
                image: row.event__image,
                created_at: row.event__created_at,
                updated_at: row.event__updated_at
              };
            } else {
              newRow.event = null;
            }
            // Delete prefixes
            Object.keys(newRow).forEach(k => {
              if (k.startsWith('event__')) delete newRow[k];
            });
            return newRow;
          });
        }

        if (countOnly) {
          // Run a COUNT(*) with only filter conditions (no LIMIT)
          const whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
          const [countRows] = await connection.query(
            `SELECT COUNT(*) as cnt FROM \`${table}\` t${whereStr}`,
            filterParams
          );
          return res.status(200).json(countRows[0]?.cnt ?? 0);
        }

        if (single || maybeSingle) {
          return res.status(200).json(resultData[0] || null);
        }
        return res.status(200).json(resultData);
      }

      // B. Build query for INSERT
      else if (action === 'insert') {
        const insertRows = Array.isArray(data) ? data : [data];
        const insertedResults = [];

        for (const rawRow of insertRows) {
          let row = { ...rawRow };
          if (!row.id) {
            row.id = uuidv4();
          }
          row = await processBase64FieldsAsync(row, row.id);

          const columns = Object.keys(row).map(c => `\`${c}\``).join(', ');
          const placeholders = Object.keys(row).map(() => '?').join(', ');
          const values = Object.values(row);

          sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
          await connection.query(sql, values);

          // Retrieve inserted row to return
          const [inserted] = await connection.query(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [row.id]);
          if (inserted.length > 0) {
            insertedResults.push(inserted[0]);
          }
        }

        return res.status(200).json(Array.isArray(data) ? insertedResults : insertedResults[0] || null);
      }

      // C. Build query for UPDATE
      // C. Build query for UPDATE
      else if (action === 'update') {
        const pkColumn = table === 'app_settings' ? 'setting_key' : 'id';
        const updatedData = await processBase64FieldsAsync(data, table);

        const updateKeys = Object.keys(updatedData).map(k => `\`${k}\` = ?`).join(', ');
        const updateValues = Object.values(updatedData);

        // Apply filters to find targets
        const whereClauses = [];
        const filterParams = [];

        if (filters && Array.isArray(filters)) {
          for (const filter of filters) {
            if (filter.type === 'eq') {
              whereClauses.push(`\`${filter.column}\` = ?`);
              filterParams.push(filter.value);
            }
          }
        }

        if (whereClauses.length === 0) {
          return res.status(400).json({ error: 'Update requests must contain filter conditions' });
        }

        // Get matching record IDs before update to retrieve them afterward
        const selectSql = `SELECT \`${pkColumn}\` FROM \`${table}\` WHERE ${whereClauses.join(' AND ')}`;
        const [matchingRows] = await connection.query(selectSql, filterParams);

        if (matchingRows.length === 0) {
          return res.status(200).json([]);
        }

        const idsToUpdate = matchingRows.map(r => r[pkColumn]);

        sql = `UPDATE \`${table}\` SET ${updateKeys} WHERE \`${pkColumn}\` IN (${idsToUpdate.map(() => '?').join(', ')})`;
        await connection.query(sql, [...updateValues, ...idsToUpdate]);

        // Retrieve updated rows
        const [updatedRows] = await connection.query(`SELECT * FROM \`${table}\` WHERE \`${pkColumn}\` IN (${idsToUpdate.map(() => '?').join(', ')})`, idsToUpdate);
        return res.status(200).json(updatedRows);
      }

      // D. Build query for UPSERT
      else if (action === 'upsert') {
        const pkColumn = table === 'app_settings' ? 'setting_key' : 'id';
        const upsertRows = Array.isArray(data) ? data : [data];
        const upsertedResults = [];

        for (const rawRow of upsertRows) {
          let row = { ...rawRow };
          if (pkColumn === 'id' && !row.id) {
            row.id = uuidv4();
          }
          row = await processBase64FieldsAsync(row, row.id || row.setting_key);

          const columns = Object.keys(row).map(c => `\`${c}\``).join(', ');
          const placeholders = Object.keys(row).map(() => '?').join(', ');
          const values = Object.values(row);

          const updateClauses = Object.keys(row)
            .filter(k => k !== pkColumn)
            .map(k => `\`${k}\` = VALUES(\`${k}\`)`)
            .join(', ');

          sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
          if (updateClauses) {
            sql += ` ON DUPLICATE KEY UPDATE ${updateClauses}`;
          }

          await connection.query(sql, [...values]);

          // Retrieve updated/inserted row
          const [resultRow] = await connection.query(`SELECT * FROM \`${table}\` WHERE \`${pkColumn}\` = ? LIMIT 1`, [row[pkColumn]]);
          if (resultRow.length > 0) {
            upsertedResults.push(resultRow[0]);
          }
        }

        return res.status(200).json(Array.isArray(data) ? upsertedResults : upsertedResults[0] || null);
      }

      // E. Build query for DELETE
      else if (action === 'delete') {
        const whereClauses = [];
        const deleteParams = [];

        if (filters && Array.isArray(filters)) {
          for (const filter of filters) {
            if (filter.type === 'eq') {
              whereClauses.push(`\`${filter.column}\` = ?`);
              deleteParams.push(filter.value);
            }
          }
        }

        if (whereClauses.length === 0) {
          return res.status(400).json({ error: 'Delete requests must contain filter conditions' });
        }

        sql = `DELETE FROM \`${table}\` WHERE ${whereClauses.join(' AND ')}`;
        const [result] = await connection.query(sql, deleteParams);

        return res.status(200).json({ success: true, affectedRows: result.affectedRows });
      }

      else {
        return res.status(400).json({ error: `Unsupported query action: ${action}` });
      }

    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Database Query Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// --- LinkedIn Auth & Sharing Routes ---

app.get('/api/linkedin/login', (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  if (!clientId) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Configuration Required</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #334155; }
          .card { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
          h1 { color: #0a66c2; font-size: 22px; margin-bottom: 12px; }
          p { font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 0; }
          code { background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #0f172a; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>LinkedIn Configuration Required</h1>
          <p>Please define your <code>LINKEDIN_CLIENT_ID</code> and <code>LINKEDIN_CLIENT_SECRET</code> variables in the backend <code>.env</code> file, then restart your server to enable sharing.</p>
        </div>
      </body>
      </html>
    `);
  }
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const redirectUri = `${appUrl}/api/linkedin/callback`;
  const state = uuidv4();
  const scope = 'openid profile w_member_social';
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
  res.redirect(authUrl);
});

app.get('/api/linkedin/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID || '';
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${appUrl}/api/linkedin/callback`;

    // 1. Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`LinkedIn token exchange failed: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json();

    // 2. Fetch profile userinfo (openid/profile scope) to get member URN and profile info
    const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userResponse.ok) {
      throw new Error(`LinkedIn userinfo failed: ${await userResponse.text()}`);
    }

    const userData = await userResponse.json();
    const urn = `urn:li:person:${userData.sub}`;
    const name = userData.name || `${userData.given_name || ''} ${userData.family_name || ''}`.trim() || 'LinkedIn User';

    // 3. Render HTML that posts success message to parent window and closes itself
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>LinkedIn Authentication Success</title></head>
      <body>
        <p>Authentication successful! Closing window...</p>
        <script>
          window.opener.postMessage({
            type: 'LINKEDIN_LOGIN_SUCCESS',
            payload: {
              token: ${JSON.stringify(tokenData.access_token)},
              urn: ${JSON.stringify(urn)},
              name: ${JSON.stringify(name)}
            }
          }, '*');
          window.close();
        </script>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error('LinkedIn Callback Error:', err.message);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

app.post('/api/linkedin/share', async (req, res) => {
  try {
    const { token, urn, text, image } = req.body;
    if (!token || !urn || !image) {
      return res.status(400).json({ error: 'Missing required parameters: token, urn, or image' });
    }

    // 1. Convert base64 image data to binary buffer
    const cleanStr = image.trim();
    if (!cleanStr.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format, must be base64 data URL' });
    }

    const semiColonIndex = cleanStr.indexOf(';base64,');
    if (semiColonIndex === -1) {
      return res.status(400).json({ error: 'Invalid base64 payload' });
    }
    const base64Data = cleanStr.substring(semiColonIndex + 8).replace(/\s/g, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 2. Register upload on LinkedIn
    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: urn
        }
      })
    });

    if (!registerResponse.ok) {
      throw new Error(`LinkedIn registerUpload failed: ${await registerResponse.text()}`);
    }

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const assetUrn = registerData.value.asset;

    // 3. Upload image binary
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: imageBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`LinkedIn image binary upload failed: ${await uploadResponse.text()}`);
    }

    // 4. Create feed share post
    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        author: urn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: text || 'I am proud to participate in this event!'
            },
            shareMediaCategory: 'IMAGE',
            media: [
              {
                status: 'READY',
                description: {
                  text: 'ITLC Certificate'
                },
                media: assetUrn,
                title: {
                  text: 'Certificate of Participation'
                }
              }
            ]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      })
    });

    if (!postResponse.ok) {
      throw new Error(`LinkedIn post share failed: ${await postResponse.text()}`);
    }

    const postData = await postResponse.json();
    return res.status(200).json({ success: true, post: postData });
  } catch (err) {
    console.error('LinkedIn Share Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});


// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Auto-repair profile images on startup
async function repairProfileImages() {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const conn = await pool.getConnection();

    // 1. Repair Base64 Images stored directly in the DB
    let b64Saved = 0;

    // A. members table
    const [membersB64Rows] = await conn.query(
      `SELECT id, profile_image FROM members WHERE profile_image LIKE 'data:image/%'`
    );
    for (const row of membersB64Rows) {
      try {
        const filename = saveBase64ToFile(row.profile_image, row.id);
        if (filename) {
          const newUrl = `${appUrl}/uploads/${filename}`;
          await conn.query(`UPDATE members SET profile_image = ? WHERE id = ?`, [newUrl, row.id]);
          b64Saved++;
        }
      } catch (err) {
        console.error(`Failed to decode base64 for member ${row.id}:`, err.message);
      }
    }

    // B. event_registrations table
    const [regB64Rows] = await conn.query(
      `SELECT id, guest_profile_image FROM event_registrations WHERE guest_profile_image LIKE 'data:image/%'`
    );
    for (const row of regB64Rows) {
      try {
        const filename = saveBase64ToFile(row.guest_profile_image, row.id);
        if (filename) {
          const newUrl = `${appUrl}/uploads/${filename}`;
          await conn.query(`UPDATE event_registrations SET guest_profile_image = ? WHERE id = ?`, [newUrl, row.id]);
          b64Saved++;
        }
      } catch (err) {
        console.error(`Failed to decode base64 for event registration ${row.id}:`, err.message);
      }
    }

    // C. events table
    const [eventsB64Rows] = await conn.query(
      `SELECT id, image FROM events WHERE image LIKE 'data:image/%'`
    );
    for (const row of eventsB64Rows) {
      try {
        const filename = saveBase64ToFile(row.image, row.id);
        if (filename) {
          const newUrl = `${appUrl}/uploads/${filename}`;
          await conn.query(`UPDATE events SET image = ? WHERE id = ?`, [newUrl, row.id]);
          b64Saved++;
        }
      } catch (err) {
        console.error(`Failed to decode base64 for event ${row.id}:`, err.message);
      }
    }

    // 2. Map existing upload files to records who have no image
    const files = fs.readdirSync(uploadsDir);
    let mapped = 0;
    for (const file of files) {
      const possibleUuid = file.slice(0, 36);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(possibleUuid)) continue;

      const photoUrl = `${appUrl}/uploads/${file}`;

      // Update members
      const [mResult] = await conn.query(
        `UPDATE members SET profile_image = ? WHERE id = ? AND (profile_image IS NULL OR profile_image = '')`,
        [photoUrl, possibleUuid]
      );
      if (mResult.affectedRows > 0) {
        mapped++;
        continue;
      }

      // Update event registrations guest_profile_image
      const [rResult] = await conn.query(
        `UPDATE event_registrations SET guest_profile_image = ? WHERE id = ? AND (guest_profile_image IS NULL OR guest_profile_image = '')`,
        [photoUrl, possibleUuid]
      );
      if (rResult.affectedRows > 0) {
        mapped++;
        continue;
      }

      // Update events image
      const [eResult] = await conn.query(
        `UPDATE events SET image = ? WHERE id = ? AND (image IS NULL OR image = '')`,
        [photoUrl, possibleUuid]
      );
      if (eResult.affectedRows > 0) {
        mapped++;
      }
    }

    // 3. Fix port/url mismatches
    let fixed = 0;

    // A. members
    const [existingMembers] = await conn.query(
      `SELECT id, profile_image FROM members WHERE profile_image IS NOT NULL AND profile_image LIKE '%/uploads/%'`
    );
    for (const row of existingMembers) {
      const filename = row.profile_image.split('/uploads/').pop();
      if (files.includes(filename)) {
        const correctUrl = `${appUrl}/uploads/${filename}`;
        if (row.profile_image !== correctUrl) {
          await conn.query(`UPDATE members SET profile_image = ? WHERE id = ?`, [correctUrl, row.id]);
          fixed++;
        }
      }
    }

    // B. event_registrations
    const [existingRegs] = await conn.query(
      `SELECT id, guest_profile_image FROM event_registrations WHERE guest_profile_image IS NOT NULL AND guest_profile_image LIKE '%/uploads/%'`
    );
    for (const row of existingRegs) {
      const filename = row.guest_profile_image.split('/uploads/').pop();
      if (files.includes(filename)) {
        const correctUrl = `${appUrl}/uploads/${filename}`;
        if (row.guest_profile_image !== correctUrl) {
          await conn.query(`UPDATE event_registrations SET guest_profile_image = ? WHERE id = ?`, [correctUrl, row.id]);
          fixed++;
        }
      }
    }

    // C. events
    const [existingEvents] = await conn.query(
      `SELECT id, image FROM events WHERE image IS NOT NULL AND image LIKE '%/uploads/%'`
    );
    for (const row of existingEvents) {
      const filename = row.image.split('/uploads/').pop();
      if (files.includes(filename)) {
        const correctUrl = `${appUrl}/uploads/${filename}`;
        if (row.image !== correctUrl) {
          await conn.query(`UPDATE events SET image = ? WHERE id = ?`, [correctUrl, row.id]);
          fixed++;
        }
      }
    }

    // 4. Clean up invalid legacy Supabase URLs that couldn't be migrated/mapped
    let cleanedInvalid = 0;

    // A. members
    const [invalidMembers] = await conn.query(
      `SELECT id, profile_image FROM members WHERE profile_image LIKE '%supabase.co%'`
    );
    for (const row of invalidMembers) {
      await conn.query(`UPDATE members SET profile_image = NULL WHERE id = ?`, [row.id]);
      cleanedInvalid++;
    }

    // B. event_registrations
    const [invalidRegs] = await conn.query(
      `SELECT id, guest_profile_image FROM event_registrations WHERE guest_profile_image LIKE '%supabase.co%'`
    );
    for (const row of invalidRegs) {
      await conn.query(`UPDATE event_registrations SET guest_profile_image = NULL WHERE id = ?`, [row.id]);
      cleanedInvalid++;
    }

    // C. events
    const [invalidEvents] = await conn.query(
      `SELECT id, image FROM events WHERE image LIKE '%supabase.co%'`
    );
    for (const row of invalidEvents) {
      await conn.query(`UPDATE events SET image = NULL WHERE id = ?`, [row.id]);
      cleanedInvalid++;
    }

    conn.release();
    console.log(`🖼️ Profile image repair: ${b64Saved} base64 converted, ${mapped} newly mapped, ${fixed} URLs corrected, ${cleanedInvalid} legacy Supabase URLs cleaned.`);
  } catch (err) {
    console.error('⚠️ Profile image repair failed:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`ITLC Backend Server running on port ${PORT}`);
  if (!isServerless) {
    await repairProfileImages();
  } else {
    console.log('🚀 Serverless/Production mode: Skipping startup profile image repair scan.');
  }
});

