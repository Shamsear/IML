import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendPushBroadcast, checkAndSendAutomatedAlerts } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, message, url, tag, checkAlerts } = body;

    // If request asks to check automated alerts (expiry + overdue uniforms)
    if (checkAlerts) {
      const result = await checkAndSendAutomatedAlerts();
      return NextResponse.json(result);
    }

    if (!title || !message) {
      return new NextResponse('Missing title or message content', { status: 400 });
    }

    const result = await sendPushBroadcast({ title, message, url, tag });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Send Push Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
