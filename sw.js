const CACHE = 'daily-os-v16';

// Files to pre-cache on install
// self.location resolves relative paths correctly regardless of GitHub Pages subpath
const SHELL = ['index.html', 'manifest.json', 'icon.svg', 'icon-maskable.svg'];

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(SHELL.map(f => new URL(f, self.location).href))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for same-origin, pass-through for external ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Let external requests (Anthropic API, Tavily, CDNs) go straight to network
  if (url.origin !== self.location.origin) return;

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Serve cached version immediately, then update cache in background
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // if offline and not cached, fall back to cached

      return cached || networkFetch;
    })
  );
});
