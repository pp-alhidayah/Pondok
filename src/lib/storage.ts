import { isApiMode } from './apiClient';

/**
 * Lapisan storage aplikasi.
 *
 * - Mode lokal: memakai localStorage browser seperti biasa (data demo).
 * - Mode API/produksi: memakai Map dalam memori. Tidak ada data yang ditulis
 *   ke penyimpanan browser; DB di server tetap menjadi satu-satunya sumber data.
 *   Cache memori diisi dari /api/backup oleh syncFromApi().
 */
const memori = new Map<string, string>();

const storageMemori: Storage = {
  get length() {
    return memori.size;
  },
  clear() {
    memori.clear();
  },
  getItem(key: string) {
    return memori.has(key) ? (memori.get(key) as string) : null;
  },
  key(index: number) {
    return Array.from(memori.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memori.delete(key);
  },
  setItem(key: string, value: string) {
    memori.set(key, String(value));
  },
};

function aktif(): Storage {
  return isApiMode() ? storageMemori : globalThis.localStorage;
}

/** Storage yang dipakai seluruh service. Di produksi ini bukan localStorage browser. */
export const storage: Storage = {
  get length() {
    return aktif().length;
  },
  clear() {
    aktif().clear();
  },
  getItem(key: string) {
    return aktif().getItem(key);
  },
  key(index: number) {
    return aktif().key(index);
  },
  removeItem(key: string) {
    aktif().removeItem(key);
  },
  setItem(key: string, value: string) {
    aktif().setItem(key, value);
  },
};

export const isStorageMemori = (): boolean => isApiMode();
