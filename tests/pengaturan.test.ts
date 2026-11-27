import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import { DataRusakError } from '../src/lib/core';
import {
  DEFAULT_PROFIL,
  normalizeProfil,
  pengaturanService,
} from '../src/lib/pengaturanService';

test('normalizeProfil mengabaikan field asing dan nilai non-string', () => {
  const hasil = normalizeProfil({
    nama_pondok: 'Pondok Uji',
    ketua: 123,
    field_asing: 'tidak boleh ikut',
  });

  assert.equal(hasil.nama_pondok, 'Pondok Uji');
  assert.equal(hasil.ketua, DEFAULT_PROFIL.ketua);
  assert.ok(!('field_asing' in hasil));
});

test('getProfil melempar DataRusakError bila data tersimpan rusak (tidak ditimpa default)', async () => {
  const storage = installLocalStorage();
  storage.setItem('al_hidayah_profil', '{bukan json');
  await assert.rejects(pengaturanService.getProfil(), DataRusakError);
});

test('getProfil hanya memakai field profil yang valid', async () => {
  const storage = installLocalStorage();
  storage.setItem(
    'al_hidayah_profil',
    JSON.stringify({ nama_pondok: 'Pondok Uji', ketua: ['bukan', 'string'] })
  );

  const hasil = await pengaturanService.getProfil();
  assert.equal(hasil.nama_pondok, 'Pondok Uji');
  assert.equal(hasil.ketua, DEFAULT_PROFIL.ketua);
});
