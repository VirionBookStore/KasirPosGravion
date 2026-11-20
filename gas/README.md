# Update backend GAS Kasir POS Gravion ke v1.1.4

Frontend branch ini memakai login challenge-response. Karena itu, backend GAS yang saat ini ter-deploy perlu diperbarui sebelum login online dari GitHub dapat diuji.

## File yang diubah
- `Code v1.1.4.gs`: pengganti isi file `Code.gs` di project Apps Script.
- `Index GAS v1.0.html` tidak perlu diubah.

## Langkah deploy
1. Buka project Google Apps Script yang terhubung ke spreadsheet Kasir POS Gravion.
2. Buka file `Code.gs` yang sudah ada.
3. Salin seluruh isi file [Code v1.1.4.gs](./Code%20v1.1.4.gs) dari branch ini, lalu ganti seluruh isi `Code.gs` dengan kode tersebut.
4. Simpan project.
5. Pilih **Deploy → Manage deployments**.
6. Edit deployment Web App yang sudah digunakan aplikasi (ikon pensil), pilih **New version**, lalu klik **Deploy**.
7. Pertahankan deployment yang sama agar URL `/exec` tidak berubah.
8. Jangan jalankan `setupDatabase()` lagi. Spreadsheet produksi sudah berisi data dan perubahan ini tidak memerlukan inisialisasi ulang.

## Pemeriksaan setelah deploy
Buka URL Web App yang sama dengan parameter `?action=ping`. Respons harus menunjukkan:
- `ok: true`
- `app: KasirPosGravion`
- `version: 1.1.4`

Kemudian coba login dari branch pengujian. Password asli tidak dikirim sebagai parameter URL; frontend meminta tantangan, menghitung proof SHA-256, lalu mengirim proof sekali pakai ke GAS.

## Catatan
Jangan gabungkan branch ini ke `main` atau arahkan produksi ke branch ini sebelum login, bootstrap, antrean transaksi, dan sinkronisasi stok diuji pada akun/cabang pengujian.