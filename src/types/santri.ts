export type KategoriSantri = 'Mukim' | 'Nduduk' | 'Kilatan';
export type StatusSantri = 'Aktif' | 'Tidak Aktif';

/** Satu periode santri tidak aktif: mulai menonaktifkan s/d diaktifkan kembali. */
export interface PeriodeNonaktif {
  mulai: string;   // tanggal tidak aktif (YYYY-MM-DD)
  sampai?: string; // tanggal aktif kembali; undefined = masih tidak aktif
}

export interface Santri {
  id: string;
  nis: string;
  nama: string;
  nama_wali: string;
  no_hp_santri: string;
  no_hp_wali: string;
  kategori: KategoriSantri;
  status: StatusSantri;
  tanggal_masuk: string;  // ISO date 'YYYY-MM-DD'
  tanggal_keluar?: string; // tanggal keluar terakhir (YYYY-MM-DD) — untuk tampilan/kompatibilitas
  periode_nonaktif?: PeriodeNonaktif[]; // riwayat tidak aktif; bulan sela tidak ditagih
  foto?: string;          // URL atau base64
  catatan?: string;
  created_at: string;
  updated_at: string;
}
