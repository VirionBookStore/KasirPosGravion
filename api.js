/* Kasir POS Gravion — koneksi aman ke Google Apps Script. */
(function () {
  'use strict';
  var API_URL = 'https://script.google.com/macros/s/AKfycbxNBacathj9EZ5JM7QJF1Ruceq4dNgAmPDhkna32hAtiBcZJfkWJ-deN6iXx4J9kR3G/exec';
  var sequence = 0;

  function jsonp(action, params) {
    params = params || {};
    return new Promise(function (resolve, reject) {
      var cb = '__kpg_jsonp_' + Date.now() + '_' + (++sequence);
      var script = document.createElement('script');
      var callbackReceived = false;
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('GAS tidak merespons dalam 15 detik. Periksa deployment Web App dan koneksi internet.'));
      }, 45000);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function (result) {
        if (settled) return;
        callbackReceived = true;
        settled = true;
        cleanup();
        if (!result || result.ok !== true) reject(new Error(result && result.error || 'Permintaan ke GAS gagal.'));
        else resolve(result);
      };
      var query = new URLSearchParams();
      query.set('action', action);
      query.set('callback', cb);
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === undefined || value === null) return;
        query.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
      script.async = true;
      script.onerror = function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Browser gagal memuat respons GAS. Periksa akses Web App dan koneksi internet.'));
      };
      // Jangan menganggap event onload sebagai bukti callback gagal.
      // GAS ContentService dapat melewati redirect googleusercontent; tunggu callback
      // JSONP yang sebenarnya. Timeout 15 detik di atas tetap menangani respons macet.
      script.src = API_URL + '?' + query.toString();
      document.head.appendChild(script);
    });
  }

  function hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function digest(value) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Browser harus menggunakan HTTPS dan mendukung Web Crypto.'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))).then(hex);
  }
  function randomSalt() {
    if (!window.crypto || !crypto.getRandomValues) throw new Error('Browser tidak mendukung pembuat PIN lokal yang aman.');
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return hex(bytes);
  }
  function derivePin(pin, saltHex) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Browser tidak mendukung verifikasi PIN aman.'));
    var salt = new Uint8Array((String(saltHex).match(/.{2}/g) || []).map(function (x) { return parseInt(x, 16); }));
    return crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
      }).then(hex);
  }
  function login(username, password) {
    username = String(username || '').trim().toLowerCase();
    password = String(password || '');
    if (!username || !password) return Promise.reject(new Error('Username dan password wajib diisi.'));
    return jsonp('loginChallenge', { username: username }).then(function (challenge) {
      return digest(challenge.salt + '|' + password).then(function (passwordHash) {
        return digest(challenge.nonce + '|' + passwordHash);
      }).then(function (proof) {
        return jsonp('loginVerify', { username: username, nonce: challenge.nonce, proof: proof });
      });
    });
  }
  function buatPin(pin) {
    var salt = randomSalt();
    return derivePin(pin, salt).then(function (pinHash) {
      return { salt: salt, pin_hash: pinHash };
    });
  }
  function verifikasiPin(pin, salt) {
    return derivePin(pin, salt);
  }

  window.KPGApi = {
    url: API_URL,
    call: jsonp,
    login: login,
    createOfflinePin: buatPin,
    verifyOfflinePin: verifikasiPin
  };
})();
