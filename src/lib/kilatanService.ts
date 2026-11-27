import { storage } from './storage';
import {
  KilatanEvent,
  EventKilatan,
  StatusKilatan,
  KilatanItemInput,
  KilatanTransaksiData,
  KilatanTransaksiRecord,
} from '../types/kilatan';
import { Santri } from '../types/santri';
import { KILATAN_EVENTS, KILATAN_EVENT_MONTH } from './constants/kilatan';

// Re-export agar import lama dari kilatanService tetap berfungsi.
export { KILATAN_EVENTS };
import { santriService } from './santriService';
import { kasService, KAS_STORAGE_KEY } from './kasService';
import { activityLogService } from './activityLogService';
import { getTarifForPeriod, pengaturanService } from './pengaturanService';
import {
  generateId,
  isBulanGapNonaktif,
  isNominalValid,
  nextNomorKuitansi,
  readJsonStrict,
  snapshotKeys,
  KEY_NOMOR_KUITANSI,
  isValidCalendarDate,
} from './core';

const STORAGE_KEY = 'al_hidayah_kilatan';
const TRANSAKSI_KEY = 'al_hidayah_kilatan_transaksi';

export async function getTarifKilatan(): Promise<number> {
  const tarif = await pengaturanService.getTarif();
  return tarif.event_kilatan;
}

/** Tarif event kilatan untuk tahun tertentu (menghormati riwayat tarif). */
export async function getTarifKilatanForEvent(tahun: number, event: EventKilatan): Promise<number> {
  const bulan = KILATAN_EVENT_MONTH[event] || 1;
  const tarif = await getTarifForPeriod(`${tahun}-${String(bulan).padStart(2, '0')}`);
  return tarif.event_kilatan;
}

function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Apakah event terjadi sebelum santri masuk. */
export function isKilatanBeforeEntry(tanggalMasuk: string, tahun: number, event: EventKilatan): boolean {
  const m = /^(\d{4})-(\d{2})/.exec(tanggalMasuk || '');
  if (!m) return false;
  const entryYear = parseInt(m[1], 10);
  const entryMonth = parseInt(m[2], 10);
  if (tahun < entryYear) return true;
  if (tahun > entryYear) return false;
  return KILATAN_EVENT_MONTH[event] < entryMonth;
}

/** Apakah event jatuh di masa tidak aktif santri (tidak ditagih & tidak bisa dibayar). */
export function isKilatanSetelahKeluar(
  santri: Pick<Santri, 'tanggal_keluar' | 'periode_nonaktif'>,
  tahun: number,
  event: EventKilatan
): boolean {
  const bulan = KILATAN_EVENT_MONTH[event] || 1;
  if (santri.periode_nonaktif && santri.periode_nonaktif.length) {
    return isBulanGapNonaktif(santri.periode_nonaktif, tahun, bulan);
  }
  // Data lama tanpa riwayat periode: tanggal keluar sederhana
  if (!santri.tanggal_keluar) return false;
  const m = /^(\d{4})-(\d{2})/.exec(santri.tanggal_keluar || '');
  if (!m) return false;
  const keluarYm = `${m[1]}-${m[2]}`;
  return `${tahun}-${String(bulan).padStart(2, '0')}` > keluarYm;
}

export async function createEmptyKilatanYear(tahun: number): Promise<KilatanEvent[]> {
  return Promise.all(KILATAN_EVENTS.map(async (event) => ({
    tahun,
    event,
    nominal_tagihan: await getTarifKilatanForEvent(tahun, event),
    total_dibayar: 0,
    status: 'Belum' as StatusKilatan,
  })));
}

type MatrixStore = Record<string, Record<number, KilatanEvent[]>>;

function getStoredMatrixData(): MatrixStore {
  return readJsonStrict<MatrixStore>(STORAGE_KEY, {});
}

function saveMatrixData(data: MatrixStore): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getStoredTransaksiData(): KilatanTransaksiRecord[] {
  return readJsonStrict<KilatanTransaksiRecord[]>(TRANSAKSI_KEY, []);
}

function saveTransaksiData(list: KilatanTransaksiRecord[]): void {
  storage.setItem(TRANSAKSI_KEY, JSON.stringify(list));
}

/** Daftar bulan (YYYY-MM) yang sudah ada pembayaran kilatan (event dipetakan ke bulan representatif). */
export function getKilatanMonthsWithPayments(): string[] {
  const stored = readJsonStrict<MatrixStore>(STORAGE_KEY, {});
  const months = new Set<string>();
  for (const santriId of Object.keys(stored)) {
    for (const tahunStr of Object.keys(stored[santriId])) {
      for (const r of stored[santriId][parseInt(tahunStr, 10)] || []) {
        if (r.total_dibayar > 0) {
          const bulan = KILATAN_EVENT_MONTH[r.event] || 1;
          months.add(`${r.tahun}-${String(bulan).padStart(2, '0')}`);
        }
      }
    }
  }
  return Array.from(months).sort();
}

/** Perbarui nominal event kilatan yang belum dibayar untuk periode >= periodeMulai. */
export async function applyNewKilatanTarifToUnpaid(
  periodeMulai: string,
  getNominal: (tahun: number, event: EventKilatan) => Promise<number>
): Promise<number> {
  const stored = readJsonStrict<MatrixStore>(STORAGE_KEY, {});
  let updatedCount = 0;
  for (const santriId of Object.keys(stored)) {
    for (const tahunStr of Object.keys(stored[santriId])) {
      const tahun = parseInt(tahunStr, 10);
      const yearRecords = stored[santriId][tahun] || [];
      const newRecords: KilatanEvent[] = [];
      for (const r of yearRecords) {
        const bulan = KILATAN_EVENT_MONTH[r.event] || 1;
        const ym = `${r.tahun}-${String(bulan).padStart(2, '0')}`;
        if (ym >= periodeMulai && r.total_dibayar === 0) {
          const newNominal = await getNominal(r.tahun, r.event);
          if (newNominal !== r.nominal_tagihan) {
            updatedCount++;
            newRecords.push({ ...r, nominal_tagihan: newNominal, status: 'Belum' as StatusKilatan });
            continue;
          }
        }
        newRecords.push(r);
      }
      stored[santriId][tahun] = newRecords;
    }
  }
  saveMatrixData(stored);
  return updatedCount;
}

export const kilatanService = {
  async getTransaksiList(): Promise<KilatanTransaksiRecord[]> {
    return getStoredTransaksiData();
  },

  /**
   * Matrix kilatan: hanya santri yang pernah ikut/bayar event pada tahun tersebut.
   * Berlaku untuk semua kategori santri (kilatan bersifat sukarela).
   */
  async getKilatanMatrix(tahun: number): Promise<{ santri: Santri; records: KilatanEvent[] }[]> {
    await delay(200);
    const santriList = await santriService.getSantriList();
    const stored = getStoredMatrixData();

    const matrix: { santri: Santri; records: KilatanEvent[] }[] = [];
    for (const s of santriList) {
      const yearRecords = stored[s.id]?.[tahun];
      if (!yearRecords || !yearRecords.some((r) => r.total_dibayar > 0)) continue;

      const records = yearRecords.map((r) => {
        let status: StatusKilatan = 'Belum';
        if (r.nominal_tagihan > 0 && r.total_dibayar >= r.nominal_tagihan) status = 'Lunas';
        else if (r.total_dibayar > 0) status = 'Sebagian';
        return { ...r, status };
      });
      matrix.push({ santri: s, records });
    }
    return matrix;
  },

  /**
   * Catat pembayaran kilatan. Validasi lengkap dulu; jika pencatatan kas
   * gagal, seluruh perubahan dikembalikan.
   */
  async simpanPembayaranKilatan(
    santriId: string,
    items: KilatanItemInput[],
    transaksiData: KilatanTransaksiData
  ): Promise<KilatanTransaksiRecord> {
    await delay(300);

    const santri = (await santriService.getSantriList()).find((s) => s.id === santriId);
    if (!santri) throw new Error('Data santri tidak ditemukan');
    if (!items.length) throw new Error('Tidak ada item pembayaran yang dipilih');
    if (!transaksiData.tanggal_bayar || !isValidCalendarDate(transaksiData.tanggal_bayar)) {
      throw new Error('Tanggal bayar tidak valid');
    }

    const seen = new Set<string>();
    for (const item of items) {
      if (!KILATAN_EVENTS.includes(item.event)) {
        throw new Error(`Event kilatan "${item.event}" tidak dikenal`);
      }
      const key = `${item.tahun}-${item.event}`;
      if (seen.has(key)) throw new Error(`Event ${item.event} ${item.tahun} dipilih lebih dari sekali`);
      seen.add(key);
      if (!isNominalValid(item.nominal)) {
        throw new Error(`Nominal event ${item.event} harus bilangan bulat rupiah dan lebih dari 0`);
      }
    }

    const storedMatrix = getStoredMatrixData();
    if (!storedMatrix[santriId]) storedMatrix[santriId] = {};

    for (const item of items) {
      if (isKilatanBeforeEntry(santri.tanggal_masuk, item.tahun, item.event)) {
        throw new Error(
          `Pembayaran tidak dapat dilakukan untuk ${item.event} tahun ${item.tahun} karena sebelum tanggal santri masuk (${santri.tanggal_masuk})`
        );
      }
      if (isKilatanSetelahKeluar(santri, item.tahun, item.event)) {
        throw new Error(
          `Pembayaran tidak dapat dilakukan untuk ${item.event} tahun ${item.tahun} karena santri tidak aktif pada bulan tersebut`
        );
      }

      let yearRecords = storedMatrix[santriId][item.tahun];
      if (!yearRecords) {
        yearRecords = await createEmptyKilatanYear(item.tahun);
        storedMatrix[santriId][item.tahun] = yearRecords;
      }
      const index = yearRecords.findIndex((r) => r.event === item.event);
      if (index === -1) throw new Error(`Event ${item.event} tahun ${item.tahun} tidak ditemukan`);

      const current = yearRecords[index];
      let nominalTagihan = current.nominal_tagihan || 0;
      if (nominalTagihan <= 0) {
        nominalTagihan = await getTarifKilatanForEvent(item.tahun, item.event);
      }
      const sudahDibayar = Math.max(0, current.total_dibayar || 0);
      const sisa = Math.max(0, nominalTagihan - sudahDibayar);

      if (sisa <= 0 || current.status === 'Lunas') {
        throw new Error(`Event ${item.event} tahun ${item.tahun} sudah lunas. Tidak dapat menambah pembayaran.`);
      }
      if (item.nominal > sisa) {
        throw new Error(
          `Nominal event ${item.event} melebihi sisa tagihan (Rp ${sisa.toLocaleString('id-ID')}).`
        );
      }

      const newTotal = sudahDibayar + item.nominal;
      yearRecords[index] = {
        ...current,
        nominal_tagihan: nominalTagihan,
        total_dibayar: Math.min(newTotal, nominalTagihan),
        status: newTotal >= nominalTagihan ? 'Lunas' : 'Sebagian',
      };
    }

    const totalItems = items.reduce((sum, i) => sum + i.nominal, 0);
    const totalIuranLain = (transaksiData.iuran_tambahan || []).reduce((sum, i) => sum + i.nominal, 0);
    const totalPembayaran = totalItems + totalIuranLain;

    const restore = snapshotKeys([STORAGE_KEY, TRANSAKSI_KEY, KAS_STORAGE_KEY, KEY_NOMOR_KUITANSI]);
    try {
      saveMatrixData(storedMatrix);

      const eventSummary = items
        .map((it) => `${it.event} ${it.tahun}`)
        .join(', ');
      let kasKeterangan = `Kilatan ${santri.nama} (${eventSummary})`;
      if (transaksiData.iuran_tambahan && transaksiData.iuran_tambahan.length > 0) {
        kasKeterangan += ` + ${transaksiData.iuran_tambahan.map((i) => i.nama).join(', ')}`;
      }
      if (transaksiData.keterangan?.trim()) {
        kasKeterangan += ` (${transaksiData.keterangan.trim()})`;
      }

      const tahunBayar = parseInt(transaksiData.tanggal_bayar.slice(0, 4), 10);
      const recordId = generateId('kt');
      const kas = await kasService.createKas({
        jenis: 'Pemasukan',
        kategori_nama: 'Kilatan',
        tanggal: transaksiData.tanggal_bayar,
        nominal: totalPembayaran,
        keterangan: kasKeterangan,
        sumber: { modul: 'kilatan', ref_id: recordId },
      });

      const newRecord: KilatanTransaksiRecord = {
        id: recordId,
        nomor_kuitansi: nextNomorKuitansi(tahunBayar),
        kas_id: kas.id,
        santri_id: santri.id,
        santri_nama: santri.nama,
        santri_nis: santri.nis,
        items,
        transaksi_data: transaksiData,
        total_pembayaran: totalPembayaran,
        created_at: new Date().toISOString(),
      };
      saveTransaksiData([newRecord, ...getStoredTransaksiData()]);
      activityLogService.catat({
        modul: 'Kilatan',
        aksi: 'Pembayaran',
        deskripsi: `Pembayaran kilatan ${santri.nama} (${newRecord.nomor_kuitansi}) Rp${totalPembayaran.toLocaleString('id-ID')}`,
        ref_id: newRecord.id,
      });
      return newRecord;
    } catch (err) {
      restore();
      throw err;
    }
  },

  /**
   * Batalkan transaksi pembayaran kilatan (dari modul asal, bukan menu Kas):
   * - total_dibayar di matriks dikurangi sesuai item transaksi (tidak pernah negatif)
   * - status event dihitung ulang
   * - record transaksi dihapus, entri kas terkait dihapus
   * - nomor kuitansi TIDAK dipakai ulang
   * Jika salah satu langkah gagal, seluruh perubahan dikembalikan.
   */
  async batalkanPembayaran(recordId: string): Promise<void> {
    const transaksi = getStoredTransaksiData();
    const record = transaksi.find((t) => t.id === recordId);
    if (!record) throw new Error('Transaksi tidak ditemukan atau sudah dibatalkan');

    const storedMatrix = getStoredMatrixData();
    const newMatrix: MatrixStore = JSON.parse(JSON.stringify(storedMatrix));
    for (const item of record.items || []) {
      const yearRecords = newMatrix[record.santri_id]?.[item.tahun];
      const index = (yearRecords || []).findIndex((r) => r.event === item.event);
      if (index === -1) {
        throw new Error(
          `Data matriks event ${item.event}/${item.tahun} tidak ditemukan; pembatalan tetap memerlukan data tersebut`
        );
      }
      const current = yearRecords[index];
      const sisaDibayar = Math.max(0, (current.total_dibayar || 0) - item.nominal);
      const nominal = current.nominal_tagihan || 0;
      const status: StatusKilatan =
        nominal > 0 && sisaDibayar >= nominal ? 'Lunas' : sisaDibayar > 0 ? 'Sebagian' : 'Belum';
      yearRecords[index] = { ...current, total_dibayar: sisaDibayar, status };
    }

    const restore = snapshotKeys([STORAGE_KEY, TRANSAKSI_KEY, KAS_STORAGE_KEY]);
    try {
      saveMatrixData(newMatrix);
      saveTransaksiData(transaksi.filter((t) => t.id !== recordId));
      await kasService.deleteKasSumber('kilatan', record.id);
      activityLogService.catat({
        modul: 'Kilatan',
        aksi: 'Pembatalan',
        deskripsi: `Membatalkan pembayaran kilatan ${record.santri_nama} (${record.nomor_kuitansi})`,
        ref_id: record.id,
      });
    } catch (err) {
      restore();
      throw err;
    }
  },
};

