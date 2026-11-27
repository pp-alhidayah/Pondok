# Perbaikan Logika Bisnis — Sistem Informasi Pondok Al Hidayah

Dokumen ini merangkum perubahan logika bisnis terhadap versi awal, dan mana yang masih perlu keputusan atau pekerjaan lanjutan.

## 1. Data keuangan tidak lagi bisa hilang diam-diam
- Pembacaan localStorage memakai `readJsonStrict` (`src/lib/core.ts`). Jika data rusak, operasi berhenti dan error ditampilkan. Sebelumnya data direset ke kosong/mock lalu tertimpa.
- Data demo (santri, kas, pendaftaran, tarif arsip) hanya dimuat saat `npm run dev`. Build produksi mulai dari data kosong.
- Santri yang sudah punya riwayat pembayaran tidak bisa dihapus; ubah statusnya menjadi Tidak Aktif (riwayat tetap tampil sesuai PRD).

## 2. Pembayaran (syahriyah, kilatan, iuran)
- Semua validasi dijalankan dulu: nominal bilangan bulat rupiah > 0, tidak ada bulan/event ganda dalam satu transaksi, tidak melebihi sisa tagihan, tidak sebelum tanggal masuk.
- Pencatatan kas dan transaksi bersifat satu paket. Jika pencatatan kas gagal, matriks, riwayat, dan nomor kuitansi dikembalikan ke kondisi semula.
- Kas hasil pembayaran diberi penanda sumber dan tidak bisa diedit atau dihapus langsung dari menu Kas. Pembatalan dilakukan dari menu asalnya lewat panel "Riwayat Transaksi": lihat §10.
- Event kilatan yang tidak dikenal kini ditolak; sebelumnya diabaikan diam-diam.
- Santri kategori Kilatan ditolak jika dicatat sebagai syahriyah bulanan.

## 3. Nomor kuitansi (sesuai PRD)
- Format `AH/tahun/nomor urut`, berurutan per tahun, dibuat hanya setelah transaksi tervalidasi.
- Modal pembayaran dan cetak kwitansi memakai nomor resmi ini, bukan ID internal.

## 4. Tarif (sesuai PRD)
- Default tarif baru berlaku mulai bulan berikutnya.
- Periode tarif tidak boleh di masa lalu.
- Perubahan ditolak jika bulan efektif sudah ada pembayaran.
- Migrasi diam-diam di `getTarif` (mengubah periode `2025-07`) dihapus. Sesuai keputusan PRD, tidak ada migrasi data lama.

## 5. Tunggakan dan laporan
- Tagihan syahriyah hanya dihitung mulai bulan masuk santri sampai bulan berjalan. Sebelumnya bulan sebelum masuk dan bulan mendatang ikut dihitung sebagai tunggakan.
- Tanggal laporan dibaca dari teks `YYYY-MM-DD`, bukan lewat `Date` (sebelumnya bisa bergeser zona waktu).
- Semua tanggal "hari ini" dan "bulan berjalan" memakai zona waktu lokal (WIB). Sebelumnya memakai UTC, sehingga sebelum pukul 07.00 tanggal default bisa menunjuk hari sebelumnya.

## 6. Pendaftaran
- Konversi ke santri hanya untuk pendaftar berstatus Diterima, dan hanya sekali.
- Status "Menjadi Santri" tidak bisa diubah lagi.

## 7. Autentikasi
- Fallback password default (`admin123`) untuk akun yang tidak ditemukan dihapus, sehingga akun yang dihapus tidak bisa login kembali.
- Akun tanpa password tidak bisa dipakai login.

## 8. Keamanan output dan ekspor
- Data santri dan keterangan di kwitansi/kop di-escape sebelum dicetak (mencegah HTML injection).
- Sel Excel/CSV yang diawali `= + - @` diberi apostrof agar tidak dieksekusi sebagai rumus.
- **File backup berisi password akun dalam teks biasa** (`al_hidayah_users`). File backup harus disimpan sebagai file rahasia dan tidak boleh dibagikan. Saat migrasi ke database MySQL, password perlu di-hash (bcrypt) sebelum disimpan. Lihat `MIGRASI_DB.md`.

## 9. Lain-lain
- Dependensi `react-is` ditambahkan. Tanpanya build produksi gagal.
- Pesan error spesifik (misalnya "riwayat pembayaran") kini tampil di UI, tidak lagi "Gagal menghapus".
- README: password default tidak lagi ditampilkan.

## Keputusan yang telah difinalisasi
1. **Aturan blokir tarif** (final 2026-11): memakai bunyi PRD revisi — perubahan ditolak hanya jika bulan efektif baru sendiri sudah ada pembayaran. Nominal bulan yang terbayar terkunci, bulan belum bayar ≥ periode baru otomatis di-update ke tarif baru.
2. **Urutan NIS otomatis** (final 2026-11): mulai dari **001** per tahun berjalan. Kode: `maxSequence = 0` di `pendaftaranService.generateAutoNis()`.
3. **Santri Tidak Aktif** (final 2026-11): ditambah field `tanggal_keluar` **dan riwayat periode tidak aktif** (`periode_nonaktif: { mulai, sampai? }[]`).
   - Toggle status di daftar santri otomatis mengisi tanggal keluar hari ini (bisa diubah via form).
   - **Bulan tanggal keluar masih ditagih; bulan setelahnya tidak** — `isBulanDitagihkan(tanggalMasuk, tahun, bulan, tanggalKeluar?, periodeNonaktif?)` di `core.ts`.
   - **Riwayat periode tidak aktif** menjamin sela tidak aktif tidak ditagih ulang: bulan `mulai` (penonaktifan) dan bulan `sampai` (pengaktifan kembali) tetap ditagih; bulan di antaranya **tidak ditagih, termasuk setelah santri diaktifkan kembali**. Lihat `isBulanGapNonaktif` di `core.ts`.
   - Pembayaran syahriyah/kilatan untuk bulan/event di sela tidak aktif ditolak (service guard + UI dinonaktifkan dengan label "Tidak Ditagih (Tidak Aktif)").
   - Saat aktif kembali, toggle menutup periode terbuka (`sampai = hari ini`) dan TIDAK menghapus riwayat, sehingga tidak terjadi penagihan ulang bulan sela.
   - Tunggakan laporan (`laporanService`) ikut menghormati periode tidak aktif.
   - Data lama tanpa riwayat periode tetap ditangani lewat fallback `tanggal_keluar` sederhana.

## 10. Pembatalan pembayaran (final 2026-11)
- Panel collapsible **"Riwayat Transaksi {tahun}"** di halaman Syahriyah, Kilatan, dan Iuran menampilkan semua transaksi tahun berjalan: tanggal, no. kuitansi, santri/pembayar, ringkasan bulan/event (tanda `*` = bayar sebagian), total, serta tombol **Struk** dan **Batalkan** (tombol Batalkan tidak ada untuk role pemilik yang read-only).
- `batalkanPembayaran(recordId)` di `syahriyahService` / `kilatanService` / `iuranPembayaranService` melakukan rollback atomik:
  - Syahriyah/Kilatan: `snapshotKeys` mencakup matriks + transaksi + kas; `total_dibayar` matriks dikurangi sesuai item transaksi (tidak pernah negatif) dan status bulan/event dihitung ulang → Lunas / Sebagian / Belum.
  - Iuran: `snapshotKeys` mencakup daftar pembayaran iuran + kas; record pembayaran dihapus tanpa menyentuh transaksi lain.
  - Ketiganya menghapus entri kas terkait via `kasService.deleteKasSumber(modul, ref_id)`.
  - Nomor kuitansi **tidak dipakai ulang** (counter tetap maju).
  - Jika salah satu langkah gagal (mis. matriks/kas tidak ditemukan), seluruh perubahan dikembalikan dan error ditampilkan lewat toast.
- Konfirmasi pembatalan memakai dialog kustom `ConfirmDialog` (`components/ui`), bukan `window.confirm`.
- Uji perilaku: `tests/pembatalanPembayaran.test.ts` (happy path syahriyah, kilatan & iuran, pembatalan sebagian, record tidak ditemukan, rollback atomik saat kas hilang).

## 11. Laporan Iuran (final 2026-11)
- Tab baru **"Rekap Iuran"** ditambahkan di halaman Laporan (`src/features/laporan/LaporanPage.tsx`).
- Menggunakan `laporanService.getLaporanIuran(tahun)` — rekap keuangan per program iuran: nominal tagihan (master), total pembayaran, sisa tagihan, status (Lunas / Sebagian / Belum).
- Ekspor CSV / Excel / PDF mengikuti pola tab keuangan dan rekap syahriyah yang ada.
- Filter laporan: tahun terpilih (pembayaran iuran memakai periode bulanan / tahunan / sekali).
- Filter laporan: **Program Iuran** (dropdown, default "Semua Program") — memfilter rekap keuangan per program.
- Sesuai keputusan pengguna, ruang lingkup laporan iuran disesuaikan dengan **rekap keuangan saja**.

## 12. Laporan Kilatan (final 2026-11)
- Tab baru **"Rekap Kilatan"** ditambahkan di halaman Laporan (`src/features/laporan/LaporanPage.tsx`), setelah tab "Rekap Iuran".
- Menggunakan `laporanService.getLaporanKilatan(tahun)` — rekap keuangan per event kilatan: total tagihan, total dibayar, sisa tunggakan, dan status event (Lunas / Sebagian / Belum).
- Data diambil dari `kilatanService.getKilatanMatrix(tahun)` dan diagregasi per event.
- Tabel tampil kolom: No, Event, Total Tagihan, Total Dibayar, Sisa Tunggakan, Status, dengan baris TOTAL di akhir.
- Ekspor CSV / Excel / PDF mengikuti pola tab keuangan dan rekap syahriyah yang ada, termasuk summary metrics dan column styles.
- Filter laporan: tahun terpilih (kilatan memakai periode tahunan).

## 13. Format periode & notifikasi (final 2026-11)
- Kolom **Periode** pada daftar pembayaran Iuran menampilkan format ringkas `Nov 2026` (bukan lagi `2026-11`). Data tetap disimpan sebagai `YYYY-MM`; hanya tampilan yang diformat (`formatPeriodeRecord`).
- Seluruh aksi sukses/gagal wajib menampilkan toast: `showToast(pesan, 'success' | 'error' | 'info')`. `ToastContainer` dan `UndoToastContainer` dipasang **satu kali** di `AppLayout` (bukan per halaman) dengan layer `z-[9999]` / `z-[9998]` sehingga selalu di atas modal dan backdrop.
- Validasi form memfokuskan field pertama yang bermasalah: `SantriFormModal`, `KasFormModal`, `PendaftaranFormModal`.
- Undo (6 detik) tersedia untuk hapus kategori kas (Pengaturan) dan hapus transaksi kas manual (`kasService.restoreKas`, id asli dipertahankan).

## 14. Fase 2 — impor, batch, riwayat, mobile (final 2026-11)
- **Pencarian/filter**: semua halaman daftar sudah memiliki pencarian + filter + reset (Santri, Pendaftaran, Syahriyah, Kilatan, Iuran, Kas, Laporan, Riwayat Aktivitas).
- **Impor santri** (`ImportSantriModal`, `santriImport.ts`, `santriService.importSantri`):
  - File `.xlsx/.xls/.csv`; template bisa diunduh dari modal. Header dinormalisasi (huruf kecil, tanpa spasi/tanda baca) sehingga "Nama Wali" = "nama_wali".
  - Kolom wajib: Nama. Kategori/status/tanggal diisi default bila kosong; tanggal `DD/MM/YYYY` dinormalkan ke `YYYY-MM-DD`.
  - NIS kosong dibuat otomatis meneruskan urutan tahun (format `YYYY001`); NIS duplikat di file atau di data lama ditolak.
  - Semua baris divalidasi dulu (`snapshot` implisit): satu baris gagal → tidak ada yang tersimpan.
- **Batch action** (Data Santri): checkbox per halaman, cetak PDF terpilih, hapus massal (Super Admin). Santri dengan riwayat pembayaran tidak bisa dihapus dan dihitung sebagai gagal.
- **Riwayat aktivitas** (`activityLogService`, menu "Riwayat Aktivitas" untuk super_admin/admin):
  - Key `al_hidayah_activity_log`, maksimal 500 entri terbaru, ikut di backup/restore (`BACKUP_SPECS`).
  - Dicatat dari service (bukan UI) untuk santri, kas, pendaftaran, pembayaran & pembatalan syahriyah/kilatan/iuran.
  - Username diambil dari sesi lokal. Pencatatan yang gagal **tidak boleh** menggagalkan aksi utama.
- **Mobile card layout**: tabel disembunyikan di < md (`hidden md:block`), kartu ditampilkan (`md:hidden`) di Santri, Pendaftaran, Syahriyah, Kilatan, Iuran, Kas, dan Aktivitas. Aksi & data yang tampil di kartu sama dengan tabel desktop.

## 15. Pengetatan data & E2E (final 2026-11)
- **Data rusak tidak lagi ditimpa default**: `pengaturanService.getProfil()`, `getArsipTarif()`, dan `iuranPembayaranService.getIuranTambahan()` melempar `DataRusakError` (`daftar.md` #2).
- **Backup ketat**: `BACKUP_SPECS` memvalidasi nested matriks syahriyah/kilatan (bulan 1–12, event valid, nominal & status), transaksi (tanggal kalender, items array, total), profil, tarif, dan print-log. `validateBackup()` juga menolak **relasi yatim** (santri/program iuran/transaksi kas tidak ada) sebelum restore (`daftar.md` #3 & #5).
- **Validator tanggal kalender** terpusat di `core.ts` (`isValidCalendarDate`, `isValidYearMonth`) dan dipakai santri, kas, pembayaran, pendaftaran, import, dan backup; server memakai `server/src/validation.ts` dengan aturan sama.
- **E2E**: `tests/e2e/auth.spec.ts` dan `validasi.spec.ts` dengan Playwright; 3 skenario lolos lewat `npm run test:e2e`.
- **Warning Vite hilang**: alias `@/` di `vite.config.ts` dihapus karena tidak dipakai (`daftar.md` #8).
- **PWA lengkap**: ikon PNG 192/512 dibuat oleh `scripts/generate-icons.mjs`, manifest & service worker cache aset statik saja.
- **Dependency audit bersih**: `xlsx` diganti tarball resmi SheetJS 0.20.3 (`npm audit` = 0).

## 16. Keringanan syahriyah Super Admin (final 2026-11)
- Hanya `super_admin` yang bisa memberikan/cabut keringanan (middleware server `requireRole('super_admin')`).
- Keringanan berupa **potongan rupiah per bulan** untuk rentang bulan tertentu pada tahun berjalan; bukan persentase tetap.
- Saat diberikan, `syahriyah_bulan.nominal_tagihan` bulan terkait diturunkan, status dihitung ulang, dan nominal asli disimpan di kolom `snapshot` (JSON) pada `keringanan_syahriyah`.
- Bulan yang sudah memiliki keringanan tidak bisa diberi keringanan lagi (409) sampai keringanan lama dicabut.
- Mencabut keringanan (Super Admin): histori bulan lunas adalah harga mati — pencabutan memotong periode keringanan (`bulan_selesai = bulan pembatalan − 1`), bulan sebelumnya tetap terikat keringanan, bulan setelah pembatalan kembali tarif penuh (server & mode lokal). `getSyahriyahMatrix` tidak recalc bulan yang sudah ada pembayaran/status Lunas.
- Setiap perubahan tercatat di `activity_log` (aksi `Ubah` / `Hapus`).
- Smoke test mencakup siklus penuh: tagihan 300rb → 200rb → kembali 300rb.

## Belum dikerjakan / di luar cakupan
- (Fitur pembatalan pembayaran sudah dibuat — lihat §10.)
- Cek konfirmasi bendahara, template kuitansi A5 dan thermal, editor kop surat, backup otomatis dan manual, dan alur desain UI dari PRD.
- Modul Dashboard, Laporan (tampilan), Kilatan (tampilan), dan Iuran (tampilan) belum ditelaah baris per baris.
- Kontrol akses masih di sisi klien dan data masih di localStorage. Keduanya perlu backend sebelum dipakai dengan data keuangan nyata.
- Risiko multi-tab: operasi baca-ubah-tulis tanpa kunci bisa saling menimpa.
- `bun.lock` perlu diperbarui dengan `bun install` karena dependensi `react-is` ditambahkan.

## Verifikasi
- `tsc --noEmit`: lolos.
- `vite build`: lolos.
- 14 uji perilaku (pembayaran, rollback, penolakan data rusak, kuitansi berurutan, aturan santri, kilatan, konversi pendaftaran) lolos. Uji dijalankan sementara dan tidak disertakan dalam paket.
