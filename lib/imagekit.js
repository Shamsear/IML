import { Buffer } from 'buffer';

export async function uploadToImageKit(file) {
  if (!file || typeof file === 'string' || !file.name || file.size === 0) {
    return null;
  }

  // Read array buffer and transform to Base64
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64File = buffer.toString('base64');

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!privateKey || !urlEndpoint) {
    throw new Error('ImageKit credentials are not configured in environment variables.');
  }

  // Create multipart/form-data payload
  const formData = new FormData();
  formData.append('file', base64File);
  formData.append('fileName', `${Date.now()}-${file.name.replace(/\s+/g, '_')}`);
  formData.append('useUniqueFileName', 'true');

  // Authorize using Basic Auth (privateKey as username, blank password)
  const authHeader = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': authHeader
    },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ImageKit upload failed: ${errText}`);
  }

  const data = await res.json();
  return data.url; // Returns the optimized CDN URL (e.g. https://ik.imagekit.io/iml/filename.png)
}
