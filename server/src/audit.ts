import { execute, pool, query, type Rows } from './db';
import type { PoolConnection } from 'mysql2/promise';

type Executor = PoolConnection | typeof pool;

export interface ActivityInput {
  modul: 'Santri' | 'Pendaftaran' | 'Syahriyah' | 'Kilatan' | 'Iuran' | 'Kas' | 'Pengaturan' | 'Sistem';
  aksi: 'Tambah' | 'Ubah' | 'Hapus' | 'Impor' | 'Pembayaran' | 'Pembatalan' | 'Restore' | 'Login';
  deskripsi: string;
  ref_id?: string | null;
  userId?: string | null;
}

/** Tulis audit trail. Boleh memakai koneksi transaksi yang sama. */
export async function logActivity(input: ActivityInput, executor: Executor = pool): Promise<void> {
  await executor.execute(
    `INSERT INTO activity_log (id, waktu, modul, aksi, deskripsi, ref_id, user_id)
     VALUES (?, NOW(), ?, ?, ?, ?, ?)`,
    [
      `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      input.modul,
      input.aksi,
      input.deskripsi.slice(0, 500),
      input.ref_id ?? null,
      input.userId ?? null,
    ]
  );

  // Pertahankan maksimal 500 entri terbaru seperti di.activityLogService (localStorage).
  await executor.execute(`
    DELETE FROM activity_log WHERE id NOT IN (
      SELECT id FROM (SELECT id FROM activity_log ORDER BY waktu DESC LIMIT 500) AS terbaru
    )
  `);
}

export async function getRecentActivity(limit = 100): Promise<Rows> {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return query(`SELECT * FROM activity_log ORDER BY waktu DESC LIMIT ${safeLimit}`);
}
