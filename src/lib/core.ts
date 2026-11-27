import { storage } from './storage';
/**
 * Helper bersama untuk logika bisnis Pondok Al Hidayah.
 *
 * - Tanggal selalu dihitung dalam zona waktu lokal (bukan UTC), agar
 *   tanggal bayar & bulan berjalan sesuai WIB.
 * - Pembacaan storage tidak pernah menimpa data yang rusak.
 * - Data demo hanya dipakai saat development.
 */

import type { PeriodeNonaktif } from '../types/santri';

/**
 * Data demo (santri, kas, pendaftaran) hanya di-seed saat development.
 * Optional chaining membuat modul ini tetap aman dijalankan oleh Node
 * (unit test) yang tidak memiliki `import.meta.env`.
 */
export const SEED_DEMO_DATA = import.meta.env?.DEV ?? false;

export const KEY_NOMOR_KUITANSI = 'al_hidayah_nomor_kuitansi';

// ─── Tanggal (zona waktu lokal) ──────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Tanggal hari ini dalam format YYYY-MM-DD menurut zona waktu lokal. */
export function todayLocal(): string {
  return toYmd(new Date());
}

/** Bulan berjalan dalam format YYYY-MM menurut zona waktu lokal. */
export function currentYmLocal(): string {
  return toYm(new Date());
}

/** Tanggal kalender benar-benar valid (bukan hanya cocok dengan regex). */
export function isValidCalendarDate(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Periode YYYY-MM yang benar-benar valid. */
export function isValidYearMonth(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split('-').map(Number);
  return year >= 2000 && month >= 1 && month <= 12;
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toYm(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Bulan berikutnya dari YYYY-MM. */
export function nextYm(ym: string): string {
  let [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${pad2(m)}`;
}

/**
 * Ambil tahun dan bulan dari string tanggal YYYY-MM-DD tanpa membuat Date
 * (menghindari pergeseran hari akibat parsing UTC).
 */
export function tahunBulanDari(tanggal: string): { tahun: number; bulan: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(tanggal || '');
  if (!m) return null;
  return { tahun: parseInt(m[1], 10), bulan: parseInt(m[2], 10) };
}

// ─── Penyimpanan ─────────────────────────────────────────────────────────────

export class DataRusakError extends Error {
  constructor(key: string) {
    super(
      `Data tersimpan (${key}) tidak dapat dibaca. Operasi dihentikan agar data tidak tertimpa. Hubungi administrator / pulihkan dari backup.`
    );
    this.name = 'DataRusakError';
  }
}

/**
 * Baca JSON dari storage.
 * - Key belum ada → kembalikan fallback.
 * - JSON rusak → lempar DataRusakError (JANGAN ditimpa dengan fallback).
 */
export function readJsonStrict<T>(key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new DataRusakError(key);
  }
}

/**
 * Simpan snapshot nilai beberapa key. Panggil fungsi yang dikembalikan
 * untuk mengembalikan kondisi semula jika operasi gagal di tengah jalan.
 */
export function snapshotKeys(keys: string[]): () => void {
  const saved = keys.map((k) => [k, storage.getItem(k)] as const);
  return () => {
    for (const [k, v] of saved) {
      if (v === null) storage.removeItem(k);
      else storage.setItem(k, v);
    }
  };
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Validasi nominal ────────────────────────────────────────────────────────

/** Rupiah penuh tanpa pecahan: bilangan bulat positif. */
export function isNominalValid(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

// ─── Aturan tagihan ──────────────────────────────────────────────────────────

/**
 * Apakah bulan ini sudah masuk tagihan untuk santri?
 * Tagihan dihitung mulai bulan masuk santri sampai bulan berjalan.
 * Bulan sebelum masuk dan bulan mendatang tidak ditagihkan (tidak menjadi tunggakan).
 * Selama masa tidak aktif (riwayat periode) bulan sela TIDAK ditagih; bulan
 * penonaktifan dan bulan pengaktifan kembali tetap ditagih.
 */
export function isBulanDitagihkan(
  tanggalMasuk: string | undefined,
  tahun: number,
  bulan: number,
  tanggalKeluar?: string,
  periodeNonaktif?: PeriodeNonaktif[]
): boolean {
  const target = `${tahun}-${pad2(bulan)}`;
  if (target > currentYmLocal()) return false;
  const masuk = tahunBulanDari(tanggalMasuk || '');
  if (masuk && target < `${masuk.tahun}-${pad2(masuk.bulan)}`) return false;
  if (periodeNonaktif && periodeNonaktif.length) {
    return !isBulanGapNonaktif(periodeNonaktif, tahun, bulan);
  }
  // Data lama tanpa riwayat periode: pakai tanggal keluar sederhana
  return !isAfterKeluar(tanggalKeluar, tahun, bulan);
}

/**
 * Apakah bulan/tagihan terjadi SETELAH tanggal keluar santri?
 * Bulan tanggal keluar sendiri masih dianggap ditagih, bulan berikutnya tidak.
 */
export function isAfterKeluar(tanggalKeluar: string | undefined, tahun: number, bulan: number): boolean {
  if (!tanggalKeluar) return false;
  const keluar = tahunBulanDari(tanggalKeluar);
  if (!keluar) return false;
  return `${tahun}-${pad2(bulan)}` > `${keluar.tahun}-${pad2(keluar.bulan)}`;
}

/**
 * Apakah bulan jatuh di SELA periode tidak aktif ([-] riwayat status)?
 * - Bulan `mulai` (penonaktifan) TETAP ditagih.
 * - Bulan `sampai` (pengaktifan kembali) TETAP ditagih.
 * - Bulan di antara keduanya (dan bulan setelah `mulai` bila masih tidak aktif)
 *   TIDAK ditagih — termasuk setelah santri diaktifkan kembali.
 */
export function isBulanGapNonaktif(periode: PeriodeNonaktif[], tahun: number, bulan: number): boolean {
  const target = `${tahun}-${pad2(bulan)}`;
  return periode.some((p) => {
    const mulai = tahunBulanDari(p?.mulai || '');
    if (!mulai) return false;
    const mulaiYm = `${mulai.tahun}-${pad2(mulai.bulan)}`;
    if (target <= mulaiYm) return false;
    if (p.sampai) {
      const sampai = tahunBulanDari(p.sampai);
      if (sampai) return target < `${sampai.tahun}-${pad2(sampai.bulan)}`;
    }
    // Masih tidak aktif sampai sekarang
    return true;
  });
}

// ─── Riwayat pembayaran ──────────────────────────────────────────────────────

/** Apakah santri punya riwayat pembayaran (syahriyah / kilatan)? */
export function hasRiwayatPembayaran(santriId: string): boolean {
  const syahMatrix = readJsonStrict<Record<string, Record<number, { total_dibayar: number }[]>>>(
    'al_hidayah_syahriyah',
    {}
  );
  const kilMatrix = readJsonStrict<Record<string, Record<number, { total_dibayar: number }[]>>>(
    'al_hidayah_kilatan',
    {}
  );
  const dibayar = (matrix: typeof syahMatrix) =>
    Object.values(matrix[santriId] || {}).some((recs) =>
      (recs || []).some((r) => r.total_dibayar > 0)
    );
  if (dibayar(syahMatrix) || dibayar(kilMatrix)) return true;

  const transaksi = [
    ...readJsonStrict<{ santri_id: string }[]>('al_hidayah_syahriyah_transaksi', []),
    ...readJsonStrict<{ santri_id: string }[]>('al_hidayah_kilatan_transaksi', []),
    ...readJsonStrict<{ santri_id?: string }[]>('al_hidayah_iuran_pembayaran', []),
  ];
  return transaksi.some((t) => t.santri_id === santriId);
}

// ─── Nomor kuitansi ──────────────────────────────────────────────────────────

/**
 * Nomor kuitansi berformat AH/tahun/nomor urut, berurutan per tahun.
 * Contoh: AH/2026/0001. Panggil hanya setelah validasi lolos.
 *
 * Counter storage bisa hilang/tertinggal (mis. setelah restore backup
 * lama). Karena itu nomor berikutnya selalu direkonsiliasi dengan nomor
 * kuitansi yang sudah ada di transaksi syahriyah & kilatan agar tidak duplikat.
 */
export function nextNomorKuitansi(tahun: number): string {
  if (!Number.isInteger(tahun) || tahun < 2000) {
    throw new Error('Tahun kuitansi tidak valid');
  }

  const key = String(tahun);
  const counters = readJsonStrict<Record<string, number>>(KEY_NOMOR_KUITANSI, {});
  const stored = Number(counters[key]);
  const counter = Number.isFinite(stored) ? Math.max(0, Math.trunc(stored)) : 0;
  const next = Math.max(counter, maxNomorKuitansiTerpakai(tahun)) + 1;

  counters[key] = next;
  storage.setItem(KEY_NOMOR_KUITANSI, JSON.stringify(counters));
  return `AH/${tahun}/${String(next).padStart(4, '0')}`;
}

interface NomorKuitansiRecord {
  nomor_kuitansi?: string;
}

/** Nomor urut terbesar yang sudah dipakai pada transaksi tahun tersebut. */
function maxNomorKuitansiTerpakai(tahun: number): number {
  const prefix = `AH/${tahun}/`;
  const records = [
    ...readJsonStrict<NomorKuitansiRecord[]>('al_hidayah_syahriyah_transaksi', []),
    ...readJsonStrict<NomorKuitansiRecord[]>('al_hidayah_kilatan_transaksi', []),
  ];

  let max = 0;
  for (const record of records) {
    const nomor = record?.nomor_kuitansi;
    if (typeof nomor !== 'string' || !nomor.startsWith(prefix)) continue;
    const urut = parseInt(nomor.slice(prefix.length), 10);
    if (Number.isFinite(urut) && urut > max) max = urut;
  }
  return max;
}

// ─── Keamanan output HTML ────────────────────────────────────────────────────

/** Escape teks sebelum dimasukkan ke HTML (cetak kwitansi / laporan). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Cegah rumus Excel/CSV dieksekusi: awali nilai teks berbahaya dengan apostrof.
 */
export function sanitizeSpreadsheetCell<T>(value: T): T {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return ("'" + value) as unknown as T;
  }
  return value;
}
