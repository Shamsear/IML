import { NextResponse } from 'next/server';
import { EventEmitter } from 'events';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


// Create a globally accessible event emitter in Next.js to broadcast scan events
if (!global.scanEmitter) {
  global.scanEmitter = new EventEmitter();
  global.scanEmitter.setMaxListeners(100);
}
const scanEmitter = global.scanEmitter;

export async function GET(request) {
  // Only authenticated staff/admin can stream scan events
  const authSession = await getServerSession(authOptions);
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const stream = new ReadableStream({
    start(controller) {
      const onScan = (barcode) => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ barcode })}\n\n`);
        } catch (e) {
          console.error("SSE enqueue error:", e);
        }
      };

      scanEmitter.on(`scan:${sessionId}`, onScan);

      request.signal.addEventListener('abort', () => {
        scanEmitter.off(`scan:${sessionId}`, onScan);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
