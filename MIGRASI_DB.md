# Migrasi Data — Dari localStorage ke MySQL

Dokumen ini adalah **spesifikasi teknis Fase 3**: pemetaan kunci localStorage (`al_hidayah_*`) ke skema MySQL, DDL, batas transaksi atomik, API, dan otorisasi.

> **Keputusan produksi: data dimulai kosong.** Tidak ada migrasi data prototype ke produksi. Prosedur ekspor/import di §4 hanya alat bantu untuk pengembangan/backup darurat, bukan langkah wajib produksi.

## 1. Keputusan desain final

| Aspek | Keputusan | Alasan |
|---|---|---|
| Primary key | `VARCHAR(36)` mengikuti `generateId()` (`s_<ms>_<random>`) | Konsisten dengan service & test yang sudah ada; tidak perlu tabel pemetaan ID lama → baru. Produksi mulai kosong sehingga tidak ada alasan kuat untuk `AUTO_INCREMENT`. |
| Waktu | `DATETIME` (bukan `TIMESTAMP`) | Aplikasi memakai waktu lokal WIB (`core.ts` sengaja menghindari parsing UTC). `TIMESTAMP` akan melakukan konversi zona waktu otomatis. |
| Uang | `BIGINT` satuan rupiah bulat | Menghindari presisi `FLOAT`/`DECIMAL`; sesuai `isNominalValid()`. |
| Tanggal | `DATE` (`YYYY-MM-DD`), `CHAR(7)` untuk `YYYY-MM` | Sama dengan format localStorage; memudahkan validasi kalender terpusat. |
| Password | `password_hash VARCHAR(255)` (bcrypt cost 12) | Password plaintext **tidak pernah** disimpan, termasuk di backup produksi. |
| Nomor kuitansi | `kuitansi_counter` + `SELECT ... FOR UPDATE` | Menutup race condition multi-tab saat dua transaksi bersamaan. |
| `iuran_pembayaran.kas_id` | Kolom `VARCHAR(36) NULL`, **tanpa FK** | Pembatalan pembayaran **menghapus** entri kas. FK dengan `RESTRICT` akan menggagalkan pembatalan. Sumber kebenaran relasi ada di `buku_kas.sumber_modul` + `sumber_ref_id`. |
| Konfigurasi | Tabel `pengaturan` dengan `kunci` sebagai PK | Profil, tarif, kop surat, dan kwitansi config adalah 4 baris berbeda dengan `UNIQUE(kunci)`. |
| Entri kas dari pembayaran | `sumber` JSON dipecah jadi 2 kolom (`sumber_modul`, `sumber_ref_id`) + `UNIQUE` | Query rollback lebih cepat dan dapat dijamin unik oleh database. |
| Audit | `created_by` / `updated_by` FK ke `users` | `activity_log` tidak lagi bergantung pada username di localStorage. |

## 2. Pemetaan kunci → tabel

| Kunci localStorage | Tabel MySQL | Keterangan |
|---|---|---|
| `al_hidayah_santri` | `santri` | Data master santri. `periode_nonaktif` dipisah ke `santri_periode_nonaktif`. |
| `al_hidayah_santri` (periode_nonaktif) | `santri_periode_nonaktif` | `santri_id` (FK), `mulai` (DATE), `sampai` (DATE, nullable). |
| `al_hidayah_syahriyah` | `syahriyah_bulan` | Matriks tagihan bulanan. `santri_id` (FK), `tahun`, `bulan`, `nominal_tagihan`, `total_dibayar`, `status`. |
| `al_hidayah_syahriyah_waivers` | `keringanan_syahriyah` | Keringanan Super Admin: rentang bulan, potongan per bulan, `snapshot` nominal asli, `created_by` (FK users). |
| `al_hidayah_syahriyah_transaksi` | `transaksi_syahriyah` | `nomor_kuitansi` UNIQUE, `santri_id` (FK), `tanggal_bayar`, `items` (JSON), `transaksi_data` dipecah ke kolom. |
| `al_hidayah_kilatan` | `kilatan_bulan` | Matriks tagihan event. `santri_id` (FK), `tahun`, `event`, `nominal_tagihan`, `total_dibayar`, `status`. |
| `al_hidayah_kilatan_transaksi` | `transaksi_kilatan` | `nomor_kuitansi` UNIQUE, `santri_id` (FK), `tanggal_bayar`, `items` (JSON). |
| `al_hidayah_kas` | `buku_kas` | Buku kas. `sumber` JSON → `sumber_modul` + `sumber_ref_id` (UNIQUE). |
| `al_hidayah_kategori_kas` | `kategori_kas` | PK komposit `(jenis, nama)`. |
| `al_hidayah_pendaftaran` | `pendaftaran` | Status ENUM, `nis_generated`, `santri_id` hasil konversi. |
| `al_hidayah_users` | `users` | `password` → `password_hash` (bcrypt). |
| `al_hidayah_master_iuran` | `master_iuran` | Program iuran. |
| `al_hidayah_iuran_pembayaran` | `iuran_pembayaran` | `kas_id` tanpa FK (lihat §1). |
| `al_hidayah_iuran_tambahan` | `iuran_tambahan` | Opsi preset iuran lain. |
| `al_hidayah_nomor_kuitansi` | `kuitansi_counter` | `tahun` PK, `nilai_counter` BIGINT. |
| `al_hidayah_profil` | `pengaturan` | `kunci = 'profil'`. |
| `al_hidayah_tarif` | `pengaturan` | `kunci = 'tarif'`. |
| `al_hidayah_arsip_tarif` | `arsip_tarif` | Riwayat tarif per periode. |
| `al_hidayah_kop_surat` | `pengaturan` | `kunci = 'kop_surat'`. |
| `al_hidayah_kwitansi_config` | `pengaturan` | `kunci = 'kwitansi_config'`. |
| `al_hidayah_print_logs` | `print_log` | Log cetak kwitansi/laporan. |
| `al_hidayah_activity_log` | `activity_log` | Audit trail, maksimal 500 entri terbaru. |

## 3. Kunci yang TIDAK dimigrasi

- `al_hidayah_auth_user` — sesi login; produksi memakai tabel `sessions` + cookie httpOnly.
- `al_hidayah_toast_event`, `al_hidayah_undo_event` — event UI sesi.
- `al_hidayah_password` tidak ada; password hanya hidup sebagai `password_hash` di tabel `users`.

## 4. Migrasi data prototype (OPSIONAL — bukan untuk produksi)

Produksi selalu dimulai kosong dan **Super Admin dibuat lewat `/api/setup`**. Prosedur di bawah hanya dipakai bila seseorang sengaja ingin memindahkan data prototype ke lingkungan non-produksi:

1. Ekspor backup JSON dari prototype (menu Backup & Restore).
2. Validasi dengan `validateBackup()` sebelum menulis apa pun.
3. Hash ulang semua password plaintext dengan bcrypt sebelum INSERT ke `users`.
4. Tulis data ke tabel sesuai §2. Karena ID memakai `VARCHAR(36)`, **tidak perlu** pemetaan ID.
5. Hitung ulang `kuitansi_counter` dari `transaksi_syahriyah` + `transaksi_kilatan` (ambil nomor urut maksimum per tahun).
6. Verifikasi jumlah baris per tabel, lalu hapus/simpan backup sebagai cadangan read-only.

## 5. DDL MySQL 8

> Jalankan dengan `utf8mb4` / `utf8mb4_unicode_ci` dan `ENGINE=InnoDB`. Urutan pembuatan mengikuti ketergantungan FK di bawah.

```sql
-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY,
  nama          VARCHAR(120) NOT NULL,
  username      VARCHAR(80)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('super_admin','admin','pemilik') NOT NULL,
  status        ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1b. sessions (sesi login httpOnly; tidak berasal dari localStorage)
CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(64) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  csrf_token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expired (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. santri
CREATE TABLE IF NOT EXISTS santri (
  id             VARCHAR(36) PRIMARY KEY,
  nis            VARCHAR(40) NOT NULL UNIQUE,
  nama           VARCHAR(150) NOT NULL,
  nama_wali      VARCHAR(150) NOT NULL DEFAULT '',
  no_hp_santri   VARCHAR(30)  NOT NULL DEFAULT '',
  no_hp_wali     VARCHAR(30)  NOT NULL DEFAULT '',
  kategori       ENUM('Mukim','Nduduk','Kilatan') NOT NULL,
  status         ENUM('Aktif','Tidak Aktif') NOT NULL DEFAULT 'Aktif',
  tanggal_masuk  DATE NOT NULL,
  tanggal_keluar DATE NULL,
  foto           TEXT NULL,
  catatan        TEXT NULL,
  created_at     DATETIME NOT NULL,
  updated_at     DATETIME NOT NULL,
  created_by     VARCHAR(36) NULL,
  updated_by     VARCHAR(36) NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_santri_nama (nama),
  INDEX idx_santri_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. santri_periode_nonaktif
CREATE TABLE IF NOT EXISTS santri_periode_nonaktif (
  id        VARCHAR(36) PRIMARY KEY,
  santri_id VARCHAR(36) NOT NULL,
  mulai     DATE NOT NULL,
  sampai    DATE NULL,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE,
  CONSTRAINT chk_periode CHECK (sampai IS NULL OR sampai >= mulai),
  INDEX idx_periode_santri (santri_id, mulai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. syahriyah_bulan
CREATE TABLE IF NOT EXISTS syahriyah_bulan (
  id              VARCHAR(36) PRIMARY KEY,
  santri_id       VARCHAR(36) NOT NULL,
  tahun           SMALLINT UNSIGNED NOT NULL,
  bulan           TINYINT UNSIGNED NOT NULL,
  nominal_tagihan BIGINT NOT NULL DEFAULT 0,
  total_dibayar   BIGINT NOT NULL DEFAULT 0,
  status          ENUM('Lunas','Sebagian','Belum') NOT NULL DEFAULT 'Belum',
  keringanan      TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = nominal_tagihan final hasil keringanan',
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE,
  UNIQUE KEY uq_syahriyah (santri_id, tahun, bulan),
  CONSTRAINT chk_bulan CHECK (bulan BETWEEN 1 AND 12),
  INDEX idx_syahriyah_tahun (tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE syahriyah_bulan ADD COLUMN IF NOT EXISTS keringanan TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE keringanan_syahriyah ADD COLUMN IF NOT EXISTS jenis ENUM('kustom','setengah','penuh') NOT NULL DEFAULT 'kustom';

-- 4b. keringanan syahriyah (Super Admin)
CREATE TABLE IF NOT EXISTS keringanan_syahriyah (
  id                 VARCHAR(36) PRIMARY KEY,
  santri_id          VARCHAR(36) NOT NULL,
  tahun              SMALLINT UNSIGNED NOT NULL,
  bulan_mulai        TINYINT UNSIGNED NOT NULL,
  bulan_selesai      TINYINT UNSIGNED NOT NULL,
  jenis              ENUM('kustom','setengah','penuh') NOT NULL DEFAULT 'kustom',
  nominal_per_bulan  BIGINT NOT NULL DEFAULT 0 COMMENT 'Potongan untuk jenis kustom',
  keterangan         TEXT NULL,
  snapshot           JSON NULL COMMENT 'nominal_tagihan asli per bulan sebelum keringanan',
  created_at         DATETIME NOT NULL,
  created_by         VARCHAR(36) NULL,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_keringanan_bulan CHECK (
    bulan_mulai BETWEEN 1 AND 12 AND bulan_selesai BETWEEN 1 AND 12 AND bulan_selesai >= bulan_mulai
  ),
  INDEX idx_keringanan_santri (santri_id, tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4c. Migrasi keringanan lintas tahun: buang kolom & constraint sisa lama.
--     CREATE TABLE IF NOT EXISTS tidak mengubah tabel yang sudah ada, jadi tanpa
--     blok ini DB lama tetap punya tahun_selesai NOT NULL DEFAULT 0 + CHECK lama
--     (tahun_selesai BETWEEN tahun AND tahun+1) -> INSERT kode revert SELALU gagal
--     ("CONSTRAINT chk_keringanan_bulan failed"). Idempoten: aman dijalankan
--     berulang, baik di DB baru maupun lama. Data lintas tahun tidak ada (kolom
--     pernah diisi pun tetap valid dipotong jadi tahun yang sama), jadi tidak ada
--     pembersihan data yang diperlukan.
ALTER TABLE keringanan_syahriyah DROP CONSTRAINT IF EXISTS chk_keringanan_bulan;
-- Baris bekas lintas tahun (bulan_selesai < bulan_mulai) dinormalkan dulu:
-- model hanya mengenal satu tahun, jadi periode dipotong di batas tahun
-- (Des -> Des; Nov..Okt -> Nov..Des). Tanpa ini ADD CONSTRAINT di bawah gagal
-- bila MariaDB menolak baris lama yang melanggar CHECK baru.
-- Sengaja tidak merujuk tahun_selesai: kolom itu mungkin sudah/tidak ada.
UPDATE keringanan_syahriyah SET bulan_selesai = 12 WHERE bulan_selesai < bulan_mulai;
ALTER TABLE keringanan_syahriyah DROP COLUMN IF EXISTS tahun_selesai;
ALTER TABLE keringanan_syahriyah ADD CONSTRAINT chk_keringanan_bulan CHECK (
  bulan_mulai BETWEEN 1 AND 12 AND bulan_selesai BETWEEN 1 AND 12 AND bulan_selesai >= bulan_mulai
);

-- 5. transaksi_syahriyah
CREATE TABLE IF NOT EXISTS transaksi_syahriyah (
  id               VARCHAR(36) PRIMARY KEY,
  nomor_kuitansi   VARCHAR(30) NOT NULL UNIQUE,
  kas_id           VARCHAR(36) NULL,
  santri_id        VARCHAR(36) NOT NULL,
  santri_nama      VARCHAR(150) NOT NULL,
  santri_nis       VARCHAR(40)  NOT NULL,
  tanggal_bayar    DATE NOT NULL,
  metode           ENUM('Tunai','Transfer','Lainnya') NOT NULL DEFAULT 'Tunai',
  keterangan       TEXT NULL,
  iuran_tambahan   JSON NULL,
  items            JSON NOT NULL,
  total_pembayaran BIGINT NOT NULL,
  created_at       DATETIME NOT NULL,
  created_by       VARCHAR(36) NULL,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_trx_syahriyah_santri (santri_id),
  INDEX idx_trx_syahriyah_tanggal (tanggal_bayar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. kilatan_bulan
CREATE TABLE IF NOT EXISTS kilatan_bulan (
  id              VARCHAR(36) PRIMARY KEY,
  santri_id       VARCHAR(36) NOT NULL,
  tahun           SMALLINT UNSIGNED NOT NULL,
  event           ENUM('Jumadil Ula','Maulid','Romadhon','Dzulhijjah') NOT NULL,
  nominal_tagihan BIGINT NOT NULL DEFAULT 0,
  total_dibayar   BIGINT NOT NULL DEFAULT 0,
  status          ENUM('Lunas','Sebagian','Belum') NOT NULL DEFAULT 'Belum',
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE CASCADE,
  UNIQUE KEY uq_kilatan (santri_id, tahun, event),
  INDEX idx_kilatan_tahun (tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. transaksi_kilatan
CREATE TABLE IF NOT EXISTS transaksi_kilatan (
  id               VARCHAR(36) PRIMARY KEY,
  nomor_kuitansi   VARCHAR(30) NOT NULL UNIQUE,
  kas_id           VARCHAR(36) NULL,
  santri_id        VARCHAR(36) NOT NULL,
  santri_nama      VARCHAR(150) NOT NULL,
  santri_nis       VARCHAR(40)  NOT NULL,
  tanggal_bayar    DATE NOT NULL,
  metode           ENUM('Tunai','Transfer','Lainnya') NOT NULL DEFAULT 'Tunai',
  keterangan       TEXT NULL,
  iuran_tambahan   JSON NULL,
  items            JSON NOT NULL,
  total_pembayaran BIGINT NOT NULL,
  created_at       DATETIME NOT NULL,
  created_by       VARCHAR(36) NULL,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_trx_kilatan_santri (santri_id),
  INDEX idx_trx_kilatan_tanggal (tanggal_bayar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. kategori_kas
CREATE TABLE IF NOT EXISTS kategori_kas (
  jenis ENUM('pemasukan','pengeluaran') NOT NULL,
  nama  VARCHAR(100) NOT NULL,
  PRIMARY KEY (jenis, nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. buku_kas
CREATE TABLE IF NOT EXISTS buku_kas (
  id            VARCHAR(36) PRIMARY KEY,
  tanggal       DATE NOT NULL,
  jenis         ENUM('Pemasukan','Pengeluaran') NOT NULL,
  kategori_nama VARCHAR(100) NOT NULL,
  nominal       BIGINT NOT NULL,
  keterangan    TEXT NULL,
  sumber_modul  ENUM('syahriyah','kilatan','iuran') NULL,
  sumber_ref_id VARCHAR(36) NULL,
  created_at    DATETIME NOT NULL,
  created_by    VARCHAR(36) NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_kas_sumber (sumber_modul, sumber_ref_id),
  INDEX idx_kas_tanggal (tanggal),
  INDEX idx_kas_kategori (kategori_nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. pendaftaran
CREATE TABLE IF NOT EXISTS pendaftaran (
  id                  VARCHAR(36) PRIMARY KEY,
  nama_calon          VARCHAR(150) NOT NULL,
  nama_wali           VARCHAR(150) NOT NULL,
  no_hp_santri        VARCHAR(30)  NOT NULL,
  no_hp_wali          VARCHAR(30)  NOT NULL,
  kategori            ENUM('Mukim','Nduduk','Kilatan') NOT NULL,
  tanggal_pendaftaran DATE NOT NULL,
  status              ENUM('Baru','Diterima','Ditolak','Menjadi Santri') NOT NULL DEFAULT 'Baru',
  nis_generated       VARCHAR(40) NULL,
  santri_id           VARCHAR(36) NULL,
  catatan             TEXT NULL,
  created_at          DATETIME NOT NULL,
  created_by          VARCHAR(36) NULL,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pendaftaran_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. master_iuran
CREATE TABLE IF NOT EXISTS master_iuran (
  id              VARCHAR(36) PRIMARY KEY,
  nama            VARCHAR(150) NOT NULL UNIQUE,
  nominal_default BIGINT NOT NULL,
  jenis_periode   ENUM('sekali','bulanan','tahunan') NOT NULL,
  status          ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  keterangan      TEXT NULL,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. iuran_pembayaran
CREATE TABLE IF NOT EXISTS iuran_pembayaran (
  id             VARCHAR(36) PRIMARY KEY,
  iuran_id       VARCHAR(36) NOT NULL,
  tipe_pembayar  ENUM('santri','umum') NOT NULL,
  santri_id      VARCHAR(36) NULL,
  nama_pembayar  VARCHAR(150) NOT NULL,
  periode_bulan  CHAR(7) NULL COMMENT 'YYYY-MM',
  periode_tahun  SMALLINT UNSIGNED NULL,
  nominal        BIGINT NOT NULL,
  tanggal_bayar  DATE NOT NULL,
  metode         ENUM('Tunai','Transfer','Lainnya') NOT NULL DEFAULT 'Tunai',
  keterangan     TEXT NULL,
  kas_id         VARCHAR(36) NULL COMMENT 'Tanpa FK: entri kas dihapus saat pembatalan',
  created_at     DATETIME NOT NULL,
  created_by     VARCHAR(36) NULL,
  FOREIGN KEY (iuran_id) REFERENCES master_iuran(id) ON DELETE RESTRICT,
  FOREIGN KEY (santri_id) REFERENCES santri(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_iuran_tanggal (tanggal_bayar),
  INDEX idx_iuran_pembayar (nama_pembayar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. iuran_tambahan
CREATE TABLE IF NOT EXISTS iuran_tambahan (
  id      VARCHAR(36) PRIMARY KEY,
  nama    VARCHAR(150) NOT NULL UNIQUE,
  tipe    ENUM('Syahriyah','Kilatan','Keduanya') NOT NULL,
  nominal BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. kuitansi_counter
CREATE TABLE IF NOT EXISTS kuitansi_counter (
  tahun         SMALLINT UNSIGNED PRIMARY KEY,
  nilai_counter BIGINT NOT NULL DEFAULT 0,
  updated_at    DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. pengaturan
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci      VARCHAR(50) PRIMARY KEY,
  nilai      JSON NOT NULL,
  updated_at DATETIME NOT NULL,
  updated_by VARCHAR(36) NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. arsip_tarif
CREATE TABLE IF NOT EXISTS arsip_tarif (
  id               VARCHAR(36) PRIMARY KEY,
  periode_mulai    CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  periode_selesai  CHAR(7) NULL,
  syahriyah_mukim  BIGINT NOT NULL,
  syahriyah_nduduk BIGINT NOT NULL,
  syahriyah_kilatan BIGINT NOT NULL,
  event_kilatan    BIGINT NOT NULL,
  status           ENUM('Aktif','Diarsipkan','Dijadwalkan') NOT NULL,
  diarsipkan_pada  DATETIME NOT NULL,
  created_by       VARCHAR(36) NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_arsip_periode (periode_mulai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. print_log
CREATE TABLE IF NOT EXISTS print_log (
  id           VARCHAR(36) PRIMARY KEY,
  transaksi_id VARCHAR(50) NOT NULL,
  type         ENUM('HVS','Thermal','PDF') NOT NULL,
  printed_at   DATETIME NOT NULL,
  printed_by   VARCHAR(36) NULL,
  FOREIGN KEY (printed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_print_transaksi (transaksi_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. activity_log
CREATE TABLE IF NOT EXISTS activity_log (
  id          VARCHAR(36) PRIMARY KEY,
  waktu       DATETIME NOT NULL,
  modul       ENUM('Santri','Pendaftaran','Syahriyah','Kilatan','Iuran','Kas','Pengaturan','Sistem') NOT NULL,
  aksi        ENUM('Tambah','Ubah','Hapus','Impor','Pembayaran','Pembatalan','Restore','Login') NOT NULL,
  deskripsi   VARCHAR(500) NOT NULL,
  ref_id      VARCHAR(36) NULL,
  user_id     VARCHAR(36) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activity_waktu (waktu),
  INDEX idx_activity_modul (modul)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 6. Batas transaksi atomik

Gunakan `START TRANSACTION` / `COMMIT` / **`ROLLBACK` di `catch`**. Urutan kunci: **counter kuitansi lebih dulu**, lalu tulisan lain — ini mencegah deadlock antar dua pembayaran bersamaan.

| Operasi | Langkah dalam satu transaksi |
|---|---|
| Bayar Syahriyah | lock `kuitansi_counter` (`FOR UPDATE`) → INSERT `transaksi_syahriyah` → INSERT `buku_kas` (`sumber_modul='syahriyah'`) → UPDATE/INSERT `syahriyah_bulan` (kurangi sisa, hitung ulang status) → increment counter → INSERT `activity_log` |
| Bayar Kilatan | sama, dengan `kilatan_bulan` & `transaksi_kilatan` |
| Bayar Iuran | INSERT `iuran_pembayaran` → INSERT `buku_kas` (`sumber_modul='iuran'`) → INSERT `activity_log` (tanpa counter kuitansi) |
| **Batal bayar** (3 modul) | verifikasi record + baris matriks + entri kas ada → kembalikan `total_dibayar` & status → DELETE transaksi → DELETE `buku_kas` → INSERT `activity_log`. **Counter kuitansi TIDAK dikembalikan.** |
| Konversi pendaftar | INSERT `santri` → UPDATE `pendaftaran` (`status='Menjadi Santri'`, `nis_generated`, `santri_id`) → INSERT `activity_log` |
| Restore backup | validasi struktur + relasi (semua FK harus ada) → tulis semua tabel dalam satu transaksi |

Validasi yang wajib dilakukan server sebelum COMMIT: `nominal > 0` bulat, tanggal kalender valid (bukan hanya regex), status termasuk ENUM, NIS unik, `santri_id`/`iuran_id` ada, dan tidak ada pembayaran melebihi sisa tagihan.

## 7. API & otorisasi

**Auth**: bcrypt cost 12; session cookie `httpOnly; Secure; SameSite=Lax`; CSRF token untuk semua mutation; rate limit pada `/api/auth/login`. Role dicek di middleware server, bukan lagi di UI.

| Role | Hak |
|---|---|
| `super_admin` | Semua, termasuk kelola user, backup/restore, pengaturan, `/api/setup` |
| `admin` | Semua transaksi, laporan, cetak; **tidak** bisa kelola user/backup |
| `pemilik` | Read-only seluruh data & laporan |

Endpoint utama:

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/setup` | Buat Super Admin pertama (hanya saat tabel `users` kosong) |
| POST/GET/DELETE | `/api/auth/login` `/api/auth/me` `/api/auth/logout` | Sesi |
| GET/POST/PUT/DELETE | `/api/santri`, `/api/pendaftaran`, `/api/kas`, `/api/iuran/*` | CRUD master & transaksi |
| POST | `/api/pembayaran/syahriyah`, `/kilatan`, `/iuran` | Catat pembayaran (atomik) |
| POST | `/api/pembayaran/:modul/:id/batalkan` | Pembatalan (atomik) |
| GET | `/api/laporan/:jenis?tahun=` | Rekap keuangan/santri/pendaftaran/syahriyah/iuran/kilatan |
| GET/POST | `/api/pengaturan`, `/api/backup`, `/api/restore` | Konfigurasi & backup |
| GET | `/api/aktivitas`, `/api/print-log` | Audit |

Frontend sudah `async` di semua service (A2), sehingga perpindahan ke API cukup mengganti implementasi service — call-site UI tidak berubah.

## 8. Catatan PWA (Fase 3 item 21)

Service worker **hanya cache aset statik** (HTML/CSS/JS/gambar/font). Data keuangan tetap `network-only` agar tidak basi dan tidak menimbulkan konflik tulis. Push notification menyusul setelah infrastruktur subscription tersedia.

## 9. Verifikasi

- `npm run lint`, `npm test`, `npm run build` tetap hijau.
- Smoke test database: jalankan DDL di MySQL 8 kosong → `/api/setup` → login → bayar syahriyah → cek 4 tabel berubah → batalkan → cek rollback + counter tidak mundur.
- Uji konkurensi: dua request bayar bersamaan → nomor kuitansi tetap unik (ditolak oleh `UNIQUE` + `FOR UPDATE`).
- Uji otorisasi: `pemilik` mendapat 403 untuk semua endpoint mutation.

## 10. Catatan keamanan

- Tabel `users` hanya menyimpan `password_hash`. Backup produksi **tidak mengandung password plaintext**.
- Jangan pernah mengembalikan `password_hash` lewat endpoint `/api/users`.
- File backup prototype lama masih berisi password plaintext — perlakukan sebagai data sensitif.
