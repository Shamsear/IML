import crypto from 'crypto';

function getJwtSecret() {
  return process.env.NEXTAUTH_SECRET || 'fallback-brand-portal-secret-key-12345';
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString();
}

/**
 * Generates an optimized, short HS256 JWT token for a brand.
 * @param {string} brandId 
 * @param {string} brandName 
 * @returns {string} Signed JWT token (compact length ~87 chars)
 */
export function generateBrandJWT(brandId, brandName) {
  const header = {
    alg: 'HS256'
  };
  const payload = {
    b: brandId // compact key for brandId
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

/**
 * Verifies a brand's JWT token and returns the parsed payload.
 * @param {string} token 
 * @returns {object|null} Parsed payload with brandId if valid, otherwise null
 */
export function verifyBrandJWT(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    const signatureInput = `${header}.${payload}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(signatureInput)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
      
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    return {
      brandId: decodedPayload.b
    };
  } catch (e) {
    return null;
  }
}
