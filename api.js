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
      var timer = setTimeout(function () { cleanup(); reject(new Error('Waktu koneksi GAS habis. Periksa internet lalu coba lagi.')); }, 30000);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function (result) {
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
      script.referrerPolicy = 'no-referrer';
      script.onerror = function () { cleanup(); reject(new Error('Tidak dapat menghubungi GAS. Periksa URL dan deployment Web App.')); };
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
    return digest(salt + '|' + String(pin)).then(function (pinHash) {
      return { salt: salt, pin_hash: pinHash };
    });
  }
  function verifikasiPin(pin, salt) {
    return digest(String(salt) + '|' + String(pin));
  }

  window.KPGApi = {
    url: API_URL,
    call: jsonp,
    login: login,
    createOfflinePin: buatPin,
    verifyOfflinePin: verifikasiPin
  };
})();