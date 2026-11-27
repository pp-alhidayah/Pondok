import test from 'node:test';
import assert from 'node:assert/strict';
import { hitungPotongan, labelKeringanan } from '../src/lib/waiverService';

test('potongan penuh dan setengah mengikuti tarif', () => {
  assert.equal(hitungPotongan('penuh', 0, 150000), 150000);
  assert.equal(hitungPotongan('setengah', 0, 150000), 75000);
  assert.equal(hitungPotongan('setengah', 0, 50000), 25000);
});

test('potongan kustom tidak boleh melebihi tarif', () => {
  assert.equal(hitungPotongan('kustom', 50000, 150000), 50000);
  assert.equal(hitungPotongan('kustom', 200000, 150000), 150000);
});

test('label keringanan singkat', () => {
  assert.equal(labelKeringanan({ jenis: 'penuh', nominal_per_bulan: 0 }), 'Keringanan Penuh');
  assert.equal(labelKeringanan({ jenis: 'setengah', nominal_per_bulan: 0 }), 'Keringanan 50%');
  assert.equal(
    labelKeringanan({ jenis: 'kustom', nominal_per_bulan: 50000 }),
    'Keringanan Rp 50.000'
  );
});
