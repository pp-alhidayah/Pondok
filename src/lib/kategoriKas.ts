import { storage } from './storage';
import { KATEGORI_PEMASUKAN, KATEGORI_PENGELUARAN } from './constants';
import { readJsonStrict } from './core';

/** Key storage yang dikelola dari menu Pengaturan > Kategori Kas. */
export const KATEGORI_KAS_STORAGE_KEY = 'al_hidayah_kategori_kas';

export interface KategoriKasConfig {
  pemasukan: string[];
  pengeluaran: string[];
}

/** Default tunggal agar form Kas dan halaman Pengaturan selalu sinkron. */
export const DEFAULT_KATEGORI_KAS: KategoriKasConfig = {
  pemasukan: [...KATEGORI_PEMASUKAN],
  pengeluaran: [...KATEGORI_PENGELUARAN],
};

function cloneDefaults(): KategoriKasConfig {
  return {
    pemasukan: [...DEFAULT_KATEGORI_KAS.pemasukan],
    pengeluaran: [...DEFAULT_KATEGORI_KAS.pengeluaran],
  };
}

function normalizeList(values: unknown, fallback: string[]): string[] {
  if (!Array.isArray(values)) return [...fallback];
  const cleaned = Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  return cleaned.length > 0 ? cleaned : [...fallback];
}

/**
 * Baca konfigurasi kategori kas.
 * Konfigurasi ini bukan data transaksi keuangan, sehingga bila rusak cukup
 * kembali ke default tanpa menghentikan aplikasi.
 */
export function getKategoriKas(): KategoriKasConfig {
  try {
    const stored = readJsonStrict<Partial<KategoriKasConfig> | null>(
      KATEGORI_KAS_STORAGE_KEY,
      null
    );
    if (!stored || typeof stored !== 'object') return cloneDefaults();
    return {
      pemasukan: normalizeList(stored.pemasukan, DEFAULT_KATEGORI_KAS.pemasukan),
      pengeluaran: normalizeList(stored.pengeluaran, DEFAULT_KATEGORI_KAS.pengeluaran),
    };
  } catch {
    return cloneDefaults();
  }
}

export function saveKategoriKas(config: KategoriKasConfig): void {
  storage.setItem(
    KATEGORI_KAS_STORAGE_KEY,
    JSON.stringify({
      pemasukan: normalizeList(config.pemasukan, DEFAULT_KATEGORI_KAS.pemasukan),
      pengeluaran: normalizeList(config.pengeluaran, DEFAULT_KATEGORI_KAS.pengeluaran),
    })
  );
}
