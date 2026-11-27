import { storage } from './storage';
import { Kas } from '../types/kas';
import { SEED_DEMO_DATA, generateId, isNominalValid, readJsonStrict, currentYmLocal, snapshotKeys, isValidCalendarDate } from './core';
import { activityLogService } from './activityLogService';

export const KAS_STORAGE_KEY = 'al_hidayah_kas';

const yearMonth = currentYmLocal();

const MOCK_KAS: Kas[] = [
  { id: 'k1', tanggal: `${yearMonth}-01`, jenis: 'Pemasukan', kategori_nama: 'Donasi', nominal: 1000000, keterangan: 'Donasi harian hamba Allah untuk pondok', created_at: `${yearMonth}-01T08:00:00Z` },
  { id: 'k2', tanggal: `${yearMonth}-03`, jenis: 'Pengeluaran', kategori_nama: 'Listrik', nominal: 350000, keterangan: 'Pembayaran tagihan listrik PLN bulan ini', created_at: `${yearMonth}-03T10:00:00Z` },
  { id: 'k3', tanggal: `${yearMonth}-05`, jenis: 'Pemasukan', kategori_nama: 'Donasi', nominal: 3500000, keterangan: 'Infaq dari donatur utama pondok', created_at: `${yearMonth}-05T09:30:00Z` },
];

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStoredKas(): Kas[] {
  const raw = storage.getItem(KAS_STORAGE_KEY);
  if (raw === null) {
    const seed = SEED_DEMO_DATA ? MOCK_KAS : [];
    storage.setItem(KAS_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  return readJsonStrict<Kas[]>(KAS_STORAGE_KEY, []);
}

function saveKasList(list: Kas[]): void {
  storage.setItem(KAS_STORAGE_KEY, JSON.stringify(list));
}

function validateKas(data: Pick<Kas, 'tanggal' | 'jenis' | 'nominal' | 'kategori_nama'>) {
  if (!isValidCalendarDate(data.tanggal)) {
    throw new Error('Tanggal transaksi tidak valid');
  }
  if (data.jenis !== 'Pemasukan' && data.jenis !== 'Pengeluaran') {
    throw new Error('Jenis transaksi tidak valid');
  }
  if (!isNominalValid(data.nominal)) {
    throw new Error('Nominal harus bilangan bulat rupiah dan lebih dari 0');
  }
  if (!data.kategori_nama?.trim()) {
    throw new Error('Kategori wajib diisi');
  }
}

const SUMBER_LOCK_MSG =
  'Transaksi ini berasal dari pembayaran dan tidak dapat diubah atau dihapus dari Kas. Batalkan pembayaran dari menu asalnya.';

export const kasService = {
  async getKasList(): Promise<Kas[]> {
    await delay(300);
    return getStoredKas();
  },

  async getKasById(id: string): Promise<Kas | null> {
    await delay(200);
    return getStoredKas().find((k) => k.id === id) || null;
  },

  async createKas(data: Omit<Kas, 'id' | 'created_at'>): Promise<Kas> {
    await delay(300);
    validateKas(data);
    const list = getStoredKas();
    const newKas: Kas = {
      ...data,
      keterangan: data.keterangan?.trim() || undefined,
      id: generateId('k'),
      created_at: new Date().toISOString(),
    };
    saveKasList([newKas, ...list]);
    activityLogService.catat({
      modul: 'Kas',
      aksi: 'Tambah',
      deskripsi: `Menambah kas ${newKas.jenis.toLowerCase()} ${newKas.kategori_nama} Rp${newKas.nominal.toLocaleString('id-ID')}`,
      ref_id: newKas.id,
    });
    return newKas;
  },

  async updateKas(id: string, data: Partial<Omit<Kas, 'id' | 'created_at'>>): Promise<Kas> {
    await delay(300);
    const list = getStoredKas();
    const index = list.findIndex((k) => k.id === id);
    if (index === -1) {
      throw new Error('Data transaksi kas tidak ditemukan');
    }
    if (list[index].sumber) {
      throw new Error(SUMBER_LOCK_MSG);
    }
    const updated = { ...list[index], ...data };
    validateKas(updated);
    list[index] = updated;
    saveKasList(list);
    activityLogService.catat({
      modul: 'Kas',
      aksi: 'Ubah',
      deskripsi: `Mengubah kas ${updated.jenis.toLowerCase()} ${updated.kategori_nama} Rp${updated.nominal.toLocaleString('id-ID')}`,
      ref_id: updated.id,
    });
    return updated;
  },

  async deleteKas(id: string): Promise<void> {
    await delay(300);
    const list = getStoredKas();
    const target = list.find((k) => k.id === id);
    if (!target) {
      throw new Error('Data transaksi kas tidak ditemukan');
    }
    if (target.sumber) {
      throw new Error(SUMBER_LOCK_MSG);
    }
    saveKasList(list.filter((k) => k.id !== id));
    activityLogService.catat({
      modul: 'Kas',
      aksi: 'Hapus',
      deskripsi: `Menghapus kas ${target.jenis.toLowerCase()} ${target.kategori_nama} Rp${target.nominal.toLocaleString('id-ID')}`,
      ref_id: id,
    });
  },

  /**
   * Kembalikan transaksi kas yang baru dihapus (undo dari menu Kas).
   * Mempertahankan id asli agar relasi lain (jika ada) tetap utuh.
   */
  async restoreKas(snapshot: Kas): Promise<void> {
    await delay(150);
    validateKas(snapshot);
    const list = getStoredKas();
    if (list.some((k) => k.id === snapshot.id)) return;
    saveKasList([snapshot, ...list]);
    activityLogService.catat({
      modul: 'Kas',
      aksi: 'Restore',
      deskripsi: `Mengembalikan kas ${snapshot.jenis.toLowerCase()} ${snapshot.kategori_nama} Rp${snapshot.nominal.toLocaleString('id-ID')}`,
      ref_id: snapshot.id,
    });
  },

  /**
   * Hapus entri kas yang terkait pembayaran — HANYA dipakai pembatalan
   * transaksi dari modul asalnya (syahriyah/kilatan), bukan dari menu Kas.
   */
  async deleteKasSumber(modul: string, refId: string): Promise<void> {
    const target = getStoredKas().find((k) => k.sumber?.modul === modul && k.sumber?.ref_id === refId);
    if (!target) {
      throw new Error('Entri kas terkait pembayaran tidak ditemukan');
    }
    saveKasList(getStoredKas().filter((k) => !(k.sumber?.modul === modul && k.sumber?.ref_id === refId)));
  },

  /** Hitung jumlah transaksi kas untuk kategori + jenis tertentu. */
  async countKasByKategori(kategori: string, jenis: 'pemasukan' | 'pengeluaran'): Promise<number> {
    const list = getStoredKas();
    const targetJenis = jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
    return list.filter(
      (item) => item.jenis === targetJenis && item.kategori_nama?.trim().toLowerCase() === kategori.trim().toLowerCase()
    ).length;
  },

  /**
   * Ganti nama kategori pada semua entri kas yang menggunakannya (jenis tertentu).
   * Digunakan saat mengedit nama kategori di menu Pengaturan.
   */
  async renameKasKategori(jenis: 'pemasukan' | 'pengeluaran', oldName: string, newName: string): Promise<void> {
    const restore = snapshotKeys([KAS_STORAGE_KEY]);
    try {
      const list = getStoredKas();
      const targetJenis = jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
      let modified = false;
      const updatedKas = list.map((item) => {
        if (
          item.jenis === targetJenis &&
          item.kategori_nama?.trim().toLowerCase() === oldName.trim().toLowerCase()
        ) {
          modified = true;
          return { ...item, kategori_nama: newName };
        }
        return item;
      });
      if (modified) {
        saveKasList(updatedKas);
      }
    } catch (err) {
      restore();
      throw err;
    }
  },
};

