function formatIdr(angka: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
}

export function formatRupiah(angka: number): string {
  if (isNaN(angka) || angka == null) return 'Rp 0';
  // Sisa tagihan / total tidak boleh tampil negatif di UI keuangan
  return formatIdr(angka < 0 ? 0 : angka);
}

/**
 * Format nilai saldo yang boleh negatif (mis. kas defisit).
 * Gunakan ini untuk saldo kas / saldo bersih, bukan untuk sisa tagihan.
 */
export function formatSaldo(angka: number): string {
  if (isNaN(angka) || angka == null) return 'Rp 0';
  return formatIdr(angka);
}

const BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
];

/**
 * Format tanggal untuk data table: dd-mmm-yyyy (mis. 24-Nov-2026).
 * Parsing dari string YYYY-MM-DD agar tidak bergeser zona waktu.
 */
export function formatTanggalTable(tanggal?: string | null): string {
  if (!tanggal) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
  if (!m) return tanggal;
  const [, tahun, bulanAngka, hari] = m;
  const bulan = BULAN_SINGKAT[Number(bulanAngka) - 1];
  return bulan ? `${hari}-${bulan}-${tahun}` : tanggal;
}

export function formatThousand(val: number | string): string {
  if (val === '' || val === null || val === undefined) return '';
  const numStr = val.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(numStr, 10));
}

export function parseThousand(val: string): number {
  const clean = val.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
}
