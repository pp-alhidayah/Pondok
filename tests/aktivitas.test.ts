import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import { ACTIVITY_LOG_KEY, activityLogService } from '../src/lib/activityLogService';
import { santriService } from '../src/lib/santriService';

const KEY_SANTRI = 'al_hidayah_santri';
const KEY_AUTH = 'al_hidayah_auth_user';

beforeEach(() => {
  installLocalStorage();
  localStorage.setItem(KEY_SANTRI, JSON.stringify([]));
  localStorage.removeItem(ACTIVITY_LOG_KEY);
  localStorage.removeItem(KEY_AUTH);
});

test('activityLogService.catat menyimpan entri terbaru di depan beserta username', () => {
  localStorage.setItem(KEY_AUTH, JSON.stringify({ username: 'admin1', role: 'admin', nama: 'Admin' }));

  activityLogService.catat({ modul: 'Kas', aksi: 'Tambah', deskripsi: 'Kas donasi', ref_id: 'k1' });
  activityLogService.catat({ modul: 'Santri', aksi: 'Ubah', deskripsi: 'Ubah santri', ref_id: 's1' });

  const list = activityLogService.getAll();
  assert.equal(list.length, 2);
  assert.equal(list[0].deskripsi, 'Ubah santri', 'entri terbaru muncul pertama');
  assert.equal(list[0].user, 'admin1');
  assert.equal(list[1].modul, 'Kas');
  assert.match(list[0].id, /^log_/);
});

test('activityLogService membatasi riwayat 500 entri terbaru', () => {
  for (let i = 0; i < 510; i += 1) {
    activityLogService.catat({ modul: 'Sistem', aksi: 'Login', deskripsi: `Aktivitas ${i}` });
  }

  const list = activityLogService.getAll();
  assert.equal(list.length, 500);
  assert.equal(list[0].deskripsi, 'Aktivitas 509');
});

test('santriService mencatat aktivitas tambah, ubah, hapus, dan impor', async () => {
  const santri = await santriService.createSantri({
    nis: '2026001',
    nama: 'Ahmad',
    nama_wali: 'Wali',
    no_hp_santri: '081234567890',
    no_hp_wali: '081234567891',
    kategori: 'Mukim',
    status: 'Aktif',
    tanggal_masuk: '2026-01-05',
  });
  await santriService.updateSantri(santri.id, { nama: 'Ahmad Fauzi' });
  await santriService.importSantri([{ nama: 'Budi' }]);
  await santriService.deleteSantri(santri.id);

  const list = activityLogService.getAll();
  assert.deepEqual(list.map((l) => l.aksi), ['Hapus', 'Impor', 'Ubah', 'Tambah']);
  assert.match(list[3].deskripsi, /Ahmad/);
  assert.equal(list[0].ref_id, santri.id);
});
