import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAfterKeluar,
  isBeforeEntryEvent,
  isBulanDitagihkan,
  isBulanGapNonaktif,
  isValidCalendarDate,
  isValidMonth,
  requirePositiveInteger,
} from '../src/validation';

test('validator tanggal menolak tanggal kalender mustahil', () => {
  assert.equal(isValidCalendarDate('2026-99-99'), false);
  assert.equal(isValidCalendarDate('2026-02-29'), false);
  assert.equal(isValidCalendarDate('2024-02-29'), true);
  assert.equal(isValidCalendarDate('2026-11-20'), true);
  assert.equal(isValidCalendarDate('20/11/2026'), false);
});

test('validator bulan dan nominal', () => {
  assert.equal(isValidMonth('2026-13'), false);
  assert.equal(isValidMonth('2026-11'), true);
  assert.throws(() => requirePositiveInteger(0), /lebih dari 0/);
  assert.equal(requirePositiveInteger(50000), 50000);
});

test('periode tidak aktif: bulan sela tidak ditagih, bulan mulai & akhir tetap ditagih', () => {
  const periods = [{ mulai: '2026-03-10', sampai: '2026-06-05' }];
  assert.equal(isBulanGapNonaktif(periods, 2026, 3), false);
  assert.equal(isBulanGapNonaktif(periods, 2026, 4), true);
  assert.equal(isBulanGapNonaktif(periods, 2026, 5), true);
  assert.equal(isBulanGapNonaktif(periods, 2026, 6), false);

  assert.equal(isBulanDitagihkan('2026-01-01', 2026, 4, undefined, periods), false);
  assert.equal(isBulanDitagihkan('2026-01-01', 2026, 6, undefined, periods), true);
  assert.equal(isBulanDitagihkan('2026-05-01', 2026, 3), false, 'bulan sebelum masuk tidak ditagih');
});

test('tanggal keluar: bulan keluar masih ditagih, bulan berikutnya tidak', () => {
  assert.equal(isAfterKeluar('2026-05-20', 2026, 5), false);
  assert.equal(isAfterKeluar('2026-05-20', 2026, 6), true);
});

test('event kilatan sebelum tanggal masuk ditolak', () => {
  assert.equal(isBeforeEntryEvent('2026-05-01', 2026, 'Romadhon'), true);
  assert.equal(isBeforeEntryEvent('2026-02-01', 2026, 'Romadhon'), false);
  assert.equal(isBeforeEntryEvent('2025-01-01', 2026, 'Maulid'), false);
});
