(function () {
  'use strict';

  // ---------- KONFIG gambar: ganti logo/foto cukup di sini (atau timpa berkas di img/) ----------
  var KONFIG = {
    logo: 'img/logo.svg',                // logo toko: sidebar, layar masuk, struk. '' = pakai ikon bawaan
    fotoContoh: 'img/produk-contoh.svg', // placeholder foto produk (rasio 1:1)
    fotoProduk: {}                       // foto produk contoh per nama, mis. { 'Mie Goreng': 'img/mie.jpg' }
  };

  // ---------- Penyimpanan (localStorage, offline) ----------
  var KUNCI = 'kasir-umkm-v1';
  var NAMA_TEMA = (window.TEMA && TEMA.nama) || 'Kopi Senja';

  function dataKosong() {
    return {
      toko: { namaDariTema: true, nama: NAMA_TEMA, alamat: '', telp: '', footer: 'Terima kasih sudah belanja!', rekening: '' },
      kategori: [], produk: [], transaksi: [],
      kasir: [{ id: 'k1', nama: 'Admin', pin: '1234', peran: 'admin' }],
      nomor: 0
    };
  }

  function dataContoh() {
    var d = dataKosong();
    d.toko = { namaDariTema: true, nama: NAMA_TEMA, alamat: 'Jl. Merdeka No. 12, Bandung', telp: '0812-0000-1234', footer: 'Terima kasih, sampai jumpa lagi!', rekening: 'Bank Contoh 0000000000 a.n. ' + NAMA_TEMA };
    d.kategori = ['Kopi', 'Non-Kopi', 'Makanan', 'Camilan'];
    var p = [
      ['Kopi Susu Gula Aren', 'Kopi', 40, [['Reguler', 18000], ['Large', 23000]]],
      ['Americano', 'Kopi', 50, [['Hot', 15000], ['Ice', 17000]]],
      ['Cappuccino', 'Kopi', 30, [['Reguler', 22000]]],
      ['Matcha Latte', 'Non-Kopi', 25, [['Reguler', 22000], ['Large', 27000]]],
      ['Cokelat Panas', 'Non-Kopi', 20, [['Reguler', 18000]]],
      ['Teh Lemon', 'Non-Kopi', 60, [['Reguler', 10000]]],
      ['Nasi Goreng Kampung', 'Makanan', 15, [['Biasa', 22000], ['Spesial', 28000]]],
      ['Mie Goreng', 'Makanan', 4, [['Biasa', 18000]]],
      ['Roti Bakar', 'Camilan', 18, [['Cokelat', 15000], ['Keju', 17000], ['Campur', 19000]]],
      ['Kentang Goreng', 'Camilan', 22, [['Reguler', 14000]]],
      ['Pisang Goreng', 'Camilan', 0, [['Isi 5', 12000]]]
    ];
    d.produk = p.map(function (x, i) {
      return { id: 'p' + (i + 1), nama: x[0], kategori: x[1], stok: x[2], foto: KONFIG.fotoProduk[x[0]] || '', varian: x[3].map(function (v) { return { nama: v[0], harga: v[1] }; }) };
    });
    d.kasir.push({ id: 'k2', nama: 'Sari', pin: '1111', peran: 'kasir' });
    // transaksi contoh 30 hari terakhir
    var acak = semai(7);
    var sekarang = new Date();
    for (var h = 29; h >= 0; h--) {
      var n = 3 + Math.floor(acak() * 7);
      for (var t = 0; t < n; t++) {
        var w = new Date(sekarang); w.setDate(w.getDate() - h);
        w.setHours(8 + Math.floor(acak() * 13), Math.floor(acak() * 60), 0, 0);
        if (w > sekarang) continue;
        var items = [], m = 1 + Math.floor(acak() * 3);
        for (var j = 0; j < m; j++) {
          var pr = d.produk[Math.floor(acak() * d.produk.length)], vr = pr.varian[Math.floor(acak() * pr.varian.length)];
          items.push({ pid: pr.id, nama: pr.nama, varian: vr.nama, harga: vr.harga, qty: 1 + Math.floor(acak() * 2) });
        }
        var sub = items.reduce(function (s, it) { return s + it.harga * it.qty; }, 0);
        var mt = ['tunai', 'tunai', 'qris', 'transfer'][Math.floor(acak() * 4)];
        var bayar = mt === 'tunai' ? Math.ceil(sub / 10000) * 10000 : sub;
        d.nomor++;
        d.transaksi.push({ id: noTrx(w, d.nomor), waktu: w.toISOString(), kasir: acak() > .5 ? 'Sari' : 'Admin', items: items, subtotal: sub, diskon: 0, total: sub, metode: mt, bayar: bayar, kembali: bayar - sub });
      }
    }
    return d;
  }
  function semai(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  var D;
  function muat(stateAwal) {
    D = stateAwal || null;
    if (!D) {
      try { D = JSON.parse(localStorage.getItem(KUNCI)); } catch (e) { D = null; }
    }
    if (!D || !Array.isArray(D.produk)) { D = dataKosong(); simpan(); }
    // Migrasi data lama: nama bawaan lama dianggap belum diubah pengguna.
    if (!D.toko) D.toko = dataKosong().toko;
    if (D.toko.namaDariTema === undefined) D.toko.namaDariTema = D.toko.nama === 'Kopi Senja' || D.toko.nama === 'Toko Saya';
    if (D.toko.namaDariTema) D.toko.nama = NAMA_TEMA;
    if (!Array.isArray(D.kategori)) D.kategori = [];
    if (!Array.isArray(D.transaksi)) D.transaksi = [];
    if (!Array.isArray(D.kasir) || !D.kasir.length) D.kasir = dataKosong().kasir;
    if (!Array.isArray(D.offlineUsers)) D.offlineUsers = [];
    if (typeof D.nomor !== 'number') D.nomor = D.transaksi.length;
  }

  // ---------- Tema (customizer Maliki Studio, lihat tema.css & tema.js) ----------
  var FONT_OK = ['Plus Jakarta Sans', 'Inter', 'Poppins', 'DM Sans', 'Space Grotesk', 'Nunito'];
  function terapkanTema(t) {
    var r = document.documentElement, st = r.style;
    if (t.utama) st.setProperty('--tema-utama', t.utama);
    if (t.aksen) st.setProperty('--tema-aksen', t.aksen);
    if (t.radius != null) st.setProperty('--tema-radius', typeof t.radius === 'number' ? t.radius + 'px' : t.radius);
    if (t.font) {
      var f = String(t.font).split(',')[0].replace(/["']/g, '').trim();
      st.setProperty('--tema-font', '"' + f + '", system-ui, sans-serif');
      var l = document.getElementById('fontTema');
      if (l && FONT_OK.indexOf(f) >= 0) l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@400;500;600;700;800&display=swap';
    }
    if (t.mode) { var m = t.mode === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang') : t.mode; r.setAttribute('data-mode', m); }
    if (t.bagian) terapkanBagian(t.bagian);
    setTimeout(hitungTeksBagian, 0);
    if (t.nama) {
      NAMA_TEMA = t.nama;
      if (D && D.toko.namaDariTema) { D.toko.nama = t.nama; $$('[data-tema-nama]').forEach(function (e) { e.textContent = t.nama; }); }
    }
  }
  window.addEventListener('message', function (e) { if (e.data && e.data.tipe === 'tema') terapkanTema(e.data); });
  // ---------- Bagian (customizer: warna per bagian, sorot, tap-untuk-pilih) ----------
  var PETA_BAGIAN = {
    nav: '.samping, .bawah, .masuk-merek',
    latar: 'main, .masuk-form, .pos-kiri, .hal',
    panel: '.panel, .kartu-produk, .keranjang, .ker-ringkas, .layar-uang, .numpad button, .tabel-bungkus, .trx, .angka:not(.sorot), dialog, .masuk-kartu',
    utama: '.tombol.utama, .nav.aktif, .chip.aktif, .tambah, .tautan, .angka.sorot, .pilih-kasir .aktif, .fab-keranjang',
    aksen: '.thumb, .di-ker, .masuk-ilus, .grafik .batang, .terlaris li, .stok.tipis',
    teks: 'h1, h2, h3, .total-besar, .kartu-produk b, .baris.total, .merek span'
  };
  var NAMA_BAGIAN = { nav: 'Navigasi', latar: 'Latar', panel: 'Panel', utama: 'Warna utama', aksen: 'Aksen', teks: 'Teks' };
  var VAR_BAGIAN = { latar: '--latar', panel: '--kartu', nav: '--nav', teks: '--teks' };
  function tandaiBagian() {
    var baru = 0;
    Object.keys(PETA_BAGIAN).forEach(function (b) {
      Array.prototype.forEach.call(document.querySelectorAll(PETA_BAGIAN[b]), function (el) { if (!el.hasAttribute('data-bagian')) { el.setAttribute('data-bagian', b); baru++; } });
    });
    if (baru && sorotAktif) sorot(sorotAktif);
  }
  // warna teks otomatis (terang/gelap) dari luminansi warna latar sebenarnya
  function warnaNyata(v) {
    var p = document.createElement('i'); p.style.cssText = 'position:absolute;width:0;height:0;background:var(' + v + ')';
    document.body.appendChild(p); var c = getComputedStyle(p).backgroundColor; p.remove();
    var m = c.match(/[\d.]+/g) || [255, 255, 255];
    if (/^color\(srgb/.test(c)) m = m.map(function (x) { return x * 255; });
    return m.slice(0, 3).map(Number);
  }
  function teksUntuk(v) {
    var l = warnaNyata(v).map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    var L = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    return L > 0.4 ? '#14171a' : '#ffffff';
  }
  function hitungTeksBagian() {
    if (!document.body) return;
    var st = document.documentElement.style;
    st.setProperty('--tema-nav-teks', teksUntuk('--nav'));
    st.setProperty('--tema-utama-teks', teksUntuk('--utama'));
  }
  function terapkanBagian(bg) {
    var st = document.documentElement.style;
    Object.keys(VAR_BAGIAN).forEach(function (k) {
      if (bg[k] === undefined) return;
      if (bg[k]) { st.setProperty('--tema-' + k, bg[k]); st.setProperty(VAR_BAGIAN[k], bg[k]); }
      else { st.removeProperty('--tema-' + k); st.removeProperty(VAR_BAGIAN[k]); }
    });
  }
  var sorotAktif = null;
  function sorot(b) {
    sorotAktif = b;
    Array.prototype.forEach.call(document.querySelectorAll('[data-sorot]'), function (e) { e.removeAttribute('data-sorot'); });
    Array.prototype.forEach.call(document.querySelectorAll('.label-sorot'), function (e) { e.remove(); });
    if (!b) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-bagian="' + b + '"]'), function (e) {
      e.setAttribute('data-sorot', '');
      var r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
      var lb = document.createElement('span'); lb.className = 'label-sorot'; lb.textContent = NAMA_BAGIAN[b] || b;
      lb.style.left = Math.max(2, r.left + 4) + 'px'; lb.style.top = Math.max(2, r.top + 4) + 'px';
      document.body.appendChild(lb);
    });
  }
  var modePilih = false, hoverEl = null;
  function bagianDari(t) { return t && t.closest ? t.closest('[data-bagian]') : null; }
  function setPilih(on) {
    modePilih = !!on; document.documentElement.classList.toggle('mode-pilih', modePilih);
    if (!modePilih && hoverEl) { hoverEl.removeAttribute('data-pilih-hover'); hoverEl = null; }
  }
  ['click', 'pointerdown', 'mousedown', 'touchstart', 'submit', 'keydown'].forEach(function (tipe) {
    document.addEventListener(tipe, function (e) {
      if (!modePilih) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (tipe === 'click') { var el = bagianDari(e.target); if (el) parent.postMessage({ tipe: 'bagian-dipilih', bagian: el.getAttribute('data-bagian') }, '*'); }
    }, { capture: true, passive: false });
  });
  document.addEventListener('mouseover', function (e) {
    if (!modePilih) return; var el = bagianDari(e.target);
    if (hoverEl && hoverEl !== el) hoverEl.removeAttribute('data-pilih-hover');
    hoverEl = el; if (el) el.setAttribute('data-pilih-hover', '');
  }, true);
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d) return;
    if (d.tipe === 'sorot') sorot(d.bagian || null);
    else if (d.tipe === 'mode-pilih') setPilih(d.aktif);
  });
  new MutationObserver(function (ms) {
    var mode = ms.some(function (m) { return m.type === 'attributes'; });
    var dom = ms.some(function (m) { return m.type === 'childList' && Array.prototype.some.call(m.addedNodes, function (n) { return n.nodeType === 1 && n.className !== 'label-sorot'; }); });
    if (dom) tandaiBagian(); if (mode) hitungTeksBagian();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mode'] });
  tandaiBagian(); hitungTeksBagian();

  function simpan() {
    // IndexedDB adalah penyimpanan persisten utama; localStorage hanya fallback
    // untuk browser lama atau jika IndexedDB tidak tersedia.
    if (window.KPGStorage && KPGStorage.saveState) {
      return KPGStorage.saveState(D).catch(function (e) {
        try { localStorage.setItem(KUNCI, JSON.stringify(D)); } catch (er) {}
        toast('IndexedDB gagal, salinan kompatibilitas dicoba: ' + (e.message || e));
        throw e;
      });
    }
    try { localStorage.setItem(KUNCI, JSON.stringify(D)); return Promise.resolve(); }
    catch (e) { toast('Gagal menyimpan data lokal: ' + (e.message || e)); return Promise.reject(e); }
  }

  // ---------- Utilitas ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function rp(n) { return 'Rp' + Math.round(n || 0).toLocaleString('id-ID'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function dua(n) { return (n < 10 ? '0' : '') + n; }
  function tglKey(d) { return d.getFullYear() + '-' + dua(d.getMonth() + 1) + '-' + dua(d.getDate()); }
  function noTrx(d, n) { return 'TRX' + String(d.getFullYear()).slice(2) + dua(d.getMonth() + 1) + dua(d.getDate()) + '-' + String(n).padStart(4, '0'); }
  function fmtWaktu(iso) { var d = new Date(iso); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + dua(d.getHours()) + ':' + dua(d.getMinutes()); }
  // ---------- Ilustrasi produk (SVG buatan sendiri, dipilih dari kata di nama/kategori) ----------
  // Warna makanan tetap; latar kotak diturunkan dari tema (--utama/--aksen) di style.css (.thumb[data-nada]).
  var ILUS = {
    kopi: '<ellipse cx="60" cy="72" rx="34" ry="6" fill="#e9dfd2"/><path d="M38 40h44l-4 26a8 8 0 0 1-8 7H50a8 8 0 0 1-8-7z" fill="#fff" stroke="#d9cbb8" stroke-width="1.5"/><path d="M82 46h4a8 8 0 0 1 0 16h-6" fill="none" stroke="#d9cbb8" stroke-width="4"/><ellipse cx="60" cy="41" rx="22" ry="4.5" fill="#7a4a2b"/><path d="M53 38c2-3 6-3 7 0s5 3 7 0" fill="none" stroke="#e9c79a" stroke-width="1.6" stroke-linecap="round"/><path class="uap" d="M52 30c-3-4 3-6 0-11M61 29c-3-4 3-6 0-11M70 30c-3-4 3-6 0-11" fill="none" stroke="#b9a58e" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
    es: '<path d="M42 22h36l-5 52a6 6 0 0 1-6 5H53a6 6 0 0 1-6-5z" fill="#fff" fill-opacity=".55" stroke="#cfd6d2" stroke-width="1.5"/><path d="M44.5 40h31l-3.4 33a5 5 0 0 1-5 4.5H52.9a5 5 0 0 1-5-4.5z" fill="{c}"/><path d="M44.5 40h31l-.6 6c-6 3-24 3-30 0z" fill="#fff" opacity=".35"/><rect x="50" y="44" width="9" height="9" rx="2" fill="#fff" opacity=".7" transform="rotate(-12 54 48)"/><rect x="61" y="50" width="9" height="9" rx="2" fill="#fff" opacity=".6" transform="rotate(10 65 54)"/><path d="M66 12l-6 52" stroke="{s}" stroke-width="3.5" stroke-linecap="round"/>',
    mug: '<ellipse cx="60" cy="74" rx="30" ry="5" fill="#e9dfd2"/><rect x="38" y="36" width="40" height="38" rx="8" fill="{c}"/><path d="M78 44h3a8 8 0 0 1 0 16h-3" fill="none" stroke="{c}" stroke-width="5"/><path d="M40 37c4-9 14-6 18-10 4 5 12 1 18 10z" fill="#fff8ee"/><circle cx="52" cy="31" r="2" fill="#7a4a2b"/><circle cx="62" cy="29" r="1.6" fill="#7a4a2b"/><rect x="44" y="50" width="28" height="4" rx="2" fill="#fff" opacity=".25"/>',
    nasi: '<ellipse cx="60" cy="58" rx="44" ry="17" fill="#fff" stroke="#e6e0d6" stroke-width="1.5"/><ellipse cx="60" cy="56" rx="34" ry="11" fill="#f2f0ea"/><path d="M34 54c4-16 48-16 52 0-8 6-44 6-52 0z" fill="#d98a3a"/><circle cx="46" cy="47" r="1.6" fill="#b5651d"/><circle cx="58" cy="44" r="1.6" fill="#7aa35a"/><circle cx="70" cy="47" r="1.6" fill="#c0392b"/><ellipse cx="72" cy="42" rx="12" ry="8" fill="#fff"/><circle cx="73" cy="42" r="4.5" fill="#f5b52e"/><circle cx="36" cy="62" r="4" fill="#7fb069"/><circle cx="36" cy="62" r="2.2" fill="#d8ecc8"/><circle cx="45" cy="65" r="4" fill="#7fb069"/><circle cx="45" cy="65" r="2.2" fill="#d8ecc8"/>',
    mie: '<path d="M26 46h68a34 26 0 0 1-68 0z" fill="{c}"/><path d="M26 46h68" stroke="#fff" stroke-width="2" opacity=".4"/><path d="M34 46c4-10 8 4 12-6s8 6 12-4 8 6 12-4 8 6 12-2 6 4 8 0" fill="none" stroke="#e8b34a" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="40" r="3" fill="#7fb069"/><circle cx="72" cy="40" r="3" fill="#c0392b"/><path d="M70 10l18 30M78 8l14 32" stroke="#8b5a32" stroke-width="3" stroke-linecap="round"/><path d="M44 66h32" stroke="#fff" stroke-width="2" opacity=".3"/>',
    roti: '<ellipse cx="60" cy="72" rx="36" ry="6" fill="#e9dfd2"/><g transform="rotate(-8 50 50)"><path d="M30 46c-6-16 30-20 34-4v26H32z" fill="#c9843f"/><path d="M34 47c-3-11 24-14 27-3v21H35z" fill="#f4d9a6"/></g><g transform="rotate(8 72 50)"><path d="M56 46c-6-16 30-20 34-4v26H58z" fill="#c9843f"/><path d="M60 47c-3-11 24-14 27-3v21H61z" fill="#f4d9a6"/><path d="M62 52c4 3 8-3 12 0s8-3 12 0M62 60c4 3 8-3 12 0s8-3 12 0" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/></g>',
    kentang: '<g fill="#f2c14e" stroke="#d99a2b" stroke-width="1"><rect x="40" y="14" width="6" height="34" rx="2" transform="rotate(-10 43 30)"/><rect x="49" y="10" width="6" height="36" rx="2"/><rect x="58" y="12" width="6" height="34" rx="2" transform="rotate(6 61 30)"/><rect x="66" y="14" width="6" height="32" rx="2" transform="rotate(14 69 30)"/><rect x="45" y="18" width="6" height="30" rx="2" transform="rotate(4 48 32)"/></g><path d="M36 36h48l-6 40H42z" fill="{c}"/><path d="M36 36c8 8 40 8 48 0" fill="none" stroke="#fff" stroke-width="2.5" opacity=".5"/><circle cx="60" cy="58" r="7" fill="#fff" opacity=".9"/><path d="M57 58h6" stroke="{c}" stroke-width="2" stroke-linecap="round"/>',
    pisang: '<ellipse cx="60" cy="62" rx="42" ry="14" fill="#fff" stroke="#e6e0d6" stroke-width="1.5"/><g fill="#d9902f"><ellipse cx="44" cy="52" rx="14" ry="7" transform="rotate(-18 44 52)"/><ellipse cx="62" cy="48" rx="15" ry="7" transform="rotate(8 62 48)"/><ellipse cx="78" cy="55" rx="13" ry="6.5" transform="rotate(-10 78 55)"/><ellipse cx="56" cy="60" rx="14" ry="6.5" transform="rotate(4 56 60)"/></g><g fill="#f0bd5e" opacity=".8"><circle cx="40" cy="50" r="2"/><circle cx="62" cy="46" r="2"/><circle cx="80" cy="53" r="2"/><circle cx="54" cy="58" r="2"/></g>',
    umum: '<ellipse cx="60" cy="74" rx="30" ry="5" fill="#e9dfd2"/><path d="M36 34l24-12 24 12v30l-24 12-24-12z" fill="{c}"/><path d="M36 34l24 12 24-12M60 46v30" fill="none" stroke="#fff" stroke-width="2" opacity=".55"/><path d="M48 28l24 12" stroke="#fff" stroke-width="3" opacity=".4"/>'
  };
  function jenisIlus(p) {
    var s = (p.nama + ' ' + p.kategori).toLowerCase();
    var aturan = [
      [/matcha/, 'es', '#8fb35a', '#2f5d3a'], [/teh|lemon|es |jeruk|soda/, 'es', '#e7a83a', '#d4573b'],
      [/cokelat|coklat|susu panas/, 'mug', '#7a4a2b'], [/nasi/, 'nasi'], [/mie|bakso|soto/, 'mie', '#c0392b'],
      [/roti|toast|sandwich/, 'roti', '#6b3a1f'], [/kentang|fries/, 'kentang', '#d64933'], [/pisang|goreng/, 'pisang'],
      [/kopi|americano|cappuccino|latte|espresso|mocha/, 'kopi'], [/minum|non-kopi/, 'es', '#b97a4a', '#2f5d3a']
    ];
    for (var i = 0; i < aturan.length; i++) if (aturan[i][0].test(s)) return aturan[i];
    return [null, 'umum', '#9aa79d'];
  }
  function ilustrasi(p) {
    if (p.foto) return '<img class="ilus foto-produk" src="' + esc(p.foto) + '" alt="" loading="lazy" onerror="this.outerHTML=window.__ilusCadangan(\'' + p.id + '\')">';
    return ilustrasiSvg(p);
  }
  window.__ilusCadangan = function (id) { var p = D.produk.filter(function (x) { return x.id === id; })[0]; return p ? ilustrasiSvg(p) : ''; };
  // Logo: tampil di .merek bila gambar termuat; gagal dimuat -> inisial nama toko
  function pasangLogo() {
    if (!KONFIG.logo) return;
    $$('.merek .logo').forEach(function (svg) {
      if (svg.getAttribute('data-logo-siap')) return; svg.setAttribute('data-logo-siap', '1');
      var w = svg.getAttribute('width'), img = new Image(); img.className = 'logo logo-img'; img.alt = ''; img.width = w; img.height = w;
      img.onload = function () { svg.style.display = 'none'; svg.parentNode.insertBefore(img, svg); };
      img.onerror = function () { var sp = document.createElement('span'); sp.className = 'logo logo-inisial'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = inisial((D && D.toko.nama) || NAMA_TEMA); sp.style.width = sp.style.height = w + 'px'; svg.style.display = 'none'; svg.parentNode.insertBefore(sp, svg); };
      img.src = KONFIG.logo;
    });
  }
  function kecilkanFoto(file, cb) {
    var r = new FileReader();
    r.onload = function () { var im = new Image(); im.onload = function () { var k = Math.min(1, 400 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = function () { toast('Berkas bukan gambar'); }; im.src = r.result; };
    r.readAsDataURL(file);
  }
  function ilustrasiSvg(p) {
    var j = jenisIlus(p), es = /ice|es\b/i.test(p.varian.map(function (v) { return v.nama; }).join(' '));
    var bentuk = j[1] === 'kopi' && /americano/i.test(p.nama) && es ? 'es' : j[1];
    var svg = ILUS[bentuk].replace(/\{c\}/g, j[2] || (bentuk === 'es' ? '#6b4128' : '#7a4a2b')).replace(/\{s\}/g, j[3] || '#2f5d3a');
    return '<svg class="ilus" viewBox="0 0 120 90" aria-hidden="true">' + svg + '</svg>';
  }
  function nadaDari(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 4; }
  function inisial(s) { return s.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  var tTimer;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('tampil'); clearTimeout(tTimer); tTimer = setTimeout(function () { t.classList.remove('tampil'); }, 2200); }
  function unduh(nama, isi, tipe) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([isi], { type: tipe }));
    a.download = nama; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csvSel(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function parseCSV(teks) {
    var baris = [], sel = '', row = [], kutip = false;
    for (var i = 0; i < teks.length; i++) {
      var c = teks[i];
      if (kutip) {
        if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++; }
        else if (c === '"') kutip = false; else sel += c;
      } else if (c === '"') kutip = true;
      else if (c === ',') { row.push(sel); sel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && teks[i + 1] === '\n') i++; row.push(sel); baris.push(row); row = []; sel = ''; }
      else sel += c;
    }
    if (sel || row.length) { row.push(sel); baris.push(row); }
    return baris.filter(function (r) { return r.join('').trim(); });
  }

  // ---------- Sesi kasir ----------
  var pengguna = null, pinBuffer = '', kasirDipilih = null;
  function isAdmin() { return !!pengguna && (pengguna.peran === 'admin' || pengguna.peran === 'owner'); }
  function isOwner() { return !!pengguna && pengguna.peran === 'owner'; }

  function tampilMasuk() {
    $('#aplikasi').hidden = true; $('#layarMasuk').hidden = false;
    $('#masukToko').textContent = D.toko.nama;
    var mi = $('#masukIlus'); if (mi) mi.innerHTML = D.produk.slice(0, 6).map(function (p, n) { return '<span class="thumb" data-nada="' + nadaDari(p.kategori + p.nama) + '" style="--i:' + n + '">' + ilustrasi(p) + '</span>'; }).join('');
    kasirDipilih = D.offlineUsers[0] || null; pinBuffer = '';
    $('#daftarKasir').innerHTML = D.offlineUsers.length ? D.offlineUsers.map(function (k) { return '<button data-id="' + esc(k.id_user) + '">' + esc(k.nama) + '</button>'; }).join('') : '<span class="redup kecil">Belum ada PIN offline. Login online terlebih dahulu.</span>';
    $$('#daftarKasir button').forEach(function (b) {
      b.classList.toggle('aktif', !!kasirDipilih && b.dataset.id === kasirDipilih.id_user);
      b.onclick = function () {
        kasirDipilih = D.offlineUsers.find(function (k) { return k.id_user === b.dataset.id; });
        pinBuffer = ''; tampilMasuk.titik();
        $$('#daftarKasir button').forEach(function (x) { x.classList.toggle('aktif', x === b); });
      };
    });
    $('#pinTitik').hidden = !kasirDipilih;
    $('#padPin').hidden = !kasirDipilih;
    tampilMasuk.titik();
  }
  tampilMasuk.titik = function () { $$('#pinTitik i').forEach(function (i, n) { i.classList.toggle('isi', n < pinBuffer.length); }); };
  function ketikPin(k) {
    if (!kasirDipilih) return;
    if (k === 'hapus') pinBuffer = pinBuffer.slice(0, -1);
    else if (pinBuffer.length < 4) pinBuffer += k;
    tampilMasuk.titik();
    if (pinBuffer.length === 4) {
      var target = kasirDipilih, pin = pinBuffer;
      KPGApi.verifyOfflinePin(pin, target.salt).then(function (hash) {
        if (hash === target.pin_hash) {
          masuk({ id: target.id_user, id_user: target.id_user, nama: target.nama, username: target.username,
            peran: normalisasiRoleUser(target), id_cabang: normalisasiIdCabang(target), offline: true }, null);
        } else salahkanPin();
      }).catch(function () { salahkanPin(); });
    }
  }
  function salahkanPin() {
    var t = $('#pinTitik'); t.classList.add('salah');
    setTimeout(function () { t.classList.remove('salah'); pinBuffer = ''; tampilMasuk.titik(); }, 350);
  }
  function normalisasiRoleUser(u) {
    u = u || {};
    var raw = u.peran;
    if (raw == null || raw === '') raw = u.role;
    if (raw == null || raw === '') raw = u.ROLE;
    var role = String(raw == null ? '' : raw).trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '');
    if (['OWNER', 'PEMILIK', 'SUPERADMIN', 'SUPERUSER'].indexOf(role) >= 0) return 'owner';
    if (['ADMIN', 'ADMINISTRATOR'].indexOf(role) >= 0) return 'admin';
    return 'kasir';
  }
  function normalisasiIdCabang(u) {
    u = u || {};
    var id = u.id_cabang;
    if (id == null || id === '') id = u.cabang_id;
    if (id == null || id === '') id = u.idCabang;
    return String(id == null ? '' : id).trim();
  }
  function normalisasiUser(u) {
    u = u || {};
    var role = normalisasiRoleUser(u);
    var roleServer = String(u.peran != null ? u.peran : (u.role != null ? u.role : (u.ROLE || ''))).trim();
    return { id: u.id_user || u.id || '', id_user: u.id_user || u.id || '',
      nama: u.nama || u.name || '', username: u.username || '',
      peran: role, peran_server: roleServer, id_cabang: normalisasiIdCabang(u), offline: false };
  }
  function barangDariServer(x) {
    return { id: String(x.id_barang), nama: String(x.nama_barang || ''), kategori: String(x.kategori || 'Umum'),
      stok: Number(x.stok) || 0, foto: String(x.foto || ''), kode_barang: String(x.kode_barang || ''),
      barcode: String(x.barcode || ''), satuan: String(x.satuan || 'pcs'),
      id_supplier: String(x.id_supplier || ''), nama_supplier: String(x.nama_supplier || ''),
      id_cabang: String(x.id_cabang || ''), nama_cabang: String(x.nama_cabang || x.id_cabang || ''), lokasi_rak: String(x.lokasi_rak || ''),
      harga_beli: Number(x.harga_beli) || 0,
      varian: [{ nama: 'Reguler', harga: Number(x.harga_jual) || 0 }] };
  }
  function terapkanBootstrap(data, user) {
    var rows = Array.isArray(data.barang) ? data.barang : [];
    D.produk = rows.map(barangDariServer);
    D.kategori = Array.from(new Set(D.produk.map(function (p) { return p.kategori; })));
    D.supplier = Array.isArray(data.supplier) ? data.supplier : [];
    D.cabang = Array.isArray(data.cabang) ? data.cabang : [];
    D.id_cabang_aktif = user.peran === 'owner' ? '' : (data.id_cabang_aktif || user.id_cabang || '');
    if (!user.id_cabang && user.peran !== 'owner') user.id_cabang = D.id_cabang_aktif;
    if (!D.stokPerCabang) D.stokPerCabang = {};
    D.stokPerCabang[D.id_cabang_aktif] = {};
    D.produk.forEach(function (p) { D.stokPerCabang[D.id_cabang_aktif][p.id] = p.stok; });
    D.serverInitialized = true;
    D.lastServerSync = data.server_time || new Date().toISOString();
  }
  function terapkanSyncPull(data, user) {
    var ownerSemuaCabang = !!(user && user.peran === 'owner' && !String(data.cabang || '').trim());
    var cabang = ownerSemuaCabang ? '' : String(data.cabang || (user && user.id_cabang) || D.id_cabang_aktif || '').trim();
    if (!D.stokPerCabang) D.stokPerCabang = {};
    var stokMap = {}, lokasiMap = {};
    if (ownerSemuaCabang) {
      (data.stok || []).forEach(function (s) {
        var idCabang = String(s.id_cabang || '').trim(), idBarang = String(s.id_barang || '');
        if (!idCabang || !idBarang) return;
        if (!D.stokPerCabang[idCabang]) D.stokPerCabang[idCabang] = {};
        D.stokPerCabang[idCabang][idBarang] = Number(s.stok) || 0;
      });
    } else {
      var stokLama = D.stokPerCabang[cabang] || {};
      stokMap = Object.assign({}, stokLama);
      (data.stok || []).forEach(function (s) {
        if (String(s.id_cabang || '') !== cabang) return;
        var idBarang = String(s.id_barang || '');
        if (!idBarang) return;
        stokMap[idBarang] = Number(s.stok) || 0;
        lokasiMap[idBarang] = String(s.lokasi_rak || '');
      });
      D.stokPerCabang[cabang] = stokMap;
    }
    (data.barang || []).forEach(function (row) {
      var mapped = barangDariServer(row), at = D.produk.findIndex(function (p) { return p.id === mapped.id; });
      if (at >= 0) D.produk[at] = Object.assign({}, D.produk[at], mapped);
      else D.produk.push(mapped);
    });
    var deleted = Array.isArray(data.barang_hapus) ? data.barang_hapus.map(String) : [];
    if (deleted.length) D.produk = D.produk.filter(function (p) { return deleted.indexOf(String(p.id)) < 0; });
    D.produk.forEach(function (p) {
      if (ownerSemuaCabang) {
        p.stok = Object.keys(D.stokPerCabang).reduce(function (sum, id) {
          return sum + (Object.prototype.hasOwnProperty.call(D.stokPerCabang[id], String(p.id)) ? Number(D.stokPerCabang[id][String(p.id)]) || 0 : 0);
        }, 0);
        p.id_cabang = '';
      } else {
        if (Object.prototype.hasOwnProperty.call(stokMap, String(p.id))) p.stok = Number(stokMap[String(p.id)]) || 0;
        p.id_cabang = cabang;
        if (Object.prototype.hasOwnProperty.call(lokasiMap, String(p.id))) p.lokasi_rak = lokasiMap[String(p.id)];
      }
    });
    D.kategori = Array.from(new Set(D.produk.map(function (p) { return p.kategori; })));
    if (Array.isArray(data.supplier)) D.supplier = data.supplier;
    if (Array.isArray(data.cabang_list)) D.cabang = data.cabang_list;
    D.id_cabang_aktif = ownerSemuaCabang ? '' : cabang;
    D.serverInitialized = true;
    D.lastServerSync = data.server_time || new Date().toISOString();
  }
  function masuk(k, token) {
    if (k.offline) {
      var cabangOffline = k.id_cabang || '';
      var stokCabang = D.stokPerCabang && D.stokPerCabang[cabangOffline];
      if (!cabangOffline || !stokCabang) {
        toast('Data stok cabang akun ini belum pernah disimpan di perangkat. Login online sekali saat internet tersedia.');
        return;
      }
      D.produk.forEach(function (p) {
        // Data cabang yang belum tersimpan bukan berarti stok habis.
        if (Object.prototype.hasOwnProperty.call(stokCabang, p.id)) {
          var stokOffline = Number(stokCabang[p.id]);
          if (Number.isFinite(stokOffline) && stokOffline >= 0) p.stok = stokOffline;
        }
      });
      D.id_cabang_aktif = cabangOffline;
    }
    pengguna = k;
    if (k.peran === 'owner') {
      try { cabangTransaksiAktif = localStorage.getItem('kpg-cabang-transaksi-owner') || ''; } catch (e) { cabangTransaksiAktif = ''; }
    }
    try {
      if (token) {
        localStorage.setItem('kpg-token', token);
        localStorage.setItem('kpg-user', JSON.stringify(k));
      } else if (k.offline) {
        // Pertahankan token online hanya bila milik akun yang sama, agar antrean
        // offline dapat dikirim saat internet kembali tanpa memakai akun lain.
        var cached = null;
        try { cached = JSON.parse(localStorage.getItem('kpg-user') || 'null'); } catch (e) {}
        if (!cached || cached.id_user !== k.id_user) {
          localStorage.removeItem('kpg-token');
          localStorage.removeItem('kpg-user');
        }
      } else {
        localStorage.removeItem('kpg-token');
        localStorage.removeItem('kpg-user');
      }
      localStorage.setItem('kasir-sesi', k.id_user || k.id);
    } catch (e) {}
    $('#layarMasuk').hidden = true; $('#aplikasi').hidden = false;
    $('#namaKasir').textContent = k.nama + (k.peran === 'owner' ? ' · owner' : (k.peran === 'admin' ? ' · admin' : ''));
    $('#namaTokoNav').textContent = D.toko.nama;
    document.querySelectorAll('[data-hal="produk"]').forEach(function (b) { b.hidden = k.peran !== 'owner'; });
    document.querySelectorAll('[data-hal="atur"]').forEach(function (b) { b.hidden = !(k.peran === 'owner' || k.peran === 'admin'); });
    var tg = $('#tglHariIni'); if (tg) tg.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var av = $('#avatarKasir'); if (av) av.textContent = inisial(k.nama);
    var pilihCabangPos = $('#pilihCabangTransaksi');
    if (pilihCabangPos) pilihCabangPos.hidden = k.peran !== 'owner';
    if (k.peran === 'owner') siapkanPilihCabangTransaksi();
    buka('kasir');
    syncPending();
  }
  function loginOnline(e) {
    e.preventDefault();
    var form = e.target, username = form.elements.username.value.trim(), password = form.elements.password.value;
    var pin = form.elements.pinOffline.value.trim(), status = $('#loginOnlineStatus');
    var existing = D.offlineUsers.find(function (x) { return String(x.username || '').toLowerCase() === username.toLowerCase(); });
    if (!existing && !/^\d{4}$/.test(pin)) { status.textContent = 'Login pertama di perangkat ini memerlukan PIN offline 4 angka.'; return; }
    if (pin && !/^\d{4}$/.test(pin)) { status.textContent = 'PIN offline harus tepat 4 angka.'; return; }
    status.textContent = 'Memeriksa akun ke GAS...';
    form.querySelector('button[type="submit"]').disabled = true;
    KPGApi.login(username, password).then(function (auth) {
      var user = normalisasiUser(auth.user);
      var pull = D.serverInitialized
        ? KPGApi.call('syncPull', { token: auth.token, since: D.lastServerSync || '', id_cabang: user.peran === 'owner' ? '' : user.id_cabang })
        : KPGApi.call('bootstrap', { token: auth.token });
      return pull.then(function (data) {
        if (D.serverInitialized) terapkanSyncPull(data, user); else terapkanBootstrap(data, user);
        if (!user.id_cabang) user.id_cabang = D.id_cabang_aktif || '';
        var credential = D.offlineUsers.find(function (x) { return x.id_user === user.id_user; });
        var savePin = pin ? KPGApi.createOfflinePin(pin) : Promise.resolve(null);
        return savePin.then(function (hashed) {
          if (!credential && !hashed) throw new Error('PIN offline belum dibuat. Isi PIN 4 angka pada formulir login.');
          if (credential) {
            credential.nama = user.nama; credential.username = user.username; credential.peran = user.peran;
            credential.id_cabang = user.id_cabang;
          } else {
            credential = { id_user: user.id_user, nama: user.nama, username: user.username, peran: user.peran, id_cabang: user.id_cabang };
            D.offlineUsers.push(credential);
          }
          if (hashed) { credential.salt = hashed.salt; credential.pin_hash = hashed.pin_hash; }
          return simpan().then(function () {
            form.elements.password.value = ''; form.elements.pinOffline.value = '';
            status.textContent = 'Login berhasil. Data lokal sudah diperbarui.';
            masuk(user, auth.token);
            syncPending();
          });
        });
      });
    }).catch(function (err) {
      status.textContent = err.message || 'Login gagal. Periksa koneksi dan akun GAS.';
    }).finally(function () { form.querySelector('button[type="submit"]').disabled = false; });
  }
  var sedangSync = false;
  function payloadTransaksiLokal(trx) {
    return { client_id: trx.client_id, no_nota: trx.id, waktu: trx.waktu,
      id_cabang: trx.id_cabang || D.id_cabang_aktif || '',
      subtotal: trx.subtotal, diskon: trx.diskon, total: trx.total,
      metode_bayar: String(trx.metode || 'tunai').toUpperCase(),
      bayar: trx.bayar, kembali: trx.kembali,
      items: (trx.items || []).map(function (i) {
        return { id_barang: i.pid, nama_barang: i.nama, varian: i.varian,
          qty: i.qty, harga: i.harga, diskon_item: Number(i.diskon_item) || 0 };
      }) };
  }
  function syncPending() {
    var token = null;
    try { token = localStorage.getItem('kpg-token'); } catch (e) {}
    if (!token || !navigator.onLine || sedangSync || !window.KPGStorage) return;
    sedangSync = true;
    // Pulihkan antrean dari transaksi lokal yang belum mendapat ACK server.
    // Ini juga memperbaiki kondisi jika browser sempat berhenti di antara dua penulisan.
    var repair = D.transaksi.filter(function (t) { return t.client_id && t.sync_status !== 'TERSINKRON'; })
      .reduce(function (chain, trx) {
        return chain.then(function () {
          return KPGStorage.enqueue({ client_id: trx.client_id, owner_user_id: trx.id_user || '', payload: payloadTransaksiLokal(trx),
            created_at: trx.waktu, attempts: 0 });
        });
      }, Promise.resolve());
    var activeUserId = '';
    try { var activeUser = JSON.parse(localStorage.getItem('kpg-user') || 'null'); activeUserId = activeUser && activeUser.id_user || ''; } catch (e) {}
    var adaAntreanSync = false;
    repair.then(function () { return KPGStorage.listOutbox(100); }).then(function (queue) {
      // Jangan kirim transaksi kasir lain dengan token pengguna yang sedang aktif.
      queue = queue.filter(function (item) { return !!activeUserId && item.owner_user_id === activeUserId; });
      adaAntreanSync = queue.length > 0;
      return queue.reduce(function (chain, item) {
        return chain.then(function () {
          return KPGApi.call('syncPush', { token: token, transaksi: [item.payload] }).then(function (result) {
            var ack = (result.hasil || []).find(function (x) { return x.client_id === item.client_id; });
            if (!ack || (!ack.ok && !ack.duplicate)) throw new Error(ack && ack.error || 'Transaksi belum diterima server.');
            return KPGStorage.removeOutbox(item.client_id).then(function () {
              var local = D.transaksi.find(function (t) { return t.client_id === item.client_id; });
              if (local) local.sync_status = 'TERSINKRON';
              return simpan();
            });
          }).catch(function (err) {
            var local = D.transaksi.find(function (t) { return t.client_id === item.client_id; });
            if (local) { local.sync_status = 'MENUNGGU'; local.sync_error = err.message; }
            return simpan();
          });
        });
      }, Promise.resolve());
    }).then(function () {
      if (!adaAntreanSync) return;
      // Setelah server mengonfirmasi antrean, ambil stok terbaru dari cabang server.
      // Jangan memuat ulang sebelum syncPush selesai karena hasilnya bisa masih stok lama.
      if (!navigator.onLine) return;
      var userAktif = null;
      try { userAktif = JSON.parse(localStorage.getItem('kpg-user') || 'null'); } catch (e) {}
      if (!userAktif) return;
      if (String(userAktif.peran || '').toUpperCase() === 'OWNER') {
        if (timerPilihCabangKasir || sedangMuatCabangKasir) return;
        var requestSaatIni = nomorPermintaanCabangKasir;
        return cabangTransaksiAktif
          ? muatBarangUntukCabang(cabangTransaksiAktif, requestSaatIni)
          : muatSemuaBarangOwner(requestSaatIni);
      }
      if (userAktif.id_cabang) return muatBarangUntukCabang(userAktif.id_cabang);
    }).catch(function (e) { console.warn('Antrean sinkronisasi / muat ulang stok:', e); })
      .finally(function () { sedangSync = false; });
  }

  // ---------- Navigasi ----------
  function buka(hal) {
    if (hal === 'produk' && !isOwner()) { toast('Menu Produk hanya dapat diakses OWNER.'); return; }
    if (hal === 'atur' && !isAdmin()) { toast('Menu Pengaturan hanya dapat diakses ADMIN/OWNER.'); return; }
    $$('.hal').forEach(function (s) { s.classList.toggle('aktif', s.id === 'hal-' + hal); });
    try { $('main').scrollTop = 0; } catch (e) {}
    $$('.nav').forEach(function (b) { b.classList.toggle('aktif', b.dataset.hal === hal); });
    ({ kasir: function () {
        if (pengguna && pengguna.peran === 'owner') {
          if (produkKasirCache) { D.produk = produkKasirCache.map(function (p) { return Object.assign({}, p); }); sumberProdukPOS = null; renderPOS(); }
          // Hindari meminta ulang seluruh katalog setiap kali tab kasir dibuka.
          // Cache lokal ditampilkan langsung; refresh GAS dilakukan maksimal sekali per 60 detik.
          if (!produkKasirCache || Date.now() - waktuMuatKasirTerakhir > 60000) {
            var requestSaatIni = nomorPermintaanCabangKasir;
            var muatAktif = cabangTransaksiAktif
              ? muatBarangUntukCabang(cabangTransaksiAktif, requestSaatIni)
              : muatSemuaBarangOwner(requestSaatIni);
            muatAktif.then(function () {
              produkKasirCache = D.produk.map(function (p) { return Object.assign({}, p); });
              waktuMuatKasirTerakhir = Date.now();
            }).catch(function (e) { if (!produkKasirCache) toast('Gagal memuat stok cabang: ' + e.message); });
          }
        } else renderPOS();
      }, produk: function () {
        if (pengguna && pengguna.peran === 'owner') produkKasirCache = D.produk.map(function (p) { return Object.assign({}, p); });
        muatKatalogServer().catch(tampilkanErrorKatalog);
      }, riwayat: renderRiwayat, laporan: renderLaporan, atur: renderAtur })[hal]();
  }

  // ---------- POS ----------
  var keranjang = [], katAktif = 'Semua';
  var produkKasirCache = null;
  var jumlahProdukTampil = 80;
  var sumberProdukPOS = null, indeksProdukPOS = [], jumlahKategoriPOS = {};
  var timerCariProduk = null, waktuMuatKasirTerakhir = 0;
  function siapkanIndeksProdukPOS() {
    if (sumberProdukPOS === D.produk) return;
    sumberProdukPOS = D.produk;
    indeksProdukPOS = [];
    jumlahKategoriPOS = {};
    D.produk.forEach(function (p) {
      var teks = [p.nama, p.id, p.kode_barang, p.barcode, p.id_cabang, p.nama_cabang, p.lokasi_rak].join(' ').toLowerCase();
      indeksProdukPOS.push({ produk: p, teks: teks });
      var kategori = p.kategori || '';
      jumlahKategoriPOS[kategori] = (jumlahKategoriPOS[kategori] || 0) + 1;
    });
  }
  function stokTerpakai(pid) { return keranjang.filter(function (i) { return i.pid === pid; }).reduce(function (s, i) { return s + i.qty; }, 0); }

  function renderPOS() {
    if (tampilkanLoaderCabangKasir) {
      $('#chipKategori').innerHTML = '';
      $('#gridProduk').innerHTML = '<div class="kasir-muat-ringkas" aria-label="Memuat produk"></div>';
      renderKeranjang();
      return;
    }
    siapkanIndeksProdukPOS();
    var kats = ['Semua'].concat(D.kategori);
    $('#chipKategori').innerHTML = kats.map(function (k) { var n = k === 'Semua' ? D.produk.length : (jumlahKategoriPOS[k] || 0);
      return '<button class="chip' + (k === katAktif ? ' aktif' : '') + '" data-k="' + esc(k) + '" aria-pressed="' + (k === katAktif) + '">' + esc(k) + '<span class="chip-n">' + n + '</span></button>'; }).join('');
    var q = $('#cariProduk').value.trim().toLowerCase();
    var kataCari = q.split(/\s+/).filter(Boolean);
    var list = indeksProdukPOS.filter(function (item) {
      var p = item.produk;
      var cocok = !kataCari.length || kataCari.every(function (kata) { return item.teks.indexOf(kata) > -1; });
      var stokAda = Number(p.stok || 0) > 0;
      return stokAda && (katAktif === 'Semua' || p.kategori === katAktif) && cocok;
    }).map(function (item) { return item.produk; });
    var tampil = list.slice(0, jumlahProdukTampil);
    $('#gridProduk').innerHTML = list.length ? tampil.map(function (p, n) {
      var sisa = p.stok - stokTerpakai(p.id), diKer = stokTerpakai(p.id);
      var min = Math.min.apply(null, p.varian.map(function (v) { return v.harga; }));
      return '<button class="kartu-produk' + (diKer ? ' dipilih' : '') + '" data-id="' + p.id + '" style="--i:' + Math.min(n, 14) + '"' + (sisa <= 0 ? ' disabled' : '') + ' aria-label="' + esc(p.nama) + ', ' + (p.varian.length > 1 ? 'mulai ' : '') + rp(min) + (sisa <= 0 ? ', stok habis' : '') + '">' +
        '<div class="thumb" data-nada="' + nadaDari(p.kategori + p.nama) + '">' + ilustrasi(p) + (diKer ? '<span class="di-ker">' + diKer + '</span>' : '') + (sisa <= 0 ? '<span class="habis">Habis</span>' : '') + '</div>' +
        '<span class="kp-teks"><b>' + esc(p.nama) + '</b><span class="stok' + (sisa <= 5 ? ' tipis' : '') + '">' + (sisa <= 0 ? 'Stok habis' : (sisa <= 5 ? 'Sisa ' : 'Stok ') + sisa) + (p.varian.length > 1 ? ' · ' + p.varian.length + ' varian' : '') + '</span>' +
        ((p.cabang_stok_label || p.nama_cabang || p.id_cabang || p.lokasi_rak) ? '<span class="stok">' + (p.cabang_stok_label ? esc(p.cabang_stok_label) : (p.nama_cabang || p.id_cabang ? 'Cabang ' + esc(p.nama_cabang || p.id_cabang) : '')) + (p.lokasi_rak ? ' · Rak ' + esc(p.lokasi_rak) : '') + '</span>' : '') + '</span>' +
        '<span class="kp-bawah"><span class="harga">' + (p.varian.length > 1 ? '<small>mulai</small> ' : '') + rp(min) + '</span><span class="tambah" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span></span></button>';
    }).join('') + (list.length > tampil.length ? '<button type="button" data-muat-lagi class="tombol" style="grid-column:1/-1;width:100%;margin:8px 0 18px">Tampilkan 80 produk berikutnya (' + (list.length - tampil.length) + ' tersisa)</button>' : '') : '<div class="kosong"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><b>Produk tidak ditemukan</b><span>Coba kata lain atau pilih kategori "Semua".</span></div>';
    renderKeranjang();
  }

  function tambahKeKeranjang(p, v) {
    if (p.stok - stokTerpakai(p.id) <= 0) return toast('Stok ' + p.nama + ' habis');
    var ada = keranjang.find(function (i) { return i.pid === p.id && i.varian === v.nama; });
    if (ada) ada.qty++; else keranjang.push({ pid: p.id, nama: p.nama, varian: v.nama, harga: v.harga, qty: 1 });
    renderPOS();
    var c = $('.kartu-produk[data-id="' + p.id + '"]'); if (c) { c.style.animation = 'none'; c.classList.add('bump'); }
    ['#kerJumlah', '#fabKeranjang'].forEach(function (q) { var e = $(q); if (e) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); } });
  }

  function hitung() {
    var sub = keranjang.reduce(function (s, i) { return s + i.harga * i.qty; }, 0);
    var nilai = Math.max(0, parseFloat($('#inDiskon').value) || 0);
    var dis = $('#tipeDiskon').value === 'persen' ? Math.round(sub * Math.min(nilai, 100) / 100) : Math.min(nilai, sub);
    return { subtotal: sub, diskon: dis, total: sub - dis };
  }

  function renderKeranjang() {
    var h = hitung(), jml = keranjang.reduce(function (s, i) { return s + i.qty; }, 0);
    $('#kerDaftar').innerHTML = keranjang.length ? keranjang.map(function (i, n) {
      var p = D.produk.find(function (x) { return x.id === i.pid; }) || { nama: i.nama, kategori: '', varian: [] };
      return '<li><span class="ker-thumb thumb" data-nada="' + nadaDari(p.kategori + p.nama) + '">' + ilustrasi(p) + '</span><span class="ker-info"><span class="nm">' + esc(i.nama) + '</span><span class="vr">' + esc(i.varian) + ' · ' + rp(i.harga) + '</span></span><span class="jml"><b>' + rp(i.harga * i.qty) + '</b><span class="qty"><button data-n="' + n + '" data-d="-1" aria-label="Kurangi ' + esc(i.nama) + '"><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button><span aria-live="polite">' + i.qty + '</span><button data-n="' + n + '" data-d="1" aria-label="Tambah ' + esc(i.nama) + '"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button></span></span></li>';
    }).join('') : '<li class="ker-kosong"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="10" width="36" height="46" rx="6"/><path d="M22 22h20M22 30h20M22 38h12"/></svg><b>Belum ada pesanan</b><span>Ketuk menu di kiri untuk menambah.</span></li>';
    $('#kerNomor').textContent = '#' + String((D.nomor || 0) + 1).padStart(4, '0');
    $('#kerJumlah').textContent = jml + ' item';
    $('#kSubtotal').textContent = rp(h.subtotal);
    $('#kTotal').textContent = rp(h.total);
    $('#btnBayar').disabled = !keranjang.length;
    $('#fabJumlah').textContent = jml; $('#fabTotal').textContent = rp(h.total);
    var kd = $('#kDiskonBaris'); if (kd) kd.classList.toggle('ada', h.diskon > 0);
  }

  function dialog(html, siap) {
    var d = $('#dlg'); $('#dlgIsi').innerHTML = html;
    if (!d.open) d.showModal();
    if (siap) siap($('#dlgIsi'));
    return d;
  }
  function tutupDialog() { var d = $('#dlg'); if (d.open) d.close(); }

  var nomorPermintaanCabangKasir = 0;
  var timerPilihCabangKasir = null;
  var tampilkanLoaderCabangKasir = false;
  var sedangMuatCabangKasir = false;
  var cabangTransaksiAktif = '';
  var daftarCabangTransaksi = [];
  function siapkanPilihCabangTransaksi() {
    var sel = $('#pilihCabangTransaksi');
    if (!sel) return;
    daftarCabangTransaksi = Array.isArray(D.cabang) ? D.cabang.slice() : daftarCabangTransaksi;
    sel.innerHTML = '<option value="">Semua cabang · pilih sebelum bayar</option>' +
      daftarCabangTransaksi.map(function (c) {
        return '<option value="' + esc(c.id_cabang) + '">' + esc(c.nama_cabang || c.id_cabang) + '</option>';
      }).join('');
    sel.value = cabangTransaksiAktif || '';
    sel.onchange = function () {
      var id = String(sel.value || '');
      if (!(pengguna && pengguna.peran === 'owner')) return;
      // Jangan izinkan keranjang dari cabang A dijual memakai stok cabang B.
      // Pertahankan pilihan cabang sebelumnya sampai keranjang diselesaikan/dikosongkan.
      var cabangSebelumnya = String(cabangTransaksiAktif || '');
      if (keranjang.length && id !== cabangSebelumnya) {
        sel.value = cabangSebelumnya;
        toast('Selesaikan atau kosongkan keranjang sebelum pindah cabang.');
        return;
      }
      // Pilihan terbaru langsung menjadi sumber kebenaran. Respons request lama
      // tidak boleh mengubah dropdown, stok, atau katalog cabang yang sedang aktif.
      var requestId = ++nomorPermintaanCabangKasir;
      if (timerPilihCabangKasir) clearTimeout(timerPilihCabangKasir);
      cabangTransaksiAktif = id;
      tampilkanLoaderCabangKasir = true;
      if (id) {
        try { localStorage.setItem('kpg-cabang-transaksi-owner', id); } catch (e) {}
        // Cache cabang terpilih langsung ditampilkan jika tersedia.
        if (dataKatalogServer.length && terapkanBarangCabangLokal(id, dataKatalogServer)) {
          tampilkanLoaderCabangKasir = false;
        } else {
          D.produk = [];
          sumberProdukPOS = null;
          D.kategori = [];
          renderPOS();
        }
      } else {
        try { localStorage.removeItem('kpg-cabang-transaksi-owner'); } catch (e) {}
        renderPOS();
      }
      // Debounce singkat: hanya pilihan terakhir yang dikirim ke GAS.
      timerPilihCabangKasir = setTimeout(function () {
        if (requestId !== nomorPermintaanCabangKasir) return;
        var proses = id ? muatBarangUntukCabang(id, requestId) : muatSemuaBarangOwner(requestId);
        proses.catch(function (e) {
          if (requestId === nomorPermintaanCabangKasir) {
            tampilkanLoaderCabangKasir = false;
            renderPOS();
            toast((id ? 'Gagal memuat cabang: ' : 'Gagal memuat seluruh cabang: ') + e.message);
          }
        });
      }, 180);
    };
  }
  function terapkanBarangCabangLokal(idCabang, rows) {
    if (!Array.isArray(rows)) return false;
    var cabangRows = rows.filter(function (x) { return String(x.id_cabang || '') === String(idCabang); });
    if (!cabangRows.length) return false;
    D.produk = cabangRows.map(barangDariServer);
    sumberProdukPOS = null;
    D.kategori = Array.from(new Set(D.produk.map(function (p) { return p.kategori; })));
    D.id_cabang_aktif = String(idCabang);
    cabangTransaksiAktif = String(idCabang);
    try { localStorage.setItem('kpg-cabang-transaksi-owner', cabangTransaksiAktif); } catch (e) {}
    var pilihCabang = $('#pilihCabangTransaksi');
    if (pilihCabang) pilihCabang.value = idCabang;
    if (!D.stokPerCabang) D.stokPerCabang = {};
    D.stokPerCabang[String(idCabang)] = {};
    D.produk.forEach(function (p) {
      D.stokPerCabang[String(idCabang)][String(p.id)] = Number(p.stok) || 0;
    });
    produkKasirCache = D.produk.map(function (p) { return Object.assign({}, p); });
    tampilkanLoaderCabangKasir = false;
    renderPOS();
    simpan().catch(function (e) { console.warn('Snapshot cabang belum tersimpan:', e); });
    return true;
  }
  function muatBarangUntukCabang(idCabang, requestId) {
    requestId = requestId == null ? ++nomorPermintaanCabangKasir : requestId;
    var token = tokenAktif();
    if (requestId === nomorPermintaanCabangKasir) sedangMuatCabangKasir = true;
    var cachePromise = dataKatalogServer.length
      ? Promise.resolve(dataKatalogServer)
      : (window.KPGStorage && KPGStorage.getMeta
        ? KPGStorage.getMeta('catalog:v3:SEMUA').then(function (cached) {
            return Array.isArray(cached) ? cached : (cached && Array.isArray(cached.data) ? cached.data : []);
          }).catch(function () { return []; })
        : Promise.resolve([]));
    // Pakai katalog semua cabang yang sudah ada di memori/IndexedDB terlebih dahulu.
    // Dengan begitu pergantian cabang tidak perlu menunggu round-trip GAS untuk menggambar kasir.
    return cachePromise.then(function (rows) {
      if (requestId !== nomorPermintaanCabangKasir) return null;
      if (rows.length) {
        dataKatalogServer = rows;
        // Jika handler pemilihan sudah menampilkan cache cabang ini, jangan render
        // ulang daftar yang sama. Render ganda inilah yang membuat katalog berkedip.
        if (String(D.id_cabang_aktif || '') !== String(idCabang)) {
          terapkanBarangCabangLokal(idCabang, rows);
        }
      }
      return KPGApi.call('listBarang', { token: token, id_cabang: idCabang });
    }).then(function (r) {
      if (requestId !== nomorPermintaanCabangKasir || r === null) return D.produk;
      if (!Array.isArray(r.data)) throw new Error('Respons stok cabang tidak valid.');
      var produkServer = r.data.map(barangDariServer);
      var produkBerubah = produkServer.length !== D.produk.length;
      if (!produkBerubah) {
        for (var pi = 0; pi < produkServer.length; pi++) {
          var ps = produkServer[pi], pl = D.produk[pi];
          if (!pl || String(ps.id) !== String(pl.id) || Number(ps.stok || 0) !== Number(pl.stok || 0) ||
              ps.nama !== pl.nama || ps.kategori !== pl.kategori ||
              Number(ps.harga || 0) !== Number(pl.harga || 0) ||
              JSON.stringify(ps.varian || []) !== JSON.stringify(pl.varian || [])) {
            produkBerubah = true; break;
          }
        }
      }
      if (produkBerubah) {
        D.produk = produkServer;
        sumberProdukPOS = null;
        D.kategori = Array.from(new Set(D.produk.map(function (p) { return p.kategori; })));
      }
      D.id_cabang_aktif = String(idCabang);
      cabangTransaksiAktif = String(idCabang);
      try { localStorage.setItem('kpg-cabang-transaksi-owner', cabangTransaksiAktif); } catch (e) {}
      var pilihCabang = $('#pilihCabangTransaksi');
      if (pilihCabang) pilihCabang.value = idCabang;
      if (!D.stokPerCabang) D.stokPerCabang = {};
      D.stokPerCabang[String(idCabang)] = {};
      D.produk.forEach(function (p) {
        D.stokPerCabang[String(idCabang)][String(p.id)] = Number(p.stok) || 0;
      });
      produkKasirCache = D.produk.map(function (p) { return Object.assign({}, p); });
      tampilkanLoaderCabangKasir = false;
      sedangMuatCabangKasir = false;
      // Jangan bangun ulang seluruh kartu bila stok dan katalog sama dengan cache.
      if (produkBerubah) renderPOS();
      return simpan().then(function () { return D.produk; });
    }).catch(function (err) {
      if (requestId === nomorPermintaanCabangKasir) {
        tampilkanLoaderCabangKasir = false;
        sedangMuatCabangKasir = false;
        renderPOS();
      }
      throw err;
    });
  }
  function terapkanSemuaBarangOwner(rows) {
    if (!Array.isArray(rows)) return false;
    var gabung = {};
    D.stokPerCabang = D.stokPerCabang || {};
    rows.forEach(function (x) {
      var id = String(x.id_barang), idCab = String(x.id_cabang || '');
      var stok = Number(x.stok) || 0;
      if (idCab && id) {
        D.stokPerCabang[idCab] = D.stokPerCabang[idCab] || {};
        D.stokPerCabang[idCab][id] = stok;
      }
      if (!gabung[id]) gabung[id] = Object.assign({}, x, { stok: 0, id_cabang: '', nama_cabang: '', lokasi_rak: '', _cabang: [] });
      gabung[id].stok += stok;
      if (stok > 0) gabung[id]._cabang.push(String(x.nama_cabang || x.id_cabang || ''));
    });
    D.produk = Object.keys(gabung).map(function (id) {
      var x = gabung[id];
      x.cabang_stok_label = x._cabang.filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
      delete x._cabang;
      return barangDariServer(x);
    }).map(function (p) {
      var src = gabung[p.id];
      p.cabang_stok_label = src ? src.cabang_stok_label : '';
      return p;
    });
    sumberProdukPOS = null;
    D.kategori = Array.from(new Set(D.produk.map(function (p) { return p.kategori; })));
    D.id_cabang_aktif = '';
    cabangTransaksiAktif = '';
    siapkanPilihCabangTransaksi();
    produkKasirCache = D.produk.map(function (p) { return Object.assign({}, p); });
    tampilkanLoaderCabangKasir = false;
    renderPOS();
    return true;
  }
  function muatSemuaBarangOwner(requestId) {
    requestId = requestId == null ? ++nomorPermintaanCabangKasir : requestId;
    var token = tokenAktif();
    if (requestId === nomorPermintaanCabangKasir) sedangMuatCabangKasir = true;
    var cachePromise = dataKatalogServer.length
      ? Promise.resolve(dataKatalogServer)
      : (window.KPGStorage && KPGStorage.getMeta
        ? KPGStorage.getMeta('catalog:v3:SEMUA').then(function (cached) {
            return Array.isArray(cached) ? cached : (cached && Array.isArray(cached.data) ? cached.data : []);
          }).catch(function () { return []; })
        : Promise.resolve([]));
    return cachePromise.then(function (rows) {
      if (requestId !== nomorPermintaanCabangKasir) return null;
      if (rows.length) {
        dataKatalogServer = rows;
        terapkanSemuaBarangOwner(rows);
      }
      return KPGApi.call('listBarang', { token: token, id_cabang: '' });
    }).then(function (r) {
      if (requestId !== nomorPermintaanCabangKasir || r === null) return D.produk;
      if (!Array.isArray(r.data)) throw new Error('Data katalog seluruh cabang tidak valid.');
      dataKatalogServer = r.data;
      katalogLastFetchAt = Date.now();
      terapkanSemuaBarangOwner(r.data);
      sedangMuatCabangKasir = false;
      return Promise.resolve(window.KPGStorage && KPGStorage.setMeta
        ? KPGStorage.setMeta('catalog:v3:SEMUA', { data: dataKatalogServer, savedAt: katalogLastFetchAt }).catch(function (e) { console.warn('Cache katalog gagal disimpan:', e); })
        : null).then(function () {
          return simpan().then(function () { return D.produk; });
        });
    }).catch(function (err) {
      if (requestId === nomorPermintaanCabangKasir) {
        tampilkanLoaderCabangKasir = false;
        sedangMuatCabangKasir = false;
        renderPOS();
      }
      throw err;
    });
  }
  function mintaCabangOwner() {
    if (cabangTransaksiAktif) return Promise.resolve(cabangTransaksiAktif);
    var token = tokenAktif();
    if (!token) return Promise.reject(new Error('Login online diperlukan untuk memilih cabang transaksi.'));
    return KPGApi.call('listCabangStok', { token: token }).then(function (r) {
      daftarCabangTransaksi = Array.isArray(r.data) ? r.data : [];
      if (!daftarCabangTransaksi.length) throw new Error('Belum ada cabang yang memiliki data stok.');
      return new Promise(function (resolve, reject) {
        var html = '<h3>Pilih cabang transaksi</h3><p class="redup kecil">Stok dan transaksi akan menggunakan cabang yang dipilih.</p><div class="pilih-varian">' +
          daftarCabangTransaksi.map(function (c) { return '<button type="button" data-cabang="' + esc(c.id_cabang) + '"><span>' + esc(c.nama_cabang) + '</span><small>' + esc(c.id_cabang) + '</small></button>'; }).join('') +
          '</div><div class="dlg-aksi"><button type="button" class="tombol" id="batalPilihCabang">Batal</button></div>';
        dialog(html, function (f) {
          $('#batalPilihCabang', f).onclick = function () { tutupDialog(); reject(new Error('Pemilihan cabang dibatalkan.')); };
          $$('[data-cabang]', f).forEach(function (b) {
            b.onclick = function () {
              $$('[data-cabang]', f).forEach(function (x) { x.disabled = true; });
              var id = b.dataset.cabang;
              muatBarangUntukCabang(id).then(function () { tutupDialog(); resolve(id); })
                .catch(function (e) { tutupDialog(); reject(e); });
            };
          });
        });
      });
    });
  }
  function pilihVarian(p) {
    if (!p || Number(p.stok || 0) <= 0) return toast('Stok barang tidak tersedia.');
    return bukaPilihanVarian(p);
  }
  function bukaPilihanVarian(p) {
    if (p.varian.length === 1) return tambahKeKeranjang(p, p.varian[0]);
    dialog('<h3>' + esc(p.nama) + '</h3><div class="pilih-varian">' + p.varian.map(function (v, i) {
      return '<button type="button" data-i="' + i + '"><span>' + esc(v.nama) + '</span><span>' + rp(v.harga) + '</span></button>';
    }).join('') + '</div><div class="dlg-aksi"><button class="tombol" value="batal">Batal</button></div>', function (f) {
      $$('[data-i]', f).forEach(function (b) { b.onclick = function () { tambahKeKeranjang(p, p.varian[+b.dataset.i]); tutupDialog(); }; });
    });
  }

  function dialogBayar() {
    var h = hitung();
    var cepat = [h.total, Math.ceil(h.total / 5000) * 5000, Math.ceil(h.total / 10000) * 10000, Math.ceil(h.total / 50000) * 50000, 100000]
      .filter(function (v, i, a) { return v >= h.total && a.indexOf(v) === i; }).slice(0, 4);
    var IK = { tunai: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></svg>', qris: '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>', transfer: '<svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18"/></svg>' };
    var pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'hapus'];
    dialog('<div class="bayar"><div class="bayar-kiri"><div class="bayar-kepala"><h3>Pembayaran</h3><span class="redup kecil">' + keranjang.reduce(function (s, i) { return s + i.qty; }, 0) + ' item' + (h.diskon ? ' · diskon ' + rp(h.diskon) : '') + '</span></div>' +
      '<div class="total-besar"><small>Total tagihan</small>' + rp(h.total) + '</div>' +
      '<div class="metode" role="radiogroup" aria-label="Metode bayar">' + ['tunai', 'qris', 'transfer'].map(function (m, i) { return '<label><input type="radio" name="metode" value="' + m + '"' + (i ? '' : ' checked') + '>' + IK[m] + '<span>' + { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }[m] + '</span></label>'; }).join('') + '</div>' +
      '<div id="areaQris" class="qris" hidden><img src="qris.svg" alt="QRIS toko"><p class="redup kecil">Minta pelanggan memindai, cek notifikasi masuk, lalu selesaikan.</p></div>' +
      '<div id="areaTransfer" hidden class="rek"><small class="redup">Rekening tujuan</small><b>' + esc(D.toko.rekening || 'Atur nomor rekening di Pengaturan') + '</b><p class="redup kecil">Cek mutasi sebelum menyelesaikan.</p></div>' +
      '<div class="kembali" id="kembali"><span>Kembalian</span><span>Rp0</span></div></div>' +
      '<div class="bayar-kanan" id="areaTunai"><label class="layar-uang"><small>Uang diterima</small><span class="rp">Rp</span><input id="inBayar" type="number" inputmode="numeric" min="0" value="' + h.total + '"></label>' +
      '<div class="uang-cepat">' + cepat.map(function (v) { return '<button type="button" data-v="' + v + '">' + (v === h.total ? 'Uang pas' : rp(v)) + '</button>'; }).join('') + '</div>' +
      '<div class="numpad">' + pad.map(function (k) { return '<button type="button" data-np="' + k + '" aria-label="' + (k === 'hapus' ? 'Hapus angka' : k) + '">' + (k === 'hapus' ? '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z"/><path d="M13 9l5 6M18 9l-5 6"/></svg>' : k) + '</button>'; }).join('') + '</div></div>' +
      '<div class="dlg-aksi bayar-aksi"><button class="tombol" value="batal">Batal</button><button class="tombol utama besar" type="button" id="btnSelesai">Selesaikan pembayaran</button></div></div>', function (f) {
        var inB = $('#inBayar', f), baru = true;
        function upd() {
          var m = $('input[name=metode]:checked', f).value;
          $('#areaTunai', f).hidden = m !== 'tunai'; $('#areaQris', f).hidden = m !== 'qris'; $('#areaTransfer', f).hidden = m !== 'transfer';
          $('.bayar', f).classList.toggle('non-tunai', m !== 'tunai');
          var k = (parseFloat(inB.value) || 0) - h.total, el = $('#kembali', f);
          el.hidden = m !== 'tunai';
          el.classList.toggle('kurang', k < 0);
          el.innerHTML = '<span>' + (k < 0 ? 'Kurang' : 'Kembalian') + '</span><b>' + rp(Math.abs(k)) + '</b>';
        }
        $$('input[name=metode]', f).forEach(function (r) { r.onchange = upd; });
        inB.oninput = function () { baru = false; upd(); };
        $$('[data-v]', f).forEach(function (b) { b.onclick = function () { inB.value = b.dataset.v; baru = true; upd(); }; });
        $('.numpad', f).onclick = function (e) {
          var b = e.target.closest('[data-np]'); if (!b) return;
          var v = baru ? '' : String(inB.value || ''); baru = false;
          if (b.dataset.np === 'hapus') v = v.slice(0, -1); else if (v.length < 10) v = (v + b.dataset.np).replace(/^0+(?=\d)/, '');
          inB.value = v || 0; upd();
        };
        $('#btnSelesai', f).onclick = function () {
          var m = $('input[name=metode]:checked', f).value;
          var bayar = m === 'tunai' ? (parseFloat(inB.value) || 0) : h.total;
          if (bayar < h.total) { var k = $('#kembali', f); k.classList.remove('goyang'); void k.offsetWidth; k.classList.add('goyang'); return toast('Uang diterima masih kurang'); }
          selesaikan(m, bayar);
        };
        upd();
      });
  }

  function selesaikan(metode, bayar) {
    var h = hitung(), w = new Date();
    if (pengguna && pengguna.peran === 'owner' && !cabangTransaksiAktif) return toast('Pilih cabang sebelum menyelesaikan transaksi.');
    // Validasi ulang stok pada saat checkout, bukan hanya saat barang masuk keranjang.
    var stokTidakCukup = keranjang.find(function (item) {
      var produk = D.produk.find(function (p) { return String(p.id) === String(item.pid); });
      return !produk || Number(produk.stok || 0) < Number(item.qty || 0);
    });
    if (stokTidakCukup) return toast('Stok ' + stokTidakCukup.nama + ' tidak cukup. Muat ulang stok cabang sebelum membayar.');
    D.nomor = (D.nomor || 0) + 1;
    var clientId = 'KPG-' + uid() + '-' + w.getTime();
    var trx = { id: noTrx(w, D.nomor), waktu: w.toISOString(), kasir: pengguna.nama, id_user: pengguna.id_user || '',
      items: keranjang.map(function (i) { return Object.assign({}, i); }), subtotal: h.subtotal,
      diskon: h.diskon, total: h.total, metode: metode, bayar: bayar, kembali: bayar - h.total,
      client_id: clientId, id_cabang: (pengguna.peran === 'owner' ? cabangTransaksiAktif : (pengguna.id_cabang || D.id_cabang_aktif || '')),
      nama_cabang: (daftarCabangTransaksi.find(function (c) { return String(c.id_cabang) === String(pengguna.peran === 'owner' ? cabangTransaksiAktif : (pengguna.id_cabang || D.id_cabang_aktif || '')); }) || {}).nama_cabang || pengguna.nama_cabang || '',
      sync_status: 'MENUNGGU' };
    if (!D.stokPerCabang) D.stokPerCabang = {};
    if (trx.id_cabang && !D.stokPerCabang[trx.id_cabang]) D.stokPerCabang[trx.id_cabang] = {};
    var stokLokalCabang = trx.id_cabang ? D.stokPerCabang[trx.id_cabang] : null;
    trx.items.forEach(function (i) {
      var p = D.produk.find(function (x) { return String(x.id) === String(i.pid); });
      if (p) {
        p.stok = Math.max(0, Number(p.stok || 0) - Number(i.qty || 0));
        if (stokLokalCabang) stokLokalCabang[p.id] = p.stok;
      }
    });
    // Cache kasir harus ikut diperbarui; jika tidak, membuka tab Kasir kembali
    // dapat mengembalikan angka stok lama setelah transaksi lokal.
    if (pengguna && pengguna.peran === 'owner') {
      produkKasirCache = D.produk.map(function (p) { return Object.assign({}, p); });
    }
    D.transaksi.push(trx);
    var payload = {
      client_id: clientId, no_nota: trx.id, waktu: trx.waktu, id_cabang: trx.id_cabang,
      subtotal: trx.subtotal, diskon: trx.diskon, total: trx.total,
      metode_bayar: String(metode || 'tunai').toUpperCase(), bayar: trx.bayar, kembali: trx.kembali,
      items: trx.items.map(function (i) { return { id_barang: i.pid, nama_barang: i.nama, varian: i.varian, qty: i.qty, harga: i.harga, diskon_item: 0 }; })
    };
    var saved = simpan();
    if (window.KPGStorage) {
      Promise.all([saved, KPGStorage.enqueue({ client_id: clientId, owner_user_id: trx.id_user, payload: payload, created_at: w.toISOString(), attempts: 0 })])
        .then(function () { syncPending(); })
        .catch(function (err) { console.error('Gagal menyimpan antrean transaksi:', err); toast('Peringatan: antrean sinkronisasi belum tersimpan. Segera backup data.'); });
    }
    keranjang = []; $('#inDiskon').value = 0; $('#panelKeranjang').classList.remove('buka');
    dialog('<div class="sukses"><svg class="centang" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg><h3>Transaksi tersimpan di perangkat</h3><div class="total-besar"><small>' + { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }[metode] + '</small>' + rp(trx.total) + '</div></div>' +
      (metode === 'tunai' ? '<div class="kembali"><span>Kembalian</span><span>' + rp(trx.kembali) + '</span></div>' : '') +
      '<p class="redup kecil" style="text-align:center;margin:0">' + trx.id + '</p>' +
      '<p class="redup kecil" style="text-align:center;margin:6px 0">Status sinkronisasi: menunggu konfirmasi server</p>' +
      '<div class="dlg-aksi"><button class="tombol" type="button" id="btnCetak">Cetak struk</button><button class="tombol utama" value="ok">Transaksi baru</button></div>', function (f) {
        $('#btnCetak', f).onclick = function () { cetak(trx); };
      });
    // Stok lokal sudah dikurangi di atas. Jangan menarik stok server sebelum syncPush ACK,
    // karena respons server yang masih lama dapat menimpa pengurangan lokal sementara.
    renderPOS();
  }

  // ---------- Struk 58mm ----------
  function cetak(trx) {
    var t = D.toko;
    $('#struk').innerHTML = '<div class="tengah">' + (KONFIG.logo ? '<img class="struk-logo" src="' + esc(KONFIG.logo) + '" alt="" onerror="this.style.display=\'none\'">' : '') + '<h4>' + esc(t.nama) + '</h4>' + (t.alamat ? '<div>' + esc(t.alamat) + '</div>' : '') + (t.telp ? '<div>' + esc(t.telp) + '</div>' : '') + '</div>' +
      '<div class="gr"></div><div>' + trx.id + '</div><div>' + fmtWaktu(trx.waktu) + '</div><div>Kasir: ' + esc(trx.kasir) + '</div><div class="gr"></div>' +
      trx.items.map(function (i) { return '<div>' + esc(i.nama) + (i.varian ? ' (' + esc(i.varian) + ')' : '') + '</div><div class="br"><span>' + i.qty + ' x ' + rp(i.harga) + '</span><span>' + rp(i.qty * i.harga) + '</span></div>'; }).join('') +
      '<div class="gr"></div><div class="br"><span>Subtotal</span><span>' + rp(trx.subtotal) + '</span></div>' +
      (trx.diskon ? '<div class="br"><span>Diskon</span><span>-' + rp(trx.diskon) + '</span></div>' : '') +
      '<div class="br"><b>TOTAL</b><b>' + rp(trx.total) + '</b></div>' +
      '<div class="br"><span>' + trx.metode.toUpperCase() + '</span><span>' + rp(trx.bayar) + '</span></div>' +
      (trx.metode === 'tunai' ? '<div class="br"><span>Kembali</span><span>' + rp(trx.kembali) + '</span></div>' : '') +
      '<div class="gr"></div><div class="tengah">' + esc(t.footer) + '</div>';
    window.print();
  }

  // ---------- Kelola produk (server GAS, per cabang) ----------
  var cabangKatalogAktif = '';
  var dataKatalogServer = [];
  var sedangMuatKatalog = false;
  var katalogFetchPromise = null;
  var katalogLastFetchAt = 0;
  var katalogPageSize = 60;
  var katalogVisibleCount = katalogPageSize;
  var filterKatalogOwner = 'SEMUA';
  var daftarCabangKatalog = [];
  function tokenAktif() {
    try { return localStorage.getItem('kpg-token') || ''; } catch (e) { return ''; }
  }
  function tampilkanErrorKatalog(err) {
    var pesan = err && err.message ? err.message : String(err || 'Kesalahan tidak diketahui.');
    $('#tabelProduk').innerHTML = '<tbody><tr><td colspan="8" class="kosong"><b>Katalog gagal dimuat.</b><div style="margin:8px 0">' + esc(pesan) + '</div><button type="button" class="tombol utama" id="btnUlangiKatalog">Coba lagi</button></td></tr></tbody>';
    var ulang = $('#btnUlangiKatalog');
    if (ulang) ulang.onclick = function () { ulang.disabled = true; ulang.textContent = 'Memuat...'; muatKatalogServer(true).catch(tampilkanErrorKatalog); };
    toast('Katalog gagal dimuat: ' + pesan);
  }
  function siapkanPilihCabangKatalog(cabang) {
    var head = $('#tabelProduk').parentNode;
    var sel = $('#pilihCabangKatalog');
    if (!sel) {
      sel = document.createElement('select');
      sel.id = 'pilihCabangKatalog';
      sel.className = 'katalog-pilih-cabang';
      sel.setAttribute('aria-label', 'Filter cabang produk');
      var barCari = document.querySelector('.katalog-cari-wrap');
      if (barCari) barCari.appendChild(sel);
      else head.parentNode.insertBefore(sel, head);
      sel.onchange = function () {
        filterKatalogOwner = sel.value || 'SEMUA';
        katalogVisibleCount = katalogPageSize;
        renderKelola();
      };
    }
    var opts = '<option value="SEMUA">Semua cabang</option>' + cabang.map(function (x) {
      return '<option value="' + esc(x.id_cabang) + '">' + esc(x.nama_cabang || x.id_cabang) + ' (' + esc(x.id_cabang) + ')</option>';
    }).join('');
    sel.innerHTML = opts;
    sel.value = filterKatalogOwner;
  }
  function muatKatalogServer(paksa) {
    var token = tokenAktif();
    if (!token) return Promise.reject(new Error('Sesi online tidak ditemukan. Login online kembali.'));
    var cacheScope = 'SEMUA';
    var cacheKey = 'catalog:v3:' + cacheScope;
    daftarCabangKatalog = Array.isArray(D.cabang) ? D.cabang.slice() : [];
    if (daftarCabangKatalog.length) siapkanPilihCabangKatalog(daftarCabangKatalog);
    var now = Date.now();
    // Data di memori/IndexedDB menjadi sumber pertama. Jangan panggil GAS lagi
    // setiap kali pengguna berpindah tab.
    if (!paksa && dataKatalogServer.length) {
      renderKelola();
      if (!navigator.onLine || (katalogLastFetchAt && now - katalogLastFetchAt < 5 * 60 * 1000)) return Promise.resolve(dataKatalogServer);
      if (katalogFetchPromise) return katalogFetchPromise;
      return segarkanKatalogDariServer(token, cacheKey);
    }
    if (paksa && katalogFetchPromise) return katalogFetchPromise;
    if (katalogFetchPromise) return katalogFetchPromise;
    if (!paksa && window.KPGStorage && KPGStorage.getMeta) {
      return KPGStorage.getMeta(cacheKey).catch(function () { return null; }).then(function (cached) {
        var data = Array.isArray(cached) ? cached : (cached && Array.isArray(cached.data) ? cached.data : []);
        var savedAt = cached && !Array.isArray(cached) ? Number(cached.savedAt) || 0 : 0;
        if (data.length) {
          dataKatalogServer = data;
          katalogLastFetchAt = savedAt;
          renderKelola();
          // Cache masih segar: tampilkan langsung tanpa menunggu GAS.
          if (!navigator.onLine || (savedAt && Date.now() - savedAt < 5 * 60 * 1000)) return dataKatalogServer;
        }
        if (!navigator.onLine && dataKatalogServer.length) return dataKatalogServer;
        return segarkanKatalogDariServer(token, cacheKey);
      });
    }
    return segarkanKatalogDariServer(token, cacheKey);
  }
  function segarkanKatalogDariServer(token, cacheKey) {
    if (katalogFetchPromise) return katalogFetchPromise;
    sedangMuatKatalog = true;
    katalogFetchPromise = KPGApi.call('listBarang', { token: token, id_cabang: '' }).then(function (hasil) {
      if (!Array.isArray(hasil.data)) throw new Error('Data katalog dari server tidak valid.');
      dataKatalogServer = hasil.data;
      katalogLastFetchAt = Date.now();
      daftarCabangKatalog = Array.isArray(D.cabang) ? D.cabang.slice() : [];
      siapkanPilihCabangKatalog(daftarCabangKatalog);
      renderKelola();
      if (window.KPGStorage && KPGStorage.setMeta) {
        return KPGStorage.setMeta(cacheKey, { data: dataKatalogServer, savedAt: katalogLastFetchAt })
          .catch(function (e) { console.warn('Cache katalog gagal disimpan:', e); })
          .then(function () { return dataKatalogServer; });
      }
      return dataKatalogServer;
    }).catch(function (err) {
      // Jika server gagal, jangan kosongkan katalog yang sudah tersedia secara lokal.
      if (dataKatalogServer.length) {
        console.warn('Refresh katalog gagal; menggunakan cache lokal:', err);
        renderKelola();
        toast('Katalog memakai data tersimpan. Sinkronisasi server akan dicoba lagi nanti.');
        return dataKatalogServer;
      }
      throw err;
    }).finally(function () {
      sedangMuatKatalog = false;
      katalogFetchPromise = null;
    });
    return katalogFetchPromise;
  }
  var katalogScanStream = null;
  var katalogScanActive = false;
  function stopKatalogScanner() {
    katalogScanActive = false;
    if (katalogScanStream) {
      katalogScanStream.getTracks().forEach(function (track) { track.stop(); });
      katalogScanStream = null;
    }
    var video = $('#videoScanKatalog');
    if (video) { try { video.pause(); video.srcObject = null; } catch (e) {} }
  }
  var kasirScanStream = null;
  var kasirScanActive = false;
  function stopKasirScanner() {
    kasirScanActive = false;
    if (kasirScanStream) {
      kasirScanStream.getTracks().forEach(function (track) { track.stop(); });
      kasirScanStream = null;
    }
    var video = $('#videoScanKasir');
    if (video) { try { video.pause(); video.srcObject = null; } catch (e) {} }
  }
  function bukaScannerKasir() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return toast('Kamera tidak tersedia. Pastikan aplikasi dibuka melalui HTTPS.');
    }
    if (!('BarcodeDetector' in window)) {
      return toast('Pemindai barcode belum didukung browser ini. Gunakan Chrome versi terbaru atau ketik barcode.');
    }
    dialog('<h3>Scan barcode barang</h3><p class="redup kecil">Arahkan barcode ke kamera untuk mencari barang di katalog Kasir.</p><div class="katalog-scan-frame"><video id="videoScanKasir" autoplay muted playsinline></video><span class="katalog-scan-line"></span></div><div class="dlg-aksi"><button type="button" class="tombol" id="btnTutupScanKasir">Tutup kamera</button></div>', function (f) {
      var video = $('#videoScanKasir', f), detector;
      try { detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code'] }); }
      catch (e) { toast('Format barcode tidak didukung browser.'); tutupDialog(); return; }
      $('#btnTutupScanKasir', f).onclick = function () { stopKasirScanner(); tutupDialog(); };
      kasirScanActive = true;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(function (stream) {
          if (!kasirScanActive) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
          kasirScanStream = stream; video.srcObject = stream; return video.play();
        }).then(function () {
          function deteksi() {
            if (!kasirScanActive || !video || !video.srcObject) return;
            detector.detect(video).then(function (hasil) {
              if (hasil && hasil.length && kasirScanActive) {
                var kode = String(hasil[0].rawValue || '').trim();
                if (kode) {
                  stopKasirScanner(); tutupDialog();
                  var cari = $('#cariProduk');
                  if (cari) { cari.value = kode; katAktif = 'Semua'; renderPOS(); cari.focus(); }
                  toast('Barcode terbaca: ' + kode + '. Pilih barang dari hasil pencarian.');
                  return;
                }
              }
              if (kasirScanActive) setTimeout(deteksi, 180);
            }).catch(function () { if (kasirScanActive) setTimeout(deteksi, 300); });
          }
          deteksi();
        }).catch(function (err) {
          stopKasirScanner();
          toast(err && err.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini.' : 'Kamera gagal dibuka. Periksa kamera dan izin browser.');
        });
      $('#dlg').addEventListener('close', stopKasirScanner, { once: true });
    });
  }

  function bukaScannerKatalog() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return toast('Kamera tidak tersedia. Pastikan aplikasi dibuka melalui HTTPS.');
    }
    if (!('BarcodeDetector' in window)) {
      return toast('Pemindai barcode belum didukung browser ini. Gunakan Chrome versi terbaru atau ketik barcode.');
    }
    dialog('<h3>Scan barcode produk</h3><p class="redup kecil">Arahkan barcode ke dalam kotak kamera.</p><div class="katalog-scan-frame"><video id="videoScanKatalog" autoplay muted playsinline></video><span class="katalog-scan-line"></span></div><div class="dlg-aksi"><button type="button" class="tombol" id="btnTutupScanKatalog">Tutup kamera</button></div>', function (f) {
      var video = $('#videoScanKatalog', f);
      var detector;
      try { detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code'] }); }
      catch (e) { toast('Format barcode tidak didukung browser.'); tutupDialog(); return; }
      $('#btnTutupScanKatalog', f).onclick = function () { stopKatalogScanner(); tutupDialog(); };
      katalogScanActive = true;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(function (stream) {
          if (!katalogScanActive) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
          katalogScanStream = stream;
          video.srcObject = stream;
          return video.play();
        }).then(function () {
          function deteksi() {
            if (!katalogScanActive || !video || !video.srcObject) return;
            detector.detect(video).then(function (hasil) {
              if (hasil && hasil.length && katalogScanActive) {
                var kode = hasil[0].rawValue || '';
                if (kode) {
                  stopKatalogScanner(); tutupDialog();
                  var cari = $('#cariKelola');
                  if (cari) { cari.value = kode; katalogVisibleCount = katalogPageSize; renderKelola(); cari.focus(); }
                  toast('Barcode ditemukan: ' + kode);
                  return;
                }
              }
              if (katalogScanActive) setTimeout(deteksi, 180);
            }).catch(function () { if (katalogScanActive) setTimeout(deteksi, 300); });
          }
          deteksi();
        }).catch(function (err) {
          stopKatalogScanner();
          toast(err && err.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini.' : 'Kamera gagal dibuka. Periksa kamera dan izin browser.');
        });
      $('#dlg').addEventListener('close', stopKatalogScanner, { once: true });
    });
  }

  function renderKelola() {
    var input = $('#cariKelola');
    var q = String(input && input.value || '').toLowerCase().trim();
    var owner = !!(pengguna && pengguna.peran === 'owner');
    var selectedBranch = owner ? String(filterKatalogOwner || 'SEMUA') : String((pengguna && pengguna.id_cabang) || D.id_cabang_aktif || '');
    // Penting: kelompokkan dari SEMUA data dahulu. Jangan buang cabang lain
    // sebelum memutuskan apakah suatu barang benar-benar kosong di seluruh cabang.
    var rows = Array.isArray(dataKatalogServer) ? dataKatalogServer : [];
    var kataCari = q.split(/\\s+/).filter(Boolean);
    var cocok = rows.filter(function (p) {
      var target = [p.nama_barang || p.nama || '', p.id_barang || p.id || '', p.barcode || '', p.id_cabang || '', p.nama_cabang || '', p.kategori || '', p.lokasi_rak || ''].join(' ').toLowerCase();
      return (!kataCari.length || kataCari.every(function (kata) { return target.indexOf(kata) > -1; })) && String(p.id_barang || p.id || '').trim() !== '';
    });
    var grup = Object.create(null), urutan = [];
    cocok.forEach(function (p) {
      var id = String(p.id_barang || p.id || '').trim();
      if (!grup[id]) { grup[id] = []; urutan.push(id); }
      var cabang = String(p.id_cabang || '').trim(), key = id + '|' + cabang;
      if (!grup[id]._seen) grup[id]._seen = Object.create(null);
      if (grup[id]._seen[key]) return;
      grup[id]._seen[key] = true;
      grup[id].push(p);
    });
    var list = [];
    urutan.forEach(function (id) {
      var item = grup[id];
      var tersediaSemua = item.filter(function (p) { return Number(p.stok || 0) > 0 && String(p.id_cabang || '').trim(); });
      if (tersediaSemua.length) {
        if (selectedBranch === 'SEMUA') {
          tersediaSemua.forEach(function (p) { list.push({ data:p, kosong:false }); });
        } else {
          var tersediaTerpilih = tersediaSemua.filter(function (p) { return String(p.id_cabang || '') === selectedBranch; });
          tersediaTerpilih.forEach(function (p) { list.push({ data:p, kosong:false }); });
          // Bila barang ada stok di cabang lain, tetapi tidak di cabang pilihan,
          // jangan tampilkan sebagai barang kosong pada cabang pilihan.
        }
      } else if (item.length) {
        // Hanya benar-benar kosong di SEMUA cabang: satu kartu abu-abu.
        list.push({ data:item[0], kosong:true });
      }
    });
    // Barang dengan stok tersedia selalu di atas; stok 0 diletakkan paling bawah.
    list.sort(function (a, b) {
      var stokA = a.kosong ? 0 : (Number(a.data.stok) || 0);
      var stokB = b.kosong ? 0 : (Number(b.data.stok) || 0);
      if (stokA !== stokB) return stokB - stokA;
      return String(a.data.nama_barang || a.data.nama || '').localeCompare(String(b.data.nama_barang || b.data.nama || ''), 'id');
    });
    var tampil = list.slice(0, katalogVisibleCount);
    $('#tabelProduk').innerHTML = tampil.length ? tampil.map(function (entry) {
      var p = entry.data, kosong = entry.kosong;
      var id = String(p.id_barang || p.id || ''), nama = String(p.nama_barang || p.nama || '');
      var cabang = String(p.id_cabang || '');
      var namaCabang = kosong ? 'Stok kosong di semua cabang' : String(p.nama_cabang || cabang || 'Cabang');
      var harga = Number(p.harga_jual || 0) || 0, stok = kosong ? 0 : (Number(p.stok) || 0);
      var foto = p.foto ? '<img class="katalog-admin-foto' + (kosong ? ' katalog-foto-kosong' : '') + '" src="' + esc(String(p.foto)) + '" alt="" loading="lazy">' :
        '<span class="katalog-admin-inisial' + (kosong ? ' katalog-foto-kosong' : '') + '" aria-hidden="true">' + esc((nama.trim().charAt(0) || 'P').toUpperCase()) + '</span>';
      return '<article class="katalog-admin-kartu' + (kosong ? ' stok-kosong' : '') + '">' +
        '<div class="katalog-admin-visual">' + foto +
        '<button class="katalog-admin-edit" type="button" data-edit-kartu="' + esc(id) + '" data-cabang="' + esc(cabang) + '" aria-label="Edit ' + esc(nama) + '" title="Edit produk">✎</button></div>' +
        '<div class="katalog-admin-info"><div class="katalog-admin-judul">' + esc(nama) + '</div>' +
        '<div class="katalog-admin-detailbar"><div class="katalog-admin-detail-left">' +
        '<div class="katalog-admin-meta">' + esc(namaCabang) + '</div>' +
        '<div class="katalog-admin-meta">' + esc(String(kosong ? '-' : (p.lokasi_rak || '-'))) + '</div>' +
        '</div><div class="katalog-admin-stok' + (kosong ? ' stok-nol' : '') + '">' + stok + '</div></div>' +
        '<div class="katalog-admin-harga">' + rp(harga) + '</div></div></article>';
    }).join('') : '<div class="kosong katalog-admin-kosong"><b>Belum ada produk</b><span>Tidak ada barang dengan stok pada cabang yang dipilih.</span></div>';
    if (list.length > tampil.length) {
      $('#tabelProduk').insertAdjacentHTML('beforeend', '<button type="button" class="tombol katalog-muat-lagi" data-muat-lagi>tampilkan ' + Math.min(katalogPageSize, list.length - tampil.length) + ' produk berikutnya (' + tampil.length + '/' + list.length + ')</button>');
    }
  }
  function formProduk(p) {
    var baru = !p;
    p = p || { id: '', nama: '', kategori: D.kategori[0] || 'Umum', barcode: '', kode_barang: '', satuan: 'pcs', harga_beli: 0, id_supplier: '', nama_supplier: '', foto: '', varian: [{ nama: 'Reguler', harga: 0 }] };
    var harga = p.varian && p.varian[0] ? p.varian[0].harga : 0;
    var suppliers = Array.isArray(D.supplier) ? D.supplier : [];
    var optSupplier = '<option value="">-- Tanpa supplier / pilih supplier --</option>' +
      suppliers.map(function (s) {
        var idS = String(s.id_supplier || '');
        var nmS = String(s.nama_supplier || idS);
        var sel = (idS && idS === String(p.id_supplier || '')) ? ' selected' : '';
        return '<option value="' + esc(idS) + '" data-nama="' + esc(nmS) + '"' + sel + '>' + esc(nmS) + (idS ? ' (' + esc(idS) + ')' : '') + '</option>';
      }).join('');

    dialog('<h3>' + (baru ? 'Tambah' : 'Ubah') + ' master produk</h3><div class="form">' +
      '<label>Nama produk<input id="fNama" required value="' + esc(p.nama) + '"></label>' +
      '<label>Kategori<input id="fKat" required value="' + esc(p.kategori || 'Umum') + '"></label>' +
      '<label>Barcode<input id="fBarcode" value="' + esc(p.barcode || '') + '"></label>' +
      '<label>Kode barang<input id="fKode" value="' + esc(p.kode_barang || '') + '"></label>' +
      '<label>Satuan<input id="fSatuan" value="' + esc(p.satuan || 'pcs') + '"></label>' +
      '<label>Supplier<select id="fSupplier">' + optSupplier + '</select></label>' +
      '<label>Harga beli<input id="fBeli" type="number" min="0" value="' + (p.harga_beli || 0) + '"></label>' +
      '<label>Harga jual master<input id="fJual" type="number" min="0" value="' + harga + '"></label>' +
      '<label>Foto produk (URL atau unggah gambar)' +
        '<input id="fFotoUrl" type="url" placeholder="https://... atau pilih file di bawah" value="' + esc(p.foto || '') + '">' +
        '<input id="fFotoFile" type="file" accept="image/*" style="margin-top:6px">' +
      '</label>' +
      '<div id="fFotoPreview" style="margin-top:4px">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt="Pratinjau" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--garis)">' : '<span class="redup kecil">Belum ada foto produk</span>') + '</div>' +
      '</div>' +
      '<p class="redup kecil">Stok dan lokasi rak diatur terpisah untuk setiap cabang. Harga di sini adalah harga master.</p>' +
      '<div class="dlg-aksi">' + (baru ? '' : '<button type="button" class="tombol bahaya" id="fHapus" style="margin-right:auto">Hapus</button>') +
      '<button class="tombol" value="batal" formnovalidate>Batal</button><button class="tombol utama" type="button" id="fSimpan">Simpan</button></div>', function (f) {
        var fotoDataBase64 = '';
        var fotoMime = 'image/jpeg';
        var fotoNamaFile = '';
        var inFotoUrl = $('#fFotoUrl', f);
        var inFotoFile = $('#fFotoFile', f);
        var boxPreview = $('#fFotoPreview', f);

        inFotoUrl.oninput = function () {
          fotoDataBase64 = '';
          var u = inFotoUrl.value.trim();
          boxPreview.innerHTML = u
            ? '<img src="' + esc(u) + '" alt="Pratinjau" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--garis)" onerror="this.style.display=\'none\'">'
            : '<span class="redup kecil">Belum ada foto produk</span>';
        };

        inFotoFile.onchange = function () {
          var file = inFotoFile.files && inFotoFile.files[0];
          if (!file) return;
          fotoNamaFile = file.name || 'produk.jpg';
          var r = new FileReader();
          r.onload = function () {
            var im = new Image();
            im.onload = function () {
              var k = Math.min(1, 320 / Math.max(im.width, im.height));
              var c = document.createElement('canvas');
              c.width = Math.round(im.width * k);
              c.height = Math.round(im.height * k);
              c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
              var dataUrl = c.toDataURL('image/jpeg', 0.72);
              fotoDataBase64 = dataUrl.split(',')[1] || '';
              fotoMime = 'image/jpeg';
              boxPreview.innerHTML = '<img src="' + dataUrl + '" alt="Pratinjau" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--garis)"> <span class="redup kecil">Siap diunggah ke Drive</span>';
            };
            im.onerror = function () { toast('Berkas bukan gambar yang valid.'); };
            im.src = r.result;
          };
          r.readAsDataURL(file);
        };

        if (!baru) $('#fHapus', f).onclick = function () {
          if (!confirm('Tandai produk ' + p.nama + ' sebagai terhapus dari master?')) return;
          KPGApi.call('saveBarang', { token: tokenAktif(), id_barang: p.id, nama_barang: p.nama, kategori: p.kategori, barcode: p.barcode || '', kode_barang: p.kode_barang || '', satuan: p.satuan || 'pcs', harga_beli: p.harga_beli || 0, harga_jual: harga, id_supplier: p.id_supplier || '', nama_supplier: p.nama_supplier || '', foto: p.foto || '', status: 'HAPUS' })
            .then(function () { tutupDialog(); return muatKatalogServer(true); }).then(function () { if (pengguna && pengguna.peran === 'owner' && cabangTransaksiAktif) return muatBarangUntukCabang(cabangTransaksiAktif); }).then(function () { toast('Produk dihapus dari master server.'); })
            .catch(function (e) { toast('Gagal menghapus: ' + e.message); });
        };

        $('#fSimpan', f).onclick = function () {
          var nama = $('#fNama', f).value.trim();
          if (!nama) return toast('Nama produk wajib diisi.');
          var selSup = $('#fSupplier', f);
          var idSupplier = selSup ? selSup.value.trim() : '';
          var namaSupplier = (selSup && selSup.selectedOptions && selSup.selectedOptions[0] && idSupplier)
            ? (selSup.selectedOptions[0].dataset.nama || '') : '';
          var btnSimpan = $('#fSimpan', f);
          btnSimpan.disabled = true;
          btnSimpan.textContent = 'Menyimpan...';

          var uploadPromise = fotoDataBase64
            ? KPGApi.call('uploadFotoBarang', {
                token: tokenAktif(),
                id_barang: baru ? '' : p.id,
                nama_file: fotoNamaFile || (nama + '.jpg'),
                mime_type: fotoMime,
                base64: fotoDataBase64
              }).then(function (up) { return up.url || up.foto || ''; })
            : Promise.resolve(inFotoUrl.value.trim());

          uploadPromise.then(function (fotoUrlFinal) {
            var payload = {
              token: tokenAktif(),
              id_barang: baru ? '' : p.id,
              nama_barang: nama,
              kategori: $('#fKat', f).value.trim() || 'Umum',
              barcode: $('#fBarcode', f).value.trim(),
              kode_barang: $('#fKode', f).value.trim(),
              satuan: $('#fSatuan', f).value.trim() || 'pcs',
              id_supplier: idSupplier,
              nama_supplier: namaSupplier,
              harga_beli: Math.max(0, Number($('#fBeli', f).value) || 0),
              harga_jual: Math.max(0, Number($('#fJual', f).value) || 0),
              foto: fotoUrlFinal,
              status: 'AKTIF'
            };
            return KPGApi.call('saveBarang', payload);
          }).then(function () {
            tutupDialog();
            return muatKatalogServer(true).then(function () {
              if (pengguna && pengguna.peran === 'owner' && cabangTransaksiAktif) return muatBarangUntukCabang(cabangTransaksiAktif);
            });
          }).then(function () {
            toast('Master produk tersimpan di server.');
          }).catch(function (e) {
            btnSimpan.disabled = false;
            btnSimpan.textContent = 'Simpan';
            toast('Gagal menyimpan: ' + e.message);
          });
        };
      });
  }
  function aturStokCabang(p) {
    var idCabangStok = String(p.id_cabang || cabangKatalogAktif || '');
    if (!idCabangStok) return toast('Pilih cabang tertentu sebelum mengatur stok.');
    var stok = prompt('Masukkan jumlah stok akhir untuk ' + p.nama + ' di cabang ' + idCabangStok + ':', String(p.stok));
    if (stok === null) return;
    var n = Number(stok);
    if (!Number.isInteger(n) || n < 0) return toast('Stok harus bilangan bulat nol atau lebih.');
    var rak = prompt('Lokasi rak (kosongkan jika tidak ada):', p.lokasi_rak || '');
    if (rak === null) return;
    KPGApi.call('saveStokCabang', { token: tokenAktif(), id_cabang: idCabangStok, id_barang: p.id, stok: n, lokasi_rak: rak })
      .then(function () { return muatKatalogServer(true); })
      .then(function () { if (pengguna && pengguna.peran === 'owner' && cabangTransaksiAktif) return muatBarangUntukCabang(cabangTransaksiAktif); })
      .then(function () { toast('Stok cabang berhasil disimpan di server.'); })
      .catch(function (e) { toast('Gagal menyimpan stok: ' + e.message); });
  }

  function formKategori() {
    function isi() {
      return '<h3>Kategori</h3><ul class="daftar-kasir">' + D.kategori.map(function (k, i) {
        var n = D.produk.filter(function (p) { return p.kategori === k; }).length;
        return '<li><span>' + esc(k) + ' <span class="redup kecil">(' + n + ' produk)</span></span><button type="button" class="tautan" data-h="' + i + '"' + (n ? ' disabled title="Masih dipakai"' : '') + '>Hapus</button></li>';
      }).join('') + '</ul><div class="form sebaris" style="grid-template-columns:1fr auto"><input id="kBaru" placeholder="Kategori baru"><button type="button" class="tombol" id="kTambah">Tambah</button></div><div class="dlg-aksi"><button class="tombol utama" value="ok">Selesai</button></div>';
    }
    function ikat(f) {
      $('#kTambah', f).onclick = function () { var v = $('#kBaru', f).value.trim(); if (v && D.kategori.indexOf(v) < 0) { D.kategori.push(v); simpan(); dialog(isi(), ikat); } };
      $$('[data-h]', f).forEach(function (b) { b.onclick = function () { D.kategori.splice(+b.dataset.h, 1); simpan(); dialog(isi(), ikat); }; });
    }
    dialog(isi(), ikat);
  }

  // ---------- Riwayat ----------
  function trxFilter() {
    var t = $('#filterTanggal').value;
    return D.transaksi.filter(function (x) { return !t || tglKey(new Date(x.waktu)) === t; }).slice().reverse();
  }
  function renderRiwayat() {
    var list = trxFilter();
    $('#daftarTrx').innerHTML = list.length ? list.slice(0, 200).map(function (x) {
      var cabangLabel = String(x.nama_cabang || '').trim() || String(x.id_cabang || '').trim() || 'Cabang tidak tercatat';
      return '<div class="trx"><div><b>' + x.id + '</b><div class="meta">' + fmtWaktu(x.waktu) + ' · ' + esc(x.kasir) + ' · ' + x.metode.toUpperCase() + ' · ' + x.items.reduce(function (s, i) { return s + i.qty; }, 0) + ' item</div><div class="meta">Cabang: ' + esc(cabangLabel) + '</div>' +
        '<div class="meta">' + x.items.map(function (i) { return esc(i.nama) + ' ×' + i.qty; }).join(', ') + '</div></div><div class="tot">' + rp(x.total) + '</div>' +
        '<div class="aksi"><button class="tombol" data-cetak="' + x.id + '">Cetak</button>' + (isAdmin() ? '<button class="tombol bahaya" data-hapus="' + x.id + '">Batalkan</button>' : '') + '</div></div>';
    }).join('') : '<p class="kosong">Belum ada transaksi.</p>';
  }

  function eksporTrx() {
    var rows = [['id', 'waktu', 'kasir', 'produk', 'varian', 'qty', 'harga', 'subtotal_item', 'diskon_trx', 'total_trx', 'metode']];
    trxFilter().reverse().forEach(function (x) { x.items.forEach(function (i) { rows.push([x.id, x.waktu, x.kasir, i.nama, i.varian, i.qty, i.harga, i.qty * i.harga, x.diskon, x.total, x.metode]); }); });
    unduh('transaksi-' + ($('#filterTanggal').value || 'semua') + '.csv', '﻿' + rows.map(function (r) { return r.map(csvSel).join(','); }).join('\n'), 'text/csv');
  }

  // ---------- Laporan ----------
  var modeLap = 'hari';
  function ringkasan(list) {
    var omzet = 0, item = 0, perProduk = {}, metode = { tunai: 0, qris: 0, transfer: 0 };
    list.forEach(function (x) {
      omzet += x.total; metode[x.metode] = (metode[x.metode] || 0) + x.total;
      x.items.forEach(function (i) { item += i.qty; var k = i.nama; perProduk[k] = perProduk[k] || { nama: k, qty: 0, nilai: 0 }; perProduk[k].qty += i.qty; perProduk[k].nilai += i.qty * i.harga; });
    });
    var top = Object.keys(perProduk).map(function (k) { return perProduk[k]; }).sort(function (a, b) { return b.qty - a.qty || b.nilai - a.nilai; });
    return { omzet: omzet, trx: list.length, item: item, rata: list.length ? omzet / list.length : 0, top: top, metode: metode };
  }
  function renderLaporan() {
    var inp = $('#tglLaporan'); if (!inp.value) inp.value = tglKey(new Date());
    var t = new Date(inp.value + 'T00:00:00');
    var list = D.transaksi.filter(function (x) { var d = new Date(x.waktu); return modeLap === 'hari' ? tglKey(d) === inp.value : d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth(); });
    var r = ringkasan(list);
    $('#kartuAngka').innerHTML = '<div class="angka sorot"><small>Omzet</small><b>' + rp(r.omzet) + '</b></div><div class="angka"><small>Transaksi</small><b>' + r.trx + '</b></div><div class="angka"><small>Item terjual</small><b>' + r.item + '</b></div><div class="angka"><small>Rata-rata/struk</small><b>' + rp(r.rata) + '</b></div>';
    var batang = [];
    if (modeLap === 'hari') {
      $('#judulGrafik').textContent = 'Penjualan per jam';
      for (var j = 7; j <= 22; j++) batang.push({ l: j, v: 0 });
      list.forEach(function (x) { var h = new Date(x.waktu).getHours(); var b = batang.find(function (z) { return z.l === h; }); if (b) b.v += x.total; });
    } else {
      $('#judulGrafik').textContent = 'Penjualan per tanggal';
      var hari = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
      for (var d = 1; d <= hari; d++) batang.push({ l: d, v: 0 });
      list.forEach(function (x) { batang[new Date(x.waktu).getDate() - 1].v += x.total; });
    }
    var maks = Math.max.apply(null, batang.map(function (b) { return b.v; }).concat([1]));
    $('#grafik').innerHTML = batang.map(function (b, i) {
      var lbl = modeLap === 'bulan' && i % 5 !== 0 && b.l !== batang.length ? '&nbsp;' : b.l;
      return '<div class="kol" title="' + b.l + ': ' + rp(b.v) + '"><div class="batang' + (b.v ? '' : ' nol') + '" style="height:' + (b.v / maks * 100) + '%"></div><small>' + lbl + '</small></div>';
    }).join('');
    $('#terlaris').innerHTML = r.top.slice(0, 7).map(function (p) { return '<li><span>' + esc(p.nama) + '</span><b>' + p.qty + '×</b></li>'; }).join('') || '<li style="display:block" class="redup">Belum ada penjualan.</li>';
    $('#metodeRingkas').innerHTML = ['tunai', 'qris', 'transfer'].map(function (m) { return '<div><small class="redup">' + m.toUpperCase() + '</small><b>' + rp(r.metode[m]) + '</b></div>'; }).join('');
  }

  // ---------- Pengaturan ----------
  function renderAtur() {
    var f = $('#formToko');
    ['nama', 'alamat', 'telp', 'footer', 'rekening'].forEach(function (k) { f.elements[k].value = D.toko[k] || ''; });
    $('#daftarKasirAtur').innerHTML = D.kasir.map(function (k) {
      return '<li><span><b>' + esc(k.nama) + '</b> <span class="lencana">' + k.peran + '</span></span>' + (k.id === pengguna.id ? '<span class="redup kecil">sedang masuk</span>' : '<button class="tautan" data-hk="' + k.id + '">Hapus</button>') + '</li>';
    }).join('');
    var panelAudit = $('#panelAuditOwner');
    if (panelAudit) panelAudit.hidden = !isOwner();
  }

  function eksporProdukCSV() {
    var rows = [['nama', 'kategori', 'stok', 'varian']].concat(D.produk.map(function (p) { return [p.nama, p.kategori, p.stok, p.varian.map(function (v) { return v.nama + ':' + v.harga; }).join('|')]; }));
    unduh('produk.csv', '﻿' + rows.map(function (r) { return r.map(csvSel).join(','); }).join('\n'), 'text/csv');
  }
  function imporProdukCSV(teks) {
    var rows = parseCSV(teks.replace(/^﻿/, ''));
    if (rows.length && /nama/i.test(rows[0][0])) rows.shift();
    var n = 0;
    rows.forEach(function (r) {
      var nama = (r[0] || '').trim(); if (!nama) return;
      var kat = (r[1] || 'Umum').trim();
      if (D.kategori.indexOf(kat) < 0) D.kategori.push(kat);
      var varian = (r[3] || 'Reguler:0').split('|').map(function (s) { var a = s.split(':'); return { nama: (a[0] || 'Reguler').trim(), harga: Math.max(0, parseInt(a[1], 10) || 0) }; });
      var ada = D.produk.find(function (p) { return p.nama.toLowerCase() === nama.toLowerCase(); });
      var data = { nama: nama, kategori: kat, stok: Math.max(0, parseInt(r[2], 10) || 0), varian: varian };
      if (ada) Object.assign(ada, data); else D.produk.push(Object.assign({ id: uid() }, data));
      n++;
    });
    simpan(); return n;
  }
  function bacaFile(input, cb) {
    var file = input.files[0]; if (!file) return;
    var r = new FileReader(); r.onload = function () { cb(String(r.result)); input.value = ''; }; r.readAsText(file);
  }

  // ---------- Event ----------
  // Scanner USB/Bluetooth mode keyboard-wedge: baca barcode tanpa fokus ke kolom pencarian.
  var inputScanKasir = '', timerScanKasir = null, awalScanKasir = 0;
  function prosesBarcodeKasir(kode) {
    kode = String(kode || '').trim();
    if (!kode) return;
    var cocok = D.produk.filter(function (p) {
      return String(p.barcode || '').trim().toLowerCase() === kode.toLowerCase()
        || String(p.kode_barang || '').trim().toLowerCase() === kode.toLowerCase();
    });
    if (!cocok.length) {
      $('#cariProduk').value = kode;
      katAktif = 'Semua'; renderPOS();
      toast('Barcode ' + kode + ' tidak ditemukan. Periksa data barcode produk.');
      return;
    }
    if (cocok.length > 1) {
      $('#cariProduk').value = kode;
      katAktif = 'Semua'; renderPOS();
      toast('Barcode cocok dengan lebih dari satu produk. Periksa data barcode.');
      return;
    }
    var p = cocok[0];
    if (Number(p.stok || 0) <= 0) return toast('Stok ' + p.nama + ' tidak tersedia di cabang/katalog aktif.');
    if (!p.varian || !p.varian.length) return toast('Varian/harga produk ' + p.nama + ' belum tersedia.');
    // Produk hasil sinkronisasi GAS saat ini menggunakan satu varian Reguler.
    if (p.varian.length > 1) {
      pilihVarian(p);
      return;
    }
    tambahKeKeranjang(p, p.varian[0]);
    toast(p.nama + ' ditambahkan ke pesanan.');
  }
  function tangkapScannerKasir(e) {
    var halamanKasir = $('#hal-kasir');
    if (!halamanKasir || !halamanKasir.classList.contains('aktif') || !$('#layarMasuk').hidden) return;
    if ($('#dlg') && $('#dlg').open) return;
    var target = e.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter') {
      if (timerScanKasir) clearTimeout(timerScanKasir);
      var kode = inputScanKasir;
      inputScanKasir = ''; awalScanKasir = 0;
      if (kode.length >= 4) { e.preventDefault(); e.stopPropagation(); prosesBarcodeKasir(kode); }
      return;
    }
    if (e.key.length !== 1 || !/^[a-zA-Z0-9._\/-]$/.test(e.key)) return;
    var sekarang = Date.now();
    if (!awalScanKasir || sekarang - awalScanKasir > 1200) { inputScanKasir = ''; awalScanKasir = sekarang; }
    inputScanKasir += e.key;
    if (timerScanKasir) clearTimeout(timerScanKasir);
    // Sebagian scanner tidak mengirim Enter; jeda singkat menutup satu pembacaan.
    timerScanKasir = setTimeout(function () {
      var kode = inputScanKasir;
      inputScanKasir = ''; awalScanKasir = 0; timerScanKasir = null;
      if (kode.length >= 4) prosesBarcodeKasir(kode);
    }, 140);
  }

  function ikatEvent() {
    if (window.KPGApi && KPGApi.onSessionExpired) {
      KPGApi.onSessionExpired(function (msg) {
        try { localStorage.removeItem('kpg-token'); } catch (e) {}
        toast(msg || 'Sesi online berakhir. Silakan login online kembali untuk melanjutkan sinkronisasi.');
        tampilMasuk();
      });
    }
    var pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'hapus'];
    $('#padPin').innerHTML = pad.map(function (k) { return k ? '<button data-k="' + k + '" aria-label="' + (k === 'hapus' ? 'Hapus' : k) + '">' + (k === 'hapus' ? '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z"/><path d="M13 9l5 6M18 9l-5 6"/></svg>' : k) + '</button>' : '<span></span>'; }).join('');
    $('#padPin').onclick = function (e) { var b = e.target.closest('[data-k]'); if (b) ketikPin(b.dataset.k); };
    document.addEventListener('keydown', function (e) {
      if ($('#layarMasuk').hidden || (e.target && e.target.closest && e.target.closest('#formLoginOnline'))) return;
      if (/^\d$/.test(e.key)) ketikPin(e.key);
      if (e.key === 'Backspace') ketikPin('hapus');
    });

    $('#navBawah').innerHTML = $$('.samping .nav').map(function (b) { return b.outerHTML; }).join('');
    document.addEventListener('click', function (e) { var n = e.target.closest('.nav'); if (n) buka(n.dataset.hal); });
    $('#btnKeluar').onclick = function () {
      var token = null; try { token = localStorage.getItem('kpg-token'); } catch (er) {}
      if (token) KPGApi.call('logout', { token: token }).catch(function () {});
      pengguna = null; keranjang = [];
      try { localStorage.removeItem('kasir-sesi'); localStorage.removeItem('kpg-token'); localStorage.removeItem('kpg-user'); } catch (er) {}
      tampilMasuk();
    };
    $('#formLoginOnline').onsubmit = loginOnline;
    if (window.addEventListener) window.addEventListener('online', syncPending);
    // Coba ulang antrean tertunda berkala selama aplikasi masih terbuka.
    if (!window.__kpgRetryTimer) window.__kpgRetryTimer = setInterval(syncPending, 60000);

    $('#cariProduk').oninput = function () {
      if (timerCariProduk) clearTimeout(timerCariProduk);
      timerCariProduk = setTimeout(function () { timerCariProduk = null; renderPOS(); }, 60);
    };
    document.addEventListener('keydown', tangkapScannerKasir, true);
    $('#btnScanKasir').onclick = bukaScannerKasir;
    $('#chipKategori').onclick = function (e) { var c = e.target.closest('.chip'); if (c) { katAktif = c.dataset.k; renderPOS(); } };
    $('#gridProduk').onclick = function (e) { var more = e.target.closest('[data-muat-lagi]'); if (more) { jumlahProdukTampil += 80; renderPOS(); return; } var k = e.target.closest('.kartu-produk'); if (k) pilihVarian(D.produk.find(function (p) { return p.id === k.dataset.id; })); };
    $('#kerDaftar').onclick = function (e) {
      var b = e.target.closest('[data-n]'); if (!b) return;
      var it = keranjang[+b.dataset.n], d = +b.dataset.d;
      if (d > 0) { var p = D.produk.find(function (x) { return x.id === it.pid; }); if (p && p.stok - stokTerpakai(p.id) <= 0) return toast('Stok tidak cukup'); }
      it.qty += d; if (it.qty <= 0) keranjang.splice(+b.dataset.n, 1);
      renderPOS();
    };
    $('#inDiskon').oninput = renderKeranjang; $('#tipeDiskon').onchange = renderKeranjang;
    $('#btnKosongkan').onclick = function () { keranjang = []; renderPOS(); };
    $('#btnBayar').onclick = function () {
      if (pengguna && pengguna.peran === 'owner' && !cabangTransaksiAktif) {
        var pilih = $('#pilihCabangTransaksi');
        toast('Pilih cabang transaksi terlebih dahulu. Katalog tetap menampilkan seluruh barang.');
        if (pilih) pilih.focus();
        return;
      }
      dialogBayar();
    };
    $('#fabKeranjang').onclick = function () { $('#panelKeranjang').classList.toggle('buka'); };
    document.addEventListener('click', function (e) {
      var pk = $('#panelKeranjang');
      if (pk.classList.contains('buka') && !pk.contains(e.target) && !e.target.closest('#fabKeranjang') && !e.target.closest('dialog')) pk.classList.remove('buka');
    });

    $('#cariKelola').oninput = function () { katalogVisibleCount = katalogPageSize; renderKelola(); };
    $('#btnScanKatalog').onclick = bukaScannerKatalog;
    $('#btnTambahProduk').onclick = function () { formProduk(null); };
    $('#btnKategori').onclick = formKategori;
    $('#tabelProduk').onclick = function (e) {
      var more = e.target.closest('[data-muat-lagi]');
      if (more) { katalogVisibleCount += katalogPageSize; renderKelola(); return; }
      var edit = e.target.closest('[data-edit-kartu]');
      if (!edit) return;
      var id = edit.dataset.editKartu, idCabang = edit.dataset.cabang;
      var row = dataKatalogServer.find(function (x) { return String(x.id_barang || x.id || '') === id && String(x.id_cabang || '') === String(idCabang || ''); });
      if (!row) return toast('Data produk tidak ditemukan. Muat ulang katalog.');
      var produk = barangDariServer(row);
      dialog('<h3>Edit produk</h3><p class="redup kecil">' + esc(produk.nama) + '</p><div class="dlg-aksi katalog-admin-menu-edit">' +
        '<button class="tombol" type="button" id="aksiEditJudul">Ubah judul / master</button>' +
        '<button class="tombol utama" type="button" id="aksiEditStok">Ubah stok & lokasi rak</button>' +
        '<button class="tombol" value="batal" formnovalidate>Tutup</button></div>', function (f) {
          $('#aksiEditJudul', f).onclick = function () { tutupDialog(); formProduk(D.produk.find(function (p) { return p.id === produk.id; }) || produk); };
          $('#aksiEditStok', f).onclick = function () { tutupDialog(); aturStokCabang(produk); };
        });
    };

    $('#filterTanggal').onchange = renderRiwayat;
    $('#btnEksporTrx').onclick = eksporTrx;
    $('#daftarTrx').onclick = function (e) {
      var c = e.target.closest('[data-cetak]'), h = e.target.closest('[data-hapus]');
      if (c) cetak(D.transaksi.find(function (x) { return x.id === c.dataset.cetak; }));
      if (h && confirm('Batalkan transaksi ini? Stok akan dikembalikan ke cabang terkait.')) {
        var x = D.transaksi.find(function (t) { return t.id === h.dataset.hapus; });
        if (!x) return;
        var alasan = prompt('Alasan pembatalan transaksi:', 'Batal oleh admin/owner');
        if (alasan === null) return;
        var batalServer = (x.sync_status === 'TERSINKRON' && tokenAktif())
          ? KPGApi.call('batalkanTransaksi', { token: tokenAktif(), id_transaksi: x.id, alasan: alasan })
          : Promise.resolve();
        batalServer.then(function () {
          x.items.forEach(function (i) {
            var p = D.produk.find(function (q) { return q.id === i.pid; });
            if (p) p.stok += i.qty;
          });
          if (window.KPGStorage && x.client_id) KPGStorage.removeOutbox(x.client_id).catch(function () {});
          D.transaksi = D.transaksi.filter(function (t) { return t !== x; });
          return simpan();
        }).then(function () {
          renderRiwayat();
          toast('Transaksi berhasil dibatalkan dan stok dikembalikan.');
        }).catch(function (err) {
          toast('Gagal membatalkan di server: ' + err.message);
        });
      }
    };

    $('#segLaporan').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; modeLap = b.dataset.mode; $$('#segLaporan button').forEach(function (x) { x.classList.toggle('aktif', x === b); }); renderLaporan(); };
    $('#tglLaporan').onchange = renderLaporan;

    $('#formToko').onsubmit = function (e) {
      e.preventDefault(); var f = e.target;
      var namaLama = D.toko.nama;
      ['nama', 'alamat', 'telp', 'footer', 'rekening'].forEach(function (k) { D.toko[k] = f.elements[k].value.trim(); });
      if (D.toko.nama !== namaLama) D.toko.namaDariTema = false;
      simpan(); $('#namaTokoNav').textContent = D.toko.nama; toast('Profil toko disimpan');
    };
    $('#formKasir').onsubmit = function (e) {
      e.preventDefault(); var f = e.target;
      D.kasir.push({ id: uid(), nama: f.elements.nama.value.trim(), pin: f.elements.pin.value, peran: f.elements.peran.value });
      simpan(); f.reset(); renderAtur(); toast('Kasir ditambahkan');
    };
    $('#daftarKasirAtur').onclick = function (e) { var b = e.target.closest('[data-hk]'); if (b && confirm('Hapus kasir ini?')) { D.kasir = D.kasir.filter(function (k) { return k.id !== b.dataset.hk; }); simpan(); renderAtur(); } };
    $('#btnBackup').onclick = function () { unduh('backup-kasir-' + tglKey(new Date()) + '.json', JSON.stringify(D, null, 1), 'application/json'); };
    $('#fileBackup').onchange = function () {
      bacaFile(this, function (t) {
        try { var x = JSON.parse(t); if (!x.produk || !x.kasir) throw 0; if (confirm('Timpa semua data dengan backup ini?')) { D = x; simpan(); toast('Backup dipulihkan'); tampilMasuk(); } }
        catch (er) { toast('File backup tidak valid'); }
      });
    };
    
    $('#btnContoh').onclick = function () { if (confirm('Ganti data dengan data contoh?')) { D = dataContoh(); simpan(); tampilMasuk(); } };
    $('#btnReset').onclick = function () { if (confirm('Yakin hapus SEMUA data? Backup dulu ya.')) { D = dataKosong(); simpan(); toast('Data dikosongkan. PIN admin: 1234'); tampilMasuk(); } };
    
    var btnAudit = $('#btnAuditIntegritas');
    if (btnAudit) btnAudit.onclick = function () {
      var box = $('#hasilAuditOwner');
      box.textContent = 'Memeriksa integritas stok & jurnal di server...';
      btnAudit.disabled = true;
      KPGApi.call('auditIntegritas', { token: tokenAktif() }).then(function (res) {
        var selisih = Array.isArray(res.selisih) ? res.selisih : [];
        var pending = Number(res.pending_count || 0);
        var corrupt = Number(res.corrupt_count || 0);
        if (!selisih.length && !pending && !corrupt) {
          box.innerHTML = '<b style="color:var(--utama)">✓ Database Sehat:</b> Semua stok cabang sesuai dengan jurnal mutasi (' + (res.total_barang_diperiksa || 0) + ' item diperiksa).';
        } else {
          box.innerHTML = '<b style="color:#c0392b">⚠ Ditemukan Ketidaksesuaian:</b> Selisih stok: ' + selisih.length + ' item · Jurnal PENDING: ' + pending + ' · CORRUPT: ' + corrupt +
            (selisih.length ? '<br>' + selisih.slice(0, 10).map(function (s) { return esc(s.id_cabang + ' / ' + s.id_barang) + ' (Sistem: ' + s.stok_sistem + ', Mutasi: ' + s.stok_mutasi + ')'; }).join('<br>') : '');
        }
      }).catch(function (e) {
        box.textContent = 'Gagal menjalankan audit: ' + e.message;
      }).finally(function () { btnAudit.disabled = false; });
    };

    var btnRecover = $('#btnRecoverPending');
    if (btnRecover) btnRecover.onclick = function () {
      var box = $('#hasilAuditOwner');
      box.textContent = 'Memulihkan jurnal tertunda...';
      btnRecover.disabled = true;
      KPGApi.call('recoverPending', { token: tokenAktif() }).then(function (res) {
        box.textContent = 'Pemulihan selesai. Dipulihkan: ' + (res.recovered || 0) + ', Gagal/Corrupt: ' + (res.corrupt || 0) + '.';
        toast('Pemulihan jurnal selesai');
      }).catch(function (e) {
        box.textContent = 'Gagal memulihkan jurnal: ' + e.message;
      }).finally(function () { btnRecover.disabled = false; });
    };

    var btnBaseline = $('#btnSetBaseline');
    if (btnBaseline) btnBaseline.onclick = function () {
      if (!confirm('Set Baseline Stok akan mengunci saldo stok saat ini sebagai titik awal audit baru. Lanjutkan?')) return;
      var box = $('#hasilAuditOwner');
      box.textContent = 'Mengunci baseline stok...';
      btnBaseline.disabled = true;
      KPGApi.call('setStokBaseline', { token: tokenAktif() }).then(function (res) {
        box.textContent = 'Baseline stok berhasil dikunci (' + (res.total || 0) + ' baris stok).';
        toast('Baseline stok berhasil dikunci');
      }).catch(function (e) {
        box.textContent = 'Gagal set baseline: ' + e.message;
      }).finally(function () { btnBaseline.disabled = false; });
    };
    // --- Helper Baca File Excel (.xlsx / .xls / .csv) ---
    function bacaExcelRows(inputEl, cb) {
      var file = inputEl.files && inputEl.files[0];
      if (!file) return;
      if (typeof XLSX === 'undefined') {
        toast('Library Excel belum termuat, periksa koneksi internet lalu refresh.');
        inputEl.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          cb(rows);
        } catch (err) {
          toast('Gagal membaca file Excel: ' + err.message);
        } finally {
          inputEl.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    }

    // --- 1. Sinkronisasi Manual ---
    var btnSyncManual = $('#btnSyncManual');
    if (btnSyncManual) btnSyncManual.onclick = function () {
      btnSyncManual.disabled = true;
      toast('Menjalankan sinkronisasi manual...');
      Promise.resolve()
        .then(function () { return typeof syncPush === 'function' ? syncPush() : null; })
        .then(function () { return typeof syncPull === 'function' ? syncPull(true) : null; })
        .then(function () {
          if (typeof produkKasirCache !== 'undefined') produkKasirCache = { cabang: '', waktu: 0, list: [] };
          renderSemua();
          toast('Sinkronisasi manual selesai.');
        })
        .catch(function (err) { toast('Gagal sinkronisasi: ' + err.message); })
        .finally(function () { btnSyncManual.disabled = false; });
    };

    // --- 2. Update Data (Excel) ---
    var boxExcel = $('#statusUpdateExcel');

    var btnExportExcel = $('#btnExportBarangExcel');
    if (btnExportExcel) btnExportExcel.onclick = function () {
      if (typeof XLSX === 'undefined') return toast('Library Excel belum termuat.');
      btnExportExcel.disabled = true;
      if (boxExcel) boxExcel.textContent = 'Mengambil data barang dari server...';
      KPGApi.call('exportBarangExcel', { token: tokenAktif() }).then(function (res) {
        var rows = res.rows || [];
        if (!rows.length) {
          if (boxExcel) boxExcel.textContent = 'Tidak ada data barang di server.';
          return;
        }
        var ws = XLSX.utils.json_to_sheet(rows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'barang');
        XLSX.writeFile(wb, 'master-barang-' + new Date().toISOString().slice(0, 10) + '.xlsx');
        if (boxExcel) boxExcel.innerHTML = '<b style="color:var(--utama)">✓ Berhasil export ' + rows.length + ' barang ke Excel.</b>';
      }).catch(function (err) {
        if (boxExcel) boxExcel.innerHTML = '<b style="color:#c0392b">Gagal export:</b> ' + esc(err.message);
      }).finally(function () { btnExportExcel.disabled = false; });
    };

    var fileImportBaru = $('#fileImportBarangBaru');
    if (fileImportBaru) fileImportBaru.onchange = function () {
      bacaExcelRows(this, function (rows) {
        if (!rows.length) return toast('File Excel kosong.');
        if (!confirm('Import ' + rows.length + ' baris barang baru ke Google Sheets?')) return;
        if (boxExcel) boxExcel.textContent = 'Mengunggah ' + rows.length + ' barang baru...';
        KPGApi.call('importBarangBaru', { token: tokenAktif(), items: rows }).then(function (res) {
          if (boxExcel) boxExcel.innerHTML = '<b style="color:var(--utama)">✓ Import Barang Selesai:</b> ' + res.inserted + ' barang ditambahkan, ' + res.skipped + ' dilewati (ID sudah ada/kosong).';
        }).catch(function (err) {
          if (boxExcel) boxExcel.innerHTML = '<b style="color:#c0392b">Gagal import barang:</b> ' + esc(err.message);
        });
      });
    };

    var fileImportUbah = $('#fileImportPerubahanBarang');
    if (fileImportUbah) fileImportUbah.onchange = function () {
      bacaExcelRows(this, function (rows) {
        if (!rows.length) return toast('File Excel kosong.');
        if (!rows[0].hasOwnProperty('id_barang')) return toast('Header wajib memiliki kolom id_barang.');
        if (!confirm('Terapkan perubahan data pada ' + rows.length + ' baris barang?')) return;
        if (boxExcel) boxExcel.textContent = 'Memperbarui data barang di server...';
        KPGApi.call('importPerubahanBarang', { token: tokenAktif(), items: rows }).then(function (res) {
          var infoNotFound = (res.notFound && res.notFound.length) ? ' (ID tidak ditemukan: ' + res.notFound.slice(0, 5).join(', ') + ')' : '';
          if (boxExcel) boxExcel.innerHTML = '<b style="color:var(--utama)">✓ Update Barang Selesai:</b> ' + res.updated + ' barang diperbarui' + esc(infoNotFound) + '.';
        }).catch(function (err) {
          if (boxExcel) boxExcel.innerHTML = '<b style="color:#c0392b">Gagal update barang:</b> ' + esc(err.message);
        });
      });
    };

    var fileImportStok = $('#fileImportStokCabang');
    if (fileImportStok) fileImportStok.onchange = function () {
      bacaExcelRows(this, function (rows) {
        if (!rows.length) return toast('File Excel kosong.');
        if (!rows[0].hasOwnProperty('id_cabang') || !rows[0].hasOwnProperty('id_barang')) {
          return toast('Header Excel wajib memiliki kolom id_cabang, id_barang, dan perubahan_stock.');
        }
        if (!confirm('Proses ' + rows.length + ' mutasi stok cabang (+ tambah / - kurang)?')) return;
        if (boxExcel) boxExcel.textContent = 'Memproses perubahan stok cabang di server...';
        KPGApi.call('importStokCabang', {
          token: tokenAktif(),
          batch_id: 'IMP-' + Date.now(),
          items: rows
        }).then(function (res) {
          if (typeof produkKasirCache !== 'undefined') produkKasirCache = { cabang: '', waktu: 0, list: [] };
          if (boxExcel) boxExcel.innerHTML = '<b style="color:var(--utama)">✓ Update Stock Cabang Selesai:</b> ' + res.processed + ' mutasi stok diproses & dicatat di jurnal.';
        }).catch(function (err) {
          if (boxExcel) boxExcel.innerHTML = '<b style="color:#c0392b">Gagal update stok cabang:</b> ' + esc(err.message);
        });
      });
    };
  }

  // ---------- Mulai ----------
  function jalankanAplikasi(state) {
    // Migrasi sesi login lama ke penyimpanan persisten agar tidak perlu login
    // ulang saat pengguna berpindah aplikasi atau membuka kembali browser.
    try {
      ['kpg-token', 'kpg-user', 'kasir-sesi'].forEach(function (key) {
        if (!localStorage.getItem(key)) {
          var lama = window.sessionStorage.getItem(key);
          if (lama) localStorage.setItem(key, lama);
        }
      });
    } catch (e) {}
    if (!state && /[?&]demo\b/.test(location.search)) state = dataContoh();
    muat(state);
    ikatEvent();
    pasangLogo();
    if (/[?&]demo\b/.test(location.search)) {
      masuk(D.kasir[0]);
      [0, 0, 3, 8].forEach(function (i, n) { var p = D.produk[i]; if (p) tambahKeKeranjang(p, p.varian[n % p.varian.length]); });
      return;
    }
    var token = null, cachedUser = null;
    try { token = localStorage.getItem('kpg-token'); cachedUser = JSON.parse(localStorage.getItem('kpg-user') || 'null'); } catch (e) {}
    if (token && cachedUser && navigator.onLine) {
      KPGApi.call('syncPull', { token: token, since: D.lastServerSync || '', id_cabang: cachedUser.peran === 'owner' ? '' : cachedUser.id_cabang })
        .then(function (data) { terapkanSyncPull(data, cachedUser); return simpan(); })
        .then(function () { masuk(cachedUser, token); syncPending(); })
        .catch(function () { tampilMasuk(); });
    } else {
      tampilMasuk();
    }
  }

  // Baca IndexedDB lebih dulu. Data localStorage lama dimigrasikan tanpa dihapus.
  if (window.KPGStorage && KPGStorage.init) {
    KPGStorage.init().then(function (hasil) {
      jalankanAplikasi(hasil.state);
      if (hasil.migrated) simpan();
    }).catch(function (err) {
      console.error('IndexedDB tidak siap, memakai penyimpanan kompatibilitas:', err);
      jalankanAplikasi(null);
      toast('Mode kompatibilitas lokal aktif');
    });
  } else {
    jalankanAplikasi(null);
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});

  // untuk pengujian
  window.__kasir = { hitung: hitung, ringkasan: ringkasan, parseCSV: parseCSV, imporProdukCSV: imporProdukCSV, data: function () { return D; }, tema: terapkanTema, keranjang: function () { return keranjang; }, tambah: tambahKeKeranjang, selesaikan: selesaikan };
})();
