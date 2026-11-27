import { Santri, StatusSantri } from '../types/santri';
import { todayLocal } from './core';

/**
 * Logika perubahan status santri (Aktif <-> Tidak Aktif) yang dipakai bersama:
 * daftar santri (via StatusToggleConfirmModal) dan halaman detail santri.
 *
 * Aturan:
 * - Jadi Tidak Aktif: tanggal_keluar = hari ini + buka periode tidak aktif baru.
 *   Bulan tanggal keluar masih ditagih; bulan setelahnya tidak.
 * - Jadi Aktif kembali: tutup periode tidak aktif terbuka dengan sampai = hari ini.
 *   Bulan sela selama tidak aktif tetap tidak ditagih (termasuk setelahnya);
 *   riwayat tidak pernah dihapus.
 */
export function buatPayloadToggleStatus(
  s: Santri
): { newStatus: StatusSantri; payload: Partial<Omit<Santri, 'id' | 'created_at' | 'updated_at'>> } {
  const newStatus: StatusSantri = s.status === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
  const tglHariIni = todayLocal();

  let payload: Partial<Omit<Santri, 'id' | 'created_at' | 'updated_at'>>;
  if (newStatus === 'Tidak Aktif') {
    payload = {
      status: newStatus,
      tanggal_keluar: tglHariIni,
      periode_nonaktif: [...(s.periode_nonaktif || []), { mulai: tglHariIni }],
    };
  } else {
    const riwayat = [...(s.periode_nonaktif || [])];
    let idxTerbuka = -1;
    for (let i = riwayat.length - 1; i >= 0; i--) {
      if (!riwayat[i].sampai) {
        idxTerbuka = i;
        break;
      }
    }
    if (idxTerbuka >= 0) {
      riwayat[idxTerbuka] = { ...riwayat[idxTerbuka], sampai: tglHariIni };
    } else if (s.tanggal_keluar) {
      // Data lama: tanggal keluar sudah ada tetapi belum punya riwayat periode
      riwayat.push({ mulai: s.tanggal_keluar, sampai: tglHariIni });
    }
    payload = { status: newStatus, periode_nonaktif: riwayat };
  }

  return { newStatus, payload };
}
