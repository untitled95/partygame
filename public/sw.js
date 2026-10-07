const CACHE_NAME = 'partygame-solo-offline-20261007-v14';

const SOLO_ROUTES = [
  '/solo2048/',
  '/memory/',
  '/reaction/',
  '/snake/',
  '/minesweeper/',
  '/tictactoe/',
  '/huarongdao/',
  '/platformer/'
];

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/lobby/style.css',
  '/lobby/theme.js',
  '/lobby/lobby.js',
  '/lobby/assets/arrow-up-right.svg',
  '/lobby/assets/brain.svg',
  '/lobby/assets/cards.svg',
  '/lobby/assets/cat.svg',
  '/lobby/assets/chat-circle-dots.svg',
  '/lobby/assets/detective.svg',
  '/lobby/assets/dice-detail.jpg',
  '/lobby/assets/dice-five.svg',
  '/lobby/assets/flag.svg',
  '/lobby/assets/game-controller.svg',
  '/lobby/assets/grid-nine.svg',
  '/lobby/assets/hash.svg',
  '/lobby/assets/lightning.svg',
  '/lobby/assets/magnifying-glass.svg',
  '/lobby/assets/moon-stars.svg',
  '/lobby/assets/moon.svg',
  '/lobby/assets/outfit-latin-400-normal.woff2',
  '/lobby/assets/outfit-latin-500-normal.woff2',
  '/lobby/assets/outfit-latin-600-normal.woff2',
  '/lobby/assets/outfit-latin-700-normal.woff2',
  '/lobby/assets/path.svg',
  '/lobby/assets/pencil-simple.svg',
  '/lobby/assets/shuffle.svg',
  '/lobby/assets/squares-four.svg',
  '/lobby/assets/sun.svg',
  '/lobby/assets/users-three.svg',
  '/lobby/assets/wifi-slash.svg',
  '/lobby/assets/x.svg',
  '/shared/party.css',
  '/shared/solo.css',
  '/shared/game-ui.css',
  '/shared/game-ui.js',
  '/shared/offline.js',
  '/shared/offline-cache.js',
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
  '/minesweeper/style.css',
  '/minesweeper/levels.js',
  '/minesweeper/game.js',
  '/tictactoe/',
  '/tictactoe/index.html',
  '/tictactoe/game.js',
  '/huarongdao/',
  '/huarongdao/index.html',
  '/huarongdao/style.css',
  '/huarongdao/cats.css',
  '/huarongdao/game.js',
  '/huarongdao/assets/zhangfei.png',
  '/huarongdao/assets/cao.png',
  '/huarongdao/assets/zhaoyun.png',
  '/huarongdao/assets/machao.png',
  '/huarongdao/assets/guanyu.png',
  '/huarongdao/assets/huangzhong.png',
  '/huarongdao/assets/soldier1.png',
  '/huarongdao/assets/soldier2.png',
  '/huarongdao/assets/soldier3.png',
  '/huarongdao/assets/soldier4.png',
  '/platformer/',
  '/platformer/index.html',
  '/platformer/style.css',
  '/platformer/engine.js',
  '/platformer/game.js'
];

async function broadcastProgress(message) {
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window'
  });
  clients.forEach(client => {
    client.postMessage({
      source: 'partygame-sw',
      ...message
    });
  });
}

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
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request, { ignoreSearch: true });
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
    const cache = await caches.open(CACHE_NAME);
    const normalizedResponse = await cache.match(getNavigationCacheKey(url), { ignoreSearch: true });
    if (normalizedResponse) return normalizedResponse;
    return cache.match('/offline.html');
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const total = PRECACHE_URLS.length;
      await broadcastProgress({ type: 'offline-cache-start', total });

      for (let index = 0; index < PRECACHE_URLS.length; index++) {
        const url = PRECACHE_URLS[index];
        // A new release must not precache the browser's previous HTTP responses.
        await cache.add(new Request(url, { cache: 'reload' }));
        const completed = index + 1;
        await broadcastProgress({
          type: 'offline-cache-progress',
          url,
          completed,
          total,
          percent: Math.round((completed / total) * 100)
        });
      }

      await broadcastProgress({ type: 'offline-cache-complete', total });
      await self.skipWaiting();
    })().catch(async error => {
      await broadcastProgress({
        type: 'offline-cache-error',
        message: error.message
      });
      throw error;
    })
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
