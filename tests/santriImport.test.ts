import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import {
  normalizeKategori,
  normalizeStatus,
  normalizeTanggal,
  parseSantriImportRows,
} from '../src/lib/santriImport';
import { santriService } from '../src/lib/santriService';

const KEY_SANTRI = 'al_hidayah_santri';

beforeEach(() => {
  installLocalStorage();
  localStorage.setItem(KEY_SANTRI, JSON.stringify([]));
});

test('parseSantriImportRows membaca header Indonesia & menormalkan nilai', () => {
  const parsed = parseSantriImportRows([
    {
      NIS: '',
      'Nama Santri': '  Ahmad   Fauzi ',
      'Nama Wali': 'Bapak Fauzi',
      'No HP Santri': '08123',
      'No HP Wali': '08999',
      Kategori: 'nduduk',
      Status: 'nonaktif',
      'Tanggal Masuk': '05/01/2026',
      Catatan: '',
    },
  ]);

  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 1);
  const data = parsed.rows[0].data;
  assert.equal(data.nama, 'Ahmad Fauzi');
  assert.equal(data.kategori, 'Nduduk');
  assert.equal(data.status, 'Tidak Aktif');
  assert.equal(data.tanggal_masuk, '2026-01-05');
});

test('parseSantriImportRows melewati baris kosong dan menandai nama kosong / NIS duplikat', () => {
  const parsed = parseSantriImportRows([
    { 'Nama Santri': '', NIS: '' },
    { 'Nama Santri': 'Ahmad', NIS: '2026001' },
    { 'Nama Santri': 'Budi', NIS: '2026001' },
    { 'Nama Santri': '', NIS: '2026009' },
  ]);

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 2);
  assert.match(parsed.errors[0].message, /duplikat/i);
  assert.match(parsed.errors[1].message, /wajib diisi/i);
});

test('normalisasi kategori, status, dan tanggal', () => {
  assert.equal(normalizeKategori('kilatan'), 'Kilatan');
  assert.equal(normalizeKategori('tidak dikenal'), 'Mukim');
  assert.equal(normalizeStatus('Tidak Aktif'), 'Tidak Aktif');
  assert.equal(normalizeStatus('aktif'), 'Aktif');
  assert.equal(normalizeTanggal('2026-02-03'), '2026-02-03');
  assert.equal(normalizeTanggal('3/2/2026'), '2026-02-03');
});

test('importSantri menyimpan semua baris dan membuat NIS otomatis berurutan', async () => {
  const tahun = new Date().getFullYear();
  localStorage.setItem(
    KEY_SANTRI,
    JSON.stringify([
      {
        id: 's-lama',
        nis: `${tahun}004`,
        nama: 'Lama',
        nama_wali: '',
        no_hp_santri: '',
        no_hp_wali: '',
        kategori: 'Mukim',
        status: 'Aktif',
        tanggal_masuk: `${tahun}-01-01`,
        created_at: '',
        updated_at: '',
      },
    ])
  );

  const result = await santriService.importSantri([
    { nama: 'Ahmad', kategori: 'Mukim', status: 'Aktif', tanggal_masuk: '2026-01-05' },
    { nama: 'Budi', kategori: 'Kilatan', status: 'Tidak Aktif' },
  ]);

  assert.equal(result.jumlah, 2);
  assert.deepEqual(result.nis, [`${tahun}005`, `${tahun}006`]);

  const list = JSON.parse(localStorage.getItem(KEY_SANTRI) || '[]');
  assert.equal(list.length, 3);
  const budi = list.find((s: { nama: string }) => s.nama === 'Budi');
  assert.equal(budi.status, 'Tidak Aktif');
  assert.equal(budi.kategori, 'Kilatan');
  assert.equal(budi.tanggal_masuk.length, 10, 'tanggal masuk default terisi');
});

test('importSantri menolak NIS ganda dan tidak menyimpan sebagian data', async () => {
  await santriService.importSantri([{ nis: '2026001', nama: 'Ahmad' }]);

  await assert.rejects(
    santriService.importSantri([
      { nis: '2026002', nama: 'Budi' },
      { nis: '2026001', nama: 'Citra' },
    ]),
    /sudah digunakan/
  );

  const list = JSON.parse(localStorage.getItem(KEY_SANTRI) || '[]');
  assert.equal(list.length, 1, 'rollback: hanya data lama yang tersimpan');
  assert.equal(list[0].nis, '2026001');
});

test('parseSantriImportRows menolak baris dengan nama dan NIS sama persis', () => {
  const parsed = parseSantriImportRows([
    { NIS: '2026001', 'Nama Santri': 'Ahmad Fauzi' },
    { NIS: '2026001', 'Nama Santri': 'Ahmad Fauzi' },
    { NIS: '2026002', 'Nama Santri': 'Ahmad Fauzi' },
  ]);

  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0].message, /duplikat/i);
  assert.match(parsed.errors[0].message, /Ahmad Fauzi/);
  assert.equal(parsed.errors[0].row, 3);
});

test('importSantri menolak data dengan nama dan NIS sama dengan data tersimpan', async () => {
  await santriService.importSantri([{ nis: '2026001', nama: 'Ahmad Fauzi' }]);

  await assert.rejects(
    santriService.importSantri([
      { nis: '2026002', nama: 'Budi' },
      { nis: '2026001', nama: 'Ahmad Fauzi' },
    ]),
    /sudah ada|duplikat/i
  );

  const list = JSON.parse(localStorage.getItem(KEY_SANTRI) || '[]');
  assert.equal(list.length, 1, 'rollback: tidak ada data baru yang tersimpan');
});

test('nama sama dengan NIS berbeda tidak dianggap duplikat', async () => {
  const parsed = parseSantriImportRows([
    { NIS: '2026001', 'Nama Santri': 'Ahmad Fauzi' },
    { NIS: '2026002', 'Nama Santri': 'Ahmad Fauzi' },
  ]);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 2);

  await santriService.importSantri([{ nis: '2026001', nama: 'Ahmad Fauzi' }]);
  const hasil = await santriService.importSantri([{ nis: '2026002', nama: 'Ahmad Fauzi' }]);
  assert.equal(hasil.jumlah, 1);

  const list = JSON.parse(localStorage.getItem(KEY_SANTRI) || '[]');
  assert.equal(list.length, 2);
});
