import type { PoolConnection } from 'mysql2/promise';
import { badRequest, conflict } from './errors';

/**
 * Ambil nomor kuitansi berikutnya secara aman untuk konkurensi.
 * Baris counter dikunci dengan FOR UPDATE di dalam transaksi, sehingga dua
 * pembayaran bersamaan tidak pernah mendapat nomor yang sama.
 */
export async function nextNomorKuitansi(
  conn: PoolConnection,
  tahun: number
): Promise<string> {
  await conn.execute(
    `INSERT INTO kuitansi_counter (tahun, nilai_counter, updated_at)
     VALUES (?, 0, NOW()) ON DUPLICATE KEY UPDATE tahun = tahun`,
    [tahun]
  );

  const [rows] = await conn.query(
    'SELECT nilai_counter FROM kuitansi_counter WHERE tahun = ? FOR UPDATE',
    [tahun]
  );
  const current = (rows as Array<{ nilai_counter: number }>)[0];
  if (!current) throw badRequest('Counter kuitansi tidak ditemukan');

  const next = Number(current.nilai_counter) + 1;
  await conn.execute(
    'UPDATE kuitansi_counter SET nilai_counter = ?, updated_at = NOW() WHERE tahun = ?',
    [next, tahun]
  );

  return `AH/${tahun}/${String(next).padStart(3, '0')}`;
}

export function tahunDariTanggal(tanggal: string): number {
  const year = Number(tanggal.slice(0, 4));
  if (!Number.isInteger(year) || year < 2000) throw badRequest('Tahun tanggal bayar tidak valid');
  return year;
}

export function pastikanUnikKuitansi(nomor: string): void {
  if (!/^AH\/\d{4}\/\d{3,}$/.test(nomor)) throw conflict('Format nomor kuitansi tidak valid');
}
