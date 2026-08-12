import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const { filename } = await params;

  // Prevent directory traversal attacks by extracting only the base name
  const safeFilename = path.basename(filename);
  const filePath = path.join(process.cwd(), 'public', 'uploads', safeFilename);

  if (!fs.existsSync(filePath)) {
    return new Response('File not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  // Detect MIME type based on file extension
  let contentType = 'application/octet-stream';
  if (safeFilename.endsWith('.jpg') || safeFilename.endsWith('.jpeg')) {
    contentType = 'image/jpeg';
  } else if (safeFilename.endsWith('.png')) {
    contentType = 'image/png';
  } else if (safeFilename.endsWith('.gif')) {
    contentType = 'image/gif';
  } else if (safeFilename.endsWith('.webp')) {
    contentType = 'image/webp';
  } else if (safeFilename.endsWith('.svg')) {
    contentType = 'image/svg+xml';
  }

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
