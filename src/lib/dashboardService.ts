import { toYm } from './core';
import { santriService } from './santriService';
import { pendaftaranService } from './pendaftaranService';
import { kasService } from './kasService';
import { syahriyahService } from './syahriyahService';
import { Kas } from '../types/kas';

export interface TrenKasItem {
  bulan: string; // e.g. "Mei 26"
  pemasukan: number;
  pengeluaran: number;
}

export interface TunggakanSantri {
  id: string;
  nama: string;
  nis: string;
  tunggakan: number;
}

export interface DashboardStats {
  totalSantri: number;
  santriAktif: number;
  santriTidakAktif: number;
  pendaftarBaru: number;
  totalPemasukanKas: number;
  totalPengeluaranKas: number;
  saldoKas: number;
  pendapatanBulanIni: number;
  trenKas: TrenKasItem[];
  transaksiTerakhir: Kas[];
  tunggakanSantri: TunggakanSantri[];
}

const BULAN_INDONESIA = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export const dashboardService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const [santriList, pendaftaranList, kasList] = await Promise.all([
      santriService.getSantriList(),
      pendaftaranService.getPendaftaranList(),
      kasService.getKasList(),
    ]);

    // 1. Santri Stats
    const totalSantri = santriList.length;
    const santriAktif = santriList.filter((s) => s.status === 'Aktif').length;
    const santriTidakAktif = santriList.filter((s) => s.status === 'Tidak Aktif').length;

    // 2. Pendaftaran Stats
    const pendaftarBaru = pendaftaranList.filter((p) => p.status === 'Baru').length;

    // 3. Kas Totals
    const totalPemasukanKas = kasList
      .filter((k) => k.jenis === 'Pemasukan')
      .reduce((sum, k) => sum + k.nominal, 0);

    const totalPengeluaranKas = kasList
      .filter((k) => k.jenis === 'Pengeluaran')
      .reduce((sum, k) => sum + k.nominal, 0);

    const saldoKas = totalPemasukanKas - totalPengeluaranKas;

    // 4. Current Month Revenue
    const now = new Date();
    const currentYearMonth = toYm(now); // "YYYY-MM"
    const pendapatanBulanIni = kasList
      .filter((k) => k.jenis === 'Pemasukan' && k.tanggal.startsWith(currentYearMonth))
      .reduce((sum, k) => sum + k.nominal, 0);

    // 5. 6-Month Trend Data
    const trenKas: TrenKasItem[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthFormattedStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const monthLabel = BULAN_INDONESIA[monthIdx];

      const monthPemasukan = kasList
        .filter((k) => k.jenis === 'Pemasukan' && k.tanggal.startsWith(monthFormattedStr))
        .reduce((sum, k) => sum + k.nominal, 0);

      const monthPengeluaran = kasList
        .filter((k) => k.jenis === 'Pengeluaran' && k.tanggal.startsWith(monthFormattedStr))
        .reduce((sum, k) => sum + k.nominal, 0);

      trenKas.push({
        bulan: monthLabel,
        pemasukan: monthPemasukan,
        pengeluaran: monthPengeluaran,
      });
    }

    // 6. 5 Most Recent Transactions
    const sortedKas = [...kasList].sort((a, b) => {
      const dateA = new Date(a.tanggal).getTime();
      const dateB = new Date(b.tanggal).getTime();
      return dateB - dateA;
    });
    const transaksiTerakhir = sortedKas.slice(0, 5);

    // 7. Top Santri dengan Tunggakan (syahriyah)
    const currentYear = now.getFullYear();
    const syahMatrix = await syahriyahService.getSyahriyahMatrix(currentYear);
    const tunggakanSantri: TunggakanSantri[] = syahMatrix
      .map(({ santri, records }) => {
        const tunggakan = records.reduce((sum, r) => {
          const sisa = Math.max(0, (r.nominal_tagihan || 0) - (r.total_dibayar || 0));
          return sum + sisa;
        }, 0);
        return {
          id: santri.id,
          nama: santri.nama,
          nis: santri.nis,
          tunggakan,
        };
      })
      .filter((r) => r.tunggakan > 0)
      .sort((a, b) => b.tunggakan - a.tunggakan)
      .slice(0, 5);

    return {
      totalSantri,
      santriAktif,
      santriTidakAktif,
      pendaftarBaru,
      totalPemasukanKas,
      totalPengeluaranKas,
      saldoKas,
      pendapatanBulanIni,
      trenKas,
      transaksiTerakhir,
      tunggakanSantri,
    };
  },
};
