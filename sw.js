/* FOR 130 field-trip map: service worker.
   Bump SHELL_VERSION whenever index.html or other app files change. */
const SHELL_VERSION = 'v1';
const SHELL = 'ft-shell-' + SHELL_VERSION;
const TILES = 'ft-tiles-v1', PHOTOS = 'ft-photos-v1', FONTS = 'ft-fonts-v1';
const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/layers.png', './vendor/leaflet/images/layers-2x.png',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
];
const TILE_HOSTS = ['basemap.nationalmap.gov', 'a.tile.opentopomap.org', 'b.tile.opentopomap.org', 'c.tile.opentopomap.org'];
const PHOTO_HOSTS = ['inaturalist-open-data.s3.amazonaws.com', 'static.inaturalist.org'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('ft-shell-') && k !== SHELL).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

// App files: try the network briefly (to pick up updates), fall back to the saved copy.
async function shell(req){
  const cache = await caches.open(SHELL);
  try{
    const res = await Promise.race([fetch(req), timeout(4000)]);
    if(res && res.ok) cache.put(req, res.clone());
    return res;
  }catch(err){
    const hit = await cache.match(req, {ignoreSearch:true}) ||
                (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if(hit) return hit;
    throw err;
  }
}

// Tiles, photos, fonts: saved copy first, network only if not saved.
async function cacheFirst(req, name, store){
  const cache = await caches.open(name);
  const hit = await cache.match(req.url, {ignoreVary:true});
  if(hit) return hit;
  const res = await fetch(req);
  if(store && res && (res.ok || res.type === 'opaque')) cache.put(req.url, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){ e.respondWith(shell(req)); return; }
  if(TILE_HOSTS.includes(url.hostname)){ e.respondWith(cacheFirst(req, TILES, false)); return; }
  if(PHOTO_HOSTS.includes(url.hostname)){ e.respondWith(cacheFirst(req, PHOTOS, false)); return; }
  if(FONT_HOSTS.includes(url.hostname)){ e.respondWith(cacheFirst(req, FONTS, true)); return; }
  // Everything else (the iNaturalist API) goes straight to the network.
});
