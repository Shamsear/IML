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

    // Custom broadcasts require ADMIN role
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required for custom push broadcasts' }, { status: 403 });
    }

    if (!title || !message) {
      return new NextResponse('Missing title or message content', { status: 400 });
    }

    // Validate URL to prevent phishing / external redirects
    let safeUrl = '/dashboard';
    if (url && typeof url === 'string') {
      const trimmed = url.trim();
      if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes(':')) {
        safeUrl = trimmed;
      }
    }

    const result = await sendPushBroadcast({ title, message, url: safeUrl, tag });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Send Push Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
