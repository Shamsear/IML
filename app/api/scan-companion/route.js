import { NextResponse } from 'next/server';
import os from 'os';
import { prisma } from '@/lib/prisma';

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
  // Clear old sessions older than 2 hours to avoid db clutter
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.scanSession.deleteMany({
      where: {
        createdAt: { lt: twoHoursAgo }
      }
    });
  } catch (e) {
    console.error("Cleanup scan sessions failed:", e);
  }

  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g. "K7A9X2"
  
  await prisma.scanSession.create({
    data: {
      id: sessionId,
      barcodes: []
    }
  });

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

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  const session = await prisma.scanSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  const barcodes = session.barcodes || [];
  
  // Atomically clear barcodes queue
  await prisma.scanSession.update({
    where: { id: sessionId },
    data: { barcodes: [] }
  });

  return NextResponse.json({ barcodes });
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { sessionId, barcode } = body;
    const cleanSessionId = sessionId?.toUpperCase();

    if (!cleanSessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const session = await prisma.scanSession.findUnique({
      where: { id: cleanSessionId }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    if (!barcode || !barcode.trim()) {
      return NextResponse.json({ error: 'Invalid barcode value' }, { status: 400 });
    }

    // Append barcode to the session's barcodes array
    await prisma.scanSession.update({
      where: { id: cleanSessionId },
      data: {
        barcodes: {
          push: barcode.trim()
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
