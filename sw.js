/* Service worker KasirPosGravion.
 * Cache hanya aset same-origin. Request GAS/JSONP tidak pernah disimpan,
 * karena URL callback berubah pada setiap permintaan.
 */
var CACHE = 'kasir-umkm-v19';
var BERKAS = [
  './', './index.html', './style.css', './app.js', './storage.js',
  './api.js', './manifest.webmanifest', './ikon.svg', './qris.svg',
  './tema.css', './tema.js', './img/logo.svg', './img/produk-contoh.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(BERKAS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // GAS, Google redirect, font, dan semua host eksternal harus selalu network.
  // Jangan cache JSONP: cache ignoreSearch dapat mengembalikan callback/nonce lama.
  if (url.origin !== self.location.origin) return;

  var path = url.pathname;
  var isShell = req.mode === 'navigate' ||
    /\.(?:html|js|css|webmanifest)$/i.test(path);

  if (isShell) {
    // Utamakan versi terbaru dari GitHub Pages; cache hanya sebagai fallback offline.
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Gambar dan aset statis same-origin: cache-first, lalu simpan hasil jaringan.
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
