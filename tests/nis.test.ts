import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import { pendaftaranService } from '../src/lib/pendaftaranService';

beforeEach(() => {
  installLocalStorage();
});

test('generateAutoNis mulai dari 001 saat belum ada santri tahun berjalan', async () => {
  const year = new Date().getFullYear().toString();
  const nis = await pendaftaranService.generateAutoNis();
  assert.equal(nis, `${year}001`);
});

test('generateAutoNis melanjutkan urutan tertinggi santri tahun berjalan', async () => {
  const year = new Date().getFullYear().toString();
  const storage = installLocalStorage();
  storage.setItem(
    'al_hidayah_santri',
    JSON.stringify([
      { id: 's1', nis: `${year}005`, nama: 'A', nama_wali: 'W', no_hp_santri: '081', no_hp_wali: '082', kategori: 'Mukim', status: 'Aktif', tanggal_masuk: `${year}-01-01`, created_at: '', updated_at: '' },
      { id: 's2', nis: `${year}011`, nama: 'B', nama_wali: 'W', no_hp_santri: '081', no_hp_wali: '082', kategori: 'Mukim', status: 'Aktif', tanggal_masuk: `${year}-01-01`, created_at: '', updated_at: '' },
      { id: 's3', nis: '2024001', nama: 'C', nama_wali: 'W', no_hp_santri: '081', no_hp_wali: '082', kategori: 'Mukim', status: 'Aktif', tanggal_masuk: '2024-01-01', created_at: '', updated_at: '' },
    ])
  );
  const nis = await pendaftaranService.generateAutoNis();
  assert.equal(nis, `${year}012`);
});
