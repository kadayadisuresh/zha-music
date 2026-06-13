// One-off PWA icon generator — pure Node, no native deps.
// Renders a dark rounded square with a blue "play" triangle, matching the
// app's deep-navy UI + electric-blue accent (#2e7df7). Fully opaque so the same
// art works for maskable icons (the mark stays inside the center safe zone).
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const BG = [17, 26, 46]; // navy (zinc-900 remapped)
const FG = [46, 125, 247]; // electric blue accent (#2e7df7)

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// signed-area sign for point-in-triangle test
function sign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}
function inTriangle(px, py, t) {
  const d1 = sign(px, py, t[0], t[1], t[2], t[3]);
  const d2 = sign(px, py, t[2], t[3], t[4], t[5]);
  const d3 = sign(px, py, t[4], t[5], t[0], t[1]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function makePng(size) {
  const r = size * 0.18; // corner radius
  // Play triangle vertices (slightly nudged right for optical centering)
  const t = [
    size * 0.40, size * 0.30,
    size * 0.40, size * 0.70,
    size * 0.72, size * 0.50,
  ];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      // rounded-rect mask
      let inside = true;
      const cx = x < r ? r : x > size - r ? size - r : x;
      const cy = y < r ? r : y > size - r ? size - r : y;
      if (Math.hypot(x - cx, y - cy) > r) inside = false;
      let col = inside ? BG : [0, 0, 0];
      if (inside && inTriangle(x + 0.5, y + 0.5, t)) col = FG;
      raw[o++] = col[0];
      raw[o++] = col[1];
      raw[o++] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "public");
const targets = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-192-maskable.png", 192],
  ["icon-512-maskable.png", 512],
];
for (const [name, size] of targets) {
  fs.writeFileSync(path.join(outDir, name), makePng(size));
  console.log("wrote", name, size + "x" + size);
}
