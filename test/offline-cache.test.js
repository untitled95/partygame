const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function workerHarness() {
  const listeners = new Map();
  const added = [];
  const matched = [];
  let activated = false;
  const currentResponse = { release: 'current' };
  const origin = 'https://party.example';
  const cache = {
    add: async request => { added.push(request); },
    match: async (request, options) => { matched.push({ request, options }); return currentResponse; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), {
    URL,
    Request: class extends Request {
      constructor(url, options) { super(new URL(url, origin), options); }
    },
    caches: {
      open: async () => cache,
      // The previous release may still exist while a new worker installs.
      match: async () => { throw new Error('Must not read across release caches'); }
    },
    self: {
      location: { origin },
      clients: { matchAll: async () => [] },
      skipWaiting: async () => { activated = true; },
      addEventListener: (name, handler) => listeners.set(name, handler)
    }
  });
  return { listeners, added, matched, currentResponse, activated: () => activated };
}

test('offline release installation bypasses stale HTTP assets, including cat PNGs', async () => {
  const harness = workerHarness();
  let pending;
  harness.listeners.get('install')({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert(harness.activated());
  assert(harness.added.length > 0);
  assert(harness.added.every(request => request.cache === 'reload'));
  assert(harness.added.some(request => request.url.endsWith('/huarongdao/assets/cao.png')));
  assert(harness.added.some(request => request.url.endsWith('/shared/offline-cache.js')));
});

test('versioned game requests use the active release, even when an older cache exists', async () => {
  const harness = workerHarness();
  const request = new Request('https://party.example/huarongdao/game.js?v=new-release');
  let response;
  harness.listeners.get('fetch')({ request, respondWith: promise => { response = promise; } });
  assert.equal(await response, harness.currentResponse);
  assert.equal(harness.matched.length, 1);
  assert.equal(harness.matched[0].options.ignoreSearch, true);
});
