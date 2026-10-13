/* Generates the FCB U19 PWA icons (PNG) with zero dependencies.
 * Design: brand blue->green diagonal gradient, white football with a
 * black pentagon + stitches, "FCB U19" in a 5x7 bitmap font.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- tiny PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const encodePNG = (w, h, rgba) => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
};

// ---------- 5x7 font ----------
const FONT = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

// ---------- scene ----------
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BLUE = hex('#1e3a8a');
const GREEN = hex('#15803d');

const lerp = (a, b, t) => a + (b - a) * t;

function inPentagon(px, py, cx, cy, r, rot) {
  // convex point-in-polygon via cross products
  let prev = null;
  for (let i = 0; i < 5; i++) {
    const a1 = rot + (i * 2 * Math.PI) / 5;
    const a2 = rot + (((i + 1) % 5) * 2 * Math.PI) / 5;
    const ax = cx + r * Math.cos(a1);
    const ay = cy + r * Math.sin(a1);
    const bx = cx + r * Math.cos(a2);
    const by = cy + r * Math.sin(a2);
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (prev !== null && cross * prev < 0) return false;
    prev = cross;
  }
  return true;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function render(S) {
  const buf = Buffer.alloc(S * S * 4);
  const cx = S / 2;
  const cy = S * 0.42;
  const ballR = S * 0.254;
  const pentR = ballR * 0.38;
  const rot = -Math.PI / 2; // one vertex pointing up

  // pentagon vertex directions for stitches
  const stitchAngles = Array.from({ length: 5 }, (_, i) => rot + (i * 2 * Math.PI) / 5);

  const text = 'FCB U19';
  const scale = Math.max(2, Math.round((S * 8) / 512));
  const glyphW = 5 * scale;
  const gap = 1 * scale;
  const textW = text.length * glyphW + (text.length - 1) * gap;
  const textX = Math.round((S - textW) / 2);
  const textY = Math.round(S * 0.765);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      // background gradient
      const t = (x + y) / (2 * (S - 1));
      let r = lerp(BLUE[0], GREEN[0], t);
      let g = lerp(BLUE[1], GREEN[1], t);
      let b = lerp(BLUE[2], GREEN[2], t);

      const dBall = Math.hypot(x - cx, y - cy);

      if (dBall <= ballR) {
        // ball body: white with soft edge shading
        const edge = Math.min(1, (ballR - dBall) / (ballR * 0.18));
        const shade = 235 + 20 * edge;
        r = shade;
        g = shade;
        b = shade;

        const isPent = inPentagon(x, y, cx, cy, pentR, rot);
        let stitch = false;
        if (!isPent) {
          for (const a of stitchAngles) {
            const sx = cx + pentR * Math.cos(a);
            const sy = cy + pentR * Math.sin(a);
            const ex = cx + ballR * 0.72 * Math.cos(a);
            const ey = cy + ballR * 0.72 * Math.sin(a);
            if (distToSegment(x, y, sx, sy, ex, ey) <= Math.max(2, ballR * 0.045)) {
              stitch = true;
              break;
            }
          }
        }
        if (isPent || stitch) {
          r = 25;
          g = 30;
          b = 38;
        }
      }

      // text
      if (y >= textY && y < textY + 7 * scale && x >= textX && x < textX + textW) {
        const ch = text[Math.floor((x - textX) / (glyphW + gap))];
        const lx = (x - textX) % (glyphW + gap);
        if (lx < glyphW && ch && FONT[ch]) {
          const ly = y - textY;
          if (FONT[ch][Math.floor(ly / scale)][Math.floor(lx / scale)] === '1') {
            r = 255;
            g = 255;
            b = 255;
          }
        }
      }

      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

const out = (name, S) => {
  const p = path.join(__dirname, '..', 'public', name);
  fs.writeFileSync(p, encodePNG(S, S, render(S)));
  console.log('wrote', p);
};

out('icon-512.png', 512);
out('icon-192.png', 192);
out('apple-touch-icon.png', 180);
