import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, requireCsrf, requireRole, verifyPassword } from '../src/auth';
import type { Request } from 'express';

function fakeReq(method: string, token?: string, csrf?: string, role?: string): Request {
  return {
    method,
    header: (name: string) => (name === 'x-csrf-token' ? token : undefined),
    user: role ? { id: 'u1', username: 'admin', nama: 'Admin', role: role as 'admin' } : undefined,
    csrfToken: csrf,
  } as unknown as Request;
}

test('password di-hash bcrypt dan bisa diverifikasi', async () => {
  const hash = await hashPassword('rahasia123');
  assert.notEqual(hash, 'rahasia123');
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await verifyPassword('rahasia123', hash), true);
  assert.equal(await verifyPassword('salah', hash), false);
});

test('CSRF hanya diperlukan untuk mutation', () => {
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  requireCsrf(fakeReq('GET'), {} as never, next);
  assert.equal(nextCalled, true);

  let denied = false;
  requireCsrf(fakeReq('POST', 'salah', 'benar'), {} as never, () => { denied = true; });
  assert.equal(denied, true);
  assert.equal(nextCalled, true);
});

test('role pemilik ditolak untuk operasi tulis', () => {
  let status: number | undefined;
  requireRole('super_admin', 'admin')(
    fakeReq('POST', undefined, undefined, 'pemilik'),
    {} as never,
    (error?: unknown) => { status = (error as { status?: number })?.status; }
  );
  assert.equal(status, 403);
});
