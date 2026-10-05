import crypto from 'crypto';

function getJwtSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required.');
  }
  return secret;
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
 * Generates an HS256 JWT token for a brand portal.
 * @param {string} brandId
 * @param {string} brandName
 * @param {number} [expiresInDays=30]
 * @returns {string} Signed JWT token
 */
export function generateBrandJWT(brandId, brandName, expiresInDays = 30) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const payload = {
    b: brandId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60),
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
 * Verifies a brand's JWT token signature and returns the parsed payload.
 * Validates HS256 algorithm and uses constant-time comparison against timing attacks.
 * @param {string} token
 * @returns {object|null} Parsed payload with brandId if valid, otherwise null
 */
export function verifyBrandJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    
    // Verify header algorithm
    const parsedHeader = JSON.parse(base64UrlDecode(header));
    if (parsedHeader?.alg !== 'HS256') {
      return null;
    }

    const signatureInput = `${header}.${payload}`;

    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(signatureInput)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // Constant-time signature comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decodedPayload = JSON.parse(base64UrlDecode(payload));

    // If token has expiration, verify it
    if (decodedPayload.exp && typeof decodedPayload.exp === 'number') {
      if (Math.floor(Date.now() / 1000) > decodedPayload.exp) {
        return null;
      }
    }

    return {
      brandId: decodedPayload.b,
    };
  } catch (e) {
    return null;
  }
}


