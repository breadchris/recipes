import * as fs from 'fs';
import * as path from 'path';
import { put } from '@vercel/blob';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

const DATA_FILE = path.join(__dirname, '../data/recipes-data.json.gz');

async function uploadToBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required');
    console.error('Get it from: https://vercel.com/dashboard/stores');
    process.exit(1);
  }

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Error: Data file not found at ${DATA_FILE}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(DATA_FILE);
  const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`Uploading recipes-data.json.gz (${fileSizeMB} MB)...`);

  const blob = await put('recipes-data.json.gz', fileBuffer, {
    access: 'public',
    contentType: 'application/gzip',
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log('\nUpload complete!');
  console.log(`URL: ${blob.url}`);
  console.log('\nAdd this to your Vercel environment variables:');
  console.log(`RECIPES_DATA_URL=${blob.url}`);
}

uploadToBlob().catch(console.error);
