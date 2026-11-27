import { storage } from './storage';
import { Pendaftaran, StatusPendaftaran } from '../types/pendaftaran';
import { Santri } from '../types/santri';
import { santriService } from './santriService';
import { SEED_DEMO_DATA, readJsonStrict, isValidCalendarDate } from './core';
import { activityLogService } from './activityLogService';

const STORAGE_KEY = 'al_hidayah_pendaftaran';
const currentYear = new Date().getFullYear();

const MOCK_PENDAFTARAN: Pendaftaran[] = [
  {
    id: 'p1', nama_calon: 'Hadi Wijaya', nama_wali: 'Suwito', no_hp_santri: '081398765001', no_hp_wali: '081398766001',
    kategori: 'Mukim', tanggal_pendaftaran: `${currentYear}-02-10`, status: 'Baru',
    catatan: 'Ingin mendaftar program tahfidz', created_at: `${currentYear}-02-10T09:00:00Z`,
  },
];

const STATUS_VALID: StatusPendaftaran[] = ['Baru', 'Diterima', 'Ditolak', 'Menjadi Santri'];

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStoredPendaftaran(): Pendaftaran[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    const seed = SEED_DEMO_DATA ? MOCK_PENDAFTARAN : [];
    storage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  return readJsonStrict<Pendaftaran[]>(STORAGE_KEY, []);
}

function savePendaftaranList(list: Pendaftaran[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const pendaftaranService = {
  async getPendaftaranList(): Promise<Pendaftaran[]> {
    await delay(300);
    return getStoredPendaftaran();
  },

  async createPendaftaran(data: Omit<Pendaftaran, 'id' | 'status' | 'created_at'>): Promise<Pendaftaran> {
    await delay(300);
    if (!data.nama_calon?.trim()) throw new Error('Nama calon santri wajib diisi');
    if (!isValidCalendarDate(data.tanggal_pendaftaran)) throw new Error('Tanggal pendaftaran tidak valid');
    const list = getStoredPendaftaran();
    const created: Pendaftaran = {
      ...data,
      nama_calon: data.nama_calon.trim(),
      id: 'p' + Date.now(),
      status: 'Baru',
      created_at: new Date().toISOString(),
    };
    savePendaftaranList([created, ...list]);
    activityLogService.catat({
      modul: 'Pendaftaran',
      aksi: 'Tambah',
      deskripsi: `Mendaftarkan calon santri ${created.nama_calon}`,
      ref_id: created.id,
    });
    return created;
  },

  /**
   * Alur status: Baru → Diterima / Ditolak. Pendaftar yang sudah
   * "Menjadi Santri" tidak bisa diubah lagi.
   */
  async updateStatusPendaftaran(id: string, status: StatusPendaftaran): Promise<Pendaftaran> {
    await delay(300);
    if (!STATUS_VALID.includes(status)) throw new Error('Status pendaftaran tidak valid');
    const list = getStoredPendaftaran();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Data pendaftaran tidak ditemukan');
    if (list[index].status === 'Menjadi Santri') {
      throw new Error('Pendaftar sudah menjadi santri dan statusnya tidak dapat diubah');
    }
    if (status === 'Menjadi Santri') {
      throw new Error('Gunakan fitur konversi untuk menjadikan pendaftar sebagai santri');
    }
    list[index] = { ...list[index], status };
    savePendaftaranList(list);
    activityLogService.catat({
      modul: 'Pendaftaran',
      aksi: 'Ubah',
      deskripsi: `Mengubah status pendaftaran ${list[index].nama_calon} menjadi ${status}`,
      ref_id: id,
    });
    return list[index];
  },

  /**
   * Konversi pendaftar yang Diterima menjadi santri Aktif.
   * Hanya boleh sekali per pendaftar.
   */
  async konversiKeSantri(
    id: string,
    nis: string,
    tanggal_masuk: string
  ): Promise<{ pendaftaran: Pendaftaran; santri: Santri }> {
    await delay(300);
    if (!nis.trim()) throw new Error('NIS wajib diisi');
    if (!isValidCalendarDate(tanggal_masuk)) throw new Error('Tanggal masuk tidak valid');

    const list = getStoredPendaftaran();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Data pendaftaran tidak ditemukan');

    const item = list[index];
    if (item.status === 'Menjadi Santri' || item.santri_id) {
      throw new Error('Pendaftar ini sudah dikonversi menjadi santri');
    }
    if (item.status !== 'Diterima') {
      throw new Error('Hanya pendaftar berstatus Diterima yang dapat dikonversi menjadi santri');
    }

    const newSantri = await santriService.createSantri({
      nis: nis.trim(),
      nama: item.nama_calon,
      nama_wali: item.nama_wali,
      no_hp_santri: item.no_hp_santri,
      no_hp_wali: item.no_hp_wali,
      kategori: item.kategori,
      status: 'Aktif',
      tanggal_masuk,
      catatan: item.catatan ? `(Dari Pendaftaran) ${item.catatan}` : 'Dikonversi dari Pendaftaran Santri',
    });

    const updated: Pendaftaran = {
      ...item,
      status: 'Menjadi Santri',
      nis_generated: nis.trim(),
      santri_id: newSantri.id,
    };
    // Pendaftaran di-refresh dari storage: createSantri sudah menulis ke key santri, bukan key ini.
    const fresh = getStoredPendaftaran();
    const freshIndex = fresh.findIndex((p) => p.id === id);
    fresh[freshIndex] = updated;
    savePendaftaranList(fresh);
    activityLogService.catat({
      modul: 'Pendaftaran',
      aksi: 'Ubah',
      deskripsi: `Konversi pendaftar ${updated.nama_calon} menjadi santri (NIS ${updated.nis_generated})`,
      ref_id: updated.id,
    });

    return { pendaftaran: updated, santri: newSantri };
  },

  async generateAutoNis(): Promise<string> {
    const santriList = await santriService.getSantriList();
    const year = new Date().getFullYear().toString();
    let maxSequence = 0; // NIS otomatis diawali dari 001 sesuai keputusan user (2026-11)
    santriList.forEach((s) => {
      if (s.nis.startsWith(year)) {
        const seq = parseInt(s.nis.substring(year.length), 10);
        if (!isNaN(seq) && seq > maxSequence) maxSequence = seq;
      }
    });
    return `${year}${(maxSequence + 1).toString().padStart(3, '0')}`;
  },
};
