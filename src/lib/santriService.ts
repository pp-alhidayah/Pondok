import { storage } from './storage';
import { Santri } from '../types/santri';
import { INITIAL_MOCK_SANTRI } from './mockSantri';
import { SEED_DEMO_DATA, generateId, hasRiwayatPembayaran, readJsonStrict, todayLocal, isValidCalendarDate } from './core';
import {
  SantriImportRowInput,
  kunciDuplikatSantri,
  normalizeKategori,
  normalizeStatus,
  normalizeTanggal,
} from './santriImport';
import { activityLogService } from './activityLogService';

const STORAGE_KEY = 'al_hidayah_santri';
const KATEGORI_VALID = ['Mukim', 'Nduduk', 'Kilatan'];

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStoredSantri(): Santri[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    const seed = SEED_DEMO_DATA ? INITIAL_MOCK_SANTRI : [];
    storage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  return readJsonStrict<Santri[]>(STORAGE_KEY, []);
}

function saveSantriList(list: Santri[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    const nama = err instanceof DOMException ? err.name : '';
    if (nama === 'QuotaExceededError' || nama === 'NS_ERROR_DOM_QUOTA_REACHED') {
      throw new Error('Penyimpanan browser penuh. Hapus foto lama atau gunakan foto yang lebih kecil.');
    }
    throw err;
  }
}

function normalizeNis(nis: string): string {
  return nis.trim().toLowerCase();
}

function validateSantri(data: {
  nis?: string;
  nama?: string;
  kategori?: string;
  tanggal_masuk?: string;
  tanggal_keluar?: string;
  periode_nonaktif?: { mulai: string; sampai?: string }[];
  status?: string;
}) {
  if (data.nis !== undefined && !data.nis.trim()) throw new Error('NIS wajib diisi');
  if (data.nama !== undefined && !data.nama.trim()) throw new Error('Nama santri wajib diisi');
  if (data.kategori !== undefined && !KATEGORI_VALID.includes(data.kategori)) {
    throw new Error('Kategori santri tidak valid');
  }
  if (data.tanggal_masuk !== undefined && !isValidCalendarDate(data.tanggal_masuk)) {
    throw new Error('Tanggal masuk tidak valid');
  }
  if (data.tanggal_keluar !== undefined && data.tanggal_keluar &&
      !isValidCalendarDate(data.tanggal_keluar)) {
    throw new Error('Tanggal keluar tidak valid');
  }
  if (data.periode_nonaktif !== undefined) {
    if (!Array.isArray(data.periode_nonaktif)) {
      throw new Error('Data periode tidak aktif tidak valid');
    }
    for (const p of data.periode_nonaktif) {
      if (!p || !p.mulai || !isValidCalendarDate(p.mulai)) {
        throw new Error('Periode tidak aktif tidak valid (tanggal mulai wajib YYYY-MM-DD)');
      }
      if (p.sampai && !isValidCalendarDate(p.sampai)) {
        throw new Error('Akhir periode tidak aktif tidak valid (YYYY-MM-DD)');
      }
      if (p.sampai && p.sampai < p.mulai) {
        throw new Error('Akhir periode tidak aktif tidak boleh sebelum mulainya');
      }
    }
  }
}

export const santriService = {
  async getSantriList(): Promise<Santri[]> {
    await delay(300);
    return getStoredSantri();
  },

  async getSantriById(id: string): Promise<Santri | null> {
    await delay(200);
    return getStoredSantri().find((s) => s.id === id) || null;
  },

  async checkNisUnik(nis: string, excludeId?: string): Promise<boolean> {
    await delay(100);
    const target = normalizeNis(nis);
    return !getStoredSantri().some((s) => normalizeNis(s.nis) === target && s.id !== excludeId);
  },

  async createSantri(data: Omit<Santri, 'id' | 'created_at' | 'updated_at'>): Promise<Santri> {
    await delay(300);
    validateSantri(data);
    const list = getStoredSantri();
    if (list.some((s) => normalizeNis(s.nis) === normalizeNis(data.nis))) {
      throw new Error('NIS sudah digunakan');
    }
    if (data.tanggal_keluar && data.tanggal_masuk && data.tanggal_keluar < data.tanggal_masuk) {
      throw new Error('Tanggal keluar tidak boleh sebelum tanggal masuk');
    }
    const now = new Date().toISOString();
    const newSantri: Santri = { ...data, id: generateId('s'), created_at: now, updated_at: now };
    saveSantriList([newSantri, ...list]);
    activityLogService.catat({
      modul: 'Santri',
      aksi: 'Tambah',
      deskripsi: `Menambah santri ${newSantri.nama} (${newSantri.nis})`,
      ref_id: newSantri.id,
    });
    return newSantri;
  },

  async updateSantri(
    id: string,
    data: Partial<Omit<Santri, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Santri> {
    await delay(300);
    validateSantri(data);
    const list = getStoredSantri();
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error('Data santri tidak ditemukan');
    }
    if (data.nis && list.some((s) => s.id !== id && normalizeNis(s.nis) === normalizeNis(data.nis!))) {
      throw new Error('NIS sudah digunakan');
    }
    // Validasi silang terhadap data gabungan (lama + perubahan)
    const merged = { ...list[index], ...data };
    if (merged.tanggal_keluar && merged.tanggal_keluar < merged.tanggal_masuk) {
      throw new Error('Tanggal keluar tidak boleh sebelum tanggal masuk');
    }
    const updated: Santri = { ...list[index], ...data, updated_at: new Date().toISOString() };
    list[index] = updated;
    saveSantriList(list);
    activityLogService.catat({
      modul: 'Santri',
      aksi: 'Ubah',
      deskripsi: `Mengubah data santri ${updated.nama} (${updated.nis})`,
      ref_id: updated.id,
    });
    return updated;
  },

  /**
   * Santri yang sudah punya riwayat pembayaran TIDAK boleh dihapus,
   * karena riwayat harus tetap tampil. Gunakan status "Tidak Aktif".
   */
  async deleteSantri(id: string): Promise<void> {
    await delay(300);
    const list = getStoredSantri();
    const target = list.find((s) => s.id === id);
    if (!target) {
      throw new Error('Data santri tidak ditemukan');
    }
    if (hasRiwayatPembayaran(id)) {
      throw new Error(
        'Santri memiliki riwayat pembayaran sehingga tidak dapat dihapus. Ubah statusnya menjadi Tidak Aktif.'
      );
    }
    saveSantriList(list.filter((s) => s.id !== id));
    activityLogService.catat({
      modul: 'Santri',
      aksi: 'Hapus',
      deskripsi: `Menghapus santri ${target.nama} (${target.nis})`,
      ref_id: id,
    });
  },

  /**
   * Impor banyak santri sekaligus (dari Excel/CSV).
   * Semua baris divalidasi lebih dulu; jika ada satu yang gagal, tidak ada data tersimpan.
   * NIS kosong dibuat otomatis meneruskan urutan tahun (format YYYY001).
   */
  async importSantri(
    rows: SantriImportRowInput[],
    tahunNis?: number
  ): Promise<{ jumlah: number; nis: string[] }> {
    await delay(300);
    if (!rows.length) throw new Error('Tidak ada baris yang bisa diimpor');

    const list = getStoredSantri();
    const existing = new Set(list.map((s) => normalizeNis(s.nis)));
    // Data dianggap duplikat hanya jika NAMA dan NIS keduanya sama.
    const existingCombo = new Set(
      list.map((s) => kunciDuplikatSantri(s.nama, s.nis))
    );
    const seen = new Set<string>();
    const seenCombo = new Set<string>();
    const year = String(tahunNis ?? new Date().getFullYear());

    let maxSequence = 0;
    list.forEach((s) => {
      if (s.nis.startsWith(year)) {
        const seq = parseInt(s.nis.substring(year.length), 10);
        if (!Number.isNaN(seq) && seq > maxSequence) maxSequence = seq;
      }
    });

    const now = new Date().toISOString();
    const prepared: Santri[] = [];

    rows.forEach((row, index) => {
      const baris = index + 2; // baris 1 = header spreadsheet
      const nama = row.nama.trim();
      if (!nama) throw new Error(`Baris ${baris}: nama santri wajib diisi`);

      let nis = (row.nis || '').trim();
      const kunciAwal = nis ? kunciDuplikatSantri(nama, nis) : '';

      // Duplikat benar-benar ganda (nama + NIS keduanya sama) ditolak lebih dulu.
      if (kunciAwal && existingCombo.has(kunciAwal)) {
        throw new Error(`Baris ${baris}: data dengan NIS ${nis} dan nama ${nama} sudah ada`);
      }
      if (kunciAwal && seenCombo.has(kunciAwal)) {
        throw new Error(`Baris ${baris}: data dengan NIS ${nis} dan nama ${nama} duplikat di file`);
      }

      if (nis) {
        const key = normalizeNis(nis);
        if (existing.has(key)) throw new Error(`Baris ${baris}: NIS ${nis} sudah digunakan`);
        if (seen.has(key)) throw new Error(`Baris ${baris}: NIS ${nis} duplikat di file`);
      } else {
        do {
          maxSequence += 1;
          nis = `${year}${String(maxSequence).padStart(3, '0')}`;
        } while (existing.has(normalizeNis(nis)) || seen.has(normalizeNis(nis)));
      }

      // NIS otomatis tidak mungkin sama dengan data lama, tetapi tetap dicek untuk konsistensi.
      const kunciData = kunciAwal || kunciDuplikatSantri(nama, nis);
      if (seenCombo.has(kunciData)) {
        throw new Error(`Baris ${baris}: data dengan NIS ${nis} dan nama ${nama} duplikat di file`);
      }

      const tanggalMasuk = normalizeTanggal(row.tanggal_masuk);
      const record: Santri = {
        id: generateId('s'),
        nis,
        nama,
        nama_wali: (row.nama_wali || '').trim(),
        no_hp_santri: (row.no_hp_santri || '').trim(),
        no_hp_wali: (row.no_hp_wali || '').trim(),
        kategori: normalizeKategori(row.kategori),
        status: normalizeStatus(row.status),
        tanggal_masuk: isValidCalendarDate(tanggalMasuk) ? tanggalMasuk : todayLocal(),
        catatan: row.catatan?.trim() || undefined,
        created_at: now,
        updated_at: now,
      };
      validateSantri(record);
      prepared.push(record);
      seen.add(normalizeNis(nis));
      seenCombo.add(kunciData);
    });

    saveSantriList([...prepared, ...list]);
    activityLogService.catat({
      modul: 'Santri',
      aksi: 'Impor',
      deskripsi: `Mengimpor ${prepared.length} data santri dari spreadsheet`,
    });
    return { jumlah: prepared.length, nis: prepared.map((s) => s.nis) };
  },
};
