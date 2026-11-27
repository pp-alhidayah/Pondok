import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import {
  KEY_NOMOR_KUITANSI,
  hasRiwayatPembayaran,
  isBulanDitagihkan,
  isNominalValid,
  isAfterKeluar,
  isBulanGapNonaktif,
  nextNomorKuitansi,
  isValidCalendarDate,
  isValidYearMonth,
} from '../src/lib/core';

beforeEach(() => {
  installLocalStorage();
});

test('validator tanggal kalender terpusat menolak tanggal mustahil', () => {
  assert.equal(isValidCalendarDate('2026-11-20'), true);
  assert.equal(isValidCalendarDate('2024-02-29'), true, 'tahun kabut');
  assert.equal(isValidCalendarDate('2026-02-29'), false);
  assert.equal(isValidCalendarDate('2026-99-99'), false);
  assert.equal(isValidCalendarDate('2026-04-31'), false);
  assert.equal(isValidCalendarDate('20/11/2026'), false);

  assert.equal(isValidYearMonth('2026-11'), true);
  assert.equal(isValidYearMonth('2026-13'), false);
  assert.equal(isValidYearMonth('1999-01'), false);
});

test('isNominalValid hanya menerima rupiah bulat lebih dari 0', () => {
  assert.equal(isNominalValid(1), true);
  assert.equal(isNominalValid(150000), true);
  assert.equal(isNominalValid(0), false);
  assert.equal(isNominalValid(-1), false);
  assert.equal(isNominalValid(1.5), false);
  assert.equal(isNominalValid(Number.NaN), false);
});

test('nextNomorKuitansi berurutan per tahun', () => {
  const storage = installLocalStorage();
  assert.equal(nextNomorKuitansi(2026), 'AH/2026/0001');
  assert.equal(nextNomorKuitansi(2026), 'AH/2026/0002');
  assert.equal(nextNomorKuitansi(2027), 'AH/2027/0001');
  assert.deepEqual(JSON.parse(storage.getItem(KEY_NOMOR_KUITANSI) as string), {
    '2026': 2,
    '2027': 1,
  });
});

test('nextNomorKuitansi merekonsiliasi counter dengan nomor yang sudah terpakai', () => {
  const storage = installLocalStorage();
  storage.setItem(
    'al_hidayah_syahriyah_transaksi',
    JSON.stringify([{ id: 'st-1', nomor_kuitansi: 'AH/2026/0007' }])
  );
  storage.setItem(
    'al_hidayah_kilatan_transaksi',
    JSON.stringify([{ id: 'kt-1', nomor_kuitansi: 'AH/2026/0003' }])
  );
  storage.setItem(KEY_NOMOR_KUITANSI, JSON.stringify({ '2026': 2 }));

  assert.equal(nextNomorKuitansi(2026), 'AH/2026/0008');
  assert.equal(nextNomorKuitansi(2026), 'AH/2026/0009');
});

test('hasRiwayatPembayaran mendeteksi pembayaran di matriks dan transaksi iuran', () => {
  const storage = installLocalStorage();
  assert.equal(hasRiwayatPembayaran('s1'), false);

  storage.setItem(
    'al_hidayah_syahriyah',
    JSON.stringify({ s1: { 2026: [{ total_dibayar: 1000 }] } })
  );
  assert.equal(hasRiwayatPembayaran('s1'), true);

  storage.clear();
  storage.setItem('al_hidayah_iuran_pembayaran', JSON.stringify([{ santri_id: 's2' }]));
  assert.equal(hasRiwayatPembayaran('s2'), true);
});

test('isBulanDitagihkan: bulan sebelum masuk dan setelah keluar tidak ditagih', () => {
  // Dengan tanggal keluar: bulan keluar masih ditagih, bulan setelahnya tidak
  assert.equal(isBulanDitagihkan('2024-07-01', 2024, 3), false, 'sebelum masuk');
  assert.equal(isBulanDitagihkan('2024-07-01', 2024, 7), true, 'bulan masuk');
  assert.equal(isBulanDitagihkan('2024-07-01', 2024, 8, '2024-08-10'), true, 'bulan keluar masih ditagih');
  assert.equal(isBulanDitagihkan('2024-07-01', 2024, 9, '2024-08-10'), false, 'setelah keluar');
  assert.equal(isBulanDitagihkan('2024-07-01', 2024, 12), true, 'tanpa keluar tetap ditagih');
});

test('isAfterKeluar: false tanpa tanggal keluar, true hanya untuk bulan > bulan keluar', () => {
  assert.equal(isAfterKeluar(undefined, 2024, 12), false);
  assert.equal(isAfterKeluar('not-a-date', 2024, 12), false);
  assert.equal(isAfterKeluar('2024-08-10', 2024, 8), false);
  assert.equal(isAfterKeluar('2024-08-10', 2024, 9), true);
  assert.equal(isAfterKeluar('2024-08-10', 2025, 3), true);
});

test('isBulanGapNonaktif: bulan sela tidak aktif tidak ditagih, bulan keluar & aktif kembali tetap ditagih', () => {
  // Skenario bug: tidak aktif mulai Juli 2024, aktif kembali Desember 2024.
  // Juli ditagih (bulan penonaktifan), Ags-Nov tidak, Des ditagih lagi.
  const periode = [{ mulai: '2024-07-15', sampai: '2024-12-05' }];
  assert.equal(isBulanGapNonaktif(periode, 2024, 7), false, 'bulan penonaktifan masih ditagih');
  assert.equal(isBulanGapNonaktif(periode, 2024, 8), true, 'sela: tidak ditagih');
  assert.equal(isBulanGapNonaktif(periode, 2024, 9), true, 'sela: tidak ditagih');
  assert.equal(isBulanGapNonaktif(periode, 2024, 10), true, 'sela: tidak ditagih');
  assert.equal(isBulanGapNonaktif(periode, 2024, 11), true, 'sela: tidak ditagih');
  assert.equal(isBulanGapNonaktif(periode, 2024, 12), false, 'bulan pengaktifan kembali ditagih lagi');
  assert.equal(isBulanGapNonaktif(periode, 2025, 1), false, 'setelah aktif kembali ditagih');

  // Periode terbuka (masih tidak aktif): semua setelah mulai tidak ditagih
  const terbuka = [{ mulai: '2026-07-10' }];
  assert.equal(isBulanGapNonaktif(terbuka, 2026, 7), false);
  assert.equal(isBulanGapNonaktif(terbuka, 2026, 10), true);
});

test('isBulanDitagihkan: bulan sela tetap TIDAK ditagih setelah santri diaktifkan kembali', () => {
  const masuk = '2024-01-01';
  const periode = [{ mulai: '2024-07-15', sampai: '2024-12-05' }];
  const tglKeluar = '2024-07-15';

  // Bila tidak ada riwayat periode, tanggal keluar bisa membuat ragu —
  // dengan riwayat periode, hasil pasti konsisten:
  assert.equal(isBulanDitagihkan(masuk, 2024, 7, tglKeluar, periode), true);
  assert.equal(isBulanDitagihkan(masuk, 2024, 9, tglKeluar, periode), false, 'sela: tidak ditagih');
  assert.equal(isBulanDitagihkan(masuk, 2024, 12, tglKeluar, periode), true);
  assert.equal(isBulanDitagihkan(masuk, 2025, 2, tglKeluar, periode), true);

  // Riwayat terbuka (masih tidak aktif sampai sekarang)
  const terbuka = [{ mulai: '2024-07-15' }];
  assert.equal(isBulanDitagihkan(masuk, 2024, 10, tglKeluar, terbuka), false);

  // Fallback data lama (tanpa riwayat periode) tetap berjalan
  assert.equal(isBulanDitagihkan(masuk, 2024, 9, tglKeluar), false);
  assert.equal(isBulanDitagihkan(masuk, 2024, 9), true);
});
