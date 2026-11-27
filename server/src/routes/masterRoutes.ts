import { Router } from 'express';
import { hashPassword, requireAuth, requireRole } from '../auth';
import { logActivity } from '../audit';
import { crudRouter } from '../crud';
import { execute, query, type Rows } from '../db';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../errors';
import { newId } from '../id';
import { ADMIN_ROLES, WRITE_ROLES } from '../roles';
import { requireDate, requireOneOf, requireText, isValidCalendarDate } from '../validation';

export const masterRoutes = Router();

// Rute spesifik harus sebelum CRUD generik (/arsip-tarif/:id, /iuran-tambahan/:id).
masterRoutes.put(
  '/arsip-tarif/replace',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const list = req.body?.list;
    if (!Array.isArray(list)) throw badRequest('Daftar arsip tarif tidak valid');
    const { withTransaction } = await import('../db');
    await withTransaction(async (conn) => {
      await conn.execute('DELETE FROM arsip_tarif');
      for (const row of list as Record<string, unknown>[]) {
        const keys = Object.keys(row).filter((key) => key !== 'id');
        if (!keys.length) continue;
        await conn.execute(
          `INSERT INTO arsip_tarif (${['id', ...keys].map((k) => `\`${k}\``).join(', ')})
           VALUES (${['id', ...keys].map(() => '?').join(', ')})`,
          [row.id || newId('ars'), ...keys.map((key) => row[key])] as any[]
        );
      }
    });
    res.json({ data: { jumlah: list.length } });
  })
);

masterRoutes.put(
  '/iuran-tambahan/replace',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const list = req.body?.list;
    if (!Array.isArray(list)) throw badRequest('Daftar iuran tambahan tidak valid');
    const { withTransaction } = await import('../db');
    await withTransaction(async (conn) => {
      await conn.execute('DELETE FROM iuran_tambahan');
      for (const row of list as Record<string, unknown>[]) {
        await conn.execute(
          'INSERT INTO iuran_tambahan (id, nama, tipe, nominal) VALUES (?, ?, ?, ?)',
          [row.id || newId('iur'), String(row.nama), String(row.tipe), Number(row.nominal)] as any[]
        );
      }
    });
    res.json({ data: { jumlah: list.length } });
  })
);

/* ── Master iuran & iuran tambahan (CRUD generik) ── */
masterRoutes.use(
  '/master-iuran',
  crudRouter({
    table: 'master_iuran',
    prefix: 'mst',
    fields: ['nama', 'nominal_default', 'jenis_periode', 'status', 'keterangan'],
    searchFields: ['nama'],
    orderBy: '`created_at` DESC',
    hasUpdatedAt: true,
    auditModul: 'Pengaturan',
    writeRoles: ADMIN_ROLES,
  })
);

masterRoutes.use(
  '/iuran-tambahan',
  crudRouter({
    table: 'iuran_tambahan',
    prefix: 'iur',
    fields: ['nama', 'tipe', 'nominal'],
    searchFields: ['nama'],
    auditModul: 'Pengaturan',
    writeRoles: ADMIN_ROLES,
  })
);

masterRoutes.use(
  '/arsip-tarif',
  crudRouter({
    table: 'arsip_tarif',
    prefix: 'ars',
    fields: [
      'periode_mulai', 'periode_selesai', 'syahriyah_mukim', 'syahriyah_nduduk',
      'syahriyah_kilatan', 'event_kilatan', 'status', 'diarsipkan_pada',
    ],
    orderBy: '`periode_mulai` DESC',
    auditModul: 'Pengaturan',
    writeRoles: ADMIN_ROLES,
  })
);

/* ── Santri: hapus hanya bila tidak punya riwayat pembayaran ── */
const santri = Router();
santri.delete('/:id', requireAuth, requireRole(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const [transaksi, matriks] = await Promise.all([
    query<Rows>(
      `SELECT 'syahriyah' AS modul FROM transaksi_syahriyah WHERE santri_id = ?
       UNION ALL SELECT 'kilatan' FROM transaksi_kilatan WHERE santri_id = ?
       UNION ALL SELECT 'iuran' FROM iuran_pembayaran WHERE santri_id = ? LIMIT 1`,
      [id, id, id]
    ),
    query<Rows>(
      `SELECT 'matriks' AS modul FROM syahriyah_bulan WHERE santri_id = ? AND total_dibayar > 0
       UNION ALL SELECT 'matriks' FROM kilatan_bulan WHERE santri_id = ? AND total_dibayar > 0 LIMIT 1`,
      [id, id]
    ),
  ]);
  if (transaksi.length || matriks.length) {
    throw conflict('Santri memiliki riwayat pembayaran sehingga tidak dapat dihapus. Ubah statusnya menjadi Tidak Aktif.');
  }
  await execute('DELETE FROM santri WHERE id = ?', [id]);
  await logActivity({ modul: 'Santri', aksi: 'Hapus', deskripsi: `Menghapus santri ${id}`, ref_id: id, userId: req.user?.id });
  res.status(204).end();
}));

santri.use(
  '/',
  crudRouter({
    table: 'santri',
    prefix: 's',
    fields: [
      'nis', 'nama', 'nama_wali', 'no_hp_santri', 'no_hp_wali', 'kategori',
      'status', 'tanggal_masuk', 'tanggal_keluar', 'foto', 'catatan',
    ],
    searchFields: ['nis', 'nama', 'nama_wali', 'no_hp_wali'],
    filterFields: ['kategori', 'status'],
    orderBy: '`nama` ASC',
    hasUpdatedAt: true,
    auditModul: 'Santri',
    writeRoles: WRITE_ROLES,
  })
);
masterRoutes.post('/santri/import', requireAuth, requireRole(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) throw badRequest('Tidak ada baris yang dikirim');
  const { withTransaction } = await import('../db');
  const jumlah = await withTransaction(async (conn) => {
    for (const raw of rows as Record<string, unknown>[]) {
      const nama = requireText(raw.nama, 'Nama santri');
      let nis = typeof raw.nis === 'string' ? raw.nis.trim() : '';
      if (!nis) {
        const year = new Date().getFullYear().toString();
        const [maxRow] = await conn.query(
          'SELECT nis FROM santri WHERE nis LIKE ? ORDER BY nis DESC LIMIT 1',
          [`${year}%`]
        ) as [Array<{ nis: string }>, unknown];
        const seq = maxRow[0] ? Number(maxRow[0].nis.slice(year.length)) + 1 : 1;
        nis = `${year}${String(seq).padStart(3, '0')}`;
      }
      const tanggalMasuk = raw.tanggal_masuk && isValidCalendarDate(raw.tanggal_masuk)
        ? raw.tanggal_masuk
        : new Date().toLocaleDateString('sv-SE');
      await conn.execute(
        `INSERT INTO santri (id, nis, nama, nama_wali, no_hp_santri, no_hp_wali, kategori, status, tanggal_masuk, catatan, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
        [
          newId('s'), nis, nama,
          typeof raw.nama_wali === 'string' ? raw.nama_wali : '',
          typeof raw.no_hp_santri === 'string' ? raw.no_hp_santri : '',
          typeof raw.no_hp_wali === 'string' ? raw.no_hp_wali : '',
          requireOneOf(raw.kategori || 'Mukim', ['Mukim', 'Nduduk', 'Kilatan'] as const, 'Kategori'),
          requireOneOf(raw.status || 'Aktif', ['Aktif', 'Tidak Aktif'] as const, 'Status'),
          tanggalMasuk,
          typeof raw.catatan === 'string' ? raw.catatan : null,
          req.user?.id ?? null,
        ]
      );
    }
    return rows.length;
  });
  res.status(201).json({ data: { jumlah: jumlah } });
}));

masterRoutes.use('/santri', santri);

/* ── Kas: entri dari pembayaran tidak bisa diubah/dihapus langsung ── */
const kas = Router();

kas.put('/:id', requireAuth, requireRole(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const rows = await query<Rows>('SELECT sumber_modul FROM buku_kas WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw notFound('Transaksi kas tidak ditemukan');
  if (rows[0].sumber_modul) throw forbidden('Transaksi dari pembayaran harus dibatalkan dari menu asalnya');
  const allowed = ['tanggal', 'jenis', 'kategori_nama', 'nominal', 'keterangan'];
  const body = req.body as Record<string, unknown>;
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      sets.push(`\`${field}\` = ?`);
      params.push(body[field]);
    }
  }
  if (!sets.length) throw badRequest('Tidak ada field yang diubah');
  params.push(req.params.id);
  await execute(`UPDATE buku_kas SET ${sets.join(', ')} WHERE id = ?`, params);
  await logActivity({ modul: 'Kas', aksi: 'Ubah', deskripsi: `Mengubah kas ${req.params.id}`, ref_id: req.params.id, userId: req.user?.id });
  res.json({ data: { id: req.params.id } });
}));

kas.delete('/:id', requireAuth, requireRole(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const rows = await query<Rows>('SELECT sumber_modul, kategori_nama FROM buku_kas WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw notFound('Transaksi kas tidak ditemukan');
  if (rows[0].sumber_modul) throw forbidden('Transaksi dari pembayaran harus dibatalkan dari menu asalnya');
  await execute('DELETE FROM buku_kas WHERE id = ?', [req.params.id]);
  await logActivity({ modul: 'Kas', aksi: 'Hapus', deskripsi: `Menghapus kas ${rows[0].kategori_nama}`, ref_id: req.params.id, userId: req.user?.id });
  res.status(204).end();
}));

kas.use(
  '/',
  crudRouter({
    table: 'buku_kas',
    prefix: 'k',
    fields: ['tanggal', 'jenis', 'kategori_nama', 'nominal', 'keterangan'],
    searchFields: ['keterangan', 'kategori_nama'],
    filterFields: ['jenis', 'kategori_nama'],
    orderBy: '`tanggal` DESC',
    auditModul: 'Kas',
    writeRoles: WRITE_ROLES,
  })
);
masterRoutes.use('/kas', kas);

/* ── Pendaftaran + konversi ── */
const pendaftaran = Router();
pendaftaran.use(
  '/',
  crudRouter({
    table: 'pendaftaran',
    prefix: 'p',
    fields: [
      'nama_calon', 'nama_wali', 'no_hp_santri', 'no_hp_wali', 'kategori',
      'tanggal_pendaftaran', 'status', 'nis_generated', 'santri_id', 'catatan',
    ],
    searchFields: ['nama_calon', 'nama_wali', 'no_hp_santri', 'no_hp_wali'],
    filterFields: ['status', 'kategori'],
    orderBy: '`created_at` DESC',
    auditModul: 'Pendaftaran',
    writeRoles: WRITE_ROLES,
  })
);

pendaftaran.post('/:id/konversi', requireAuth, requireRole(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const nis = requireText(req.body?.nis, 'NIS');
  const tanggalMasuk = requireDate(req.body?.tanggal_masuk, 'Tanggal masuk');
  const rows = await query<Rows>('SELECT * FROM pendaftaran WHERE id = ?', [req.params.id]);
  const calon = rows[0];
  if (!calon) throw notFound('Pendaftaran tidak ditemukan');
  if (calon.status === 'Menjadi Santri' || calon.santri_id) throw conflict('Pendaftar ini sudah dikonversi');
  if (calon.status !== 'Diterima') throw badRequest('Hanya pendaftar berstatus Diterima yang bisa dikonversi');

  const santriId = newId('s');
  const { withTransaction } = await import('../db');
  const result = await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO santri (id, nis, nama, nama_wali, no_hp_santri, no_hp_wali, kategori, status, tanggal_masuk, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, NOW(), NOW(), ?)`,
      [santriId, nis, calon.nama_calon, calon.nama_wali, calon.no_hp_santri, calon.no_hp_wali, calon.kategori, tanggalMasuk, req.user?.id ?? null]
    );
    await conn.execute(
      `UPDATE pendaftaran SET status = 'Menjadi Santri', nis_generated = ?, santri_id = ? WHERE id = ?`,
      [nis, santriId, req.params.id]
    );
    await logActivity(
      { modul: 'Pendaftaran', aksi: 'Ubah', deskripsi: `Konversi ${calon.nama_calon} menjadi santri (${nis})`, ref_id: req.params.id, userId: req.user?.id },
      conn
    );
    return { santri_id: santriId, nis };
  });
  res.status(201).json({ data: result });
}));
masterRoutes.use('/pendaftaran', pendaftaran);

/* ── Kategori kas (PK komposit) ── */
masterRoutes.get('/kategori-kas', requireAuth, asyncHandler(async (_req, res) => {
  const rows = await query<Rows>('SELECT jenis, nama FROM kategori_kas ORDER BY jenis, nama');
  res.json({ data: rows });
}));

masterRoutes.put('/kategori-kas/:jenis/:namaLama', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const namaBaru = requireText(req.body?.nama, 'Nama kategori');
  const hasil = await execute(
    'UPDATE kategori_kas SET nama = ? WHERE jenis = ? AND nama = ?',
    [namaBaru, req.params.jenis, req.params.namaLama]
  );
  if (!hasil.affectedRows) throw notFound('Kategori tidak ditemukan');
  await execute('UPDATE buku_kas SET kategori_nama = ? WHERE jenis = ? AND kategori_nama = ?', [
    namaBaru,
    req.params.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
    req.params.namaLama,
  ]);
  res.json({ data: { nama: namaBaru } });
}));

masterRoutes.post('/kategori-kas', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const jenis = requireOneOf(req.body?.jenis, ['pemasukan', 'pengeluaran'] as const, 'Jenis');
  const nama = requireText(req.body?.nama, 'Nama kategori');
  await execute('INSERT INTO kategori_kas (jenis, nama) VALUES (?, ?)', [jenis, nama]);
  res.status(201).json({ data: { jenis, nama } });
}));

masterRoutes.delete('/kategori-kas/:jenis/:nama', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const jumlah = await query<Rows>('SELECT COUNT(*) AS n FROM buku_kas WHERE kategori_nama = ?', [req.params.nama]);
  if (Number(jumlah[0]?.n) > 0) throw conflict('Kategori masih digunakan transaksi kas');
  await execute('DELETE FROM kategori_kas WHERE jenis = ? AND nama = ?', [req.params.jenis, req.params.nama]);
  res.status(204).end();
}));

/* ── Pengaturan (key-value) ── */
masterRoutes.get('/pengaturan', requireAuth, asyncHandler(async (req, res) => {
  const kunci = typeof req.query.kunci === 'string' ? req.query.kunci : undefined;
  const rows = kunci
    ? await query<Rows>('SELECT * FROM pengaturan WHERE kunci = ?', [kunci])
    : await query<Rows>('SELECT * FROM pengaturan ORDER BY kunci');
  res.json({ data: kunci ? rows[0] || null : rows });
}));

/** Samakan matriks dengan tarif baru: tarif berlaku → dikurangi keringanan. */
async function sesuaikanTarifDiServer(nilai: Record<string, any>): Promise<void> {
  const periodeMulai = String(nilai.periode_mulai || new Date().toISOString().slice(0, 7));
  const { withTransaction } = await import('../db');
  await withTransaction(async (conn) => {
    const santriRows = await conn.query('SELECT id, kategori FROM santri');
    const kategoriById = new Map<string, string>();
    (santriRows as Rows).forEach((s) => kategoriById.set(String(s.id), String(s.kategori)));

    const waiverRows = await conn.query('SELECT * FROM keringanan_syahriyah');
    const waivers = waiverRows as Rows;
    const matrixRows = await conn.query('SELECT id, santri_id, tahun, bulan, total_dibayar FROM syahriyah_bulan');

    for (const row of matrixRows as Rows) {
      const ym = `${String(row.tahun)}-${String(row.bulan).padStart(2, '0')}`;
      if (ym < periodeMulai) continue;
      const kategori = kategoriById.get(String(row.santri_id)) || 'Mukim';
      if (kategori === 'Kilatan') continue;
      const tarif = Number(kategori === 'Nduduk' ? nilai.syahriyah_nduduk : nilai.syahriyah_mukim) || 0;
      const waiver = waivers.find(
        (w) =>
          String(w.santri_id) === String(row.santri_id) &&
          Number(w.tahun) === Number(row.tahun) &&
          Number(w.bulan_mulai) <= Number(row.bulan) &&
          Number(w.bulan_selesai) >= Number(row.bulan)
      );
      let potongan = 0;
      if (waiver) {
        const jenis = String(waiver.jenis || 'kustom');
        const nominal = Number(waiver.nominal_per_bulan) || 0;
        potongan = jenis === 'penuh' ? tarif : jenis === 'setengah' ? Math.round(tarif / 2) : Math.min(nominal, tarif);
      }
      const tagihan = Math.max(0, tarif - potongan);
      const dibayar = Number(row.total_dibayar) || 0;
      const status = tagihan === 0 || dibayar >= tagihan ? 'Lunas' : dibayar > 0 ? 'Sebagian' : 'Belum';
      await conn.execute(
        'UPDATE syahriyah_bulan SET nominal_tagihan = ?, status = ?, keringanan = ? WHERE id = ?',
        [tagihan, status, potongan > 0 ? 1 : 0, row.id]
      );
    }
  });
}

masterRoutes.put('/pengaturan/:kunci', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const kunci = requireText(req.params.kunci, 'Kunci');
  if (!('nilai' in (req.body || {}))) throw badRequest('Field nilai wajib diisi');
  await execute(
    `INSERT INTO pengaturan (kunci, nilai, updated_at, updated_by) VALUES (?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE nilai = VALUES(nilai), updated_at = NOW(), updated_by = VALUES(updated_by)`,
    [kunci, JSON.stringify(req.body.nilai), req.user?.id ?? null]
  );
  if (kunci === 'tarif') await sesuaikanTarifDiServer(req.body.nilai as Record<string, any>);
  res.json({ data: { kunci } });
}));

/* ── Users (tanpa mengembalikan password_hash) ── */
masterRoutes.get('/users', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (_req, res) => {
  const rows = await query<Rows>('SELECT id, nama, username, role, status, created_at, updated_at FROM users ORDER BY nama');
  res.json({ data: rows });
}));

masterRoutes.post('/users', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const nama = requireText(req.body?.nama, 'Nama');
  const username = requireText(req.body?.username, 'Username').toLowerCase();
  const password = requireText(req.body?.password, 'Password');
  if (password.length < 8) throw badRequest('Password minimal 8 karakter');
  const role = requireOneOf(req.body?.role, ['super_admin', 'admin', 'pemilik'] as const, 'Role');
  const id = newId('u');
  await execute(
    `INSERT INTO users (id, nama, username, password_hash, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'Aktif', NOW(), NOW())`,
    [id, nama, username, await hashPassword(password), role]
  );
  res.status(201).json({ data: { id, nama, username, role } });
}));

masterRoutes.put('/users/:id', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const rows = await query<Rows>('SELECT id FROM users WHERE id = ?', [id]);
  if (!rows[0]) throw notFound('User tidak ditemukan');
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const field of ['nama', 'role', 'status'] as const) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      sets.push(`\`${field}\` = ?`);
      params.push((req.body as Record<string, unknown>)[field]);
    }
  }
  if (typeof req.body?.password === 'string' && req.body.password.length >= 8) {
    sets.push('`password_hash` = ?');
    params.push(await hashPassword(req.body.password));
  }
  if (sets.length) {
    sets.push('`updated_at` = NOW()');
    params.push(id);
    await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  res.json({ data: { id } });
}));

masterRoutes.delete('/users/:id', requireAuth, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  if (req.user?.id === req.params.id) throw badRequest('Tidak dapat menghapus akun sendiri');
  const hasil = await execute('DELETE FROM users WHERE id = ?', [req.params.id]);
  if (!hasil.affectedRows) throw notFound('User tidak ditemukan');
  res.status(204).end();
}));
