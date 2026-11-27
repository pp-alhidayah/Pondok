import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectedItems, toggleSelectAll, toggleSelected } from '../src/lib/bulkSelection';

const semua = ['a', 'b', 'c'];

test('toggleSelected menambah dan menghapus pilihan', () => {
  assert.deepEqual(toggleSelected([], 'a'), ['a']);
  assert.deepEqual(toggleSelected(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleSelected(['a', 'b'], 'a'), ['b']);
});

test('toggleSelectAll memilih semua lalu membatalkan semuanya', () => {
  assert.deepEqual(toggleSelectAll([], semua), semua);
  assert.deepEqual(toggleSelectAll(['b'], semua), ['b', 'a', 'c']);
  assert.deepEqual(toggleSelectAll(semua, semua), []);
  assert.deepEqual(toggleSelectAll(['a'], []), []);
});

test('selectedItems hanya mengembalikan data yang dipilih sesuai urutan tabel', () => {
  const data = [
    { id: 'a', nama: 'A' },
    { id: 'b', nama: 'B' },
    { id: 'c', nama: 'C' },
  ];
  assert.deepEqual(selectedItems(data, ['c', 'a']), [data[0], data[2]]);
  assert.deepEqual(selectedItems(data, []), []);
});
