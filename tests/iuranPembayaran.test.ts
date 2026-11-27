import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import { DataRusakError } from '../src/lib/core';
import { iuranPembayaranService } from '../src/lib/iuranPembayaranService';

test('getIuranTambahan melempar DataRusakError bila data rusak', async () => {
  installLocalStorage();
  localStorage.setItem('al_hidayah_iuran_tambahan', '{bukan json');
  await assert.rejects(iuranPembayaranService.getIuranTambahan(), DataRusakError);

  localStorage.setItem('al_hidayah_iuran_tambahan', JSON.stringify({ bukan: 'array' }));
  await assert.rejects(iuranPembayaranService.getIuranTambahan(), DataRusakError);
});

const MASTER_IURAN = [
  {
    id: 'mi-haul',
    nama: 'Haul',
    nominal_default: 100000,
    jenis_periode: 'tahunan',
    status: 'Aktif',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

const pembayaran = (nominal: number, nama = 'Ahmad') => ({
  iuran_id: 'mi-haul',
  tipe_pembayar: 'umum' as const,
  nama_pembayar: nama,
  periode_tahun: 2026,
  nominal,
  tanggal_bayar: '2026-01-15',
});

beforeEach(() => {
  const storage = installLocalStorage();
  storage.setItem('al_hidayah_master_iuran', JSON.stringify(MASTER_IURAN));
});

test('menolak nominal 0 dan pecahan', async () => {
  await assert.rejects(
    iuranPembayaranService.catatPembayaran(pembayaran(0)),
    /lebih dari 0/
  );
  await assert.rejects(
    iuranPembayaranService.catatPembayaran(pembayaran(1000.5)),
    /lebih dari 0/
  );
});

test('menerima cicilan tetapi menolak pembayaran melebihi sisa tagihan', async () => {
  await iuranPembayaranService.catatPembayaran(pembayaran(60000));

  await assert.rejects(
    iuranPembayaranService.catatPembayaran(pembayaran(50000)),
    /melebihi sisa/
  );

  await iuranPembayaranService.catatPembayaran(pembayaran(40000));

  await assert.rejects(
    iuranPembayaranService.catatPembayaran(pembayaran(1)),
    /sudah lunas/
  );
});

test('menganggap nama pembayar sama tanpa membedakan huruf besar/kecil', async () => {
  await iuranPembayaranService.catatPembayaran(pembayaran(60000, 'Ahmad'));

  await assert.rejects(
    iuranPembayaranService.catatPembayaran(pembayaran(50000, '  ahmad ')),
    /melebihi sisa/
  );
});
