/* Kasir POS Gravion — koneksi aman ke Google Apps Script (v1.2.2). */
(function () {
  'use strict';
  var API_URL = 'https://script.google.com/macros/s/AKfycbyBrSwEFYQvfCbyHhJBl8ko4c1VW-JowhThdkMyHbubeu2-YPrAT9Bcg9lUAdKQJQZl/exec';
  var sequence = 0;
  var MAX_URL_LENGTH = 7500;
  var STICKY_STORAGE_KEY = 'KPG_STICKY_CID_MAP_V1';

  // Daftar lengkap action mutasi yang wajib membawa client_id idempotensi di GAS v1.2.2
  var MUTATION_ACTIONS = {
    simpanTransaksi: true,
    saveStokCabang: true,
    stokMasuk: true,
    returBarang: true,
    transferStok: true,
    koreksiStok: true,
    batalkanTransaksi: true,
    importStokCabang: true,
    importStokCabangBatch: true
  };

  // Menyimpan promise mutasi yang sedang berjalan agar double-click tidak mengirim 2x
  var inFlightMutations = {};
  var sessionExpiredHandler = null;

  function buatClientId(prefix) {
    return (prefix || 'KPG') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function hashRingan(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(36);
  }

  function loadStickyMap() {
    try {
      return JSON.parse(sessionStorage.getItem(STICKY_STORAGE_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveStickyMap(map) {
    try {
      var keys = Object.keys(map);
      if (keys.length > 50) {
        keys.slice(0, keys.length - 50).forEach(function (k) { delete map[k]; });
      }
      sessionStorage.setItem(STICKY_STORAGE_KEY, JSON.stringify(map));
    } catch (e) { /* abaikan jika mode privat membatasi storage */ }
  }

  function buatFingerprintMutasi(action, params) {
    var clone = Object.assign({}, params);
    delete clone.token;
    delete clone.client_id;
    delete clone.callback;
    return action + ':' + hashRingan(JSON.stringify(clone));
  }

  // Menghasilkan client_id tetap (sticky) jika payload yang sama di-retry setelah timeout/error
  function resolveStickyClientId(action, params) {
    if (params.client_id) {
      return { clientId: String(params.client_id).trim(), fingerprint: null };
    }
    var fp = buatFingerprintMutasi(action, params);
    var map = loadStickyMap();
    if (map[fp] && map[fp].cid) {
      return { clientId: map[fp].cid, fingerprint: fp };
    }
    var cid = buatClientId('MUT');
    map[fp] = { cid: cid, ts: Date.now() };
    saveStickyMap(map);
    return { clientId: cid, fingerprint: fp };
  }

  function clearStickyClientId(fingerprint) {
    if (!fingerprint) return;
    var map = loadStickyMap();
    if (map[fingerprint]) {
      delete map[fingerprint];
      saveStickyMap(map);
    }
  }

  function isSessionError(msg) {
    var s = String(msg || '').toLowerCase();
    return s.indexOf('sesi berakhir') >= 0 ||
           s.indexOf('sesi tidak ditemukan') >= 0 ||
           s.indexOf('hak akses berubah') >= 0;
  }

  function jsonp(action, params) {
    params = Object.assign({}, params || {});
    var isMutation = !!MUTATION_ACTIONS[action];
    var stickyInfo = { clientId: null, fingerprint: null };

    if (isMutation) {
      stickyInfo = resolveStickyClientId(action, params);
      params.client_id = stickyInfo.clientId;

      var flightKey = action + '|' + stickyInfo.clientId;
      if (inFlightMutations[flightKey]) {
        return inFlightMutations[flightKey];
      }
    }

    var promise = new Promise(function (resolve, reject) {
      var cb = '__kpg_jsonp_' + Date.now() + '_' + (++sequence);
      var script = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('GAS tidak merespons dalam 45 detik. Tekan Coba Lagi untuk melanjutkan dengan ID aman.'));
      }, 45000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = function (result) {
        if (settled) return;
        settled = true;
        cleanup();
        if (result && (result.ok === true || result.duplicate === true)) {
          clearStickyClientId(stickyInfo.fingerprint);
          resolve(result);
        } else {
          var errMsg = (result && result.error) || 'Permintaan ke GAS gagal.';
          if (isSessionError(errMsg) && typeof sessionExpiredHandler === 'function') {
            try { sessionExpiredHandler(errMsg); } catch (e) {}
          }
          clearStickyClientId(stickyInfo.fingerprint);
          reject(new Error(errMsg));
        }
      };

      var query = new URLSearchParams();
      query.set('action', action);
      query.set('callback', cb);
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === undefined || value === null) return;
        query.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      });

      var fullUrl = API_URL + '?' + query.toString();
      if (fullUrl.length > MAX_URL_LENGTH) {
        settled = true;
        cleanup();
        reject(new Error('Ukuran data terlalu besar untuk satu kali kirim (' + fullUrl.length + ' karakter). Perkecil jumlah baris per batch.'));
        return;
      }

      script.async = true;
      script.onerror = function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Browser gagal memuat respons GAS. Periksa koneksi internet lalu coba lagi.'));
      };

      script.src = fullUrl
