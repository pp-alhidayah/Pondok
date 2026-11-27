import { Router } from 'express';
import type { Role } from './auth';
import { requireAuth, requireRole } from './auth';
import { logActivity, type ActivityInput } from './audit';
import { execute, query, type Rows } from './db';
import { asyncHandler, badRequest, notFound } from './errors';
import { newId } from './id';

export interface CrudOptions {
  table: string;
  prefix: string;
  fields: string[];
  searchFields?: string[];
  filterFields?: string[];
  orderBy?: string;
  hasUpdatedAt?: boolean;
  auditModul?: ActivityInput['modul'];
  /** Role yang boleh menulis; default semua peran terautentikasi. */
  writeRoles?: Role[];
}

function pickFields(body: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) picked[field] = body[field];
  }
  return picked;
}

/** CRUD generik dengan whitelist kolom agar tidak ada SQL injection lewat nama kolom. */
export function crudRouter(options: CrudOptions): Router {
  const router = Router();
  const writableRoles = options.writeRoles;

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const conditions: string[] = ['1 = 1'];
      const params: unknown[] = [];
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

      if (search && options.searchFields?.length) {
        conditions.push(
          `(${options.searchFields.map((field) => `\`${field}\` LIKE ?`).join(' OR ')})`
        );
        options.searchFields.forEach(() => params.push(`%${search}%`));
      }

      for (const field of options.filterFields || []) {
        const value = req.query[field];
        if (typeof value === 'string' && value !== '' && value !== 'Semua') {
          conditions.push(`\`${field}\` = ?`);
          params.push(value);
        }
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const order = options.orderBy || '`created_at` DESC';

      const rows = await query<Rows>(
        `SELECT * FROM \`${options.table}\` WHERE ${conditions.join(' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      res.json({ data: rows });
    })
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await query<Rows>(`SELECT * FROM \`${options.table}\` WHERE id = ?`, [req.params.id]);
      if (!rows[0]) throw notFound('Data tidak ditemukan');
      res.json({ data: rows[0] });
    })
  );

  router.post(
    '/',
    requireAuth,
    ...(writableRoles ? [requireRole(...writableRoles)] : []),
    asyncHandler(async (req, res) => {
      const body = pickFields(req.body as Record<string, unknown>, options.fields);
      if (!Object.keys(body).length) throw badRequest('Tidak ada field yang dikirim');
      const id = typeof body.id === 'string' && body.id ? body.id : newId(options.prefix);
      const columns = ['id', ...Object.keys(body).filter((key) => key !== 'id')];
      const values = [id, ...columns.slice(1).map((key) => body[key])];
      const placeholders = columns.map(() => '?').join(', ');

      await execute(
        `INSERT INTO \`${options.table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
        values
      );

      if (options.auditModul) {
        await logActivity({
          modul: options.auditModul,
          aksi: 'Tambah',
          deskripsi: `Menambah data ${options.table} (${id})`,
          ref_id: id,
          userId: req.user?.id,
        });
      }
      res.status(201).json({ data: { id, ...body } });
    })
  );

  router.put(
    '/:id',
    requireAuth,
    ...(writableRoles ? [requireRole(...writableRoles)] : []),
    asyncHandler(async (req, res) => {
      const body = pickFields(req.body as Record<string, unknown>, options.fields);
      if (!Object.keys(body).length) throw badRequest('Tidak ada field yang diubah');
      const assignments = Object.keys(body).map((key) => `\`${key}\` = ?`);
      const params: unknown[] = Object.values(body);
      if (options.hasUpdatedAt) {
        assignments.push('`updated_at` = NOW()');
      }
      params.push(req.params.id);

      const result = await execute(
        `UPDATE \`${options.table}\` SET ${assignments.join(', ')} WHERE id = ?`,
        params
      );
      if (!result.affectedRows) throw notFound('Data tidak ditemukan');

      if (options.auditModul) {
        await logActivity({
          modul: options.auditModul,
          aksi: 'Ubah',
          deskripsi: `Mengubah data ${options.table} (${req.params.id})`,
          ref_id: req.params.id,
          userId: req.user?.id,
        });
      }
      res.json({ data: { id: req.params.id, ...body } });
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    ...(writableRoles ? [requireRole(...writableRoles)] : []),
    asyncHandler(async (req, res) => {
      const result = await execute(`DELETE FROM \`${options.table}\` WHERE id = ?`, [req.params.id]);
      if (!result.affectedRows) throw notFound('Data tidak ditemukan');

      if (options.auditModul) {
        await logActivity({
          modul: options.auditModul,
          aksi: 'Hapus',
          deskripsi: `Menghapus data ${options.table} (${req.params.id})`,
          ref_id: req.params.id,
          userId: req.user?.id,
        });
      }
      res.status(204).end();
    })
  );

  return router;
}
