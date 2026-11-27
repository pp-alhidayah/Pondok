import { kasService } from './kasService';
import { santriService } from './santriService';
import { pendaftaranService } from './pendaftaranService';
import { syahriyahService } from './syahriyahService';
import { masterIuranService } from './pengaturanService';
import { iuranPembayaranService } from './iuranPembayaranService';
import { kilatanService } from './kilatanService';
import { KILATAN_EVENTS } from './constants/kilatan';
import { Kas } from '../types/kas';
import { Santri } from '../types/santri';
import { Pendaftaran } from '../types/pendaftaran';
import { MasterIuran, JenisPeriodeIuran } from '../types/pengaturan';
import { IuranPembayaran } from '../types/iuranPembayaran';
import { EventKilatan } from '../types/kilatan';
import { isBulanDitagihkan, tahunBulanDari } from './core';

export interface LaporanKeuanganData {
  list: Kas[];
  totalPemasukan: number;
  totalPengeluaran: number;
  saldoBersih: number;
}

export interface LaporanSyahriyahRow {
  santriId: string;
  nis: string;
  nama: string;
  kategori: string;
  totalTagihan: number;
  totalDibayar: number;
  sisaTunggakan: number;
  statusTahunan: 'Lunas' | 'Sebagian' | 'Belum';
}

export interface LaporanIuranRow {
  iuranId: string;
  iuranNama: string;
  jenisPeriode: JenisPeriodeIuran;
  /** Nominal tagihan master iuran (per pembayar per periode). */
  nominalTagihan: number;
  /** Total nominal yang sudah dibayar pada tahun laporan. */
  totalPembayaran: number;
  sisaTagihan: number;
  status: 'Lunas' | 'Sebagian' | 'Belum';
  jumlahTransaksi: number;
}

export interface LaporanKilatanRow {
  event: EventKilatan;
  totalTagihan: number;
  totalDibayar: number;
  sisaTunggakan: number;
  status: 'Lunas' | 'Sebagian' | 'Belum';
}

/** Baris rekap kilatan per santri: NIS + satu kolom untuk tiap event + total bayar. */
export interface LaporanKilatanPerSantriRow {
  santriId: string;
  nis: string;
  nama: string;
  kategori: string;
  /** Nominal dibayar per event (0 bila belum bayar). */
  events: Record<EventKilatan, number>;
  totalDibayar: number;
}

export const laporanService = {
  async getLaporanKeuangan(tahun: number, bulan: string, jenis: string): Promise<LaporanKeuanganData> {
    const kasList = await kasService.getKasList();

    // Tanggal diambil dari string YYYY-MM-DD agar tidak bergeser zona waktu.
    const filtered = kasList.filter((item) => {
      const tb = tahunBulanDari(item.tanggal);
      if (!tb) return false;
      if (tb.tahun !== tahun) return false;
      if (bulan !== 'Semua' && String(tb.bulan) !== bulan) return false;
      if (jenis !== 'Semua' && item.jenis !== jenis) return false;
      return true;
    });

    const totalPemasukan = filtered
      .filter((k) => k.jenis === 'Pemasukan')
      .reduce((sum, k) => sum + k.nominal, 0);
    const totalPengeluaran = filtered
      .filter((k) => k.jenis === 'Pengeluaran')
      .reduce((sum, k) => sum + k.nominal, 0);

    return {
      list: filtered,
      totalPemasukan,
      totalPengeluaran,
      saldoBersih: totalPemasukan - totalPengeluaran,
    };
  },

  async getLaporanSantri(kategori: string, status: string): Promise<Santri[]> {
    const list = await santriService.getSantriList();
    return list.filter((s) => {
      if (kategori !== 'Semua' && s.kategori !== kategori) return false;
      if (status !== 'Semua' && s.status !== status) return false;
      return true;
    });
  },

  async getLaporanPendaftaran(tahun: number, bulan: string, status: string): Promise<Pendaftaran[]> {
    const list = await pendaftaranService.getPendaftaranList();
    return list.filter((item) => {
      const tb = tahunBulanDari(item.tanggal_pendaftaran);
      if (!tb) return false;
      if (tb.tahun !== tahun) return false;
      if (bulan !== 'Semua' && String(tb.bulan) !== bulan) return false;
      if (status !== 'Semua' && item.status !== status) return false;
      return true;
    });
  },

  /**
   * Rekap syahriyah per santri untuk satu tahun.
   * Tagihan dihitung hanya untuk bulan sejak santri masuk sampai bulan berjalan.
   * Pembayaran di muka (bulan mendatang) tetap dihitung sebagai dibayar,
   * tetapi tidak menjadi tunggakan.
   */
  async getLaporanSyahriyah(tahun: number, kategori: string): Promise<LaporanSyahriyahRow[]> {
    const matrix = await syahriyahService.getSyahriyahMatrix(tahun);

    return matrix
      .filter(({ santri }) => kategori === 'Semua' || santri.kategori === kategori)
      .map(({ santri, records }) => {
        const tagihanRecords = records.filter((r) =>
          isBulanDitagihkan(santri.tanggal_masuk, r.tahun, r.bulan, santri.tanggal_keluar, santri.periode_nonaktif)
        );
        const totalTagihan = tagihanRecords.reduce((sum, r) => sum + r.nominal_tagihan, 0);
        const totalDibayar = records.reduce((sum, r) => sum + r.total_dibayar, 0);
        // Tunggakan hanya dihitung dari bulan yang sudah ditagihkan, sehingga
        // pembayaran di muka (bulan mendatang) tidak membuat status jadi Lunas.
        const dibayarUntukTagihan = tagihanRecords.reduce((sum, r) => sum + r.total_dibayar, 0);
        const sisaTunggakan = Math.max(0, totalTagihan - dibayarUntukTagihan);

        let statusTahunan: 'Lunas' | 'Sebagian' | 'Belum' = 'Belum';
        if (totalTagihan > 0 && sisaTunggakan === 0) statusTahunan = 'Lunas';
        else if (dibayarUntukTagihan > 0) statusTahunan = 'Sebagian';

        return {
          santriId: santri.id,
          nis: santri.nis,
          nama: santri.nama,
          kategori: santri.kategori,
          totalTagihan,
          totalDibayar,
          sisaTunggakan,
          statusTahunan,
        };
      });
  },

  /**
   * Rekap keuangan iuran per program untuk satu tahun.
   * Total pembayaran dihitung dari transaksi iuran pada tahun terpilih
   * (periode bulanan: tahun dari periode_bulan; tahunan: periode_tahun).
   * Jika `iuranId` diberikan (bukan 'Semua'), hanya program itu yang direkap.
   */
  async getLaporanIuran(tahun: number, iuranId?: string): Promise<LaporanIuranRow[]> {
    const masters = await masterIuranService.getAktif();
    const payments = await iuranPembayaranService.getAll();

    const rows: LaporanIuranRow[] = masters.map((m) => {
      const programPayments = payments.filter((p) => {
        if (p.iuran_id !== m.id) return false;
        const tahunDariBulan = p.periode_bulan
          ? parseInt(p.periode_bulan.split('-')[0], 10)
          : undefined;
        const tahunKunci = tahunDariBulan ?? p.periode_tahun;
        if (m.jenis_periode === 'sekali') {
          return new Date(p.created_at).getFullYear() === tahun;
        }
        return tahunKunci === tahun;
      });
      const totalPembayaran = programPayments.reduce(
        (sum, p) => sum + (p.nominal || 0),
        0,
      );
      const nominalTagihan = m.nominal_default || 0;
      const sisaTagihan = Math.max(0, nominalTagihan - totalPembayaran);

      const status: LaporanIuranRow['status'] =
        totalPembayaran <= 0
          ? 'Belum'
          : nominalTagihan > 0 && totalPembayaran >= nominalTagihan
            ? 'Lunas'
            : 'Sebagian';

      return {
        iuranId: m.id,
        iuranNama: m.nama,
        jenisPeriode: m.jenis_periode,
        nominalTagihan,
        totalPembayaran,
        sisaTagihan,
        status,
        jumlahTransaksi: programPayments.length,
      };
    });

    const filteredRows = iuranId && iuranId !== 'Semua'
      ? rows.filter((r) => r.iuranId === iuranId)
      : rows;

    return filteredRows.sort((a, b) => b.totalPembayaran - a.totalPembayaran);
  },

  /**
   * Rekap keuangan kilatan per event untuk satu tahun:
   * total tagihan, total dibayar, sisa tunggakan, dan status event.
   */
  async getLaporanKilatan(tahun: number): Promise<LaporanKilatanRow[]> {
    const matrix = await kilatanService.getKilatanMatrix(tahun);

    const perEvent = new Map<EventKilatan, { tagihan: number; dibayar: number }>();
    for (const { records } of matrix) {
      for (const r of records) {
        const cur = perEvent.get(r.event) ?? { tagihan: 0, dibayar: 0 };
        cur.tagihan += r.nominal_tagihan || 0;
        cur.dibayar += r.total_dibayar || 0;
        perEvent.set(r.event, cur);
      }
    }

    const rows: LaporanKilatanRow[] = Array.from(perEvent.entries()).map(([event, v]) => {
      const sisa = Math.max(0, v.tagihan - v.dibayar);
      const status: LaporanKilatanRow['status'] =
        v.tagihan > 0 && sisa === 0 ? 'Lunas' : v.dibayar > 0 ? 'Sebagian' : 'Belum';
      return { event, totalTagihan: v.tagihan, totalDibayar: v.dibayar, sisaTunggakan: sisa, status };
    });

    return rows.sort((a, b) => b.totalTagihan - a.totalTagihan);
  },

  /**
   * Rekap kilatan per santri untuk datatable:
   * satu baris per santri, kolom untuk setiap event, dan total bayar.
   */
  async getRekapKilatanPerSantri(tahun: number): Promise<LaporanKilatanPerSantriRow[]> {
    const matrix = await kilatanService.getKilatanMatrix(tahun);

    const rows = matrix.map(({ santri, records }) => {
      const events = Object.fromEntries(
        KILATAN_EVENTS.map((event) => [event, 0])
      ) as Record<EventKilatan, number>;

      for (const r of records) {
        events[r.event] = (events[r.event] || 0) + (r.total_dibayar || 0);
      }

      return {
        santriId: santri.id,
        nis: santri.nis,
        nama: santri.nama,
        kategori: santri.kategori,
        events,
        totalDibayar: KILATAN_EVENTS.reduce((sum, event) => sum + events[event], 0),
      };
    });

    return rows.sort(
      (a, b) => a.nama.localeCompare(b.nama, 'id') || a.nis.localeCompare(b.nis)
    );
  },
};
