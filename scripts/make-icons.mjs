// Gera os PNGs do icone (disco laranja com recorte de lua) sem dependencias.
// Uso: node scripts/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro "none"
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Amostragem 4x4 por pixel para as bordas nao ficarem serrilhadas.
const SS = 4;

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const R = size / 2;
  const cx = R, cy = R;
  // Circulo que "morde" o disco, deslocado para a direita e para cima.
  const mx = R * 1.30, my = R * 0.74, mr = R * 0.80;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const inDisc = (px - cx) ** 2 + (py - cy) ** 2 <= (R - size * 0.02) ** 2;
          const inBite = (px - mx) ** 2 + (py - my) ** 2 <= mr ** 2;
          if (inDisc && !inBite) {
            // Degrade diagonal do laranja da marca.
            const t = Math.min(1, Math.max(0, (px + py) / (2 * size)));
            acc[0] += 255 - t * 40;
            acc[1] += 122 - t * 52;
            acc[2] += 69 - t * 55;
            acc[3] += 255;
          }
        }
      }
      const n = SS * SS;
      const a = acc[3] / n;
      const i = (y * size + x) * 4;
      if (a > 0) {
        // acc de cor foi somado so nas amostras opacas; normaliza por elas.
        const opaque = acc[3] / 255;
        buf[i] = Math.round(acc[0] / opaque);
        buf[i + 1] = Math.round(acc[1] / opaque);
        buf[i + 2] = Math.round(acc[2] / opaque);
        buf[i + 3] = Math.round(a);
      }
    }
  }
  return buf;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, encodePNG(size, draw(size)));
  console.log(`${file} (${fs.statSync(file).size} bytes)`);
}
