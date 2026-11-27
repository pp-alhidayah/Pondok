# Pondok Al Hidayah — Sistem Manajemen Pondok Pesantren

Aplikasi web untuk mengelola data santri, pendaftaran, syahriyah (iuran bulanan), kilatan, buku kas, dan laporan keuangan Pondok Al Hidayah Tertek, Pare, Kediri.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Recharts, jsPDF, xlsx, Lucide React

## Fitur Utama

| Modul | Keterangan |
|-------|----------|
| **Dashboard** | Ringkasan santri, kas, tren |
| **Data Santri** | CRUD santri (Mukim / Nduduk / Kilatan) |
| **Pendaftaran** | Calon santri → konversi ke santri aktif |
| **Syahriyah** | Matrix pembayaran bulanan + kwitansi PDF |
| **Kilatan** | Iuran event + kwitansi PDF |
| **Kas** | Buku kas (terintegrasi otomatis dari pembayaran) |
| **Laporan** | Laporan keuangan & syahriyah + export |
| **Pengaturan** | Profil, tarif + arsip, user, iuran, backup |

## Aturan Tarif

- Saat tarif diubah di Pengaturan, tarif lama **otomatis diarsipkan**.
- Tagihan yang sudah ada pembayaran **tetap memakai tarif lama**.
- Tagihan yang belum dibayar (bulan >= periode baru) di-update ke **tarif baru**.
- **Perubahan tarif hanya boleh** untuk bulan yang belum ada pembayaran dari santri mana pun (syahriyah & kilatan).
- Lookup berdasarkan periode (`YYYY-MM`).

## Integrasi Antar Fitur

- Bayar Syahriyah / Kilatan → otomatis create entri Kas (Pemasukan)
- Konversi Pendaftaran → create Santri baru
- Tarif di Pengaturan dipakai Syahriyah & Kilatan sesuai periode

## Menjalankan Lokal

```bash
npm install --legacy-peer-deps
# atau
bun install

npm run dev
```

Buka http://localhost:3000

### Akun Awal

- **Mode development (`npm run dev`)**: tiga akun demo dibuat (superadmin, admin1, pengasuh) dengan password sementara `admin123`. Jangan dipakai di produksi; segera ganti dari menu **Pengaturan → Pengguna**.
- **Build produksi (`npm run build`)**: tidak ada akun default. Saat pertama kali dibuka, aplikasi meminta pembuatan akun **Super Admin pertama** dengan password yang Anda tentukan sendiri (minimal 8 karakter).

### Hak Akses

- **Super Admin**: seluruh menu, termasuk Pengaturan dan manajemen pengguna.
- **Administrator**: input dan kelola data (santri, pendaftaran, pembayaran, kas).
- **Pengasuh / Pemilik**: hanya melihat data dan mengekspor laporan (read-only). Tombol input/pembayaran disembunyikan.

### Backup & Restore

- Backup hanya berisi data aplikasi (`al_hidayah_*` yang dikenal). Sesi login dan key lama tidak ikut dibackup.
- File backup dari aplikasi lain atau yang strukturnya rusak akan ditolak seluruhnya, sehingga tidak ada data yang tertulis setengah jalan.
- Backup lama (format datar) masih dapat dipulihkan; key sesi di dalamnya diabaikan.
- **Peringatan keamanan**: file backup berisi password akun dalam teks biasa. Simpan file backup sebagai file rahasia dan jangan dibagikan kepada siapa pun.

### Pengujian

```bash
npm test        # unit test (format, nomor kuitansi, backup, iuran, profil)
npm run lint    # pemeriksaan TypeScript
npm run build   # build produksi
```

## Catatan

- Data disimpan di **localStorage** browser (prototype). Hapus data browser berarti menghapus seluruh data; lakukan backup berkala.
- Data demo hanya dimuat saat mode development (`npm run dev`). Build produksi dimulai dengan data kosong.
- Siap dimigrasi ke backend (Supabase / NestJS + PostgreSQL).
