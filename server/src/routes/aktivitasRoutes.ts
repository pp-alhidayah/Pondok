import { Router } from 'express';
import { requireAuth, requireRole } from '../auth';
import { logActivity } from '../audit';
import { execute, query, withTransaction, type Rows } from '../db';
import { asyncHandler, badRequest } from '../errors';
import { ADMIN_ROLES } from '../roles';

export const aktivitasRoutes = Router();

aktivitasRoutes.get(
  '/aktivitas',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conditions: string[] = ['1 = 1'];
    const params: unknown[] = [];
    if (typeof req.query.modul === 'string' && req.query.modul !== 'Semua') {
      conditions.push('modul = ?');
      params.push(req.query.modul);
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      conditions.push('(deskripsi LIKE ? OR modul LIKE ? OR aksi LIKE ?)');
      const like = `%${req.query.search.trim()}%`;
      params.push(like, like, like);
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const rows = await query<Rows>(
      `SELECT * FROM activity_log WHERE ${conditions.join(' AND ')} ORDER BY waktu DESC LIMIT ${limit}`,
      params
    );
    res.json({ data: rows });
  })
);

aktivitasRoutes.get(
  '/print-log',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = typeof req.query.transaksi_id === 'string' ? req.query.transaksi_id : '';
    const rows = id
      ? await query<Rows>('SELECT * FROM print_log WHERE transaksi_id = ? ORDER BY printed_at DESC', [id])
      : await query<Rows>('SELECT * FROM print_log ORDER BY printed_at DESC LIMIT 500');
    res.json({ data: rows });
  })
);

aktivitasRoutes.post(
  '/print-log',
  requireAuth,
  asyncHandler(async (req, res) => {
    const transaksiId = String(req.body?.transaksi_id || '').trim();
    const type = String(req.body?.type || 'PDF');
    if (!transaksiId || !['HVS', 'Thermal', 'PDF'].includes(type)) throw badRequest('Data log cetak tidak valid');
    await execute(
      `INSERT INTO print_log (id, transaksi_id, type, printed_at, printed_by) VALUES (?, ?, ?, NOW(), ?)`,
      [
        `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        transaksiId,
        type,
        req.user?.id ?? null,
      ]
    );
    res.status(201).json({ data: { transaksi_id: transaksiId, type } });
  })
);

/** Ekspor seluruh data (kecuali sesi & password) — hanya Super Admin. */
aktivitasRoutes.get(
  '/backup',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    const tables = [
      'users', 'santri', 'santri_periode_nonaktif', 'syahriyah_bulan', 'keringanan_syahriyah', 'transaksi_syahriyah',
      'kilatan_bulan', 'transaksi_kilatan', 'buku_kas', 'kategori_kas', 'pendaftaran',
      'master_iuran', 'iuran_pembayaran', 'iuran_tambahan', 'kuitansi_counter',
      'pengaturan', 'arsip_tarif', 'print_log', 'activity_log',
    ];
    const hasil: Record<string, unknown> = {};
    for (const table of tables) {
      const rows = await query<Rows>(`SELECT * FROM \`${table}\``);
      hasil[table] = table === 'users'
        ? rows.map(({ password_hash: _hash, ...rest }) => rest)
        : rows;
    }
    res.json({ data: hasil, version: 1, exported_at: new Date().toISOString() });
  })
);

/** Restore data tanpa akun users (akun tetap dikelola lewat /api/users). */
aktivitasRoutes.post(
  '/restore',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    if (req.body?.konfirmasi !== true) throw badRequest('Restore memerlukan konfirmasi: true');
    const data = req.body?.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') throw badRequest('Data backup tidak valid');

    const urutanHapus = [
      'activity_log', 'print_log', 'arsip_tarif', 'pengaturan', 'iuran_pembayaran',
      'iuran_tambahan', 'master_iuran', 'transaksi_syahriyah', 'transaksi_kilatan',
      'buku_kas', 'kuitansi_counter', 'santri_periode_nonaktif', 'syahriyah_bulan',
      'keringanan_syahriyah', 'kilatan_bulan', 'pendaftaran', 'kategori_kas', 'santri',
    ];
    const urutanTulis = [...urutanHapus].reverse();

    const jumlah = await withTransaction(async (conn) => {
      for (const table of urutanHapus) {
        const rows = data[table];
        if (!Array.isArray(rows)) throw badRequest(`Data ${table} bukan array`);
        await conn.execute(`DELETE FROM \`${table}\``);
      }
      for (const table of urutanTulis) {
        const rows = (data[table] as unknown[]) || [];
        for (const row of rows) {
          const item = row as Record<string, unknown>;
          const keys = Object.keys(item).filter((key) => key !== 'password_hash');
          if (!keys.length) continue;
          const placeholders = keys.map(() => '?').join(', ');
          await conn.execute(
            `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES (${placeholders})`,
            keys.map((key) => (typeof item[key] === 'object' ? JSON.stringify(item[key]) : item[key])) as any[]
          );
        }
      }
      await logActivity(
        { modul: 'Pengaturan', aksi: 'Restore', deskripsi: 'Memulihkan data dari backup', userId: req.user?.id },
        conn
      );
      return urutanHapus.length;
    });

    res.json({ data: { dipulihkan: jumlah } });
  })
);
