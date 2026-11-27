import { Router } from 'express';
import {
  createSession,
  destroySession,
  hashPassword,
  loadSession,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
} from '../auth';
import { execute, query, type Rows } from '../db';
import { asyncHandler, badRequest, conflict, HttpError } from '../errors';
import { newId } from '../id';
import { logActivity } from '../audit';
import { requireText } from '../validation';

export const authRoutes = Router();

authRoutes.get(
  '/setup-status',
  asyncHandler(async (_req, res) => {
    const rows = await query<Rows>('SELECT COUNT(*) AS jumlah FROM users');
    res.json({ data: { needsSetup: Number(rows[0]?.jumlah) === 0 } });
  })
);

authRoutes.post(
  '/setup',
  asyncHandler(async (req, res) => {
    const existing = await query<Rows>('SELECT COUNT(*) AS jumlah FROM users');
    if (Number(existing[0]?.jumlah) > 0) throw conflict('Super Admin sudah dibuat');

    const nama = requireText(req.body?.nama, 'Nama');
    const username = requireText(req.body?.username, 'Username').toLowerCase();
    const password = requireText(req.body?.password, 'Password');
    if (password.length < 8) throw badRequest('Password minimal 8 karakter');

    const id = newId('u');
    await execute(
      `INSERT INTO users (id, nama, username, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'super_admin', 'Aktif', NOW(), NOW())`,
      [id, nama, username, await hashPassword(password)]
    );
    await logActivity({
      modul: 'Pengaturan',
      aksi: 'Tambah',
      deskripsi: `Membuat Super Admin ${username}`,
      ref_id: id,
    });
    res.status(201).json({ data: { id, username, nama, role: 'super_admin' } });
  })
);

authRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = requireText(req.body?.username, 'Username').toLowerCase();
    const password = requireText(req.body?.password, 'Password');

    const rows = await query<Rows>('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, String(user.password_hash)))) {
      throw new HttpError(401, 'Username atau password salah', 'INVALID_CREDENTIALS');
    }
    if (user.status !== 'Aktif') throw new HttpError(403, 'Akun tidak aktif', 'ACCOUNT_INACTIVE');

    const session = await createSession(String(user.id));
    setSessionCookie(res, session.sid, session.maxAge);
    await logActivity({
      modul: 'Sistem',
      aksi: 'Login',
      deskripsi: `${user.nama} login`,
      ref_id: String(user.id),
      userId: String(user.id),
    });

    res.json({
      data: {
        user: { id: user.id, username: user.username, nama: user.nama, role: user.role },
        csrfToken: session.csrf,
      },
    });
  })
);

authRoutes.get('/me', loadSession, requireAuth, (req, res) => {
  res.json({ data: { user: req.user, csrfToken: req.csrfToken } });
});

authRoutes.post('/logout', loadSession, requireAuth, asyncHandler(async (req, res) => {
  const sid = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (sid) await destroySession(decodeURIComponent(sid));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ data: { ok: true } });
}));
