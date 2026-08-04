import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, 'uploads');
const UPLOAD_URL = 'https://gravity-innovations.com/itlc/upload.php';

async function syncFiles() {
  const files = fs.readdirSync(uploadsDir);
  console.log(`Found ${files.length} local files in backend/uploads to sync...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(uploadsDir, filename);

    if (!fs.lstatSync(filePath).isFile()) continue;

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const folder = filename.toLowerCase().includes('event') ? 'events' : 'members';

    try {
      const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64: base64Data,
          filename: filename,
          folder: folder
        })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          successCount++;
          console.log(`[${i + 1}/${files.length}] ✅ Uploaded ${filename} -> ${resData.url}`);
        } else {
          failCount++;
          console.error(`[${i + 1}/${files.length}] ❌ Failed ${filename}: ${resData.error}`);
        }
      } else {
        failCount++;
        console.error(`[${i + 1}/${files.length}] ❌ HTTP ${response.status} for ${filename}`);
      }
    } catch (err) {
      failCount++;
      console.error(`[${i + 1}/${files.length}] ❌ Error uploading ${filename}: ${err.message}`);
    }
  }

  console.log(`Sync complete! ${successCount} uploaded successfully, ${failCount} failed.`);
}

syncFiles();
