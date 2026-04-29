const CACHE_NAME = 'partygame-solo-offline-20260429-v1';

const SOLO_ROUTES = [
  '/solo2048/',
  '/memory/',
  '/reaction/',
  '/snake/',
  '/minesweeper/',
  '/tictactoe/',
  '/huarongdao/'
];

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/shared/party.css',
  '/shared/solo.css',
  '/shared/offline.js',
  '/solo2048/',
  '/solo2048/index.html',
  '/solo2048/game.js',
  '/memory/',
  '/memory/index.html',
  '/memory/game.js',
  '/reaction/',
  '/reaction/index.html',
  '/reaction/game.js',
  '/snake/',
  '/snake/index.html',
  '/snake/game.js',
  '/minesweeper/',
  '/minesweeper/index.html',
  '/minesweeper/game.js',
  '/tictactoe/',
  '/tictactoe/index.html',
  '/tictactoe/game.js',
  '/huarongdao/',
  '/huarongdao/index.html',
  '/huarongdao/game.js'
];

function isSoloRoute(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return SOLO_ROUTES.includes(normalized);
}

function shouldHandleWithCache(url, request) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/socket.io/')) return false;
  if (request.mode === 'navigate') return url.pathname === '/' || isSoloRoute(url.pathname);
  return PRECACHE_URLS.includes(url.pathname);
}

async function matchCache(request) {
  return caches.match(request, { ignoreSearch: true });
}

async function cacheFirst(request) {
  const cachedResponse = await matchCache(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

function getNavigationCacheKey(url) {
  if (url.pathname === '/') return '/';
  if (!isSoloRoute(url.pathname)) return url.pathname;
  return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
}

async function navigationResponse(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await matchCache(request);
    if (cachedResponse) return cachedResponse;
    const normalizedResponse = await caches.match(getNavigationCacheKey(url), { ignoreSearch: true });
    if (normalizedResponse) return normalizedResponse;
    return caches.match('/offline.html');
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('partygame-solo-offline-') && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!shouldHandleWithCache(url, request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request, url));
    return;
  }

  event.respondWith(cacheFirst(request));
});
