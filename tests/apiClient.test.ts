import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, apiRequest, setCsrfToken } from '../src/lib/apiClient';

const fetchAsli = globalThis.fetch;

function stubFetch(status: number, body: string, contentType = 'application/json') {
  globalThis.fetch = (async () =>
    new Response(body, { status, headers: { 'Content-Type': contentType } })) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = fetchAsli;
  setCsrfToken(undefined);
});

test('apiRequest menerjemahkan 403 menjadi pesan izin', async () => {
  stubFetch(403, JSON.stringify({ message: 'Forbidden', code: 'FORBIDDEN' }));

  await assert.rejects(
    () => apiRequest('/api/master/santri'),
    (err: unknown) =>
      err instanceof ApiError &&
      err.status === 403 &&
      /tidak memiliki izin/i.test(err.message) &&
      err.code === 'FORBIDDEN'
  );
});

test('apiRequest menerjemahkan 401 menjadi pesan sesi berakhir', async () => {
  stubFetch(401, JSON.stringify({ message: 'UNAUTHORIZED' }));

  await assert.rejects(
    () => apiRequest('/api/master/santri'),
    (err: unknown) => err instanceof ApiError && err.status === 401 && /sesi/i.test(err.message)
  );
});

test('apiRequest menerjemahkan 5xx walau respons bukan JSON', async () => {
  stubFetch(502, '<html>Bad Gateway</html>', 'text/html');

  await assert.rejects(
    () => apiRequest('/api/master/santri'),
    (err: unknown) => err instanceof ApiError && err.status === 502 && /server sedang bermasalah/i.test(err.message)
  );
});

test('apiRequest memberi pesan koneksi saat fetch gagal', async () => {
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;

  await assert.rejects(
    () => apiRequest('/api/master/santri'),
    (err: unknown) => err instanceof ApiError && err.status === 0 && /terhubung ke server/i.test(err.message)
  );
});
