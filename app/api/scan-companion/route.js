import { NextResponse } from 'next/server';
import os from 'os';

if (!global.scanSessions) {
  global.scanSessions = {};
}
const sessions = global.scanSessions;

// Helper to get local IP address of the server host PC
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

export async function POST() {
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g. "K7A9X2"
  sessions[sessionId] = {
    barcodes: [],
    createdAt: Date.now(),
    lastPolledAt: Date.now()
  };

  const localIp = getLocalIpAddress();
  
  // Return session details including local IP and port (default to 3000)
  return NextResponse.json({
    sessionId,
    localIp,
    port: process.env.PORT || '3000'
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId')?.toUpperCase();

  if (!sessionId || !sessions[sessionId]) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  const session = sessions[sessionId];
  session.lastPolledAt = Date.now();
  
  // Get and clear barcodes from queue
  const barcodes = [...session.barcodes];
  session.barcodes = [];

  return NextResponse.json({ barcodes });
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { sessionId, barcode } = body;
    const cleanSessionId = sessionId?.toUpperCase();

    if (!cleanSessionId || !sessions[cleanSessionId]) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    if (!barcode || !barcode.trim()) {
      return NextResponse.json({ error: 'Invalid barcode value' }, { status: 400 });
    }

    sessions[cleanSessionId].barcodes.push(barcode.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
