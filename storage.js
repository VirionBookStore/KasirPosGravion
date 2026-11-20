/* Kasir POS Gravion — penyimpanan lokal IndexedDB (Local First). */
(function () {
  'use strict';
  var DB_NAME = 'kpg-gravion-local';
  var DB_VERSION = 1;
  var DB = null;

  function bukaDB() {
    if (DB) return Promise.resolve(DB);
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('Browser ini tidak mendukung IndexedDB.'));
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'client_id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = function () { DB = req.result; resolve(DB); };
      req.onerror = function () { reject(req.error || new Error('Gagal membuka IndexedDB.')); };
      req.onblocked = function () { reject(new Error('Database lokal sedang dipakai tab lain. Tutup tab aplikasi lain lalu coba lagi.')); };
    });
  }

  function request(store, mode, action) {
    return bukaDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, mode), req = action(tx.objectStore(store)), result;
        req.onsuccess = function () { result = req.result; };
        req.onerror = function () { reject(req.error || new Error('Operasi database lokal gagal.')); };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error('Transaksi database lokal gagal.')); };
        tx.onabort = function () { reject(tx.error || new Error('Transaksi database lokal dibatalkan.')); };
      });
    });
  }

  function ambilState() {
    return request('state', 'readonly', function (s) { return s.get('app'); })
      .then(function (r) { return r ? r.value : null; });
  }
  function simpanState(value) {
    return request('state', 'readwrite', function (s) {
      return s.put({ key: 'app', value: value, updated_at: new Date().toISOString() });
    });
  }
  function init() {
    return bukaDB().then(ambilState).then(function (state) {
      if (state) return { state: state, migrated: false };
      var lama = null;
      try { lama = JSON.parse(localStorage.getItem('kasir-umkm-v1') || 'null'); } catch (e) {}
      if (lama && Array.isArray(lama.produk) && Array.isArray(lama.transaksi)) {
        return simpanState(lama).then(function () { return { state: lama, migrated: true }; });
      }
      return { state: null, migrated: false };
    });
  }
  function enqueue(item) {
    if (!item || !item.client_id) return Promise.reject(new Error('client_id antrean wajib diisi.'));
    return request('outbox', 'readwrite', function (s) { return s.put(item); });
  }
  function daftarAntrean(limit) {
    return request('outbox', 'readonly', function (s) { return s.getAll(); })
      .then(function (rows) { return rows.slice(0, Math.max(1, Number(limit) || 500)); });
  }
  function hapusAntrean(clientId) {
    return request('outbox', 'readwrite', function (s) { return s.delete(clientId); });
  }
  function simpanMeta(key, value) {
    return request('meta', 'readwrite', function (s) { return s.put({ key: key, value: value }); });
  }
  function ambilMeta(key) {
    return request('meta', 'readonly', function (s) { return s.get(key); })
      .then(function (r) { return r ? r.value : null; });
  }

  window.KPGStorage = {
    init: init,
    saveState: simpanState,
    getState: ambilState,
    enqueue: enqueue,
    listOutbox: daftarAntrean,
    removeOutbox: hapusAntrean,
    setMeta: simpanMeta,
    getMeta: ambilMeta
  };
})();