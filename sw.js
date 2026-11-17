/* Thai Speak offline service worker. index.html holds every lesson; the sounds live in audio/<pack>-<hash>.js.
   The page asks once per version to save every pack, so the whole course works with no internet. */
const CACHE = 'thaispeak-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put('index.html', c)); } return res; })
      .catch(() => caches.match('index.html', { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })));
});
self.addEventListener('message', e => {
  const d = e.data || {}; if (d.type !== 'cacheAll' || !Array.isArray(d.urls)) return;
  const reply = m => e.source && e.source.postMessage(m);
  caches.open(CACHE).then(async c => {
    const keep = new Set(d.urls.map(u => new URL(u, self.registration.scope).href));
    for (const r of await c.keys()) if (r.url.includes('/audio/') && !keep.has(r.url)) await c.delete(r);   // drop old versions
    let done = 0, failed = 0;
    for (const u of d.urls) {
      try { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); else failed++; } } catch (_) { failed++; }
      done++; if (done % 3 === 0 || done === d.urls.length) reply({ type: 'cacheAll-progress', done, total: d.urls.length });
    }
    reply({ type: 'cacheAll-done', failed });
  });
});
