// 앱 아이콘 생성: node tools/make-icons.js
// 게임과 같은 sprites.js 코드로 웅심이·옹심이를 찍어 PNG로 저장한다 (외부 라이브러리 없음).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const root = path.join(__dirname, '..');

// ── 아주 작은 캔버스 흉내 (sprites.js가 쓰는 기능만) ─────────────────
function parseColor(c) {
  if (c[0] === '#') {
    let h = c.slice(1); if (h.length === 3) h = [...h].map(x => x + x).join('');
    const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/); const p = m[1].split(',').map(Number);
  return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
}
class Canvas {
  constructor(w = 0, h = 0) { this._w = w; this._h = h; this.data = new Uint8ClampedArray(w * h * 4); }
  get width() { return this._w; } set width(v) { this._w = v; this.data = new Uint8ClampedArray(v * this._h * 4); }
  get height() { return this._h; } set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * v * 4); }
  getContext() { return new Ctx(this); }
}
class Ctx {
  constructor(c) { this.c = c; this.fillStyle = '#000'; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; }
  blend(i, r, g, b, a) {
    const d = this.c.data;
    if (this.globalCompositeOperation === 'source-atop' && d[i + 3] === 0) return;
    const da = d[i + 3] / 255, oa = a + da * (1 - a);
    if (this.globalCompositeOperation === 'source-atop') { d[i] = r * a + d[i] * (1 - a); d[i + 1] = g * a + d[i + 1] * (1 - a); d[i + 2] = b * a + d[i + 2] * (1 - a); return; }
    if (oa <= 0) return;
    d[i] = (r * a + d[i] * da * (1 - a)) / oa; d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa; d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa; d[i + 3] = oa * 255;
  }
  fillRect(x, y, w, h) {
    const [r, g, b, a0] = parseColor(this.fillStyle), a = a0 * this.globalAlpha, W = this.c.width, H = this.c.height;
    for (let yy = Math.max(0, Math.round(y)); yy < Math.min(H, Math.round(y + h)); yy++)
      for (let xx = Math.max(0, Math.round(x)); xx < Math.min(W, Math.round(x + w)); xx++) this.blend((yy * W + xx) * 4, r, g, b, a);
  }
  drawImage(src, dx = 0, dy = 0, dw, dh) {
    const sw = src.width, sh = src.height; dw = dw || sw; dh = dh || sh;
    const W = this.c.width, H = this.c.height;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const tx = Math.round(dx) + x, ty = Math.round(dy) + y;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const si = (Math.floor(y * sh / dh) * sw + Math.floor(x * sw / dw)) * 4, s = src.data;
      if (s[si + 3]) this.blend((ty * W + tx) * 4, s[si], s[si + 1], s[si + 2], s[si + 3] / 255 * this.globalAlpha);
    }
  }
  getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(this.c.data) }; }
  putImageData(img) { this.c.data.set(img.data); }
  save() { } restore() { } translate() { } scale() { }
}
const ctx = { console, Math, Promise, fetch: () => Promise.reject(), Image: class { }, document: { createElement: () => new Canvas() } };
vm.createContext(ctx);
for (const f of ['js/util.js', 'js/sprites.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
vm.runInContext('SPR.build()', ctx);
const frames = vm.runInContext('SPR.frames', ctx);
const C = vm.runInContext('C', ctx);

// ── 아이콘 구성 (픽셀 단위) ─────────────────
function compose(size, pad) {
  const c = new Canvas(size, size), g = c.getContext();
  g.fillStyle = C.orange; g.fillRect(0, 0, size, size);
  g.fillStyle = '#e8733f'; for (let y = 0; y < size; y += 4) g.fillRect(0, y, size, 1);
  const ground = size - pad - 7;
  g.fillStyle = C.green; g.fillRect(0, ground, size, size - ground);
  g.fillStyle = C.yellow; g.fillRect(0, ground, size, 1);
  g.fillStyle = C.dgreen; g.fillRect(0, ground + 3, size, size - ground - 3);
  const put = (name, x, y) => { const f = frames[name]; g.drawImage(f.c, x - f.ox, y - f.oy); };
  const cx = Math.floor(size / 2), feet = ground + 3;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 7, feet - 1, 14, 2);
  put('woong_frontcheer', cx, feet);
  put('ong_frontcheer', cx, feet - 26);
  // 공
  put('ball0', cx + 16, feet - 3);
  return c;
}
function scaleUp(src, k) { const c = new Canvas(src.width * k, src.height * k); c.getContext().drawImage(src, 0, 0, c.width, c.height); return c; }

// ── PNG 인코더 ─────────────────
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
}
function png(c) {
  const W = c.width, H = c.height, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(c.data.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(root, 'icons'); fs.mkdirSync(out, { recursive: true });
const base = compose(64, 2), mask = compose(80, 10);
const files = { 'icon-192.png': scaleUp(base, 3), 'icon-512.png': scaleUp(base, 8), 'apple-touch-icon.png': scaleUp(base, 3), 'icon-maskable-512.png': scaleUp(mask, 6.4) };
for (const [n, c] of Object.entries(files)) { fs.writeFileSync(path.join(out, n), png(c)); console.log('icons/' + n, c.width + 'x' + c.height); }
