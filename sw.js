const CACHE_NAME = 'mghr-sales-v2.0';
const ASSETS = [
  '/gayatri/',
  '/gayatri/index.html',
  '/gayatri/manifest.json'
];

// Install — cache all assets
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS.filter(url => url.startsWith('/gayatri/')))
          .catch(err => console.log('[SW] Cache error:', err));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — Network First for CDN, Cache First for local assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Network-first strategy for CDN resources (always get latest)
  if (url.hostname !== self.location.hostname) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first strategy for local assets
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(e.request)
          .then(response => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            return response;
          });
      })
      .catch(() => {
        // Fallback to index.html for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('/gayatri/index.html');
        }
      })
  );
});

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle new sale notification from background
  if (event.data && event.data.type === 'NEW_SALE') {
    const { billNo, total, label } = event.data;
    self.registration.showNotification('New Sale - MGHR', {
      body: `Bill #${billNo} - ₹${total} (${label || 'POS'})`,
      icon: '/gayatri/icon-192.png',
      badge: '/gayatri/icon-192.png',
      tag: 'mghr-sale-' + billNo,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: { billNo, total, label }
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if open
        for (let client of clientList) {
          if (client.url.includes('/gayatri/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow('/gayatri/');
        }
      })
  );
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-sales') {
    event.waitUntil(checkForNewSales());
  }
});

async function checkForNewSales() {
  // This would reconnect to MQTT in background
  // For now, just log
  console.log('[SW] Background sync check');
}
