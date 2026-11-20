/**
 * KASIR POS GRAVION — BACKEND GOOGLE APPS SCRIPT
 * Buat spreadsheet khusus aplikasi ini, lalu jalankan setupDatabase().
 * Jangan gunakan spreadsheet/GAS milik POSVirion.
 */

const CFG = {
  SPREADSHEET_ID: '', // Kosongkan jika script dibuat dari Spreadsheet (bound script)
  TIMEZONE: 'Asia/Jakarta',
  SESSION_TTL: 21600,
  SHEETS: {
    Cabang: ['id_cabang','nama_cabang','alamat','telepon','status','dibuat_pada'],
    User: ['id_user','nama','username','password_hash','salt','peran','id_cabang','status','dibuat_pada'],
    Barang: ['id_barang','kode_barang','barcode','nama_barang','kategori','satuan','harga_beli','harga_jual','foto','status','diubah_pada','id_supplier','nama_supplier'],
    Promo: ['id_promo','id_barang','tipe_promo','min_qty','besaran_promo','harga_bundling','status','supplier','nama_barang','harga_beli','harga_jual','stok','diubah_pada'],
    Supplier: ['id_supplier','nama_supplier','telepon','alamat','catatan','status','dibuat_pada'],
    Stok_Cabang: ['id_stok','id_cabang','id_barang','stok','diubah_pada','lokasi_rak'],
    Transaksi: ['id_transaksi','no_nota','waktu','id_cabang','id_user','nama_kasir','subtotal','diskon','total','metode_bayar','bayar','kembali','status','client_id','catatan'],
    Detail_Transaksi: ['id_detail','id_transaksi','id_barang','nama_barang','varian','qty','harga','diskon_item','subtotal'],
    Stok_Masuk: ['id_masuk','no_masuk','waktu','id_cabang','id_supplier','nama_supplier','id_user','total','catatan','client_id'],
    Detail_Stok_Masuk: ['id_detail','id_masuk','id_barang','nama_barang','qty','harga_beli','subtotal'],
    Retur_Barang: ['id_retur','no_retur','waktu','id_cabang','id_transaksi','id_user','total_retur','alasan','status','client_id'],
    Detail_Retur: ['id_detail','id_retur','id_barang','nama_barang','qty','nilai_satuan','diskon_proporsional','subtotal'],
    Transfer_Stok: ['id_transfer','no_transfer','waktu','cabang_asal','cabang_tujuan','id_user','status','catatan','client_id'],
    Detail_Transfer: ['id_detail','id_transfer','id_barang','nama_barang','qty'],
    Log_Aktivitas: ['id_log','waktu','id_user','nama_user','id_cabang','aksi','modul','referensi','keterangan'],
    Pengaturan: ['kunci','nilai','diubah_pada']
  }
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ok:true, app:'KasirPosGravion', version:'1.1.4', time:new Date().toISOString()});
  if (p.callback) {
    const result = route_(p);
    return ContentService.createTextOutput(String(p.callback).replace(/[^\w.$]/g,'') + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Kasir POS Gravion — Koneksi GAS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ok:false,error:'JSON tidak valid'}); }
  return json_(route_(body));
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function route_(p) {
  try {
    // GET/JSONP mengirim detail transaksi sebagai string; normalisasi payload agar
    // endpoint mutasi (stok masuk/transfer) menerima array yang tervalidasi.
    if (typeof p.items === 'string' && p.items.trim()) p.items = JSON.parse(p.items);
    if (typeof p.transaksi === 'string' && p.transaksi.trim()) p.transaksi = JSON.parse(p.transaksi);
    const action = String(p.action || '');
    if (action === 'loginChallenge') return loginChallenge_(p);
    if (action === 'loginVerify') return loginVerify_(p);
    if (action === 'login') throw new Error('Login langsung dinonaktifkan. Gunakan login challenge-response.');
    if (action === 'logout') { logout_(p.token); return {ok:true}; }
    if (action === 'ping') return {ok:true, app:'KasirPosGravion', time:new Date().toISOString()};
    const user = auth_(p.token);
    switch (action) {
      case 'bootstrap': return bootstrap_(user);
      case 'syncPull': return syncPull_(user,p);
      case 'syncPush': return syncPush_(user,p);
      case 'listPromo': return listPromo_(user,p);
      case 'savePromo': return savePromo_(user,p);
      case 'listBarang': return listBarang_(user,p);
      case 'saveLokasiRak': return saveLokasiRak_(user,p);
      case 'saveBarang': return saveBarang_(user,p);
      case 'uploadFotoBarang': return uploadFotoBarang_(user,p);
      case 'listCabang': return listCabang_(user);
      case 'saveCabang': return saveCabang_(user,p);
      case 'listSupplier': return listSupplier_(user);
      case 'saveSupplier': return saveSupplier_(user,p);
      case 'simpanTransaksi': return simpanTransaksi_(user,p);
      case 'riwayatTransaksi': return riwayatTransaksi_(user,p);
      case 'batalkanTransaksi': return batalkanTransaksi_(user,p);
      case 'stokMasuk': return stokMasuk_(user,p);
      case 'returBarang': return returBarang_(user,p);
      case 'transferStok': return transferStok_(user,p);
      case 'koreksiStok': return koreksiStok_(user,p);
      case 'laporan': return laporan_(user,p);
      case 'logAktivitas': return logAktivitas_(user,p);
      default: throw new Error('Aksi API tidak dikenal: ' + action);
    }
  } catch (err) {
    return {ok:false,error:err.message || String(err)};
  }
}

/* ---------- SETUP ---------- */
function setupDatabase() {
  const ss = db_();
  Object.keys(CFG.SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = CFG.SHEETS[name];
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    else {
      // Bandingkan hanya header lama yang benar-benar terisi. getLastColumn()
      // menghindari kolom kosong di kanan dianggap sebagai header yang salah.
      const lastHeaderCol = Math.max(1, sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0]
        .reduce((last,v,i) => String(v||'').trim() ? i+1 : last, 0));
      const current = sh.getRange(1,1,1,lastHeaderCol).getValues()[0].map(v=>String(v||'').trim());
      const expectedPrefix = headers.slice(0,current.length);
      const prefixOK = current.every((h,i) => h === expectedPrefix[i]);
      if (!prefixOK) throw new Error('Header sheet '+name+' tidak sesuai. Header lama dipertahankan; periksa urutan kolom sebelum setup.');
      if (current.length < headers.length) {
        sh.getRange(1,current.length+1,1,headers.length-current.length).setValues([headers.slice(current.length)]);
      }
    }
    sh.setFrozenRows(1);
  });
  const props = PropertiesService.getScriptProperties();
  props.setProperty('KPG_DB_ID', ss.getId());
  if (getRows_('Cabang').length === 0) append_('Cabang',{
    id_cabang:'CBG-PUSAT',nama_cabang:'Pusat',alamat:'',telepon:'',status:'AKTIF',dibuat_pada:now_()
  });
  if (getRows_('Pengaturan').length === 0) append_('Pengaturan',{kunci:'nama_aplikasi',nilai:'Kasir POS Gravion',diubah_pada:now_()});
  return 'Database siap: '+ss.getUrl();
}

/**
 * Jalankan sekali dari editor Apps Script.
 * Ganti username dan password sebelum menjalankan.
 */
function buatOwnerAwal() {
  const username = 'owner';
  const password = 'GANTI_PASSWORD_OWNER_MINIMAL_12_KARAKTER';
  if (password.indexOf('GANTI_PASSWORD') === 0 || password.length < 12) {
    throw new Error('Ubah password default pada fungsi buatOwnerAwal() terlebih dahulu.');
  }
  if (getRows_('User').some(x => String(x.username).toLowerCase() === username)) throw new Error('Username owner sudah ada.');
  const salt = Utilities.getUuid();
  append_('User',{id_user:id_('USR'),nama:'Owner',username:username,password_hash:hash_(password,salt),salt:salt,
    peran:'OWNER',id_cabang:'CBG-PUSAT',status:'AKTIF',dibuat_pada:now_()});
  return 'Owner berhasil dibuat. Segera hapus/ganti password bootstrap dari source.';
}

/* ---------- AUTH ---------- */
function loginChallenge_(p) {
  const username = String(p.username || '').trim().toLowerCase();
  if (!username) throw new Error('Username wajib diisi.');
  const u = getRows_('User').find(x => String(x.username).toLowerCase() === username && x.status === 'AKTIF');
  // Salt acak untuk username yang tidak dikenal agar endpoint tidak membocorkan
  // apakah sebuah username terdaftar.
  const salt = u ? String(u.salt) : Utilities.getUuid().replace(/-/g,'');
  const nonce = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('KPG_LOGIN_CHAL_'+nonce,
    JSON.stringify({username:username,id_user:u ? u.id_user : '',salt:salt}),120);
  return {ok:true,salt:salt,nonce:nonce,expires_in:120};
}
function loginVerify_(p) {
  const username = String(p.username || '').trim().toLowerCase();
  const nonce = String(p.nonce || '');
  const proof = String(p.proof || '');
  if (!nonce || !proof) throw new Error('Tantangan login tidak lengkap.');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('KPG_LOGIN_CHAL_'+nonce);
  if (!raw) throw new Error('Tantangan login kedaluwarsa. Silakan coba lagi.');
  cache.remove('KPG_LOGIN_CHAL_'+nonce); // nonce hanya boleh dipakai sekali
  const challenge = JSON.parse(raw);
  if (challenge.username !== username || !challenge.id_user) throw new Error('Username atau password salah.');
  const u = getRows_('User').find(x => x.id_user === challenge.id_user && x.status === 'AKTIF');
  if (!u || String(u.salt) !== challenge.salt) throw new Error('Username atau password salah.');
  // Frontend mengirim SHA256(nonce|SHA256(salt|password)); password asli
  // tidak pernah dikirim melalui URL JSONP.
  if (hash_(u.password_hash,nonce) !== proof) throw new Error('Username atau password salah.');
  const token = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  const session = {id_user:u.id_user,nama:u.nama,username:u.username,peran:u.peran,id_cabang:u.id_cabang};
  cache.put('KPG_SESS_'+token,JSON.stringify(session),CFG.SESSION_TTL);
  log_(session,'LOGIN','Auth','', 'Login berhasil');
  return {ok:true,token:token,user:session,expires_in:CFG.SESSION_TTL};
}
function login_(p) {
  throw new Error('Login langsung dinonaktifkan. Gunakan login challenge-response.');
}
function auth_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  const raw = CacheService.getScriptCache().get('KPG_SESS_'+token);
  if (!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  const s = JSON.parse(raw);
  const u = getRows_('User').find(x => x.id_user === s.id_user && x.status === 'AKTIF');
  if (!u || u.peran !== s.peran || u.id_cabang !== s.id_cabang) throw new Error('Hak akses berubah. Silakan login kembali.');
  return s;
}
function logout_(token) { if (token) CacheService.getScriptCache().remove('KPG_SESS_'+token); }
function requireOwner_(u) { if (u.peran !== 'OWNER') throw new Error('Akses khusus OWNER.'); }
function requireAdmin_(u) { if (['OWNER','ADMIN'].indexOf(u.peran) < 0) throw new Error('Akses khusus ADMIN/OWNER.'); }
function cabangAkses_(u, requested) {
  if (u.peran === 'OWNER') return requested || '';
  if (requested && requested !== u.id_cabang) throw new Error('Tidak memiliki akses ke cabang tersebut.');
  return u.id_cabang;
}

/* ---------- DATA API ---------- */
function bootstrap_(u) {
  const cabang = u.peran === 'OWNER' ? getRows_('Cabang') : getRows_('Cabang').filter(x => x.id_cabang === u.id_cabang);
  const idCabang = u.peran === 'OWNER' ? (u.id_cabang || (cabang[0] && cabang[0].id_cabang) || '') : u.id_cabang;
  return {ok:true,user:u,cabang:cabang,id_cabang_aktif:idCabang,
    barang:listBarang_(u,{id_cabang:idCabang}).data,supplier:listSupplier_(u).data,promo:listPromo_(u,{id_cabang:idCabang}).data};
}
function listCabang_(u) {
  const rows = getRows_('Cabang').filter(x => u.peran === 'OWNER' || x.id_cabang === u.id_cabang);
  return {ok:true,data:rows};
}
function saveCabang_(u,p) {
  requireOwner_(u);
  const nama = String(p.nama_cabang || '').trim();
  if (!nama) throw new Error('Nama cabang wajib diisi.');
  const id = p.id_cabang || id_('CBG');
  upsert_('Cabang','id_cabang',id,{id_cabang:id,nama_cabang:nama,alamat:String(p.alamat||''),telepon:String(p.telepon||''),status:p.status||'AKTIF',dibuat_pada:p.dibuat_pada||now_()});
  log_(u,'SIMPAN','Cabang',id,nama);
  return {ok:true,id_cabang:id};
}
function listBarang_(u,p) {
  p = p || {};
  const cabang = cabangAkses_(u,p.id_cabang || '');
  const barang = getRows_('Barang').filter(x => x.status !== 'HAPUS');
  const stok = getRows_('Stok_Cabang').filter(x => !cabang || x.id_cabang === cabang);
  const map = {};
  stok.forEach(x => map[String(x.id_barang)] = {stok:Number(x.stok)||0,lokasi_rak:String(x.lokasi_rak||'')});
  return {ok:true,data:barang.map(x => {
    const s=map[String(x.id_barang)]||{};
    return Object.assign({},x,{id_cabang:cabang,stok:s.stok===undefined?0:s.stok,lokasi_rak:s.lokasi_rak||''});
  })};
}
/**
 * Upload foto barang ke Google Drive dan mengembalikan URL file.
 * Frontend mengirim {action:'uploadFotoBarang', token, fileName, mimeType, base64}.
 * File disimpan dalam folder khusus KasirPosGravion_FotoBarang.
 */
function uploadFotoBarang_(u,p) {
  requireAdmin_(u);
  const mime = String(p.mimeType||'').toLowerCase();
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (allowed.indexOf(mime) < 0) throw new Error('Format foto harus JPG, PNG, WEBP, atau GIF.');
  const raw = String(p.base64||'').replace(/^data:[^;]+;base64,/,'').replace(/\\s/g,'');
  if (!raw) throw new Error('Data foto kosong.');
  const bytes = Utilities.base64Decode(raw);
  if (bytes.length > 5*1024*1024) throw new Error('Ukuran foto maksimal 5 MB.');
  let folder = getFotoFolder_();
  const safeName = String(p.fileName||'foto-barang').replace(/[\\\\/:*?"<>|#%{}~&]/g,'_').slice(0,100);
  const file = folder.createFile(Utilities.newBlob(bytes,mime,safeName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  const url = file.getUrl();
  return {ok:true,url:url,fileId:file.getId(),fileName:file.getName()};
}
function getFotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('KPG_FOTO_FOLDER_ID');
  if (saved) {
    try { return DriveApp.getFolderById(saved); } catch(e) { props.deleteProperty('KPG_FOTO_FOLDER_ID'); }
  }
  const folder = DriveApp.createFolder('KasirPosGravion_FotoBarang');
  props.setProperty('KPG_FOTO_FOLDER_ID',folder.getId());
  return folder;
}

/** Simpan lokasi rak untuk satu barang pada cabang tertentu. */
function saveLokasiRak_(u,p) {
  requireAdmin_(u);
  const cabang=cabangAkses_(u,String(p.id_cabang||''));
  const barang=String(p.id_barang||'');
  if(!cabang) throw new Error('id_cabang wajib diisi.');
  if(!barang || !getRows_('Barang').some(x=>x.id_barang===barang && x.status!=='HAPUS')) throw new Error('Barang tidak ditemukan.');
  const lokasi=String(p.lokasi_rak||'').trim();
  const rows=getRows_('Stok_Cabang');
  const row=rows.find(x=>x.id_cabang===cabang && x.id_barang===barang);
  simpanBarisStokCabang_(cabang,barang,{lokasi_rak:lokasi});
  log_(u,'UBAH LOKASI RAK','Stok_Cabang',barang,'Cabang '+cabang+'; lokasi '+(lokasi||'(kosong)'));
  return {ok:true,id_cabang:cabang,id_barang:barang,lokasi_rak:lokasi};
}

function saveBarang_(u,p) {
  requireAdmin_(u);
  const nama = String(p.nama_barang||'').trim();
  if (!nama) throw new Error('Nama barang wajib diisi.');
  const id = p.id_barang || id_('BRG');
  const row = {id_barang:id,kode_barang:String(p.kode_barang||''),barcode:String(p.barcode||''),nama_barang:nama,
    kategori:String(p.kategori||'Umum'),satuan:String(p.satuan||'pcs'),id_supplier:String(p.id_supplier||''),nama_supplier:String(p.nama_supplier||''),harga_beli:num_(p.harga_beli),harga_jual:num_(p.harga_jual),
    foto:String(p.foto||''),status:p.status||'AKTIF',diubah_pada:now_()};
  upsert_('Barang','id_barang',id,row);
  if (p.stok_awal !== undefined && p.id_cabang) setStok_(cabangAkses_(u,p.id_cabang),id,num_(p.stok_awal));
  log_(u,'SIMPAN','Barang',id,nama);
  return {ok:true,id_barang:id};
}
function listSupplier_(u) {
  return {ok:true,data:getRows_('Supplier').filter(x => x.status !== 'HAPUS')};
}
function saveSupplier_(u,p) {
  requireAdmin_(u);
  const nama = String(p.nama_supplier||'').trim();
  if (!nama) throw new Error('Nama supplier wajib diisi.');
  const id = p.id_supplier || id_('SUP');
  upsert_('Supplier','id_supplier',id,{id_supplier:id,nama_supplier:nama,telepon:String(p.telepon||''),alamat:String(p.alamat||''),catatan:String(p.catatan||''),status:p.status||'AKTIF',dibuat_pada:now_()});
  return {ok:true,id_supplier:id};
}

/* ---------- PROMO & SINKRONISASI LOCAL-FIRST ---------- */
function listPromo_(u,p) {
  p=p||{}; const cabang=cabangAkses_(u,p.id_cabang||'');
  const stok=getRows_('Stok_Cabang').filter(x=>!cabang||x.id_cabang===cabang);
  const sm={}; stok.forEach(x=>sm[x.id_barang]=num_(x.stok));
  return {ok:true,data:getRows_('Promo').filter(x=>x.status!=='HAPUS'&&x.status!=='NONAKTIF').map(x=>Object.assign({},x,{stok:sm[x.id_barang]||0}))};
}
function savePromo_(u,p) {
  requireAdmin_(u);
  const barang=getRows_('Barang').find(x=>x.id_barang===p.id_barang);
  if(!barang) throw new Error('Barang promo tidak ditemukan.');
  const tipe=String(p.tipe_promo||'');
  if(['1','3'].indexOf(tipe)<0) throw new Error('Tipe promo yang sudah didefinisikan saat ini adalah 1 (diskon persen) dan 3 (bundling). Tipe lain perlu disesuaikan dengan aturan POSVirion.');
  const min=Math.floor(num_(p.min_qty)); if(min<1) throw new Error('Minimal qty harus minimal 1.');
  const besaran=num_(p.besaran_promo), bundling=num_(p.harga_bundling);
  if(tipe==='1' && (besaran<=0||besaran>100)) throw new Error('Promo tipe 1: besaran diskon persen harus >0 dan maksimal 100.');
  if(tipe==='3' && bundling<=0) throw new Error('Promo bundling harus memiliki harga bundling.');
  const id=p.id_promo||id_('PRM');
  upsert_('Promo','id_promo',id,{id_promo:id,id_barang:barang.id_barang,tipe_promo:tipe,min_qty:min,besaran_promo:besaran,harga_bundling:bundling,status:p.status||'AKTIF',supplier:String(p.supplier||barang.nama_supplier||''),nama_barang:barang.nama_barang,harga_beli:num_(barang.harga_beli),harga_jual:num_(barang.harga_jual),stok:0,diubah_pada:now_()});
  log_(u,'SIMPAN','Promo',id,barang.nama_barang); return {ok:true,id_promo:id};
}
function syncPull_(u,p) {
  const cabang=cabangAkses_(u,p.id_cabang||'');
  const since=String(p.since||'');
  function changed(rows,field){return rows.filter(x=>!since||String(x[field]||'')>=since);}
  const semuaBarang=getRows_('Barang');
  const barang=changed(semuaBarang.filter(x=>x.status!=='HAPUS'),'diubah_pada');
  const barang_hapus=changed(semuaBarang.filter(x=>x.status==='HAPUS'),'diubah_pada').map(x=>String(x.id_barang));
  const promo=changed(getRows_('Promo').filter(x=>x.status!=='HAPUS'),'diubah_pada');
  const stok=getRows_('Stok_Cabang').filter(x=>!cabang||x.id_cabang===cabang);
  return {ok:true,server_time:now_(),cabang:cabang,barang:barang,barang_hapus:barang_hapus,promo:promo,stok:stok,supplier:getRows_('Supplier').filter(x=>x.status!=='HAPUS'),cabang_list:u.peran==='OWNER'?getRows_('Cabang'):getRows_('Cabang').filter(x=>x.id_cabang===u.id_cabang)};
}
function syncPush_(u,p) {
  const list=Array.isArray(p.transaksi)?p.transaksi:[]; const hasil=[];
  list.forEach(t=>{
    try { const r=simpanTransaksi_(u,Object.assign({},t,{action:'simpanTransaksi'})); hasil.push({client_id:t.client_id,ok:!!r.ok,duplicate:!!r.duplicate,id_transaksi:r.data&&r.data.id_transaksi,error:r.error||''}); }
    catch(e){hasil.push({client_id:t.client_id,ok:false,error:e.message||String(e)});}
  });
  return {ok:true,hasil:hasil,server_time:now_()};
}

/* ---------- TRANSAKSI ---------- */
function simpanTransaksi_(u,p) {
  const cabang=cabangAkses_(u,p.id_cabang||'');
  const clientId=String(p.client_id||''); if(!clientId) throw new Error('client_id wajib untuk mencegah transaksi ganda.');
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const existing=getRows_('Transaksi').find(x=>x.client_id===clientId);
    if(existing) return {ok:true,duplicate:true,data:existing};
    const items=Array.isArray(p.items)?p.items:[]; if(!items.length) throw new Error('Keranjang transaksi kosong.');
    const master=getRows_('Barang').filter(x=>x.status==='AKTIF'), agg={}, detail=[]; let subtotal=0;
    items.forEach(it=>{
      const qty=num_(it.qty),harga=num_(it.harga),diskonItem=num_(it.diskon_item);
      if(qty<=0||harga<0||diskonItem<0) throw new Error('Qty/harga/diskon barang tidak valid.');
      const b=master.find(x=>x.id_barang===it.id_barang); if(!b) throw new Error('Barang tidak ditemukan/aktif: '+it.id_barang);
      agg[b.id_barang]=(agg[b.id_barang]||0)+qty;
      const nilai=Math.max(0,qty*harga-diskonItem); subtotal+=nilai;
      detail.push({id_detail:id_('DTL'),id_transaksi:'',id_barang:b.id_barang,nama_barang:b.nama_barang,varian:String(it.varian||''),qty:qty,harga:harga,diskon_item:diskonItem,subtotal:nilai});
    });
    Object.keys(agg).forEach(id=>{const st=getStok_(cabang,id);if(st<agg[id]){const b=master.find(x=>x.id_barang===id);throw new Error('Stok '+(b?b.nama_barang:id)+' tidak cukup. Sisa '+st);}});
    const diskon=Math.min(num_(p.diskon),subtotal),total=Math.max(0,subtotal-diskon);
    const id=id_('TRX'),waktu=p.waktu||now_(),noNota=p.no_nota||('TRX-'+Utilities.formatDate(new Date(),CFG.TIMEZONE,'yyMMdd-HHmmss'));
    const trx={id_transaksi:id,no_nota:noNota,waktu:waktu,id_cabang:cabang,id_user:u.id_user,nama_kasir:u.nama,subtotal:subtotal,diskon:diskon,total:total,metode_bayar:String(p.metode_bayar||'TUNAI').toUpperCase(),bayar:num_(p.bayar),kembali:num_(p.kembali),status:'SELESAI',client_id:clientId,catatan:String(p.catatan||'')};
    append_('Transaksi',trx);
    detail.forEach(d=>{d.id_transaksi=id;append_('Detail_Transaksi',d);});
    Object.keys(agg).forEach(pid=>setStok_(cabang,pid,getStok_(cabang,pid)-agg[pid]));
    log_(u,'SIMPAN','Transaksi',id,noNota); return {ok:true,data:trx,items:detail};
  } finally {lock.releaseLock();}
}
function riwayatTransaksi_(u,p) {
  const cabang = cabangAkses_(u,p.id_cabang||'');
  const rows = getRows_('Transaksi').filter(x => (!cabang || x.id_cabang===cabang) && (!p.tanggal || String(x.waktu).slice(0,10)===p.tanggal));
  rows.sort((a,b)=>String(b.waktu).localeCompare(String(a.waktu)));
  return {ok:true,data:rows.slice(0,Number(p.limit)||300)};
}
function batalkanTransaksi_(u,p) {
  requireAdmin_(u);
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t=getRows_('Transaksi').find(x=>x.id_transaksi===p.id_transaksi);
    if(!t) throw new Error('Transaksi tidak ditemukan.');
    if(t.status!=='SELESAI') throw new Error('Transaksi sudah tidak aktif.');
    cabangAkses_(u,t.id_cabang);
    getRows_('Detail_Transaksi').filter(x=>x.id_transaksi===t.id_transaksi).forEach(d=>setStok_(t.id_cabang,d.id_barang,getStok_(t.id_cabang,d.id_barang)+num_(d.qty)));
    updateById_('Transaksi','id_transaksi',t.id_transaksi,{status:'DIBATALKAN'});
    log_(u,'BATAL','Transaksi',t.id_transaksi,t.no_nota);
    return {ok:true};
  } finally {lock.releaseLock();}
}

/* ---------- STOK MASUK / RETUR / TRANSFER / KOREKSI ---------- */
function stokMasuk_(u,p) {
  requireAdmin_(u); const cabang=cabangAkses_(u,p.id_cabang||''),items=Array.isArray(p.items)?p.items:[];
  if(!items.length) throw new Error('Detail barang masuk kosong.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const client=String(p.client_id||'');if(client&&getRows_('Stok_Masuk').some(x=>x.client_id===client))return {ok:true,duplicate:true};
    const master=getRows_('Barang'),validated=items.map(x=>{const b=master.find(z=>z.id_barang===x.id_barang&&z.status==='AKTIF');const q=num_(x.qty),h=num_(x.harga_beli);if(!b)throw new Error('Barang tidak ditemukan/aktif: '+x.id_barang);if(q<=0||h<0)throw new Error('Qty/harga beli tidak valid.');return {b:b,qty:q,harga:h};});
    const id=id_('IN'),total=validated.reduce((s,x)=>s+x.qty*x.harga,0);
    append_('Stok_Masuk',{id_masuk:id,no_masuk:p.no_masuk||id,waktu:now_(),id_cabang:cabang,id_supplier:p.id_supplier||'',nama_supplier:p.nama_supplier||'',id_user:u.id_user,total:total,catatan:p.catatan||'',client_id:client});
    const agg={};validated.forEach(x=>{append_('Detail_Stok_Masuk',{id_detail:id_('DTL'),id_masuk:id,id_barang:x.b.id_barang,nama_barang:x.b.nama_barang,qty:x.qty,harga_beli:x.harga,subtotal:x.qty*x.harga});agg[x.b.id_barang]=(agg[x.b.id_barang]||0)+x.qty;});
    Object.keys(agg).forEach(pid=>setStok_(cabang,pid,getStok_(cabang,pid)+agg[pid]));
    log_(u,'STOK MASUK','Persediaan',id,'Penerimaan '+validated.length+' baris barang');return {ok:true,id_masuk:id,total:total};
  } finally {lock.releaseLock();}
}
function returBarang_(u,p) {
  requireAdmin_(u);const cabang=cabangAkses_(u,p.id_cabang||''),items=Array.isArray(p.items)?p.items:[];
  if(!items.length)throw new Error('Item retur kosong.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const trx=getRows_('Transaksi').find(x=>x.id_transaksi===p.id_transaksi&&x.id_cabang===cabang&&x.status==='SELESAI');if(!trx)throw new Error('Transaksi asal tidak ditemukan/aktif.');
    const asal=getRows_('Detail_Transaksi').filter(d=>d.id_transaksi===trx.id_transaksi),returLama=getRows_('Detail_Retur').filter(d=>getRows_('Retur_Barang').some(r=>r.id_retur===d.id_retur&&r.id_transaksi===trx.id_transaksi&&r.status==='SELESAI'));
    const agg={};returLama.forEach(d=>agg[d.id_barang]=(agg[d.id_barang]||0)+num_(d.qty));
    const valid=items.map(x=>{const d=asal.find(z=>z.id_barang===x.id_barang);if(!d)throw new Error('Barang tidak ada pada transaksi asal: '+x.id_barang);const q=num_(x.qty),already=agg[x.id_barang]||0;if(q<=0||already+q>num_(d.qty))throw new Error('Qty retur melebihi sisa barang yang dapat diretur: '+d.nama_barang);agg[x.id_barang]=already+q;return {d:d,qty:q};});
    const id=id_('RET');let total=0;const subtotalLines=asal.reduce((s,d)=>s+Math.max(0,num_(d.qty)*num_(d.harga)-num_(d.diskon_item)),0);
    const diskonTrans=num_(trx.diskon);
    valid.forEach(x=>{const d=x.d;const gross=Math.max(0,num_(d.qty)*num_(d.harga)-num_(d.diskon_item));const proporsi=diskonTrans>0&&subtotalLines>0?(diskonTrans*gross/subtotalLines)/Math.max(1,num_(d.qty)):0;const nilaiSatuan=Math.max(0,(num_(d.qty)*num_(d.harga)-num_(d.diskon_item))/Math.max(1,num_(d.qty))-proporsi);const nilai=Math.round(nilaiSatuan*x.qty);total+=nilai;append_('Detail_Retur',{id_detail:id_('DTL'),id_retur:id,id_barang:d.id_barang,nama_barang:d.nama_barang,qty:x.qty,nilai_satuan:num_(d.harga),diskon_proporsional:proporsi,subtotal:nilai});setStok_(cabang,d.id_barang,getStok_(cabang,d.id_barang)+x.qty);});
    append_('Retur_Barang',{id_retur:id,no_retur:p.no_retur||id,waktu:now_(),id_cabang:cabang,id_transaksi:trx.id_transaksi,id_user:u.id_user,total_retur:total,alasan:p.alasan||'',status:'SELESAI',client_id:p.client_id||''});
    log_(u,'RETUR','Retur',id,'Nilai retur '+total);return {ok:true,id_retur:id,total_retur:total};
  } finally {lock.releaseLock();}
}
function transferStok_(u,p) {
  requireAdmin_(u);const asal=cabangAkses_(u,p.cabang_asal||''),tujuan=String(p.cabang_tujuan||'');
  if(!tujuan||tujuan===asal||!getRows_('Cabang').some(x=>x.id_cabang===tujuan&&x.status==='AKTIF'))throw new Error('Cabang tujuan tidak valid.');
  const items=Array.isArray(p.items)?p.items:[];if(!items.length)throw new Error('Barang transfer kosong.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const client=String(p.client_id||'');if(client&&getRows_('Transfer_Stok').some(x=>x.client_id===client))return {ok:true,duplicate:true};
    const master=getRows_('Barang'),agg={};items.forEach(x=>{const b=master.find(z=>z.id_barang===x.id_barang&&z.status==='AKTIF'),q=num_(x.qty);if(!b)throw new Error('Barang tidak ditemukan/aktif.');if(q<=0)throw new Error('Qty transfer tidak valid.');agg[b.id_barang]=(agg[b.id_barang]||0)+q;});
    Object.keys(agg).forEach(pid=>{if(getStok_(asal,pid)<agg[pid])throw new Error('Stok tidak cukup untuk transfer barang '+pid);});
    const id=id_('TRF');append_('Transfer_Stok',{id_transfer:id,no_transfer:p.no_transfer||id,waktu:now_(),cabang_asal:asal,cabang_tujuan:tujuan,id_user:u.id_user,status:'SELESAI',catatan:p.catatan||'',client_id:client});
    Object.keys(agg).forEach(pid=>{const b=master.find(z=>z.id_barang===pid),q=agg[pid];append_('Detail_Transfer',{id_detail:id_('DTL'),id_transfer:id,id_barang:pid,nama_barang:b.nama_barang,qty:q});setStok_(asal,pid,getStok_(asal,pid)-q);setStok_(tujuan,pid,getStok_(tujuan,pid)+q);});
    log_(u,'TRANSFER','Stok',id,asal+' → '+tujuan);return {ok:true,id_transfer:id};
  } finally {lock.releaseLock();}
}
function koreksiStok_(u,p) {
  requireAdmin_(u);const cabang=cabangAkses_(u,p.id_cabang||''),id=p.id_barang,baru=num_(p.stok_baru);
  if(!String(p.alasan||'').trim())throw new Error('Alasan koreksi stok wajib diisi.');
  if(baru<0)throw new Error('Stok baru tidak boleh negatif.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {if(!getRows_('Barang').some(x=>x.id_barang===id&&x.status==='AKTIF'))throw new Error('Barang tidak ditemukan/aktif.');const lama=getStok_(cabang,id);setStok_(cabang,id,baru);log_(u,'KOREKSI STOK','Stok',id,'Stok '+lama+' menjadi '+baru+'; '+p.alasan);return {ok:true,stok_lama:lama,stok_baru:baru};}
  finally {lock.releaseLock();}
}
function laporan_(u,p) {
  const cabang=cabangAkses_(u,p.id_cabang||'');
  const from=p.dari||'0000-00-00', to=p.sampai||'9999-99-99';
  const rows=getRows_('Transaksi').filter(x=>(!cabang||x.id_cabang===cabang)&&x.status==='SELESAI'&&String(x.waktu).slice(0,10)>=from&&String(x.waktu).slice(0,10)<=to);
  return {ok:true,transaksi:rows,omzet:rows.reduce((s,x)=>s+num_(x.total),0),jumlah:rows.length};
}
function logAktivitas_(u,p) {
  requireOwner_(u);
  return {ok:true,data:getRows_('Log_Aktivitas').slice(-Math.min(Number(p.limit)||200,1000)).reverse()};
}

/* ---------- HELPERS ---------- */
function db_() {
  const id=CFG.SPREADSHEET_ID || PropertiesService.getScriptProperties().getProperty('KPG_DB_ID');
  if(id) return SpreadsheetApp.openById(id);
  const ss=SpreadsheetApp.getActiveSpreadsheet(); if(!ss) throw new Error('Isi CFG.SPREADSHEET_ID atau buat script dari Spreadsheet.');
  return ss;
}
function getRows_(name) {
  const sh=db_().getSheetByName(name); if(!sh) throw new Error('Sheet '+name+' belum ada. Jalankan setupDatabase().');
  if(sh.getLastRow()<2) return [];
  const values=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
  const headers=CFG.SHEETS[name];
  return values.map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i] instanceof Date?r[i].toISOString():r[i]);return o;}).filter(o=>Object.values(o).some(v=>v!==''));
}
function append_(name,obj) {
  const sh=db_().getSheetByName(name), headers=CFG.SHEETS[name];
  sh.appendRow(headers.map(h=>obj[h]===undefined?'':obj[h]));
}
function upsert_(name,key,id,obj) {
  const sh=db_().getSheetByName(name), rows=getRows_(name), i=rows.findIndex(x=>String(x[key])===String(id));
  const vals=CFG.SHEETS[name].map(h=>obj[h]===undefined?'':obj[h]);
  if(i<0) sh.appendRow(vals); else sh.getRange(i+2,1,1,vals.length).setValues([vals]);
}
function updateById_(name,key,id,patch) {
  const sh=db_().getSheetByName(name), rows=getRows_(name), i=rows.findIndex(x=>String(x[key])===String(id));
  if(i<0) throw new Error('Data tidak ditemukan.');
  const obj=Object.assign({},rows[i],patch); sh.getRange(i+2,1,1,CFG.SHEETS[name].length).setValues([CFG.SHEETS[name].map(h=>obj[h]===undefined?'':obj[h])]);
}
function getStok_(cabang,barang) {
  const x=getRows_('Stok_Cabang').find(r=>r.id_cabang===cabang&&r.id_barang===barang); return x?num_(x.stok):0;
}
function setStok_(cabang,barang,stok) {
  if(stok<0) throw new Error('Stok tidak boleh negatif.');
  simpanBarisStokCabang_(cabang,barang,{stok:stok});
}
/**
 * Update stok berdasarkan pasangan id_cabang + id_barang, bukan id_stok.
 * Data lama dapat memiliki id_stok kosong; jangan sampai updateById_ dengan
 * kunci kosong mengubah baris stok milik barang lain.
 */
function simpanBarisStokCabang_(cabang,barang,patch) {
  const sh=db_().getSheetByName('Stok_Cabang');
  const headers=CFG.SHEETS.Stok_Cabang;
  const last=sh.getLastRow();
  const values=last>=2?sh.getRange(2,1,last-1,headers.length).getValues():[];
  const ix={}; headers.forEach((h,i)=>ix[h]=i);
  let rowIndex=-1, row=null;
  for(let i=0;i<values.length;i++){
    if(String(values[i][ix.id_cabang]||'')===String(cabang) &&
       String(values[i][ix.id_barang]||'')===String(barang)){
      rowIndex=i+2; row=values[i].slice(); break;
    }
  }
  if(!row){
    const obj={id_stok:id_('STK'),id_cabang:cabang,id_barang:barang,stok:0,diubah_pada:now_(),lokasi_rak:''};
    Object.keys(patch||{}).forEach(k=>obj[k]=patch[k]);
    append_('Stok_Cabang',obj);
    return;
  }
  if(!String(row[ix.id_stok]||'')) row[ix.id_stok]=id_('STK');
  Object.keys(patch||{}).forEach(k=>{if(ix[k]!==undefined) row[ix[k]]=patch[k];});
  row[ix.diubah_pada]=now_();
  sh.getRange(rowIndex,1,1,headers.length).setValues([row.slice(0,headers.length)]);
}
function log_(u,aksi,modul,ref,ket) {
  append_('Log_Aktivitas',{id_log:id_('LOG'),waktu:now_(),id_user:u.id_user,nama_user:u.nama,id_cabang:u.id_cabang,aksi:aksi,modul:modul,referensi:ref,keterangan:ket});
}
function id_(prefix) { return prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase(); }
function now_() { return Utilities.formatDate(new Date(),CFG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss"); }
function num_(v) { const n=Number(v); return isFinite(n)?n:0; }
function hash_(value,salt) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+'|'+value,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join(''); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function statusBackend(){ return {ok:true,app:'KasirPosGravion',version:'1.1.4',time:now_()}; }