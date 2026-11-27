# Backend API — Sistem Informasi Pondok Al Hidayah

Implementasi Fase 3 berdasarkan `MIGRASI_DB.md`. Berjalan terpisah dari Vite (frontend tetap di port 3000).

## Prasyarat

- **MariaDB 10.x / MySQL 8.x** (terdeteksi: MariaDB; collation DDL `utf8mb4_unicode_ci`)
- Node.js 20+
- Salin `.env.example` menjadi `.env`, lalu isi kredensial database dan `SESSION_SECRET`.
- `.env` contoh memakai `DB_NAME=al_hidayah` — database ini sudah dikosongkan dan dimigrasi khusus untuk aplikasi ini. Database lama dengan schema lain sudah tidak ada; jangan pakai nama itu untuk aplikasi berbeda tanpa migrasi terencana.

## Menjalankan

```bash
npm install --legacy-peer-deps
npm run db:migrate      # membuat 19 tabel dari blok DDL di MIGRASI_DB.md + sessions
npm run server          # API di http://localhost:3001
# atau saat development: npm run dev:server
```

## Alur awal (data produksi kosong)

1. `POST /api/auth/setup` — buat Super Admin pertama (hanya bisa dipanggil sekali).
2. `POST /api/auth/login` — cookie `al_hidayah_sid` (httpOnly) + `csrfToken`.
3. Sertakan `x-csrf-token` pada semua method POST/PUT/DELETE.

## Cara pakai dari frontend

Salin `.env.example` → `.env`, lalu set:

```
VITE_API_MODE=api
VITE_API_URL=http://localhost:3001
```

Mode default (`local`) tetap memakai localStorage. Saat `api`, frontend memanggil API untuk semua perubahan data dan menyinkronkan cache baca dari `/api/backup`.

## Ringkasan endpoint

| Prefix | Isi |
|---|---|
| `/api/auth/*` | setup, login, me, logout |
| `/api/pembayaran/*` | bayar syahriyah/kilatan/iuran, batalkan, riwayat |
| `/api/master/*` | santri, pendaftaran (+ konversi), kas, master-iuran, iuran-tambahan, arsip-tarif, kategori-kas, pengaturan, users |
| `/api/laporan/:jenis` | keuangan, santri, pendaftaran, syahriyah, iuran, kilatan |
| `/api/aktivitas`, `/api/print-log` | audit trail & log cetak |
| `/api/backup`, `/api/restore` | ekspor/pulihkan data (Super Admin) |
| `/health` | health check database |

## Aturan penting

- Semua perubahan data berjalan di transaksi InnoDB; counter kuitansi dikunci dengan `SELECT ... FOR UPDATE`.
- Pembatalan pembayaran tidak mengembalikan nomor kuitansi.
- Entri kas dari pembayaran tidak bisa diedit/dihapus lewat `/api/master/kas`.
- `pemilik` bersifat read-only; middleware menolak mutation dengan 403.
- Password hanya tersimpan sebagai hash bcrypt (cost 12); `password_hash` tidak pernah dikirim ke client.

## Verifikasi

```bash
npm run lint:server
npx tsx --test server/tests/*.test.ts
npm run test:smoke   # server harus sudah berjalan; menguji bayar, konkurensi kuitansi, batal, dan 403 pemilik
```

Smoke test terverifikasi lolos terhadap MariaDB lokal: 4 skenario (pembayaran + kas + matriks + kuitansi, konkurensi nomor unik, rollback pembatalan tanpa mundur counter, otorisasi pemilik 403).
