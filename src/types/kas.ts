export type JenisKas = 'Pemasukan' | 'Pengeluaran';

export type SumberKas = 'syahriyah' | 'kilatan' | 'iuran';

export interface Kas {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jenis: JenisKas;
  kategori_nama: string; // Contoh: Listrik, Donasi, ATK, Konsumsi, Perbaikan, Lainnya
  nominal: number;
  keterangan?: string;
  /** Diisi jika entri berasal dari pembayaran. Entri ber-sumber tidak bisa diedit/dihapus langsung. */
  sumber?: { modul: SumberKas; ref_id: string };
  created_at: string;
}
