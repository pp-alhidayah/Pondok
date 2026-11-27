export interface ProfilPondok {
  nama_pondok: string;
  alamat: string;
  pengasuh: string;
  ketua: string;
  sekretaris?: string;
  bendahara: string;
  kontak?: string;
  email?: string;
  logo?: string;
}

export interface TarifDefault {
  syahriyah_mukim: number;
  syahriyah_nduduk: number;
  syahriyah_kilatan: number;
  event_kilatan: number;
  periode_mulai?: string; // Format 'YYYY-MM'
}

export type StatusTarifRiwayat = 'Aktif' | 'Diarsipkan' | 'Dijadwalkan';

export interface ArsipTarif {
  id: string;
  periode_mulai: string; // 'YYYY-MM'
  /** Kosong / undefined = masih berjalan ("Sekarang") atau dijadwalkan tanpa akhir */
  periode_selesai?: string;
  syahriyah_mukim: number;
  syahriyah_nduduk: number;
  syahriyah_kilatan: number;
  event_kilatan: number;
  status: StatusTarifRiwayat;
  diarsipkan_pada: string;
}

export type UserRole = 'super_admin' | 'admin' | 'pemilik';
export type UserStatus = 'Aktif' | 'Nonaktif';

export interface UserAccount {
  id: string;
  nama: string;
  username: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
}

/** Master program iuran (Haul, sumbangan, dll.) — dikelola Superadmin di Pengaturan */
export type JenisPeriodeIuran = 'sekali' | 'bulanan' | 'tahunan';
export type StatusMasterIuran = 'Aktif' | 'Nonaktif';

export interface MasterIuran {
  id: string;
  nama: string;
  nominal_default: number;
  jenis_periode: JenisPeriodeIuran;
  status: StatusMasterIuran;
  keterangan?: string;
  created_at: string;
  updated_at?: string;
}
