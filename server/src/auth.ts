import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from 'express';
import { config, isProduction } from './config';
import { execute, query, type Rows } from './db';
import { asyncHandler, forbidden, HttpError } from './errors';

export type Role = 'super_admin' | 'admin' | 'pemilik';

export interface AuthUser {
  id: string;
  username: string;
  nama: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      csrfToken?: string;
    }
  }
}

export const SESSION_COOKIE = 'al_hidayah_sid';

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export async function createSession(userId: string): Promise<{ sid: string; csrf: string; maxAge: number }> {
  const sid = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const maxAge = config.sessionTtlHours * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAge);
  await execute(
    'INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())',
    [sid, userId, csrf, expiresAt]
  );
  return { sid, csrf, maxAge };
}

export async function destroySession(sid: string): Promise<void> {
  await execute('DELETE FROM sessions WHERE id = ?', [sid]);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

export const loadSession: RequestHandler = asyncHandler(async (req, res, next) => {
  const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!sid) return next();

  const rows = await query<Rows>(
    `SELECT s.csrf_token, s.expires_at, u.id, u.username, u.nama, u.role, u.status
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [sid]
  );
  const row = rows[0];
  const expired = row && new Date(String(row.expires_at)).getTime() < Date.now();

  if (!row || expired || row.status !== 'Aktif') {
    if (expired) await destroySession(sid).catch(() => undefined);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return next();
  }

  req.user = { id: String(row.id), username: String(row.username), nama: String(row.nama), role: row.role as Role };
  req.csrfToken = String(row.csrf_token);
  next();
});

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Login diperlukan', 'UNAUTHORIZED'));
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Login diperlukan', 'UNAUTHORIZED'));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.header('x-csrf-token');
  if (!req.csrfToken || !token || token !== req.csrfToken) return next(forbidden('Token CSRF tidak valid'));
  next();
};

export function setSessionCookie(
  res: Parameters<RequestHandler>[1],
  sid: string,
  maxAge: number
): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

export function timingSafeEqualKnown(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
