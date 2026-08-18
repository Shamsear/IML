/**
 * Generate the correct scan companion URL for mobile devices
 * Uses production URL in production, local IP in development
 */
export function getScanCompanionUrl(sessionId, localIp, port) {
  // In production, use the actual domain
  if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_URL) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${baseUrl}/scan-companion?session=${sessionId}`;
  }
  
  // In development, use local IP for LAN access
  return `http://${localIp}:${port}/scan-companion?session=${sessionId}`;
}

/**
 * Client-side version that works in the browser
 */
export function getClientScanCompanionUrl(sessionId, localIp, port) {
  // Check if we're in production by looking at the hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If hostname is a domain (not localhost or IP), use the current origin
    if (hostname !== 'localhost' && !hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
      return `${window.location.origin}/scan-companion?session=${sessionId}`;
    }
  }
  
  // Otherwise use local IP
  return `http://${localIp}:${port}/scan-companion?session=${sessionId}`;
}
