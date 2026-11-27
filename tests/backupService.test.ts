import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import {
  BACKUP_APP_ID,
  BACKUP_VERSION,
  buildBackup,
  restoreBackup,
  validateBackup,
} from '../src/lib/backupService';

const envelope = (data: Record<string, unknown>) => ({
  app: BACKUP_APP_ID,
  version: BACKUP_VERSION,
  created_at: '2026-01-01T00:00:00.000Z',
  data,
});

test('backup hanya memuat key data dan tidak memuat sesi login', () => {
  const storage = installLocalStorage();
  storage.setItem('al_hidayah_santri', JSON.stringify([{ id: 's1' }]));
  storage.setItem('al_hidayah_auth_user', JSON.stringify({ username: 'superadmin' }));

  const backup = buildBackup(storage);

  assert.equal(backup.app, BACKUP_APP_ID);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.ok('al_hidayah_santri' in backup.data);
  assert.ok(!('al_hidayah_auth_user' in backup.data));
});

test('file asing ditolak', () => {
  const hasil = validateBackup({ hello: 'world' });
  assert.equal(hasil.ok, false);
});

test('file dengan struktur data rusak ditolak tanpa menulis apa pun', () => {
  const storage = installLocalStorage();
  storage.setItem('al_hidayah_santri', JSON.stringify([{ id: 'lama' }]));

  const invalid = envelope({ al_hidayah_santri: { bukan: 'array' } });

  assert.equal(validateBackup(invalid).ok, false);
  assert.throws(() => restoreBackup(invalid, storage), /tidak valid/);
  assert.deepEqual(JSON.parse(storage.getItem('al_hidayah_santri') as string), [
    { id: 'lama' },
  ]);
});

test('restore valid mengganti data tanpa menimpa sesi', () => {
  const storage = installLocalStorage();
  storage.setItem('al_hidayah_santri', JSON.stringify([{ id: 'lama' }]));
  storage.setItem('al_hidayah_auth_user', JSON.stringify({ username: 'sesi' }));

  const hasil = restoreBackup(
    envelope({ al_hidayah_santri: [{ id: 'baru' }] }),
    storage
  );

  assert.equal(hasil.restored, 1);
  assert.deepEqual(JSON.parse(storage.getItem('al_hidayah_santri') as string), [
    { id: 'baru' },
  ]);
  assert.deepEqual(JSON.parse(storage.getItem('al_hidayah_auth_user') as string), {
    username: 'sesi',
  });
});

test('backup lama (format datar) tetap dapat divalidasi', () => {
  const hasil = validateBackup({
    al_hidayah_santri: [{ id: 's1' }],
    al_hidayah_auth_user: { username: 'sesi' },
  });

  assert.equal(hasil.ok, true);
  if (hasil.ok) {
    assert.deepEqual(hasil.data, { al_hidayah_santri: [{ id: 's1' }] });
    assert.deepEqual(hasil.ignored, ['al_hidayah_auth_user']);
  }
});

test('matriks syahriyah divalidasi per baris (bulan, nominal, status)', () => {
  const matrixValid = {
    s1: { '2026': [{ tahun: 2026, bulan: 1, nominal_tagihan: 100000, total_dibayar: 0, status: 'Belum' }] },
  };
  assert.equal(validateBackup(envelope({ al_hidayah_syahriyah: matrixValid })).ok, true);

  const matrixRusak = {
    s1: { '2026': [{ tahun: 2026, bulan: 13, nominal_tagihan: 100000, total_dibayar: 0, status: 'Belum' }] },
  };
  assert.equal(validateBackup(envelope({ al_hidayah_syahriyah: matrixRusak })).ok, false);
});

test('backup dengan relasi yatim ditolak', () => {
  const data = {
    al_hidayah_santri: [{ id: 's1' }],
    al_hidayah_syahriyah_transaksi: [
      {
        id: 'trx-1',
        santri_id: 's2',
        items: [],
        transaksi_data: { tanggal_bayar: '2026-01-10' },
        total_pembayaran: 100000,
      },
    ],
  };
  const hasil = validateBackup(envelope(data));
  assert.equal(hasil.ok, false);
  if (!hasil.ok) assert.match(hasil.message, /santri "s2" yang tidak ada/);
});
