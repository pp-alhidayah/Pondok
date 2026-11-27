/**
 * Smoke test backend Fase 3 terhadap MySQL/MariaDB nyata.
 * Jalankan server dulu: npm run server
 * Lalu: node server/tests/smoke.mjs
 */
import assert from 'node:assert/strict';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const API = 'http://localhost:3001';
const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'al_hidayah',
};

const tahun = new Date().getFullYear();
const tanggal = `${tahun}-01-10`;
const sql = await mysql.createConnection(DB);

async function api(path, { method = 'GET', token, csrf, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.cookie = token;
  if (csrf) headers['x-csrf-token'] = csrf;
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { status: response.status, payload, setCookie: response.headers.get('set-cookie') };
}

const cookieOf = (response) => (response.setCookie || '').split(';')[0];

async function login(username, password) {
  const response = await api('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  assert.equal(response.status, 200, `login gagal: ${JSON.stringify(response.payload)}`);
  return { token: cookieOf(response), csrf: response.payload.data.csrfToken };
}

async function seedSantri(id, nis) {
  await sql.execute(
    `INSERT INTO santri (id, nis, nama, nama_wali, no_hp_santri, no_hp_wali, kategori, status, tanggal_masuk, created_at, updated_at)
     VALUES (?, ?, ?, 'Wali Smoke', '081234567890', '081234567891', 'Mukim', 'Aktif', ?, NOW(), NOW())`,
    [id, nis, `Santri ${id}`, `${tahun}-01-01`]
  );
  await sql.execute(
    `INSERT INTO syahriyah_bulan (id, santri_id, tahun, bulan, nominal_tagihan, total_dibayar, status)
     VALUES (?, ?, ?, 1, 300000, 0, 'Belum')`,
    [`mat-${id}`, id, tahun]
  );
}

async function fibayar(auth, santriId, nominal) {
  const response = await api('/api/pembayaran/syahriyah', {
    method: 'POST',
    token: auth.token,
    csrf: auth.csrf,
    body: {
      santri_id: santriId,
      items: [{ tahun, bulan: 1, nominal, jenis: 'Penuh' }],
      tanggal_bayar: tanggal,
      metode: 'Tunai',
    },
  });
  assert.equal(response.status, 201, `bayar gagal: ${JSON.stringify(response.payload)}`);
  return response.payload.data;
}

async function main() {
  // Tunggu server siap.
  for (let i = 0; i < 30; i += 1) {
    try {
      const health = await fetch(`${API}/health`);
      if (health.ok) break;
    } catch {
      // belum siap
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const setup = await api('/api/auth/setup-status');
  assert.equal(setup.status, 200);
  if (setup.payload.data.needsSetup) {
    const created = await api('/api/auth/setup', {
      method: 'POST',
      body: { nama: 'Smoke Admin', username: 'smokeadmin', password: 'smoke12345' },
    });
    assert.equal(created.status, 201, `setup gagal: ${JSON.stringify(created.payload)}`);
  }
  const admin = await login('smokeadmin', 'smoke12345');

  // Bersihkan sisa test sebelumnya.
  await sql.execute('DELETE FROM buku_kas');
  await sql.execute('DELETE FROM transaksi_syahriyah');
  await sql.execute('DELETE FROM keringanan_syahriyah');
  await sql.execute('DELETE FROM syahriyah_bulan');
  await sql.execute('DELETE FROM santri WHERE id LIKE "smoke-%"');
  await sql.execute('DELETE FROM users WHERE username = "smokeview"');
  await sql.execute('UPDATE kuitansi_counter SET nilai_counter = 0');

  await seedSantri('smoke-s1', 'SMOKE001');
  await seedSantri('smoke-s2', 'SMOKE002');
  await seedSantri('smoke-s3', 'SMOKE003');

  // 1. pembayaran & rollback dasar
  const pertama = await fibayar(admin, 'smoke-s1', 300000);
  assert.match(pertama.nomor_kuitansi, /^AH\/\d{4}\/001$/);

  const [trx] = await sql.query('SELECT * FROM transaksi_syahriyah WHERE id = ?', [pertama.id]);
  const [kas] = await sql.query('SELECT * FROM buku_kas WHERE sumber_ref_id = ?', [pertama.id]);
  const [mat] = await sql.query('SELECT * FROM syahriyah_bulan WHERE santri_id = ?', ['smoke-s1']);
  assert.equal(trx.length, 1, 'transaksi tersimpan');
  assert.equal(kas[0].sumber_modul, 'syahriyah');
  assert.equal(kas[0].nominal, 300000);
  assert.equal(Number(mat[0].total_dibayar), 300000);
  assert.equal(mat[0].status, 'Lunas');
  console.log('✓ bayar syahriyah: transaksi + kas + matriks + kuitansi');

  // 2. konkurensi: dua pembayaran bersamaan harus dapat nomor berbeda
  const [a, b] = await Promise.all([
    fibayar(admin, 'smoke-s2', 150000),
    fibayar(admin, 'smoke-s2', 150000),
  ]);
  assert.notEqual(a.nomor_kuitansi, b.nomor_kuitansi, 'nomor kuitansi harus unik');
  const [counter] = await sql.query('SELECT nilai_counter FROM kuitansi_counter WHERE tahun = ?', [tahun]);
  assert.equal(Number(counter[0].nilai_counter), 3);
  console.log('✓ konkurensi: kuitansi unik & counter = 3');

  // 3. pembatalan: matriks & kas hilang, counter TIDAK mundur
  const batalkan = await api(`/api/pembayaran/syahriyah/${pertama.id}/batalkan`, {
    method: 'POST',
    token: admin.token,
    csrf: admin.csrf,
    body: {},
  });
  assert.equal(batalkan.status, 200, `batal gagal: ${JSON.stringify(batalkan.payload)}`);

  const [trx2] = await sql.query('SELECT * FROM transaksi_syahriyah WHERE id = ?', [pertama.id]);
  const [kas2] = await sql.query('SELECT * FROM buku_kas WHERE sumber_ref_id = ?', [pertama.id]);
  const [mat2] = await sql.query('SELECT * FROM syahriyah_bulan WHERE santri_id = ?', ['smoke-s1']);
  const [counter2] = await sql.query('SELECT nilai_counter FROM kuitansi_counter WHERE tahun = ?', [tahun]);
  assert.equal(trx2.length, 0);
  assert.equal(kas2.length, 0);
  assert.equal(Number(mat2[0].total_dibayar), 0);
  assert.equal(mat2[0].status, 'Belum');
  assert.equal(Number(counter2[0].nilai_counter), 3, 'counter tidak boleh mundur');
  console.log('✓ batalkan: rollback penuh, counter tetap maju');

  // 4. otorisasi: pemilik tidak bisa mutation
  const user = await api('/api/master/users', {
    method: 'POST',
    token: admin.token,
    csrf: admin.csrf,
    body: { nama: 'Smoke Viewer', username: 'smokeview', password: 'smoke12345', role: 'pemilik' },
  });
  assert.equal(user.status, 201);
  const viewer = await login('smokeview', 'smoke12345');
  const ditolak = await api('/api/master/santri', {
    method: 'POST',
    token: viewer.token,
    csrf: viewer.csrf,
    body: { nis: 'SMOKE999', nama: 'Tidak boleh' },
  });
  assert.equal(ditolak.status, 403, 'pemilik harus ditolak');
  console.log('✓ otorisasi: pemilik mendapat 403 untuk mutation');

  // 5. keringanan Super Admin: potong tagihan lalu cabut → kembali ke nominal asli
  const keringanan = await api('/api/keringanan/syahriyah', {
    method: 'POST',
    token: admin.token,
    csrf: admin.csrf,
    body: {
      santri_id: 'smoke-s3',
      tahun,
      bulan_mulai: 1,
      bulan_selesai: 1,
      nominal_per_bulan: 100000,
      keterangan: 'Smoke test',
    },
  });
  assert.equal(keringanan.status, 201, `keringanan gagal: ${JSON.stringify(keringanan.payload)}`);

  const [matKeringanan] = await sql.query(
    'SELECT nominal_tagihan FROM syahriyah_bulan WHERE santri_id = ? AND tahun = ? AND bulan = 1',
    ['smoke-s3', tahun]
  );
  assert.equal(Number(matKeringanan[0].nominal_tagihan), 200000, 'tagihan dipotong 100rb');

  const daftarKeringanan = await api(`/api/keringanan?santri_id=smoke-s3&tahun=${tahun}`, {
    token: admin.token,
  });
  assert.equal(daftarKeringanan.payload.data.length, 1);
  console.log('✓ keringanan super admin: tagihan 300rb menjadi 200rb');

  const cabut = await api(`/api/keringanan/${keringanan.payload.data.id}`, {
    method: 'DELETE',
    token: admin.token,
    csrf: admin.csrf,
  });
  assert.equal(cabut.status, 204);
  const [matPulih] = await sql.query(
    'SELECT nominal_tagihan FROM syahriyah_bulan WHERE santri_id = ? AND tahun = ? AND bulan = 1',
    ['smoke-s3', tahun]
  );
  assert.equal(Number(matPulih[0].nominal_tagihan), 300000, 'tagihan kembali setelah dicabut');
  console.log('✓ cabut keringanan: nominal asli dipulihkan');

  console.log('\nSMOKE TEST LULUS');
}

main()
  .catch((error) => {
    console.error('SMOKE TEST GAGAL:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
