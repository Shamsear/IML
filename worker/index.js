// Custom Service Worker script to handle Web Push Notifications
self.addEventListener('push', function (event) {
  if (!event.data) return;
  
  try {
    const data = JSON.parse(event.data.text());
    const options = {
      body: data.message,
      icon: '/icon-192.png', // PWA Icon
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Push notification parse error:', error);
  }
});
