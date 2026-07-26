/* ==========================================================================
   UdharPayInd Service Worker (PWABuilder 100% Compliant & Auto Background Push)
   ========================================================================== */

const CACHE_NAME = 'udharpayind-v1';
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

// Activate Event
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

// Fetch Event - Handles Navigation & Offline Fallback for PWABuilder
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests
  if (!event.request.url.startsWith('http')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
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

  // Check every 30 minutes in background automatically
  autoNotificationTimer = setInterval(() => {
    triggerBackgroundDueNotifications();
  }, 30 * 60 * 1000);

  // Initial trigger check after 5 seconds
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

// Notification Click Event (Brings app to focus on phone/laptop when notification is tapped)
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
