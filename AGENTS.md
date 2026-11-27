# AGENTS.md

Sistem Informasi Pondok Al Hidayah — React 19 + TypeScript + Vite + Tailwind v4.
Data disimpan di localStorage browser (prototype), tidak ada backend.

## Commands
- Install: `npm install --legacy-peer-deps` (atau `bun install`; `bun.lock` belum sinkron dengan `package.json`)
- Dev: `npm run dev` → http://localhost:3000 (port tetap 3000; mode dev membuat 3 akun demo `admin123`)
- Lint/typecheck: `npm run lint` = `tsc --noEmit` (tidak ada prettier/eslint terpisah)
- Test: `npm test` = `tsx --test` dengan **daftar file eksplisit di `package.json`** — file test baru **tidak otomatis** dijalankan; tambahkan ke script `test` secara manual
- E2E: `npm run test:e2e` = Playwright (butuh `npx playwright install chromium` sekali); terpisah dari `npm test`
- Satu test: `npx tsx --test tests/pembatalanPembayaran.test.ts`
- Build: `npm run build` (warning chunk ~1.86 MB sudah dikenal, abaikan)
- Backend (Fase 3): `npm run db:migrate` (jalankan DDL dari `MIGRASI_DB.md`), `npm run server` / `npm run dev:server` (API port 3001), `npm run lint:server`, `npx tsx --test server/tests/*.test.ts`
- Smoke DB live: `npm run test:smoke` — butuh server berjalan + `.env` terisi. `DB_NAME=al_hidayah` (database sudah dikosongkan & dimigrasi untuk aplikasi ini; script memuat `.env` lewat dotenv sehingga memakai DB yang sama dengan server).
- Server terdeteksi berjalan di **MariaDB**; DDL memakai `CREATE TABLE IF NOT EXISTS` & collation `utf8mb4_unicode_ci` konsisten.
- Urutan verifikasi setelah mengubah kode: `npm run lint && npm test && npm run build`

## Arsitektur & aturan bisnis
- `src/lib/core.ts` menyimpan logika inti bisnis: `isBulanDitagihkan`, `isBulanGapNonaktif`, parse tanggal `YYYY-MM-DD` sebagai waktu lokal (bukan UTC).
- **`PERBAIKAN_LOGIKA.md` adalah catatan keputusan aturan bisnis yang wajib dibaca**: tagihan santri tidak aktif, periode nonaktif, tarif, pembatalan pembayaran, nomor kuitansi, blokir tarif. Perbarui file ini saat mengubah aturan bisnis.
- Pembatalan pembayaran memakai rollback atomik (`snapshotKeys`): syahriyah/kilatan (matriks + transaksi + kas + counter kuitansi) dan iuran (daftar pembayaran + kas). Jangan melakukan perubahan parsial; ikuti pola di `syahriyahService.batalkanPembayaran()`.
- `src/features/<modul>/…` halaman per menu; `src/components/layout/Sidebar.tsx` + `Topbar.tsx` + `menuConfig.tsx` (label menu & role); `src/components/ui/` — `ConfirmDialog` & `Toast` (jangan pakai `window.confirm`/`alert`).

## Komponen & fitur UX (Fase 1)
- **Toast**: `showToast(pesan, 'success' | 'error' | 'info')`. `ToastContainer` + `UndoToastContainer` hanya dipasang di `AppLayout` (z-[9999]/z-[9998]) — **jangan** menambah `ToastContainer` per halaman. Setiap aksi sukses/gagal wajib memunculkan toast, termasuk jalur `catch`.
- **`Button`** (`components/ui/Button.tsx`): varian `primary | secondary | danger | ghost`, prop `fullWidth`, `isLoading` — pakai untuk tombol baru agar gaya konsisten.
- **`EmptyState`** (`components/ui/EmptyState.tsx`): tampilan data kosong dengan ikon, judul, deskripsi, aksi opsional.
- **`HelpTooltip`** (`components/ui/HelpTooltip.tsx`): bantuan kontekstual; posisi `top-full left-0`, lebar maksimal 240px, `z-30`.
- **`SearchModal`** (`components/ui/SearchModal.tsx`): pencarian global lintas modul, dibuka `Ctrl/Cmd+K`.
- **`NotificationsPanel`** (`components/ui/NotificationsPanel.tsx`): lonceng notifikasi dari data nyata (tunggakan syahriyah/kilatan, saldo kas defisit, pendaftar baru).
- **`UndoToast`** (`components/ui/UndoToast.tsx`): `showUndoToast()` untuk aksi destruktif yang bisa dibatalkan — dipakai hapus kategori kas dan hapus transaksi kas (`kasService.restoreKas`).
- **Shortcut global** (di `Topbar.tsx`): `Ctrl/Cmd+K` cari, `Ctrl/Cmd+N` notifikasi, `Ctrl/Cmd+F` fokus pencarian halaman, `Ctrl/Cmd+P` cetak. Jangan menambah handler `keydown` global di halaman.
- **Validasi form**: `SantriFormModal`, `KasFormModal`, `PendaftaranFormModal` memfokuskan field pertama yang error; pertahankan pola ini saat menambah form.

## Komponen & fitur UX (Fase 2)
- **Impor santri**: `features/santri/ImportSantriModal.tsx` + `lib/santriImport.ts` (parsing/alias header) + `santriService.importSantri()` (atomik, auto-NIS). Template unduh memakai `XLSX.writeFile`. Test: `tests/santriImport.test.ts`.
- **Batch action**: checkbox di `SantriListPage` (pilih per halaman), cetak PDF terpilih via `exportLaporanToPdf`, hapus massal via `ConfirmDialog` + `santriService.deleteSantri` per id.
- **Riwayat aktivitas**: `lib/activityLogService.ts` (`catat/getAll/clear`, key `al_hidayah_activity_log`, max 500) dan `features/aktivitas/AktivitasPage.tsx` (rute `/aktivitas`, menu super_admin/admin). Catatan dari **service layer**, jangan dari UI. Key ini termasuk `BACKUP_SPECS`.
- **Mobile card layout**: pola `hidden md:block` untuk tabel + `md:hidden` untuk kartu dipakai di halaman daftar. Pastikan aksi di kartu identik dengan tabel.
- Data lokal pakai key `al_hidayah_*`; backup/restore memvalidasi struktur secara ketat — jangan ubah nama key.
- `react-is` dibutuhkan untuk build produksi; jangan hapus dari `package.json`.
- `DISABLE_HMR=true` di `vite.config.ts` untuk mode AI Studio; jangan disederhanakan.
- Dev: 3 akun demo (superadmin/admin1/pengasuh) password `admin123`, hanya di mode dev. Build produksi tidak punya akun default; aplikasi meminta pembuatan Super Admin pertama.

## Backend (Fase 3)
- `server/` berisi API Express + MySQL (`mysql2/promise`); entri `server/src/app.ts`, `server/src/index.ts`.
- `npm run db:migrate` **membaca blok DDL dari `MIGRASI_DB.md`** — jika mengubah schema, ubah dokumen itu (jangan duplikat DDL di `server/`).
- Autentikasi: tabel `sessions`, cookie httpOnly `al_hidayah_sid`, CSRF header `x-csrf-token` untuk mutation, bcrypt cost 12. Role dicek di middleware (`server/src/auth.ts`, `server/src/roles.ts`).
- Transaksi atomik (pengganti `snapshotKeys`) ada di `withTransaction()` (`server/src/db.ts`); counter kuitansi dikunci `FOR UPDATE` di `server/src/kuitansi.ts`.
- Aturan bisnis frontend (`core.ts`, `kilatanService`) diport ke `server/src/validation.ts` — **jangan biarkan keduanya berbeda tanpa alasan**.
- Frontend: **development default `VITE_API_MODE=local`** (`.env`, `.env.example`) agar data demo & semua aksi berjalan seperti prototype. **Production memakai API** melalui `.env.production` (`VITE_API_MODE=api`) yang dibaca saat `npm run build`. `.env.test` dipakai Playwright.
- `src/lib/storageMode.ts` membersihkan cache localStorage **sekali kali** saat versi/mode berubah (`al_hidayah_storage_version`); mencegah cache API (santri `smoke-*`, matriks 1 bulan) dipakai saat mode lokal.
- Jalur tulis juga sudah API: arsip tarif (`PUT /api/master/arsip-tarif/replace`), iuran tambahan (`PUT /api/master/iuran-tambahan/replace`), kop surat & konfigurasi kwitansi (`PUT /api/master/pengaturan/:kunci`), serta backup/restore (`GET /api/backup`, `POST /api/restore`).
- Di mode API, file backup berisi tabel DB (bukan key `al_hidayah_*`); restore backup format lokal ditolak dengan pesan jelas. Cache localStorage hanya dipakai sebagai pembaca yang disinkronkan.
- `apiRequest` punya opsi `skipCsrf` untuk endpoint sebelum login (`/api/auth/login`, `/api/auth/setup`). Tanpa ini, login API gagal karena CSRF mencoba `/api/auth/me`.
- PWA: `public/manifest.webmanifest`, `public/icon.svg`, `public/sw.js` (cache aset statik saja; `/api/*` network-only). SW didaftarkan di `main.tsx` hanya saat `import.meta.env.PROD`. Ikon PNG 192/512 dibuat dengan `node scripts/generate-icons.mjs`.
- `xlsx` dipakai dari tarball resmi SheetJS 0.20.3 (bukan versi npm lama yang punya advisory high). Jangan downgrade ke `xlsx@0.18.x`.
- **Keringanan syahriyah (Super Admin)**: tabel `keringanan_syahriyah` menyimpan rentang bulan + `snapshot` nominal asli; endpoint `/api/keringanan`; UI tombol "Keringanan" di halaman Syahriyah (`KeringananModal.tsx`). Histori bulan lunas adalah **harga mati**: mencabut keringanan memotong periode (`bulan_selesai = bulan pembatalan - 1`); bulan sebelumnya tetap terikat keringanan, bulan setelah pembatalan kembali tarif penuh. Matrix recalc (`getSyahriyahMatrix`) tidak mengubah bulan yang sudah ada pembayaran/status Lunas. Mode lokal memakai `al_hidayah_syahriyah_waivers` + `waiverService.hapus(id, dariBulan)`.
- Detail setup & deploy produksi: `server/README.md` dan **`DEPLOYMENT.md`**.

## Perangkap & catatan opsional
- **Backup mode lokal berisi password plaintext** (`al_hidayah_users`); backup produksi lewat `/api/backup` **tidak** mengirim `password_hash` sama sekali. Jangan pernah menyalin file backup lokal ke produksi.
- **Mode lokal**: otorisasi hanya di UI (tombol disembunyikan per role). **Mode API produksi**: otorisasi ada di middleware server (`requireAuth`/`requireRole`) — jangan menganggap UI sebagai satu-satunya pengaman.
- **Mode lokal** masih punya race condition multi-tab; **mode API** sudah memakai transaksi InnoDB + `SELECT ... FOR UPDATE` pada counter kuitansi.
- `npm install` tanpa `--legacy-peer-deps` bisa gagal (React 19).
- Folder root berisi `*.zip` berkopian aplikasi — jangan dihapus. Repo sekarang sudah terhubung ke `origin` GitHub.
- Strict JSON di `core.ts` (`readJsonStrict`): data rusak melempar `DataRusakError`, tidak direset diam-diam.
- TypeScript v7; build chunk >500 kB memicu warning (backlog).
