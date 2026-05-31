import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const outDir = join(process.cwd(), 'assets', 'icons');
const sizes = [16, 32, 48, 64, 128, 256, 512];

const colors = {
  background: [247, 247, 242, 255],
  ink: [31, 36, 34, 255],
  teal: [27, 102, 95, 255],
  amber: [181, 119, 36, 255],
  light: [236, 242, 239, 255],
};

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function insideRoundRect(x, y, left, top, right, bottom, radius) {
  const clampedX = Math.max(left + radius, Math.min(x, right - radius));
  const clampedY = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - clampedX;
  const dy = y - clampedY;
  return dx * dx + dy * dy <= radius * radius;
}

function drawRoundRect(pixels, size, left, top, right, bottom, radius, color) {
  for (let y = Math.floor(top); y <= Math.ceil(bottom); y += 1) {
    for (let x = Math.floor(left); x <= Math.ceil(right); x += 1) {
      if (insideRoundRect(x, y, left, top, right, bottom, radius)) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function drawDiagonal(pixels, size, color, offset, thickness) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.abs(y - x + offset);
      if (distance < thickness) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function createPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(pixels, size, x, y, colors.background);
    }
  }

  drawDiagonal(pixels, size, colors.teal, size * 0.22, Math.max(2, size * 0.08));
  drawDiagonal(pixels, size, colors.amber, -size * 0.28, Math.max(2, size * 0.075));
  drawRoundRect(pixels, size, size * 0.20, size * 0.24, size * 0.80, size * 0.73, size * 0.12, colors.ink);
  drawRoundRect(pixels, size, size * 0.28, size * 0.32, size * 0.72, size * 0.58, size * 0.07, colors.light);

  for (let y = Math.floor(size * 0.61); y < Math.floor(size * 0.78); y += 1) {
    for (let x = Math.floor(size * 0.52); x < Math.floor(size * 0.66); x += 1) {
      if (y - size * 0.60 > Math.abs(x - size * 0.52) * 0.8) {
        setPixel(pixels, size, x, y, colors.ink);
      }
    }
  }

  const rawRows = [];
  for (let y = 0; y < size; y += 1) {
    rawRows.push(Buffer.from([0]));
    rawRows.push(pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rawRows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(outDir, { recursive: true });
for (const size of sizes) {
  await writeFile(join(outDir, `${size}x${size}.png`), createPng(size));
}

