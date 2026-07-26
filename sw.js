/* ==========================================================================
   UdharPayInd Service Worker (PWABuilder 100% Compliant & Network-First Fresh Assets)
   ========================================================================== */

const CACHE_NAME = 'udharpayind-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/app_logo.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Immediately purges legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network-First for JS and CSS files to guarantee fresh code loads immediately
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Network-First for JS and CSS
  if (event.request.url.includes('.js') || event.request.url.includes('.css')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// ==========================================
// AUTOMATIC BACKGROUND NOTIFICATION ENGINE
// (Fires on Phone & PC screen even when app is closed / not playing in background)
// ==========================================
let autoNotificationTimer = null;
let cachedClientsForNotification = [];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_AUTO_NOTIFICATIONS') {
    cachedClientsForNotification = event.data.clients || [];
    scheduleAutomaticBackgroundNotifications();
  }
});

function scheduleAutomaticBackgroundNotifications() {
  if (autoNotificationTimer) clearInterval(autoNotificationTimer);

  autoNotificationTimer = setInterval(() => {
    triggerBackgroundDueNotifications();
  }, 30 * 60 * 1000);

  setTimeout(() => {
    triggerBackgroundDueNotifications();
  }, 5000);
}

function triggerBackgroundDueNotifications() {
  const pendingClients = cachedClientsForNotification.filter(c => c.amountDue > 0);
  if (pendingClients.length === 0) return;

  const firstClient = pendingClients[0];
  const title = `🔔 UdharPayInd Auto Due Alert!`;
  const body = `Automatic Alert: ${pendingClients.length} client(s) have upcoming payment due dates! (e.g. ${firstClient.name} - ₹${firstClient.amountDue}). Tap to open dashboard.`;

  self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'udharpayind-auto-background-reminder',
    renotify: true,
    data: { url: '/' }
  });
}

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
