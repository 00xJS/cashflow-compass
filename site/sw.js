/* =========================================================
   Cashflow Compass — service worker (app shell only)

   A service worker requires a secure context (https:// or
   http://localhost). On file:// registration is rejected by the
   browser, so this file simply never runs — that is expected and
   nothing in the app depends on it.

   Scope note: this worker caches the *shell* (markup, scripts,
   vendor libraries, icon). The user's data lives in localStorage
   and is never touched, fetched or cached here — there is no
   network data in this app at all.
   ========================================================= */

const CACHE_PREFIX = 'cashflow-compass-shell';
const CACHE_NAME = CACHE_PREFIX + '-v6';

// Relative so the worker keeps working from any scope (root, /app/, a Netlify
// deploy preview path). './' is the start_url the manifest declares.
const SHELL = [
    './',
    'index.html',
    'engine.js',
    'app.js',
    'importers.js',
    'features.js',
    'portability.js',
    'shell.js',
    'vendor/InterVariable.woff2',
    'guide.html',
    'vendor/chart.umd.min.js',
    'vendor/xlsx.full.min.js',
    'manifest.webmanifest',
    'icon.svg'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // Added one at a time rather than cache.addAll(): addAll is atomic, so a
        // single missing optional file would abort the whole install and leave
        // the app with no offline shell at all.
        await Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
        // The app loads its whole shell at startup, so there is no window in
        // which a page could mix old and new assets — take over immediately.
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names
                .filter(n => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
                .map(n => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // Same-origin only. Nothing in this app is cross-origin, and letting a
    // cross-origin request through the handler would be the one place a future
    // edit could quietly start talking to a third party.
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith((async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;

        try {
            const res = await fetch(req);
            // Only opaque-free, successful, same-origin responses are worth keeping.
            if (res && res.ok && res.type === 'basic') {
                const cache = await caches.open(CACHE_NAME);
                cache.put(req, res.clone());
            }
            return res;
        } catch (err) {
            // Offline and not in the cache: a navigation still deserves the app,
            // anything else fails the way it would without a worker.
            if (req.mode === 'navigate') {
                const shell = await caches.match('index.html', { ignoreSearch: true });
                if (shell) return shell;
            }
            throw err;
        }
    })());
});
