import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildZip, crc32 } from '../src/lib/zipHelper';

function bacaZip(bytes: Uint8Array): Record<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, 'EOCD signature');

  const jumlah = view.getUint16(eocd + 8, true);
  const hasil: Record<string, Uint8Array> = {};
  let posisi = 0;

  for (let i = 0; i < jumlah; i += 1) {
    assert.equal(view.getUint32(posisi, true), 0x04034b50, 'lokal header signature');
    const ukuran = view.getUint32(posisi + 18, true);
    const panjangNama = view.getUint16(posisi + 26, true);
    const panjangExtra = view.getUint16(posisi + 28, true);
    const nama = new TextDecoder().decode(
      bytes.subarray(posisi + 30, posisi + 30 + panjangNama)
    );
    const mulaiData = posisi + 30 + panjangNama + panjangExtra;
    hasil[nama] = bytes.slice(mulaiData, mulaiData + ukuran);
    posisi = mulaiData + ukuran;
  }

  return hasil;
}

test('crc32 sesuai vektor standar "123456789"', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('buildZip menghasilkan arsip dengan nama file UTF-8 dan isi utuh', () => {
  const pesan = new TextEncoder().encode('Halo santri');
  const gambar = new Uint8Array([1, 2, 3, 4, 255]);

  const zip = buildZip([
    { name: 'PETUNJUK.txt', data: pesan },
    { name: 'foto/2026001_Ahmad Fauzi.jpg', data: gambar },
  ]);

  const isi = bacaZip(zip);
  assert.deepEqual(Object.keys(isi), [
    'PETUNJUK.txt',
    'foto/2026001_Ahmad Fauzi.jpg',
  ]);
  assert.equal(new TextDecoder().decode(isi['PETUNJUK.txt']), 'Halo santri');
  assert.deepEqual([...isi['foto/2026001_Ahmad Fauzi.jpg']], [...gambar]);
});

test('buildZip menulis jumlah entri di EOCD', () => {
  const zip = buildZip([
    { name: 'a.txt', data: new Uint8Array([65]) },
    { name: 'b.txt', data: new Uint8Array([66]) },
  ]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  assert.equal(view.getUint16(eocd + 8, true), 2);
  assert.equal(view.getUint16(eocd + 10, true), 2);
});
