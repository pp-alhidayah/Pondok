# Panduan Deploy Produksi — Sistem Informasi Pondok Al Hidayah

Arsitektur produksi: **SPA Vite/React** (folder `dist/`) → **API Express** (`server/`, port 3001) → **MariaDB/MySQL**. Tidak ada localStorage sebagai sumber data; localStorage hanya cache baca yang disinkronkan dari API.

## 1. Prasyarat

- Node.js 20+
- MariaDB 10.x / MySQL 8.x
- Reverse proxy HTTPS (Nginx/Caddy) — wajib untuk cookie `Secure` & service worker
- Domain/HTTPS untuk frontend dan API (boleh satu domain, API di `/api`)

## 2. Konfigurasi environment

Salin template lalu isi nilai produksi:

```bash
cp .env.example .env
cp env.production.example .env.production
```

Contoh `.env` (server):

```ini
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=pondok
DB_PASSWORD=<password-kuat>
DB_NAME=al_hidayah
CORS_ORIGIN=https://pondok.example.com
SESSION_SECRET=<64-96 karakter acak>
SESSION_TTL_HOURS=12
```

Buat secret acak:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Contoh `.env.production` (dipakai Vite saat `npm run build`):

```ini
VITE_API_MODE=api
# Kosong = same-origin (API di /api lewat reverse proxy). Atau isi origin saja:
VITE_API_URL=
# VITE_API_URL=https://pondok.example.com
```

> `VITE_*` tertanam di bundle saat build. Ubah `.env.production` **sebelum** build, lalu build ulang.
>
> **Jangan** mengisi `VITE_API_URL` dengan `https://.../api`. Setiap `apiRequest` sudah
> memakai path `/api/...`, jadi akhirnya akan menjadi `/api/api/...`. Isi origin saja
> atau kosongkan untuk same-origin.

## 3. Database

```bash
# Buat DB & user (sekali)
mysql -u root -p -e "CREATE DATABASE al_hidayah CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'pondok'@'localhost' IDENTIFIED BY '...'; GRANT ALL ON al_hidayah.* TO 'pondok'@'localhost'; FLUSH PRIVILEGES;"

# Terapkan schema (idempoten; aman dijalankan ulang)
npm run db:migrate
```

DDL **satu-satunya sumber kebenaran** ada di blok ` ```sql ` pada `MIGRASI_DB.md`. Jangan duplikat DDL di `server/`.

Data produksi dimulai kosong. Super Admin dibuat lewat `POST /api/auth/setup` (tersedia hanya saat tabel `users` kosong).

## 4. Build & jalankan

```bash
npm install --legacy-peer-deps
npm run lint && npm test && npm run build
NODE_ENV=production npm run server
```

Gunakan process manager agar API hidup terus, mis. PM2:

```bash
pm2 start npm --name "alhidayah-api" -- run server
pm2 save && pm2 startup
```

## 5. Reverse proxy (contoh Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name pondok.example.com;

    ssl_certificate     /etc/letsencrypt/live/pondok.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pondok.example.com/privkey.pem;

    root /var/www/pondok/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001/health;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Service worker hanya mendaftar saat `import.meta.env.PROD` — pastikan aplikasi dilayani via HTTPS.

## 6. Checklist keamanan

- [ ] Semua perubahan sudah di-commit & di-push ke `origin` (commit terakhir sudah bersih)
- [ ] `SESSION_SECRET` diganti dari nilai development (minimal 32 byte acak)
- [ ] `VITE_API_URL` tidak mengandung `/api` dan tidak pointing ke `localhost`
- [ ] `NODE_ENV=production` (cookie `Secure` aktif, error detail tidak bocor)
- [ ] `CORS_ORIGIN` tepat satu origin frontend (bukan `*`)
- [ ] DB hanya bisa diakses localhost / private network
- [ ] User DB bukan `root`, password kuat, hak hanya untuk DB aplikasi
- [ ] HTTPS aktif di frontend & API
- [ ] Tidak ada akun demo produksi (setup Super Admin pertama)
- [ ] Backup disimpan terenkripsi & tidak mengandung password plaintext (API `/api/backup` menghilangkan `password_hash`)
- [ ] Log audit (`activity_log`) dipantau; skrip backup otomatis disiapkan
- [ ] Header CSRF `x-csrf-token` wajib untuk semua mutation

## 7. Backup & restore

- **Download**: menu Pengaturan → Backup (memanggil `GET /api/backup`).
- **Restore**: menu Pengaturan → Restore (memanggil `POST /api/restore`).
- File backup produksi berisi **nama tabel DB**, bukan key `al_hidayah_*`.
- Backup format localStorage lama **ditolak** di mode API — jangan dipakai untuk produksi.
- Simpan backup di lokasi terpisah + enkripsi; uji restore secara berkala di staging.

## 8. Verifikasi pasca-deploy

```bash
curl https://pondok.example.com/health
npm run lint && npm run lint:server && npm test
npx tsx --test server/tests/*.test.ts
npm run test:e2e
# Smoke terhadap DB produksi/staging:
npm run test:smoke
```

Smoke test mencakup: pembayaran (transaksi + kas + matriks + kuitansi), konkurensi nomor kuitansi, rollback pembatalan, penolakan 403 untuk role `pemilik`, dan siklus keringanan Super Admin (potong → cabut → tagihan pulih).

## 9. Catatan operasional

- Build menyisakan warning chunk >500 kB (~2,1 MB) — sudah dikenal, tidak memblokir.
- `xlsx` berasal dari tarball resmi SheetJS 0.20.3; jangan diturunkan ke `0.18.x` (advisory high).
- Perubahan schema **wajib** dilakukan di `MIGRASI_DB.md`, lalu `npm run db:migrate`.
- Semua aturan bisnis penting ada di `PERBAIKAN_LOGIKA.md` dan `AGENTS.md`.
- Jika memakai domain berbeda untuk API, set `CORS_ORIGIN` dan `VITE_API_URL` sesuai, lalu build ulang frontend.
