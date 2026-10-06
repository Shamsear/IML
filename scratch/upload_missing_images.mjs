import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function uploadFileToImageKit(filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64File = fileBuffer.toString('base64');
  
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const authHeader = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');
  
  const formData = new FormData();
  formData.append('file', base64File);
  formData.append('fileName', fileName);
  formData.append('folder', '/sadia_products');
  formData.append('useUniqueFileName', 'false');

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': authHeader
    },
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.url;
}

async function run() {
  const items = [
    { id: 'PROD-SAD-106', file: 'public/uploads/products/PROD-SAD-106.png', name: 'PROD-SAD-106.png' },
    { id: 'PROD-SAD-109', file: 'public/uploads/products/PROD-SAD-109.png', name: 'PROD-SAD-109.png' },
  ];

  for (const item of items) {
    if (fs.existsSync(item.file)) {
      console.log(`Uploading ${item.file} to ImageKit...`);
      try {
        const url = await uploadFileToImageKit(item.file, item.name);
        console.log(`Uploaded ${item.id} successfully: ${url}`);
        await pool.query('UPDATE "Product" SET "imageUrl" = $1 WHERE id = $2', [url, item.id]);
        console.log(`Updated database record for ${item.id}`);
      } catch (err) {
        console.error(`Error uploading ${item.id}:`, err);
      }
    } else {
      console.log(`File ${item.file} does not exist.`);
    }
  }
}

run().catch(console.error).finally(() => pool.end());
