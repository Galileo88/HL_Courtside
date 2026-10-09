/* Lets HoopWire open without a connection. Every file is fetched fresh when online, so a new
   deploy shows up right away; the last copy of each file is kept for when the network is gone. */
const CACHE = 'hoopwire-app';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request,
    url = new URL(request.url);
  // Team logos, court art and other images from elsewhere go straight to the network.
  if (request.method !== 'GET' || url.origin !== location.origin || request.headers.has('range')) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        // A deploy changes the ?v= on scripts and styles; any cached copy is better than none offline.
        return (
          (await cache.match(request)) ||
          (await cache.match(request, { ignoreSearch: true })) ||
          (request.mode === 'navigate' ? await cache.match('./', { ignoreSearch: true }) : undefined) ||
          Response.error()
        );
      })
  );
});
