import { storage } from './storage';
import { IuranPembayaran, TipePembayarIuran } from '../types/iuranPembayaran';
import { MasterIuran } from '../types/pengaturan';
import { masterIuranService } from './pengaturanService';
import { kasService, KAS_STORAGE_KEY } from './kasService';
import { activityLogService } from './activityLogService';
import { generateId, isNominalValid, readJsonStrict, snapshotKeys, DataRusakError, isValidCalendarDate, isValidYearMonth } from './core';

const STORAGE_KEY = 'al_hidayah_iuran_pembayaran';
export const IURAN_TAMBAHAN_KEY = 'al_hidayah_iuran_tambahan';

export interface IuranTambahanItem {
  id: string;
  nama: string;
  tipe: 'Syahriyah' | 'Kilatan' | 'Keduanya';
  nominal: number;
}

const DEFAULT_IURAN_TAMBAHAN: IuranTambahanItem[] = [
  { id: 'iur-1', nama: 'Seragam', tipe: 'Keduanya', nominal: 50000 },
  { id: 'iur-2', nama: 'Kitab', tipe: 'Keduanya', nominal: 35000 },
];

function readAll(): IuranPembayaran[] {
  return readJsonStrict<IuranPembayaran[]>(STORAGE_KEY, []);
}

function writeAll(list: IuranPembayaran[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export interface CatatPembayaranIuranInput {
  iuran_id: string;
  tipe_pembayar: TipePembayarIuran;
  santri_id?: string;
  nama_pembayar: string;
  periode_bulan?: string;
  periode_tahun?: number;
  nominal: number;
  tanggal_bayar: string;
  metode?: string;
  keterangan?: string;
}

export const iuranPembayaranService = {
  getAll(): IuranPembayaran[] {
    return readAll().sort(
      (a, b) =>
        (b.tanggal_bayar || '').localeCompare(a.tanggal_bayar || '') ||
        (b.created_at || '').localeCompare(a.created_at || '')
    );
  },

  async catatPembayaran(input: CatatPembayaranIuranInput): Promise<IuranPembayaran> {
    const nama = input.nama_pembayar.trim();
    if (!nama) throw new Error('Nama pembayar wajib diisi');
    if (!isNominalValid(input.nominal)) {
      throw new Error('Nominal harus bilangan bulat rupiah dan lebih dari 0');
    }
    if (!isValidCalendarDate(input.tanggal_bayar)) {
      throw new Error('Tanggal bayar tidak valid');
    }
    if (input.tipe_pembayar === 'santri' && !input.santri_id) {
      throw new Error('Pembayaran dari santri harus dikaitkan dengan data santri');
    }

    const master = (await masterIuranService.getAll()).find((m) => m.id === input.iuran_id);
    if (!master) throw new Error('Master iuran tidak ditemukan');
    if (master.status !== 'Aktif') throw new Error('Master iuran tidak aktif');

    if (master.jenis_periode === 'bulanan') {
      if (!input.periode_bulan || !isValidYearMonth(input.periode_bulan)) {
        throw new Error('Periode bulan wajib diisi (YYYY-MM)');
      }
    }
    if (master.jenis_periode === 'tahunan') {
      if (!input.periode_tahun || input.periode_tahun < 2000) {
        throw new Error('Periode tahun wajib diisi');
      }
    }

    // Cegah pembayaran ganda/berlebih untuk program + pembayar + periode yang
    // sama. Cicilan tetap diperbolehkan selama totalnya tidak melebihi nominal.
    const sudahDibayar = readAll()
      .filter((r) => {
        if (r.iuran_id !== master.id) return false;
        const pembayarSama =
          input.tipe_pembayar === 'santri'
            ? r.tipe_pembayar === 'santri' && r.santri_id === input.santri_id
            : r.tipe_pembayar !== 'santri' &&
              r.nama_pembayar.trim().toLowerCase() === nama.toLowerCase();
        if (!pembayarSama) return false;
        if (master.jenis_periode === 'bulanan') {
          return r.periode_bulan === input.periode_bulan;
        }
        if (master.jenis_periode === 'tahunan') {
          return r.periode_tahun === input.periode_tahun;
        }
        return true;
      })
      .reduce((sum, r) => sum + (r.nominal || 0), 0);

    if (master.nominal_default > 0) {
      const sisa = Math.max(0, master.nominal_default - sudahDibayar);
      if (sisa <= 0) {
        throw new Error('Iuran untuk periode ini sudah lunas');
      }
      if (input.nominal > sisa) {
        throw new Error(
          `Pembayaran melebihi sisa tagihan iuran (sisa Rp ${sisa.toLocaleString('id-ID')})`
        );
      }
    }

    const recordId = generateId('ip');
    const periodeLabel =
      master.jenis_periode === 'bulanan'
        ? input.periode_bulan
        : master.jenis_periode === 'tahunan'
          ? String(input.periode_tahun)
          : 'sekali';

    const restore = snapshotKeys([STORAGE_KEY, KAS_STORAGE_KEY]);
    try {
      const kas = await kasService.createKas({
        jenis: 'Pemasukan',
        kategori_nama: 'Iuran',
        tanggal: input.tanggal_bayar,
        nominal: input.nominal,
        keterangan: `Iuran ${master.nama} — ${nama}${periodeLabel ? ` (${periodeLabel})` : ''}${
          input.keterangan ? ` — ${input.keterangan}` : ''
        }`,
        sumber: { modul: 'iuran', ref_id: recordId },
      });

      const record: IuranPembayaran = {
        id: recordId,
        iuran_id: master.id,
        iuran_nama: master.nama,
        tipe_pembayar: input.tipe_pembayar,
        santri_id: input.tipe_pembayar === 'santri' ? input.santri_id : undefined,
        nama_pembayar: nama,
        periode_bulan: master.jenis_periode === 'bulanan' ? input.periode_bulan : undefined,
        periode_tahun:
          master.jenis_periode === 'tahunan' || master.jenis_periode === 'bulanan'
            ? input.periode_tahun ??
              (input.periode_bulan ? parseInt(input.periode_bulan.split('-')[0], 10) : undefined)
            : undefined,
        nominal: input.nominal,
        tanggal_bayar: input.tanggal_bayar,
        metode: input.metode,
        keterangan: input.keterangan?.trim() || undefined,
        kas_id: kas.id,
        created_at: new Date().toISOString(),
      };

      const list = readAll();
      list.unshift(record);
      writeAll(list);
      activityLogService.catat({
        modul: 'Iuran',
        aksi: 'Pembayaran',
        deskripsi: `Pembayaran iuran ${record.iuran_nama} — ${record.nama_pembayar} Rp${record.nominal.toLocaleString('id-ID')}`,
        ref_id: record.id,
      });
      return record;
    } catch (err) {
      restore();
      throw err;
    }
  },

  getByIuranId(iuranId: string): IuranPembayaran[] {
    return this.getAll().filter((r) => r.iuran_id === iuranId);
  },

  /** Total nominal per pembayar (untuk cicilan). */
  totalByPembayar(iuranId: string, namaPembayar: string, periodeKey?: string): number {
    return this.getAll()
      .filter((r) => {
        if (r.iuran_id !== iuranId) return false;
        if (r.nama_pembayar.toLowerCase() !== namaPembayar.trim().toLowerCase()) return false;
        if (periodeKey) {
          return r.periode_bulan === periodeKey || String(r.periode_tahun) === periodeKey;
        }
        return true;
      })
      .reduce((sum, r) => sum + (r.nominal || 0), 0);
  },

  /**
   * Batalkan pembayaran iuran:
   * - menghapus record pembayaran iuran
   * - menghapus entri kas terkait via kasService.deleteKasSumber('iuran', id)
   * Jika salah satu langkah gagal, seluruh perubahan dikembalikan.
   */
  async batalkanPembayaran(recordId: string): Promise<void> {
    const transaksi = readAll();
    const record = transaksi.find((r) => r.id === recordId);
    if (!record) throw new Error('Pembayaran iuran tidak ditemukan atau sudah dibatalkan');

    const restore = snapshotKeys([STORAGE_KEY, KAS_STORAGE_KEY]);
    try {
      writeAll(transaksi.filter((r) => r.id !== recordId));
      await kasService.deleteKasSumber('iuran', recordId);
      activityLogService.catat({
        modul: 'Iuran',
        aksi: 'Pembatalan',
        deskripsi: `Membatalkan pembayaran iuran ${record.iuran_nama} — ${record.nama_pembayar}`,
        ref_id: record.id,
      });
    } catch (err) {
      restore();
      throw err;
    }
  },

  /**
   * Ambil daftar iuran tambahan dari storage, difilter sesuai tipe.
   * Digunakan form pembayaran Syahriyah & Kilatan sebagai opsi preset iuran lain.
   */
  async getIuranTambahan(tipe?: 'Syahriyah' | 'Kilatan' | 'Keduanya'): Promise<IuranTambahanItem[]> {
    const stored = readJsonStrict<unknown>(IURAN_TAMBAHAN_KEY, null);
    if (stored === null) return [...DEFAULT_IURAN_TAMBAHAN];
    if (!Array.isArray(stored)) throw new DataRusakError(IURAN_TAMBAHAN_KEY);
    const items = stored as IuranTambahanItem[];
    if (!tipe) return items;
    return items.filter(
      (item) => item.tipe === tipe || item.tipe === 'Keduanya' || !item.tipe
    );
  },

  /** Simpan seluruh daftar iuran tambahan (dipakai menu Pengaturan). */
  async saveIuranTambahan(list: IuranTambahanItem[]): Promise<IuranTambahanItem[]> {
    storage.setItem(IURAN_TAMBAHAN_KEY, JSON.stringify(list));
    return list;
  },
};

export async function getMasterIuranAktif(): Promise<MasterIuran[]> {
  return masterIuranService.getAktif();
}
