import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import { santriService } from '../src/lib/santriService';
import { isValidFotoDataUrl } from '../src/lib/fotoSantri';

const KEY_SANTRI = 'al_hidayah_santri';
const FOTO_JPEG = 'data:image/jpeg;base64,AAAA';
const FOTO_PNG = 'data:image/png;base64,BBBB';

const dataDasar = {
  nis: '2026099',
  nama: 'Uji Foto',
  nama_wali: 'Wali Uji',
  no_hp_santri: '081234567890',
  no_hp_wali: '081234567891',
  kategori: 'Mukim' as const,
  status: 'Aktif' as const,
  tanggal_masuk: '2026-01-05',
};

beforeEach(() => {
  installLocalStorage();
  localStorage.setItem(KEY_SANTRI, JSON.stringify([]));
});

test('foto tersimpan saat create dan terbaca kembali', async () => {
  const dibuat = await santriService.createSantri({ ...dataDasar, foto: FOTO_JPEG });
  assert.equal(dibuat.foto, FOTO_JPEG);

  const ditemukan = await santriService.getSantriById(dibuat.id);
  assert.equal(ditemukan?.foto, FOTO_JPEG);
});

test('foto bisa diganti dan dihapus lewat update', async () => {
  const dibuat = await santriService.createSantri({ ...dataDasar, foto: FOTO_JPEG });

  const diganti = await santriService.updateSantri(dibuat.id, { foto: FOTO_PNG });
  assert.equal(diganti.foto, FOTO_PNG);

  const dihapus = await santriService.updateSantri(dibuat.id, { foto: '' });
  assert.equal(dihapus.foto, '');
  assert.equal((await santriService.getSantriById(dibuat.id))?.foto, '');
});

test('update tanpa field foto tidak menghapus foto lama', async () => {
  const dibuat = await santriService.createSantri({ ...dataDasar, foto: FOTO_JPEG });
  const diubah = await santriService.updateSantri(dibuat.id, { nama: 'Uji Foto Revisi' });
  assert.equal(diubah.foto, FOTO_JPEG);
});

test('isValidFotoDataUrl hanya menerima data URL gambar', () => {
  assert.equal(isValidFotoDataUrl(FOTO_JPEG), true);
  assert.equal(isValidFotoDataUrl('https://contoh.com/foto.jpg'), false);
  assert.equal(isValidFotoDataUrl(''), false);
  assert.equal(isValidFotoDataUrl(null), false);
});
