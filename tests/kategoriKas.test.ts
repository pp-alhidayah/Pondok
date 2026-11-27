import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/localStorage';
import {
  DEFAULT_KATEGORI_KAS,
  getKategoriKas,
  saveKategoriKas,
} from '../src/lib/kategoriKas';

test('kategori kas memakai default saat data belum ada', () => {
  installLocalStorage();
  assert.deepEqual(getKategoriKas(), DEFAULT_KATEGORI_KAS);
});

test('kategori kas menormalkan duplikat dan nilai kosong', () => {
  const storage = installLocalStorage();
  saveKategoriKas({
    pemasukan: ['  Donasi ', 'Donasi', '', 'Iuran'],
    pengeluaran: ['Listrik', 'Listrik'],
  });

  assert.deepEqual(getKategoriKas(), {
    pemasukan: ['Donasi', 'Iuran'],
    pengeluaran: ['Listrik'],
  });
  assert.ok(storage.getItem('al_hidayah_kategori_kas'));
});

test('kategori kas kembali ke default bila data rusak', () => {
  const storage = installLocalStorage();
  storage.setItem('al_hidayah_kategori_kas', '{rusak');
  assert.deepEqual(getKategoriKas(), DEFAULT_KATEGORI_KAS);
});
