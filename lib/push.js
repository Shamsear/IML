import { prisma } from '@/lib/prisma';

let webpushInstance = null;

async function getWebPush() {
  if (webpushInstance) return webpushInstance;
  try {
    const mod = await import('web-push');
    webpushInstance = mod.default || mod;
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpushInstance.setVapidDetails(
        'mailto:logistics@imlme.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    }
    return webpushInstance;
  } catch (err) {
    console.error('[WebPush Init Error]:', err);
    return null;
  }
}

/**
 * Broadcasts a push notification to all active browser subscribers.
 * Automatically purges stale/unsubscribed endpoints (410, 404).
 */
export async function sendPushBroadcast({ title, message, url = '/dashboard', tag, actions = [] }) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { success: false, reason: 'VAPID keys not configured' };
  }

  const webpush = await getWebPush();
  if (!webpush) {
    return { success: false, reason: 'WebPush module failed to load' };
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const payload = JSON.stringify({
      title,
      message,
      body: message,
      url,
      tag: tag || 'inventory-alert',
      actions,
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, payload);
      } catch (error) {
        // Remove expired or unsubscribed clients
        if (error.statusCode === 410 || error.statusCode === 404) {
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          } catch (delErr) {
            // Ignore if already deleted
          }
        }
      }
    });

    await Promise.all(sendPromises);
    return { success: true, sentCount: subscriptions.length };
  } catch (error) {
    console.error('[Push Notification Broadcast Error]:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a real-time transaction notification for Inbound, Outbound, Returns, Damages, etc.
 */
export async function notifyTransaction({ type, productName, quantity, deliveryNote, destinationOrSource, brandName }) {
  let title = 'Inventory Transaction Logged';
  let message = `${quantity}x ${productName || 'Item'}`;
  let url = '/dashboard/transactions';

  switch (type) {
    case 'RECEIVE':
      title = `📥 Inbound Received: ${brandName ? `[${brandName}]` : ''}`;
      message = `Received ${quantity} units of ${productName}${deliveryNote ? ` (DN: ${deliveryNote})` : ''}${destinationOrSource ? ` from ${destinationOrSource}` : ''}.`;
      url = '/dashboard/inbound';
      break;
    case 'ISSUE':
      title = `📤 Outbound Dispatched: ${brandName ? `[${brandName}]` : ''}`;
      message = `Dispatched ${quantity} units of ${productName}${destinationOrSource ? ` to ${destinationOrSource}` : ''}${deliveryNote ? ` (DN: ${deliveryNote})` : ''}.`;
      url = '/dashboard/outbound';
      break;
    case 'RETURN':
      title = `🔄 Stock Returned: ${brandName ? `[${brandName}]` : ''}`;
      message = `Returned ${quantity} units of ${productName}${destinationOrSource ? ` from ${destinationOrSource}` : ''}.`;
      url = '/dashboard/returns';
      break;
    case 'DAMAGE':
      title = `⚠️ Stock Damage Reported`;
      message = `${quantity} units of ${productName} marked as damaged.`;
      url = '/dashboard/damage';
      break;
    case 'LOST':
      title = `🚨 Stock Loss Reported`;
      message = `${quantity} units of ${productName} reported as missing/lost.`;
      url = '/dashboard/loss';
      break;
    case 'CLIENT_RETURN':
      title = `📦 Client Return Received`;
      message = `${quantity} units of ${productName} received back from client possession.`;
      url = '/dashboard/client-returns';
      break;
    default:
      message = `${type} of ${quantity} units of ${productName}.`;
      break;
  }

  // Fire asynchronously in background
  sendPushBroadcast({
    title,
    message,
    url,
    tag: `tx-${type.toLowerCase()}`,
  }).catch((err) => console.error('[Push Notification Error]:', err));
}

/**
 * Checks for overdue staff uniform allocations and near-expiry products and sends automated summary push alerts.
 */
export async function checkAndSendAutomatedAlerts() {
  const alerts = [];

  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [expiringBatches, allStaff] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: {
          transactionType: { in: ['RECEIVE', 'RETURN'] },
          expiryDate: {
            not: null,
            lte: thirtyDaysFromNow,
          },
        },
        include: {
          product: {
            select: { name: true, brand: { select: { name: true } } },
          },
        },
        take: 10,
      }),
      prisma.staff.findMany({
        where: {
          allocations: {
            some: {
              OR: [
                { uniformReturned: false, uniformQty: { gt: 0 } },
                { capReturned: false, capQty: { gt: 0 } },
                { returnDate: null }
              ]
            }
          }
        },
        include: {
          allocations: {
            include: {
              store: { select: { name: true } },
            },
          },
        },
      })
    ]);

    if (expiringBatches.length > 0) {
      const expiredCount = expiringBatches.filter((b) => new Date(b.expiryDate) < today).length;
      const nearCount = expiringBatches.length - expiredCount;

      let summary = '';
      if (expiredCount > 0) summary += `${expiredCount} expired`;
      if (nearCount > 0) summary += `${summary ? ', ' : ''}${nearCount} expiring within 30 days`;

      alerts.push({
        title: '⚠️ Expiry Alert: Inventory Batches',
        message: `Attention: ${summary}. Check the Expiry Tracker for details.`,
        url: '/dashboard/expiry',
        tag: 'expiry-alert',
      });
    }

    let overdueStaffCount = 0;
    allStaff.forEach((s) => {
      s.allocations?.forEach((a) => {
        const hasUniform = a.uniformQty > 0 && !a.uniformReturned;
        const hasCap = a.capQty > 0 && !a.capReturned;
        let hasDynamic = false;
        if (a.allocatedItems) {
          try {
            const items = typeof a.allocatedItems === 'string' ? JSON.parse(a.allocatedItems) : a.allocatedItems;
            if (Array.isArray(items)) {
              hasDynamic = items.some((i) => !i.returned);
            }
          } catch (e) {}
        }

        if (hasUniform || hasCap || hasDynamic) {
          const period = a.workingPeriod || '';
          if (period.includes(' to ')) {
            const parts = period.split(' to ');
            const endDateStr = parts[1]?.trim();
            if (endDateStr) {
              const endDate = new Date(endDateStr);
              endDate.setHours(23, 59, 59, 999);
              if (today > endDate) {
                overdueStaffCount++;
              }
            }
          }
        }
      });
    });

    if (overdueStaffCount > 0) {
      alerts.push({
        title: '👔 Overdue Uniform Alert',
        message: `${overdueStaffCount} promoter allocation${overdueStaffCount > 1 ? 's are' : ' is'} past working period without uniform return.`,
        url: '/dashboard/staff',
        tag: 'staff-uniform-overdue',
      });
    }

    if (alerts.length > 0) {
      await Promise.all(alerts.map((alert) => sendPushBroadcast(alert)));
    }

    return { success: true, alertsSent: alerts.length };
  } catch (err) {
    console.error('[Automated Alerts Check Error]:', err);
    return { success: false, error: err.message };
  }
}
