const CACHE_NAME = 'esfim-decanatura-v1.0.4';
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/app',
  '/manifest.json',
  '/css/main.css',
  '/css/components.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/store.js',
  '/js/alerts.js',
  '/js/admin.js',
  '/js/employee.js',
  '/js/email.js',
  '/img/icon.svg',
  '/img/icon-192.png',
  '/img/icon-512.png'
];

// Install: Cache initial shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Algunos recursos estáticos no pudieron ser cacheados inicialmente:', err);
      });
    })
  );
});

// Activate: Clean old caches and claim
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for APIs and dynamic content, cache fallback for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not intercept non-GET requests or browser-sync / chrome-extension
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // APIs: Strictly Network-first (never serve stale database auth/tasks offline unless necessary)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, message: 'Sin conexión a la red institucional.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Static assets & Pages: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Navigation fallback
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/app') || await caches.match('/');
          if (fallback) return fallback;
        }
        return new Response('Sin conexión a Internet', { status: 503, statusText: 'Offline' });
      })
  );
});
