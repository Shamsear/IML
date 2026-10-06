import { NextResponse } from 'next/server';
import os from 'os';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EventEmitter } from 'events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

if (!global.scanEmitter) {
  global.scanEmitter = new EventEmitter();
  global.scanEmitter.setMaxListeners(100);
}

// Helper to get local IP address of the server host PC (dev only)
function getLocalIpAddress() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_IP_DISCLOSURE) {
    return null;
  }
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
  // Only authenticated staff/admin can generate new scanning sessions
  const authSession = await getServerSession(authOptions);
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = authSession.user?.role?.toUpperCase();
  if (role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY') {
    return NextResponse.json({ error: 'Forbidden: Read-only accounts cannot initiate scanning sessions' }, { status: 403 });
  }

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

  // Cryptographically secure 12-character hex ID (e.g. "A7F93C4E12B8")
  const sessionId = crypto.randomBytes(6).toString('hex').toUpperCase();
  
  await prisma.scanSession.create({
    data: {
      id: sessionId,
      barcodes: []
    }
  });

  const localIp = getLocalIpAddress();
  
  // Return session details
  return NextResponse.json({
    sessionId,
    localIp,
    port: process.env.PORT || '3000'
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId')?.toUpperCase();
  const checkOnly = searchParams.get('checkOnly') === 'true';

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  // Reading barcodes requires an authenticated session (desktop dashboard)
  if (!checkOnly) {
    const authSession = await getServerSession(authOptions);
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const session = await prisma.scanSession.findUnique({
      where: { id: sessionId },
      select: { barcodes: true }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired', exists: false }, { status: 404 });
    }

    if (checkOnly) {
      return NextResponse.json({ exists: true });
    }

    await prisma.scanSession.update({
      where: { id: sessionId },
      data: { barcodes: [] }
    });

    return NextResponse.json({ barcodes: session.barcodes || [] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
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

    if (barcode.length > 100) {
      return NextResponse.json({ error: 'Barcode value exceeds maximum allowed length of 100 characters' }, { status: 400 });
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

    // Broadcast scan event to SSE listeners
    global.scanEmitter.emit(`scan:${cleanSessionId}`, barcode.trim());

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Submit barcode error:', e);
    return NextResponse.json({ error: 'Failed to submit barcode' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId')?.toUpperCase();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    await prisma.scanSession.deleteMany({
      where: { id: sessionId }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Delete scan session error:', e);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
