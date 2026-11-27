export type StatusSyahriyah = 'Lunas' | 'Sebagian' | 'Belum';

export interface SyahriyahBulan {
  tahun: number;
  bulan: number; // 1-12
  nominal_tagihan: number;
  total_dibayar: number;
  status: StatusSyahriyah;
  /** Ditandai saat Super Admin memberikan keringanan (nominal_tagihan sudah final). */
  keringanan?: boolean;
}

export interface SyahriyahItemInput {
  tahun: number;
  bulan: number;
  nominal: number;
  jenis: 'Penuh' | 'Sebagian';
}

export interface IuranTambahanInput {
  id: string;
  nama: string;
  nominal: number;
}

export interface SyahriyahTransaksiData {
  tanggal_bayar: string;
  metode: 'Tunai' | 'Transfer' | 'Lainnya';
  keterangan?: string;
  iuran_tambahan?: IuranTambahanInput[];
}

export interface SyahriyahTransaksiRecord {
  id: string;
  /** Nomor kuitansi resmi, format AH/tahun/nomor urut. */
  nomor_kuitansi?: string;
  /** Id entri kas yang dicatat dari pembayaran ini. */
  kas_id?: string;
  santri_id: string;
  santri_nama: string;
  santri_nis: string;
  items: SyahriyahItemInput[];
  transaksi_data: SyahriyahTransaksiData;
  total_pembayaran: number;
  created_at: string;
}
