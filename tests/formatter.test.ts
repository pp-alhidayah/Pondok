import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRupiah,
  formatSaldo,
  formatThousand,
  parseThousand,
  formatTanggalTable,
} from '../src/lib/formatter';

test('formatRupiah tidak menampilkan tagihan negatif', () => {
  assert.equal(formatRupiah(-5000), formatRupiah(0));
  assert.ok(formatRupiah(150000).includes('150.000'));
});

test('formatSaldo mempertahankan nilai negatif', () => {
  const hasil = formatSaldo(-5000);
  assert.ok(hasil.includes('5.000'));
  assert.ok(hasil.includes('-'));
});

test('formatTanggalTable memakai format dd-mmm-yyyy', () => {
  assert.equal(formatTanggalTable('2026-11-24'), '24-Nov-2026');
  assert.equal(formatTanggalTable('2026-05-07'), '07-Mei-2026');
  assert.equal(formatTanggalTable(''), '-');
  assert.equal(formatTanggalTable(undefined), '-');
  assert.equal(formatTanggalTable('bukan-tanggal'), 'bukan-tanggal');
});

test('formatThousand dan parseThousand menangani input ribuan', () => {
  assert.equal(formatThousand(1500000), '1.500.000');
  assert.equal(parseThousand('Rp 1.500.000'), 1500000);
  assert.equal(parseThousand(''), 0);
});
