// ─── Service Worker for IML Inventory PWA ─────────────────────────────────────
// Handles: install, activate, push notifications, notification clicks,
//          static asset caching, and offline navigation fallback.

const CACHE_NAME = 'iml-inventory-v1';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/icon-192.png',
  '/icon-512.png',
  '/IML LOGO V-C.png',
  '/IML LOGO H-C.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
      });
    })
  );
  // Activate immediately without waiting for existing SW to die
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ─── Fetch Strategy ───────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls, server actions, and Next.js data requests — always go to network
  const url = new URL(request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('/actions/')
  ) {
    return;
  }

  // Network-first for navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/dashboard') || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Cache-first for static assets (images, fonts, CSS, JS)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Only cache successful responses for same-origin requests
          if (!response.ok || response.status !== 200 || url.origin !== self.location.origin) {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Return a transparent 1x1 PNG for failed image requests
          if (request.destination === 'image') {
            return new Response(
              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = JSON.parse(event.data.text());
    const options = {
      body: data.message || data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: data.tag || 'inventory-notification',
      renotify: true,
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/dashboard',
      },
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'IML Inventory', options)
    );
  } catch (error) {
    console.error('[SW] Push notification parse error:', error);
  }
});

// ─── Notification Click Handler ───────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Notification Close (optional analytics) ──────────────────────────────────

self.addEventListener('notificationclose', (_event) => {
  // Could be used for analytics — no-op for now
});
