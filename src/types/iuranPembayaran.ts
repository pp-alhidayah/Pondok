export type TipePembayarIuran = 'santri' | 'umum';

export interface IuranPembayaran {
  id: string;
  iuran_id: string;
  iuran_nama: string;
  tipe_pembayar: TipePembayarIuran;
  santri_id?: string;
  nama_pembayar: string;
  /** YYYY-MM jika periode bulanan */
  periode_bulan?: string;
  /** YYYY jika tahunan atau bagian dari bulanan */
  periode_tahun?: number;
  nominal: number;
  tanggal_bayar: string; // YYYY-MM-DD
  metode?: string;
  keterangan?: string;
  kas_id?: string;
  created_at: string;
}
