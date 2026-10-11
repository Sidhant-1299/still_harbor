import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}
function pixel(x, y) {
  const distance = Math.hypot(x - 0.5, y - 0.5);
  if (distance > 0.48) return [0, 0, 0, 0];
  const wave = Math.sin((x - 0.25) * Math.PI * 4) * 0.037;
  const stroke = x > 0.22 && x < 0.78 && (Math.abs(y - (0.43 + wave)) < 0.022 || Math.abs(y - (0.57 + wave)) < 0.022);
  return stroke ? [70, 106, 87, 255] : [232, 238, 229, 255];
}
export async function generateIcons(directory) {
  for (const size of [16, 32, 48, 128]) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
    header[8] = 8; header[9] = 6;
    const rows = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const values = pixel((x + (sx + 0.5) / 3) / size, (y + (sy + 0.5) / 3) / size);
        values.forEach((value, channel) => { sum[channel] += value; });
      }
      sum.forEach((value, channel) => { rows[y * (size * 4 + 1) + 1 + x * 4 + channel] = Math.round(value / 9); });
    }
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
    await writeFile(`${directory}/icon-${size}.png`, png);
  }
}
