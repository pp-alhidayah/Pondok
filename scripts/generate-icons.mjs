import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** PNG polos berwarna emerald (#059669), cocok untuk icon maskable. */
function buatPng(size, target) {
  const baris = Buffer.alloc(size * 4 + 1);
  for (let x = 0; x < size; x += 1) {
    baris[x * 4 + 1] = 5;     // R
    baris[x * 4 + 2] = 150;   // G
    baris[x * 4 + 3] = 105;   // B
    baris[x * 4 + 4] = 255;   // A
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => baris));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(target, png);
  console.log(`${target} (${size}x${size})`);
}

mkdirSync('public/icons', { recursive: true });
buatPng(192, 'public/icons/icon-192.png');
buatPng(512, 'public/icons/icon-512.png');
