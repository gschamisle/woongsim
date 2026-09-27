'use strict';
// ─────────────────────────────────────────────
// 공통 상수 · 도우미 · 3x5 전광판 픽셀 폰트
// ─────────────────────────────────────────────
const W = 480, H = 270;

// 강원FC 공식 색상 + 게임 팔레트
const C = {
  orange: '#DD5828', yellow: '#FDB813', green: '#006058', dgreen: '#00302B',
  ink: '#141414', white: '#ffffff', cream: '#fff4dc',
  red: '#e8342c', sky: '#8fd3ff', ice: '#bfe9ff',
  opp: '#3a4fc4', oppDark: '#243282', gk: '#b8e02c', gkDark: '#6f8f10',
};

// 경기장 (공격 진영 한 화면). 골대는 오른쪽.
const F = { x0: 12, y0: 54, x1: 452, y1: 256 };
F.cy = (F.y0 + F.y1) / 2;            // 155
const GOAL = { x: F.x1, cy: F.cy, half: 22, depth: 14 };

const U = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  sign: v => v < 0 ? -1 : 1,
  approach(v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); },
  // 점 P와 선분 AB 사이 거리
  segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cy = ay + dy * t;
    return { d: Math.hypot(px - cx, py - cy), t, cx, cy };
  },
  easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  easeOut(t) { return 1 - (1 - t) * (1 - t); },
  fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  pad(n, l) { return String(Math.max(0, Math.floor(n))).padStart(l, '0'); },
  comma(n) { return Math.floor(n).toLocaleString('ko-KR'); },
};

// 3x5 픽셀 글꼴 (전광판 숫자, 현수막 영문)
const PF = {
  g: {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001',
    '8': '111101111101111', '9': '111101111001111', ':': '000010000010000', '-': '000000111000000',
    '.': '000000000000010', '!': '010010010000010', 'x': '000101010101000', '+': '000010111010000',
    ' ': '000000000000000', '/': '001001010100100', '*': '101010111010101',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
  },
  width(str, s = 1) { return str.length * 4 * s - s; },
  draw(ctx, str, x, y, col, s = 1, align = 'left') {
    str = String(str).toUpperCase();
    if (align === 'center') x -= this.width(str, s) / 2;
    else if (align === 'right') x -= this.width(str, s);
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const g = this.g[str[i]] || this.g[' '];
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + (p % 3) * s, y + Math.floor(p / 3) * s, s, s);
      x += 4 * s;
    }
  },
  // 외곽선이 있는 전광판 글자
  drawO(ctx, str, x, y, col, s = 1, align = 'left', oc = C.ink) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.draw(ctx, str, x + dx, y + dy, oc, s, align);
    this.draw(ctx, str, x, y, col, s, align);
  },
};
