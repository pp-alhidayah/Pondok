import { Router } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { requireAuth } from '../auth';
import { logActivity } from '../audit';
import { query, withTransaction, type Rows } from '../db';
import { asyncHandler, badRequest, notFound } from '../errors';
import { newId } from '../id';
import { nextNomorKuitansi, tahunDariTanggal } from '../kuitansi';
import { WRITE_ROLES } from '../roles';
import { requireRole } from '../auth';
import {
  isAfterKeluar,
  isBeforeEntryEvent,
  isBulanDitagihkan,
  isBulanGapNonaktif,
  requireDate,
  requireOneOf,
  requirePositiveInteger,
  requireText,
} from '../validation';

type Row = Record<string, unknown>;

export const pembayaranRoutes = Router();

const KATEGORI_EVENT = ['Jumadil Ula', 'Maulid', 'Romadhon', 'Dzulhijjah'] as const;
const METODE = ['Tunai', 'Transfer', 'Lainnya'] as const;
const JENIS = ['Penuh', 'Sebagian'] as const;

const Status = {
  Lunas: 'Lunas',
  Sebagian: 'Sebagian',
  Belum: 'Belum',
} as const;

function statusDari(tagihan: number, dibayar: number): string {
  if (tagihan > 0 && dibayar >= tagihan) return Status.Lunas;
  if (dibayar > 0) return Status.Sebagian;
  return Status.Belum;
}

async function rowsFrom(conn: PoolConnection, sql: string, params: unknown[] = []): Promise<Row[]> {
  const [rows] = await conn.query(sql, params);
  return rows as Row[];
}

async function loadSantri(conn: PoolConnection, id: string): Promise<Row> {
  const rows = await rowsFrom(conn, 'SELECT * FROM santri WHERE id = ?', [id]);
  const santri = rows[0];
  if (!santri) throw notFound('Data santri tidak ditemukan');
  return santri;
}

async function loadPeriods(conn: PoolConnection, santriId: string): Promise<Array<{ mulai: string; sampai?: string }>> {
  const rows = await rowsFrom(
    conn,
    'SELECT mulai, sampai FROM santri_periode_nonaktif WHERE santri_id = ?',
    [santriId]
  );
  return rows.map((row) => ({
    mulai: String(row.mulai),
    ...(row.sampai ? { sampai: String(row.sampai) } : {}),
  }));
}

function parseIuranTambahan(value: unknown): Array<{ id: string; nama: string; nominal: number }> {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) throw badRequest('Iuran tambahan tidak valid');
  return value.map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      id: requireText(raw.id, 'Id iuran tambahan'),
      nama: requireText(raw.nama, 'Nama iuran tambahan'),
      nominal: requirePositiveInteger(raw.nominal, 'Nominal iuran tambahan'),
    };
  });
}

function totalItems(items: Array<{ nominal: number }>): number {
  return items.reduce((sum, item) => sum + item.nominal, 0);
}

/* ──────────────────────────── SYAHRIYAH ──────────────────────────── */

pembayaranRoutes.post(
  '/syahriyah',
  requireAuth,
  requireRole(...WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const santriId = requireText(req.body?.santri_id, 'Santri');
    const tanggalBayar = requireDate(req.body?.tanggal_bayar, 'Tanggal bayar');
    const metode = requireOneOf(req.body?.metode ?? 'Tunai', METODE, 'Metode');
    const keterangan = typeof req.body?.keterangan === 'string' ? req.body.keterangan.trim() : '';
    const tambahan = parseIuranTambahan(req.body?.iuran_tambahan);
    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw badRequest('Pilih minimal satu bulan');

    const items = rawItems.map((raw) => {
      const item = raw as Record<string, unknown>;
      const tahun = Number(item.tahun);
      const bulan = Number(item.bulan);
      if (!Number.isInteger(tahun) || tahun < 2000) throw badRequest('Tahun tidak valid');
      if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) throw badRequest('Bulan tidak valid');
      return {
        tahun,
        bulan,
        nominal: requirePositiveInteger(item.nominal, 'Nominal pembayaran'),
        jenis: requireOneOf(item.jenis ?? 'Penuh', JENIS, 'Jenis pembayaran'),
      };
    });

    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.tahun}-${item.bulan}`;
      if (seen.has(key)) throw badRequest(`Bulan ${item.bulan}/${item.tahun} dipilih lebih dari sekali`);
      seen.add(key);
    }

    const result = await withTransaction(async (conn) => {
      const santri = await loadSantri(conn, santriId);
      if (santri.kategori === 'Kilatan') {
        throw badRequest('Santri kategori Kilatan tidak dikenakan syahriyah bulanan');
      }
      const periods = await loadPeriods(conn, santriId);

      for (const item of items) {
        if (!isBulanDitagihkan(String(santri.tanggal_masuk), item.tahun, item.bulan, santri.tanggal_keluar ? String(santri.tanggal_keluar) : undefined, periods)) {
          throw badRequest(`Bulan ${item.bulan}/${item.tahun} tidak ditagihkan untuk santri ini`);
        }
        const matrix = await rowsFrom(
          conn,
          'SELECT nominal_tagihan, total_dibayar FROM syahriyah_bulan WHERE santri_id = ? AND tahun = ? AND bulan = ?',
          [santriId, item.tahun, item.bulan]
        );
        if (!matrix[0]) throw badRequest(`Data tagihan ${item.bulan}/${item.tahun} tidak ditemukan`);
        const sisa = Math.max(0, Number(matrix[0].nominal_tagihan) - Number(matrix[0].total_dibayar));
        if (item.nominal > sisa) {
          throw badRequest(`Pembayaran bulan ${item.bulan}/${item.tahun} melebihi sisa tagihan`);
        }
      }

      const nomorKuitansi = await nextNomorKuitansi(conn, tahunDariTanggal(tanggalBayar));
      const id = newId('trx_s');
      const total = totalItems(items) + totalItems(tambahan);

      await conn.execute(
        `INSERT INTO transaksi_syahriyah
         (id, nomor_kuitansi, kas_id, santri_id, santri_nama, santri_nis, tanggal_bayar, metode, keterangan, iuran_tambahan, items, total_pembayaran, created_at, created_by)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          id,
          nomorKuitansi,
          santriId,
          String(santri.nama),
          String(santri.nis),
          tanggalBayar,
          metode,
          keterangan || null,
          tambahan.length ? JSON.stringify(tambahan) : null,
          JSON.stringify(items),
          total,
          req.user?.id ?? null,
        ]
      );

      const kasId = newId('k');
      await conn.execute(
        `INSERT INTO buku_kas (id, tanggal, jenis, kategori_nama, nominal, keterangan, sumber_modul, sumber_ref_id, created_at, created_by)
         VALUES (?, ?, 'Pemasukan', 'Syahriyah', ?, ?, 'syahriyah', ?, NOW(), ?)`,
        [kasId, tanggalBayar, total, keterangan || null, id, req.user?.id ?? null]
      );
      await conn.execute('UPDATE transaksi_syahriyah SET kas_id = ? WHERE id = ?', [kasId, id]);

      for (const item of items) {
        const matrix = await rowsFrom(
          conn,
          'SELECT nominal_tagihan, total_dibayar FROM syahriyah_bulan WHERE santri_id = ? AND tahun = ? AND bulan = ?',
          [santriId, item.tahun, item.bulan]
        );
        const dibayar = Number(matrix[0].total_dibayar) + item.nominal;
        const tagihan = Number(matrix[0].nominal_tagihan);
        await conn.execute(
          'UPDATE syahriyah_bulan SET total_dibayar = ?, status = ? WHERE santri_id = ? AND tahun = ? AND bulan = ?',
          [dibayar, statusDari(tagihan, dibayar), santriId, item.tahun, item.bulan]
        );
      }

      await logActivity(
        {
          modul: 'Syahriyah',
          aksi: 'Pembayaran',
          deskripsi: `Pembayaran syahriyah ${santri.nama} (${nomorKuitansi}) Rp${total.toLocaleString('id-ID')}`,
          ref_id: id,
          userId: req.user?.id,
        },
        conn
      );

      return { id, nomor_kuitansi: nomorKuitansi, total };
    });

    res.status(201).json({ data: result });
  })
);

/* ──────────────────────────── KILATAN ──────────────────────────── */

pembayaranRoutes.post(
  '/kilatan',
  requireAuth,
  requireRole(...WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const santriId = requireText(req.body?.santri_id, 'Santri');
    const tanggalBayar = requireDate(req.body?.tanggal_bayar, 'Tanggal bayar');
    const metode = requireOneOf(req.body?.metode ?? 'Tunai', METODE, 'Metode');
    const keterangan = typeof req.body?.keterangan === 'string' ? req.body.keterangan.trim() : '';
    const tambahan = parseIuranTambahan(req.body?.iuran_tambahan);
    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw badRequest('Pilih minimal satu event');

    const items = rawItems.map((raw) => {
      const item = raw as Record<string, unknown>;
      const tahun = Number(item.tahun);
      if (!Number.isInteger(tahun) || tahun < 2000) throw badRequest('Tahun tidak valid');
      return {
        tahun,
        event: requireOneOf(item.event, KATEGORI_EVENT, 'Event'),
        nominal: requirePositiveInteger(item.nominal, 'Nominal pembayaran'),
        jenis: requireOneOf(item.jenis ?? 'Penuh', JENIS, 'Jenis pembayaran'),
      };
    });

    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.tahun}-${item.event}`;
      if (seen.has(key)) throw badRequest(`Event ${item.event} ${item.tahun} dipilih lebih dari sekali`);
      seen.add(key);
    }

    const result = await withTransaction(async (conn) => {
      const santri = await loadSantri(conn, santriId);
      const periods = await loadPeriods(conn, santriId);

      for (const item of items) {
        if (isBeforeEntryEvent(String(santri.tanggal_masuk), item.tahun, item.event)) {
          throw badRequest(`Event ${item.event} ${item.tahun} terjadi sebelum santri masuk`);
        }
        const bulan = { Romadhon: 3, Dzulhijjah: 6, Maulid: 9, 'Jumadil Ula': 11 }[item.event] || 1;
        if (
          (periods.length && isBulanGapNonaktif(periods, item.tahun, bulan)) ||
          isAfterKeluar(santri.tanggal_keluar ? String(santri.tanggal_keluar) : undefined, item.tahun, bulan)
        ) {
          throw badRequest(`Event ${item.event} ${item.tahun} tidak ditagihkan untuk santri ini`);
        }
        const matrix = await rowsFrom(
          conn,
          'SELECT nominal_tagihan, total_dibayar FROM kilatan_bulan WHERE santri_id = ? AND tahun = ? AND event = ?',
          [santriId, item.tahun, item.event]
        );
        if (!matrix[0]) throw badRequest(`Data tagihan event ${item.event} ${item.tahun} tidak ditemukan`);
        const sisa = Math.max(0, Number(matrix[0].nominal_tagihan) - Number(matrix[0].total_dibayar));
        if (item.nominal > sisa) throw badRequest(`Pembayaran event ${item.event} melebihi sisa tagihan`);
      }

      const nomorKuitansi = await nextNomorKuitansi(conn, tahunDariTanggal(tanggalBayar));
      const id = newId('trx_k');
      const total = totalItems(items) + totalItems(tambahan);

      await conn.execute(
        `INSERT INTO transaksi_kilatan
         (id, nomor_kuitansi, kas_id, santri_id, santri_nama, santri_nis, tanggal_bayar, metode, keterangan, iuran_tambahan, items, total_pembayaran, created_at, created_by)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          id,
          nomorKuitansi,
          santriId,
          String(santri.nama),
          String(santri.nis),
          tanggalBayar,
          metode,
          keterangan || null,
          tambahan.length ? JSON.stringify(tambahan) : null,
          JSON.stringify(items),
          total,
          req.user?.id ?? null,
        ]
      );

      const kasId = newId('k');
      await conn.execute(
        `INSERT INTO buku_kas (id, tanggal, jenis, kategori_nama, nominal, keterangan, sumber_modul, sumber_ref_id, created_at, created_by)
         VALUES (?, ?, 'Pemasukan', 'Kilatan', ?, ?, 'kilatan', ?, NOW(), ?)`,
        [kasId, tanggalBayar, total, keterangan || null, id, req.user?.id ?? null]
      );
      await conn.execute('UPDATE transaksi_kilatan SET kas_id = ? WHERE id = ?', [kasId, id]);

      for (const item of items) {
        const matrix = await rowsFrom(
          conn,
          'SELECT nominal_tagihan, total_dibayar FROM kilatan_bulan WHERE santri_id = ? AND tahun = ? AND event = ?',
          [santriId, item.tahun, item.event]
        );
        const dibayar = Number(matrix[0].total_dibayar) + item.nominal;
        const tagihan = Number(matrix[0].nominal_tagihan);
        await conn.execute(
          'UPDATE kilatan_bulan SET total_dibayar = ?, status = ? WHERE santri_id = ? AND tahun = ? AND event = ?',
          [dibayar, statusDari(tagihan, dibayar), santriId, item.tahun, item.event]
        );
      }

      await logActivity(
        {
          modul: 'Kilatan',
          aksi: 'Pembayaran',
          deskripsi: `Pembayaran kilatan ${santri.nama} (${nomorKuitansi}) Rp${total.toLocaleString('id-ID')}`,
          ref_id: id,
          userId: req.user?.id,
        },
        conn
      );

      return { id, nomor_kuitansi: nomorKuitansi, total };
    });

    res.status(201).json({ data: result });
  })
);

/* ──────────────────────────── IURAN ──────────────────────────── */

pembayaranRoutes.post(
  '/iuran',
  requireAuth,
  requireRole(...WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const iuranId = requireText(req.body?.iuran_id, 'Program iuran');
    const namaPembayar = requireText(req.body?.nama_pembayar, 'Nama pembayar');
    const tanggalBayar = requireDate(req.body?.tanggal_bayar, 'Tanggal bayar');
    const nominal = requirePositiveInteger(req.body?.nominal, 'Nominal');
    const metode = requireOneOf(req.body?.metode ?? 'Tunai', METODE, 'Metode');
    const keterangan = typeof req.body?.keterangan === 'string' ? req.body.keterangan.trim() : '';
    const tipePembayar = requireOneOf(req.body?.tipe_pembayar ?? 'umum', ['santri', 'umum'] as const, 'Tipe pembayar');
    const santriId = tipePembayar === 'santri' ? requireText(req.body?.santri_id, 'Santri') : null;

    const result = await withTransaction(async (conn) => {
      const master = await rowsFrom(conn, 'SELECT * FROM master_iuran WHERE id = ?', [iuranId]);
      if (!master[0]) throw notFound('Program iuran tidak ditemukan');
      if (master[0].status !== 'Aktif') throw badRequest('Program iuran tidak aktif');

      let periodeBulan: string | null = null;
      let periodeTahun: number | null = null;
      if (master[0].jenis_periode === 'bulanan') {
        const raw = req.body?.periode_bulan;
        if (typeof raw !== 'string' || !/^\d{4}-\d{2}$/.test(raw)) throw badRequest('Periode bulan wajib diisi (YYYY-MM)');
        periodeBulan = raw;
        periodeTahun = Number(raw.slice(0, 4));
      } else if (master[0].jenis_periode === 'tahunan') {
        periodeTahun = Number(req.body?.periode_tahun);
        if (!Number.isInteger(periodeTahun) || periodeTahun < 2000) throw badRequest('Periode tahun wajib diisi');
      }

      const id = newId('iur');
      await conn.execute(
        `INSERT INTO iuran_pembayaran
         (id, iuran_id, tipe_pembayar, santri_id, nama_pembayar, periode_bulan, periode_tahun, nominal, tanggal_bayar, metode, keterangan, kas_id, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(), ?)`,
        [id, iuranId, tipePembayar, santriId, namaPembayar, periodeBulan, periodeTahun, nominal, tanggalBayar, metode, keterangan || null, req.user?.id ?? null]
      );

      const kasId = newId('k');
      await conn.execute(
        `INSERT INTO buku_kas (id, tanggal, jenis, kategori_nama, nominal, keterangan, sumber_modul, sumber_ref_id, created_at, created_by)
         VALUES (?, ?, 'Pemasukan', 'Iuran', ?, ?, 'iuran', ?, NOW(), ?)`,
        [kasId, tanggalBayar, nominal, keterangan || null, id, req.user?.id ?? null]
      );
      await conn.execute('UPDATE iuran_pembayaran SET kas_id = ? WHERE id = ?', [kasId, id]);

      await logActivity(
        {
          modul: 'Iuran',
          aksi: 'Pembayaran',
          deskripsi: `Pembayaran iuran ${master[0].nama} — ${namaPembayar} Rp${nominal.toLocaleString('id-ID')}`,
          ref_id: id,
          userId: req.user?.id,
        },
        conn
      );

      return { id, total: nominal };
    });

    res.status(201).json({ data: result });
  })
);

/* ──────────────────────────── BATALKAN ──────────────────────────── */

function parseItems(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as Row[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const PEMBAYARAN_MODUL = {
  syahriyah: {
    tabel: 'transaksi_syahriyah',
    matriks: 'syahriyah_bulan',
    kategori: 'Syahriyah',
    modulAudit: 'Syahriyah' as const,
    kunci: (item: Row) => ({ field: 'bulan', value: Number(item.bulan), tahun: Number(item.tahun) }),
  },
  kilatan: {
    tabel: 'transaksi_kilatan',
    matriks: 'kilatan_bulan',
    kategori: 'Kilatan',
    modulAudit: 'Kilatan' as const,
    kunci: (item: Row) => ({ field: 'event', value: String(item.event), tahun: Number(item.tahun) }),
  },
  iuran: {
    tabel: 'iuran_pembayaran',
    matriks: '',
    kategori: 'Iuran',
    modulAudit: 'Iuran' as const,
    kunci: () => ({ field: '', value: '', tahun: 0 }),
  },
};

pembayaranRoutes.post(
  '/:modul/:id/batalkan',
  requireAuth,
  requireRole(...WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const modul = req.params.modul;
    const config = PEMBAYARAN_MODUL[modul as keyof typeof PEMBAYARAN_MODUL];
    if (!config) throw notFound('Modul pembayaran tidak ditemukan');
    const id = req.params.id;

    await withTransaction(async (conn) => {
      const transaksi = await rowsFrom(conn, `SELECT * FROM \`${config.tabel}\` WHERE id = ?`, [id]);
      const record = transaksi[0];
      if (!record) throw notFound('Pembayaran tidak ditemukan atau sudah dibatalkan');

      if (config.matriks) {
        const items = parseItems(record.items);
        for (const item of items) {
          const key = config.kunci(item);
          const matrix = await rowsFrom(
            conn,
            `SELECT nominal_tagihan, total_dibayar FROM \`${config.matriks}\`
             WHERE santri_id = ? AND tahun = ? AND \`${key.field}\` = ?`,
            [record.santri_id, key.tahun, key.value]
          );
          if (!matrix[0]) throw badRequest('Data matriks terkait tidak ditemukan; pembatalan dibatalkan');
          const dibayar = Math.max(0, Number(matrix[0].total_dibayar) - Number(item.nominal));
          const tagihan = Number(matrix[0].nominal_tagihan);
          await conn.execute(
            `UPDATE \`${config.matriks}\` SET total_dibayar = ?, status = ?
             WHERE santri_id = ? AND tahun = ? AND \`${key.field}\` = ?`,
            [dibayar, statusDari(tagihan, dibayar), record.santri_id, key.tahun, key.value] as any[]
          );
        }
      }

      const kas = await rowsFrom(conn, 'SELECT id FROM buku_kas WHERE sumber_modul = ? AND sumber_ref_id = ?', [modul, id]);
      if (!kas[0]) throw badRequest('Entri kas terkait tidak ditemukan; pembatalan dibatalkan');
      await conn.execute('DELETE FROM buku_kas WHERE sumber_modul = ? AND sumber_ref_id = ?', [modul, id]);
      await conn.execute(`DELETE FROM \`${config.tabel}\` WHERE id = ?`, [id]);

      await logActivity(
        {
          modul: config.modulAudit,
          aksi: 'Pembatalan',
          deskripsi: `Membatalkan pembayaran ${config.kategori} ${String(record.nama_pembayar || record.santri_nama || '')}`,
          ref_id: id,
          userId: req.user?.id,
        },
        conn
      );
    });

    // Counter kuitansi sengaja TIDAK dikembalikan.
    res.json({ data: { ok: true } });
  })
);

pembayaranRoutes.get(
  '/riwayat',
  requireAuth,
  asyncHandler(async (req, res) => {
    const modul = req.params.modul || String(req.query.modul || 'syahriyah');
    const config = PEMBAYARAN_MODUL[modul as keyof typeof PEMBAYARAN_MODUL];
    if (!config) throw notFound('Modul pembayaran tidak ditemukan');
    const tahun = Number(req.query.tahun) || new Date().getFullYear();
    const rows = await query<Rows>(
      `SELECT * FROM \`${config.tabel}\` WHERE YEAR(tanggal_bayar) = ? ORDER BY tanggal_bayar DESC LIMIT 500`,
      [tahun]
    );
    res.json({ data: rows });
  })
);
