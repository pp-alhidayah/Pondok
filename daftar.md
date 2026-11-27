# Daftar Perbaikan Aplikasi

Daftar ini disusun berdasarkan hasil review aplikasi Sistem Informasi Pondok Al Hidayah.

## Status Terkini (2026-11)

| # | Item | Status | Catatan |
|---|---|---|---|
| 1 | Autentikasi backend | ✅ | API Express + MariaDB, bcrypt, session httpOnly, CSRF, role di middleware (`server/`). **Frontend default `VITE_API_MODE=api`.** |
| 2 | Fallback data rusak | ✅ | `getProfil`, `getIuranTambahan`, `getArsipTarif` kini melempar `DataRusakError`. |
| 3 | Validasi backup ketat | ✅ | Validator nested matriks/transaksi/profil/tarif/print-log + uji format rusak. |
| 4 | Validasi tanggal kalender | ✅ | Validator kalender di `core.ts` dipakai semua service frontend; server punya `server/src/validation.ts`. |
| 5 | Konsistensi relasi | ✅ | `validateBackup()` menolak ID yatim; server memverifikasi FK sebelum commit. |
| 6 | Test UI/E2E | ✅ | 3 skenario Playwright lolos: login/role, read-only pemilik, fokus field error. `npm run test:e2e`. |
| 7 | Race condition multi-tab | ✅ | Transaksi InnoDB + `SELECT ... FOR UPDATE` pada counter kuitansi; frontend sinkron tiap 30 detik. **Smoke DB: dua bayar bersamaan tetap unik.** |
| 8 | Warning Vite `__dirname` | ✅ | Alias `@/` tidak dipakai sehingga dihapus dari `vite.config.ts`. |
| 9 | Perbarui `bun.lock` | ✅ | Sudah berisi `react-is@19.3.1`. |

Verifikasi terkini: `npm run lint` ✅ · `npm run lint:server` ✅ · `npm test` 48/48 ✅ · server test 8/8 ✅ · `npm run test:e2e` 3/3 ✅ · **`npm run test:smoke` 4/4 ✅ (MariaDB)** · **UI mode API ✅** · `npm run build` ✅ · `npm audit` 0 vulnerability.

## Prioritas Tinggi

### 1. Pindahkan autentikasi ke backend

- Password saat ini disimpan plaintext di `localStorage`.
- File backup juga memuat password akun.
- Role dan hak akses masih dikendalikan oleh sisi client.
- Pengguna dapat memodifikasi data localStorage melalui Developer Tools.

**Perbaikan:** gunakan backend dengan database, password hashing seperti bcrypt/Argon2, session atau token yang aman, dan otorisasi di service/API layer.

### 2. Hentikan fallback diam-diam ketika data rusak

Beberapa service masih mengganti data rusak dengan nilai default atau array kosong:

- Profil pondok di `src/lib/pengaturanService.ts`.
- Iuran tambahan di `src/lib/iuranPembayaranService.ts`.
- Arsip tarif di `src/lib/pengaturanService.ts`.

**Perbaikan:** lempar `DataRusakError`, tampilkan pesan error, dan jangan menulis data baru sebelum pengguna memulihkan backup atau memperbaiki data.

### 3. Perketat validasi backup dan restore

Validasi saat ini masih terlalu umum untuk beberapa data penting. Matriks syahriyah/kilatan, tarif, profil, dan konfigurasi dapat lolos hanya karena berbentuk objek.

**Perbaikan:** validasi struktur nested secara lengkap, termasuk tipe field, nilai status, nominal, tahun, bulan, relasi ID, dan format tanggal. Tambahkan test untuk setiap format data yang rusak.

## Prioritas Menengah

### 4. Perbaiki validasi tanggal

Beberapa service hanya memeriksa pola `YYYY-MM-DD`, sehingga tanggal seperti `2026-99-99` masih dapat diterima.

Area terkait:

- Pembayaran syahriyah.
- Pembayaran kilatan.
- Pembayaran iuran.
- Transaksi kas.
- Data tanggal masuk dan periode nonaktif santri.

**Perbaikan:** buat satu validator tanggal kalender yang memastikan tahun, bulan, dan hari benar-benar valid. Gunakan validator tersebut di seluruh service.

### 5. Tambahkan validasi konsistensi data antar-modul

Backup atau localStorage dapat berisi relasi yang tidak valid, misalnya transaksi menunjuk santri, master iuran, atau entri kas yang tidak ada.

**Perbaikan:** validasi relasi sebelum restore dan sebelum pembatalan pembayaran. Tolak data yang memiliki referensi yatim.

### 6. Tambahkan test untuk UI dan alur end-to-end

Test saat ini sudah mencakup logika inti, tetapi belum mencakup interaksi browser secara menyeluruh.

Tambahkan pengujian untuk:

- Login akun aktif dan nonaktif.
- Pembatasan menu berdasarkan role.
- Pembayaran dari modal hingga kuitansi.
- Pembatalan pembayaran melalui UI.
- Backup dan restore dari halaman Pengaturan.
- Validasi tanggal dan nominal pada form.

## Prioritas Rendah / Pengembangan Lanjutan

### 7. Mitigasi race condition multi-tab

Operasi localStorage masih memakai pola baca-ubah-tulis tanpa lock. Dua tab dapat menimpa perubahan satu sama lain atau menghasilkan nomor kuitansi yang sama.

**Perbaikan sementara:** gunakan mekanisme lock berbasis localStorage dan deteksi event `storage`.

**Perbaikan jangka panjang:** pindahkan operasi transaksi dan counter kuitansi ke backend/database dengan transaksi atomik.

### 8. Perbaiki warning konfigurasi Vite

Build berhasil, tetapi Vite memberi warning penggunaan `__dirname` pada `vite.config.ts` karena dukungan `configLoader: 'native'` di masa depan.

**Perbaikan:** evaluasi migrasi dari `__dirname` ke `import.meta.dirname` saat kompatibilitas Vite dan environment sudah siap.

### 9. Perbarui `bun.lock`

`react-is` sudah ditambahkan ke `package.json`, tetapi `bun.lock` belum disinkronkan.

**Perbaikan:** jalankan `bun install` dan commit perubahan lockfile jika Bun tetap didukung.

## Status Verifikasi Saat Ini

- `npm run lint` — lulus.
- `npm test` — lulus, 48 test (frontend) + 8 test server + 3 test E2E (Playwright).
- `npm run build` — lulus tanpa warning Vite; warning chunk ~2 MB masih dikenal.
- `npm audit` — 0 vulnerability (`xlsx` diganti rilis resmi SheetJS 0.20.3).

## Urutan Pengerjaan yang Disarankan

1. Validasi tanggal terpusat.
2. Hilangkan fallback diam-diam pada data rusak.
3. Perketat validasi backup dan relasi antar-data.
4. Tambahkan test untuk perubahan tersebut.
5. Rancang backend untuk autentikasi, otorisasi, dan transaksi keuangan.
