// Service worker: precaches the whole build so the app opens offline (on stage,
// no Wi-Fi). Generated at build time by the `serviceWorker` plugin in
// vite.config.ts, which replaces the two placeholders below.
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const CACHE = `pm-midi-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pm-midi-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Cache first: every file of this version is precached, and a new deploy ships a
// new sw.js (new VERSION), which the browser picks up and installs in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  const key = req.mode === 'navigate' ? './' : req
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      // ignoreVary: servers send `Vary: Origin` and Vite's module script / CSS link
      // carry an Origin header the precache requests didn't, so they would never match.
      cache.match(key, { ignoreSearch: req.mode === 'navigate', ignoreVary: true }).then((hit) => hit ?? fetch(req)),
    ),
  )
})
