'use strict';
// ─────────────────────────────────────────────
// 렌더링: 게임 캔버스(480×270 픽셀) + UI 캔버스(고해상도 한글)
// ─────────────────────────────────────────────

// UI 캔버스 한글 텍스트 (좌표는 게임 픽셀 단위)
const TXT = {
  ctx: null,
  font(size, bold) { return `${size}px ${bold ? 'Galmuri11B' : (size < 11 ? 'Galmuri9' : 'Galmuri11')}, 'Malgun Gothic', sans-serif`; },
  draw(s, x, y, o = {}) {
    const c = this.ctx; if (!c) return;
    const size = o.size || 12;
    c.font = this.font(size, o.bold);
    c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'top';
    c.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.stroke !== false) {
      c.lineJoin = 'round'; c.strokeStyle = o.stroke || C.ink;
      c.lineWidth = o.sw || Math.max(2, size * 0.22); c.strokeText(s, x, y);
    }
    c.fillStyle = o.color || '#fff'; c.fillText(s, x, y);
    c.globalAlpha = 1;
  },
  width(s, size = 12, bold) { this.ctx.font = this.font(size, bold); return this.ctx.measureText(s).width; },
  wrap(s, maxW, size = 11, bold) {
    const out = []; let line = '';
    for (const word of s.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (this.width(t, size, bold) > maxW && line) { out.push(line); line = word; } else line = t;
    }
    if (line) out.push(line);
    return out;
  },
  box(x, y, w, h, fill = 'rgba(0,48,43,.88)', stroke = C.yellow, lw = 1) {
    const c = this.ctx;
    c.fillStyle = fill; c.fillRect(x, y, w, h);
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); }
  },
};

const THEMES = {
  chuncheon: { sky: ['#8fd4ff', '#dff4ff'], grass: ['#5cb85a', '#53ad51'], crowd: 0.22, song: 'stage' },
  beach: { sky: ['#86cffc', '#e3f6ff'], grass: ['#5ab35a', '#51a751'], crowd: 0.35, song: 'stage' },
  snow: { sky: ['#bcd9ee', '#eef7ff'], grass: ['#7cb074', '#73a66c'], crowd: 0.35, song: 'stage' },
  night: { sky: ['#07102a', '#1b2a58'], grass: ['#3f9146', '#388640'], crowd: 1.0, song: 'night' },
  arena: { sky: ['#5b3f8f', '#ff9a58'], grass: ['#4fa653', '#479b4b'], crowd: 1.0, song: 'night' },
};

const R = {
  bg: {},
  crowd: {},

  // ── 배경 (한 번 그려서 캐시) ─────────────────
  getBG(theme) {
    if (this.bg[theme]) return this.bg[theme];
    const c = SPR.mk(W, H), g = c.getContext('2d');
    const th = THEMES[theme];
    const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // 하늘
    const skyTop = 18, skyBot = 40;
    for (let y = skyTop; y < skyBot; y++) {
      const t = (y - skyTop) / (skyBot - skyTop);
      rect(0, y, W, 1, mixHex(th.sky[0], th.sky[1], t));
    }
    const ridge = (base, amp, f1, f2, ph, col, top = skyTop) => {
      for (let x = 0; x < W; x++) {
        const h = base - amp * (0.6 * Math.sin(x * f1 + ph) + 0.4 * Math.sin(x * f2 + ph * 2.3));
        rect(x, Math.max(top, Math.round(h)), 1, 44 - Math.round(h), col);
      }
    };
    if (theme === 'chuncheon') {
      ridge(30, 6, 0.021, 0.057, 1, '#86c28d'); ridge(34, 4, 0.03, 0.08, 3, '#5f9f68');
      rect(0, 35, W, 5, '#4fa7d8');                       // 호수
      for (let x = 3; x < W; x += 11) rect(x, 36 + (x % 3), 4, 1, '#bfe8ff');
      // 둑 위 관중 자리(연습장)
      rect(0, 40, W, 8, '#6aa65e'); for (let x = 0; x < W; x += 6) rect(x, 40, 3, 1, '#7dbb70');
    } else if (theme === 'beach') {
      rect(0, 27, W, 10, '#2b8fd2'); rect(0, 27, W, 1, '#a9e2ff');
      rect(0, 37, W, 4, '#ecd89c');
      for (const px of [8, 34, 60, 410, 436, 462]) pine(g, px, 40);
      rect(0, 41, W, 7, '#d9c48a');
    } else if (theme === 'snow') {
      ridge(27, 7, 0.018, 0.05, 2, '#e9f3fb');
      for (let x = 0; x < W; x += 1) { const h = 27 - 7 * (0.6 * Math.sin(x * 0.018 + 2) + 0.4 * Math.sin(x * 0.05 + 4.6)); if (x % 7 < 3) rect(x, Math.round(h) + 3, 1, 2, '#b8cfe2'); }
      ridge(35, 3, 0.04, 0.09, 5, '#c7d9e6');
      for (const tx of [70, 150, 330, 410]) { rect(tx, 22, 1, 16, '#8ea6ba'); rect(tx - 1, 37, 3, 1, '#8ea6ba'); }
      rect(0, 40, W, 8, '#eef5fb'); for (let x = 0; x < W; x += 5) rect(x, 40, 2, 1, '#fff');
    } else if (theme === 'night' || theme === 'arena') {
      if (theme === 'night') for (let i = 0; i < 40; i++) rect((i * 97) % W, 18 + (i * 37) % 12, 1, 1, i % 3 ? '#9fb3ff' : '#fff');
      // 경기장 지붕 · 조명탑
      rect(0, 30, W, 3, '#26303f'); for (let x = 0; x < W; x += 16) rect(x, 30, 1, 3, '#3c4a60');
      for (const lx of [24, 456]) { rect(lx - 1, 19, 3, 12, '#4a5566'); rect(lx - 5, 18, 11, 4, '#dfe8ff'); rect(lx - 5, 18, 11, 1, '#fff'); }
      // 가득 찬 스탠드 기반
      rect(0, 33, W, 15, theme === 'night' ? '#8a2f12' : '#7a2c14');
      for (let y = 34; y < 48; y += 3) rect(0, y, W, 1, '#5c1f0c');
      if (theme === 'arena') {
        // 대형 전광판 틀
        rect(186, 18, 108, 21, '#1a1a1a'); rect(188, 20, 104, 17, '#050a08');
        rect(238, 39, 4, 2, '#333');
      }
    }
    if (theme !== 'night' && theme !== 'arena') {
      // 작은 스탠드
      const sc = theme === 'snow' ? '#8aa0b0' : '#6a7f7a';
      if (theme !== 'chuncheon') { rect(150, 38, 180, 10, sc); for (let y = 40; y < 48; y += 3) rect(150, y, 180, 1, '#4f615c'); }
    }
    // 광고판
    const boards = ['GANGWON FC', 'GREAT UNION', 'NARSHA 12', 'SINCE 2008', 'GANGWON FC', 'GREAT UNION'];
    const cols = [[C.orange, '#fff'], [C.green, C.yellow], [C.yellow, C.dgreen], [C.dgreen, '#fff']];
    let bx = 0, bi = 0;
    while (bx < W) {
      const txt = boards[bi % boards.length], [bc, tc] = cols[bi % cols.length];
      const bw = PF.width(txt) + 12;
      rect(bx, 48, bw, 6, bc); rect(bx, 48, 1, 6, C.ink);
      PF.draw(g, txt, bx + 6, 48.5, tc);
      bx += bw; bi++;
    }
    rect(0, 53, W, 1, C.ink);
    // 사이드 트랙
    rect(0, 54, F.x0, F.y1 - 54 + 4, mixHex(th.grass[0], '#000000', 0.18));
    rect(F.x1, 54, W - F.x1, F.y1 - 54 + 4, mixHex(th.grass[0], '#000000', 0.18));
    // 잔디 줄무늬
    for (let x = F.x0; x < F.x1; x += 30) rect(x, F.y0, Math.min(30, F.x1 - x), F.y1 - F.y0, ((x - F.x0) / 30) % 2 ? th.grass[1] : th.grass[0]);
    // 잔디 결
    for (let i = 0; i < 700; i++) { const x = F.x0 + (i * 131) % (F.x1 - F.x0), y = F.y0 + (i * 71) % (F.y1 - F.y0); rect(x, y, 1, 1, mixHex(th.grass[0], '#ffffff', 0.12)); }
    // 라인
    const L = theme === 'snow' ? '#ffffff' : '#f2fff0';
    rect(F.x0, F.y0, F.x1 - F.x0, 1, L); rect(F.x0, F.y1, F.x1 - F.x0 + 1, 1, L);
    rect(F.x0, F.y0, 1, F.y1 - F.y0, L); rect(F.x1, F.y0, 1, F.y1 - F.y0, L);
    const arc = (cx, cy, r, filt) => { for (let a = 0; a < Math.PI * 2; a += 0.01) { const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (filt(x, y)) rect(x, y, 1, 1, L); } };
    arc(F.x0, F.cy, 34, x => x >= F.x0);
    rect(F.x0, F.cy - 1, 2, 2, L);
    const pbx = F.x1 - 62, gbx = F.x1 - 22;
    rect(pbx, F.cy - 64, 1, 128, L); rect(pbx, F.cy - 64, 62, 1, L); rect(pbx, F.cy + 64, 62, 1, L);
    rect(gbx, F.cy - 32, 1, 64, L); rect(gbx, F.cy - 32, 22, 1, L); rect(gbx, F.cy + 32, 22, 1, L);
    rect(F.x1 - 44, F.cy - 1, 2, 2, L);
    arc(F.x1 - 44, F.cy, 30, x => x < pbx);
    // 골대 뒤 공간
    rect(GOAL.x + 1, GOAL.cy - GOAL.half, GOAL.depth, GOAL.half * 2, 'rgba(0,0,0,0.25)');
    // 하단 게이지 바탕
    rect(0, F.y1 + 1, W, H - F.y1 - 1, C.dgreen); rect(0, F.y1 + 1, W, 1, C.ink);
    this.bg[theme] = c;
    return c;

    function pine(g, x, base) {
      rect(x, base - 4, 2, 5, '#5a3a1e');
      for (let i = 0; i < 4; i++) rect(x - 5 + i, base - 6 - i * 3, 12 - i * 2, 3, i % 2 ? '#2f6b3a' : '#255a31');
    }
  },

  getCrowd(theme) {
    if (this.crowd[theme]) return this.crowd[theme];
    const th = THEMES[theme], out = [];
    const full = th.crowd;
    const rows = theme === 'night' || theme === 'arena' ? [35, 38, 41, 44] : theme === 'chuncheon' ? [42, 45] : [39, 42, 45];
    const palette = theme === 'night' || theme === 'arena'
      ? [C.orange, C.orange, C.orange, C.yellow, C.orange, '#ff8a4a', C.yellow, C.green, '#fff']
      : [C.orange, C.yellow, C.green, '#fff', '#5a7fd0', C.orange];
    const xr = theme === 'chuncheon' || theme === 'night' || theme === 'arena' ? [0, W] : theme === 'beach' || theme === 'snow' ? [150, 330] : [0, W];
    for (const y of rows) for (let x = xr[0] + 1; x < xr[1] - 2; x += 3) {
      if (theme === 'arena' && x > 182 && x < 298 && y < 40) continue;
      if (Math.random() > full) continue;
      out.push({ x, y, c: U.pick(palette), ph: Math.random() * 6.28, skin: U.pick(['#f2c79c', '#e0ad7e', '#f7d7b5']) });
    }
    // 깃발
    const flags = theme === 'night' || theme === 'arena' ? [60, 140, 330, 410] : theme === 'chuncheon' ? [] : [200, 280];
    this.crowd[theme] = { people: out, flags };
    return this.crowd[theme];
  },

  drawCrowd(g, theme, t, excite) {
    const cr = this.getCrowd(theme);
    for (const p of cr.people) {
      const jump = excite > 0.3 && Math.sin(t * (10 + excite * 6) + p.ph) > 0.2 ? Math.min(2, Math.round(excite * 1.5)) : 0;
      const y = p.y - jump;
      g.fillStyle = p.c; g.fillRect(p.x, y + 1, 2, 2);
      g.fillStyle = p.skin; g.fillRect(p.x, y, 2, 1);
      if (excite > 0.8 && jump) { g.fillStyle = p.c; g.fillRect(p.x - 1, y - 1, 1, 1); g.fillRect(p.x + 2, y - 1, 1, 1); }
    }
    for (const fx of cr.flags) {
      g.fillStyle = '#ddd'; g.fillRect(fx, 30, 1, 14);
      for (let i = 0; i < 12; i++) {
        const wy = Math.round(Math.sin(t * 6 + i * 0.6) * (1 + excite));
        g.fillStyle = i < 4 ? C.orange : i < 8 ? C.yellow : C.green;
        g.fillRect(fx + 1 + i, 30 + wy, 1, 6);
      }
    }
  },

  drawSceneryAnim(g, theme, t, m) {
    if (theme === 'beach') {
      g.fillStyle = '#e8f7ff';
      for (let i = 0; i < 26; i++) { const x = ((i * 53 + t * 12 * (i % 2 ? 1 : -1)) % (W + 20) + W + 20) % (W + 20) - 10; g.fillRect(Math.round(x), 29 + (i % 4) * 2, 4, 1); }
    } else if (theme === 'snow') {
      for (const tx of [70, 150, 330, 410]) {
        const a0 = t * 2.4 + tx;
        g.fillStyle = '#6f8aa2';
        for (let k = 0; k < 3; k++) { const a = a0 + k * 2.094; for (let r = 1; r <= 6; r++) g.fillRect(Math.round(tx + Math.cos(a) * r), Math.round(22 + Math.sin(a) * r), 1, 1); }
        g.fillStyle = '#9fb5c8'; g.fillRect(tx - 1, 21, 2, 2);
      }
      // 눈송이
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 40; i++) { const x = (i * 71 + t * 8) % W, y = F.y0 + ((i * 97 + t * 14 * (1 + i % 3)) % (F.y1 - F.y0)); g.fillRect(Math.round(x), Math.round(y), 1, 1); }
    } else if (theme === 'night' || theme === 'arena') {
      g.globalAlpha = 0.18 + 0.04 * Math.sin(t * 3);
      g.fillStyle = '#fff6d0';
      for (const lx of [24, 456]) { g.beginPath(); g.arc(lx, 20, 14, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      if (theme === 'arena' && m) {
        // 전광판
        const blink = m.phase === 'goal' && Math.floor(t * 6) % 2;
        if (m.phase === 'goal' && m.ceremony) PF.draw(g, 'MIRACLE', 240, 22, C.orange, 1, 'center');
        else { PF.draw(g, 'GANGWON', 192, 22, blink ? C.yellow : '#9fe0c0'); PF.draw(g, 'VS', 256, 22, '#9fe0c0'); }
        PF.draw(g, m.goals + ':' + m.opp, 240, 28, blink ? '#fff' : C.yellow, 2, 'center');
      }
    }
  },

  // ── 경기 화면 ─────────────────
  drawMatch(g, m) {
    const theme = m.stage.theme;
    g.save();
    let sx = 0, sy = 0;
    if (m.fx.shake > 0) { sx = Math.round(U.rand(-1, 1) * m.fx.shakeMag); sy = Math.round(U.rand(-1, 1) * m.fx.shakeMag); }
    g.translate(sx, sy);
    g.drawImage(this.getBG(theme), 0, 0);
    this.drawSceneryAnim(g, theme, m.t, m);
    this.drawCrowd(g, theme, m.t, m.crowdExcite);
    // 얼음
    if (m.iceMask) this.drawIce(g, m);
    // 바람 줄기
    if (m.wind) { g.fillStyle = 'rgba(255,255,255,0.35)'; for (const s of m.fx.streaks) g.fillRect(Math.round(s.x), Math.round(s.y), 1, Math.round(s.len)); }
    this.drawGuides(g, m);
    // 태클 예고 (바닥)
    for (const d of m.defs) if (d.state === 'tell') this.drawTell(g, d, m);
    // 그림자
    g.fillStyle = 'rgba(0,0,0,0.28)';
    const shadow = (x, y, w) => { g.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 3); g.fillRect(Math.round(x - w / 2 + 1), Math.round(y - 2), w - 2, 5); };
    for (const p of m.P) if (!(m.ceremony && p === m.ong && m.celebrateInfo && m.celebrateInfo.t > 1.3)) shadow(p.x, p.y, 12);
    for (const d of m.defs) shadow(d.x, d.y, 10);
    shadow(m.gk.x, m.gk.y, 10);
    shadow(m.ball.x, m.ball.y + 1, 5);
    // 잔상
    for (const gh of m.fx.ghosts) SPR.draw(g, gh.id + '_' + gh.pose + '_ghost', gh.x, gh.y, gh.flip, 0.5 * (1 - gh.t / 0.25));
    // 공 궤적
    const b = m.ball;
    if (b.trail.length > 1) {
      const strong = b.shot && b.shot.strong, gu = m.gu > 0;
      for (let i = 0; i < b.trail.length; i++) {
        const p = b.trail[i], a = (i + 1) / b.trail.length;
        g.globalAlpha = a * 0.6;
        g.fillStyle = gu ? C.orange : strong ? C.yellow : '#fff';
        const s = strong || gu ? 3 : 2;
        g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - 2 - s / 2 - (b.z || 0)), s, s);
      }
      g.globalAlpha = 1;
    }
    // 엔티티 (y 정렬)
    const list = [];
    for (const p of m.P) list.push({ y: p.y, f: () => this.drawPlayer(g, p, m) });
    for (const d of m.defs) list.push({ y: d.y, f: () => this.drawDef(g, d, m) });
    list.push({ y: m.gk.y, f: () => this.drawGK(g, m) });
    list.push({ y: b.y + 0.5, f: () => SPR.draw(g, 'ball' + (Math.floor(b.spin) % 3), b.x, b.y - 2 - (b.z || 0)) });
    list.sort((a, c) => a.y - c.y);
    for (const e of list) e.f();
    // 세리머니: 웅심이가 옹심이를 들어올림
    if (m.ceremony && m.celebrateInfo && m.celebrateInfo.t > 1.3) {
      const w = m.woong, hop = Math.abs(Math.sin(m.t * 6)) * 3;
      SPR.draw(g, 'ong_frontcheer', w.x, w.y - 26 - hop, false);
    }
    this.drawNet(g, m);
    // 입자
    for (const p of m.fx.parts) {
      g.globalAlpha = Math.max(0, 1 - p.t / p.life);
      g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.size || 1, p.size || 1);
    }
    g.globalAlpha = 1;
    this.drawIndicators(g, m);
    if (m.wind) this.drawWindBox(g, m);
    g.restore();
    // GREAT UNION 테두리
    if (m.gu > 0) {
      const a = 0.35 + 0.25 * Math.sin(m.t * 12);
      g.fillStyle = `rgba(221,88,40,${a})`;
      g.fillRect(0, 18, W, 3); g.fillRect(0, F.y1 - 2, W, 3); g.fillRect(0, 18, 3, F.y1 - 18); g.fillRect(W - 3, 18, 3, F.y1 - 18);
    }
    this.drawHUD(g, m);
  },

  // 얼음 픽셀 지도 → 한 번만 그려 캐시 (공격마다 모양이 새로 생기면 다시 그림)
  iceCache: null,
  drawIce(g, m) {
    const k = m.iceMask;
    if (!this.iceCache || this.iceCache.m !== m || this.iceCache.ver !== k.ver) {
      const c = SPR.mk(k.w, k.h), cx = c.getContext('2d'), img = cx.createImageData(k.w, k.h), d = img.data;
      const at = (x, y) => x >= 0 && y >= 0 && x < k.w && y < k.h && k.data[y * k.w + x] === 1;
      const put = (x, y, r, gg, b, a) => { const i = (y * k.w + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = a; };
      const sparks = [];
      for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) {
        if (!at(x, y)) {
          // 아래쪽 가장자리 그림자 (두께감)
          if (at(x, y - 1) || at(x, y - 2)) put(x, y, 40, 95, 120, at(x, y - 1) ? 110 : 55);
          continue;
        }
        const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
        if (edge) { put(x, y, 246, 253, 255, 255); continue; }
        const near = !at(x - 2, y) || !at(x + 2, y) || !at(x, y - 2) || !at(x, y + 2) || !at(x - 3, y - 3) || !at(x + 3, y + 3);
        if (near) { put(x, y, 150, 210, 240, 215); continue; }
        // 빛 반사 줄무늬와 서리 점
        const streak = (x - y * 2 + 400) % 23 < 2 && ((x * 7 + y * 13) % 5 < 3);
        const frost = ((x * 73856093) ^ (y * 19349663)) % 61 === 0;
        if (streak) put(x, y, 235, 250, 255, 220);
        else if (frost) put(x, y, 255, 255, 255, 230);
        else put(x, y, 196, 236, 255, 170);
        if (((x * 31 + y * 17) % 97 === 0) && sparks.length < 24) sparks.push({ x: x + k.x0, y: y + k.y0, ph: (x * 0.37 + y) % 6.28 });
      }
      cx.putImageData(img, 0, 0);
      this.iceCache = { m, ver: k.ver, c, sparks };
    }
    g.drawImage(this.iceCache.c, k.x0, k.y0);
    g.fillStyle = '#ffffff';
    for (const s of this.iceCache.sparks) {
      const tw = Math.sin(m.t * 3 + s.ph);
      if (tw > 0.75) { g.fillRect(s.x, s.y - 1, 1, 3); g.fillRect(s.x - 1, s.y, 3, 1); }
      else if (tw > 0.4) g.fillRect(s.x, s.y, 1, 1);
    }
  },

  // 패스 길 · 동료 이동 예정 위치 · 도착점
  drawGuides(g, m) {
    if (m.phase !== 'play' && m.phase !== 'ready') return;
    const b = m.ball, c = m.ctrl;
    const dot = (x, y, col, s = 2) => { g.fillStyle = col; g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); };
    const blink = Math.floor(m.t * 4) % 2;
    // 동료 목표 위치
    for (const p of m.P) {
      if (p === c && b.owner === p) continue;
      if (p.mode === 'receive' && b.state === 'pass') {
        g.fillStyle = '#fff';
        for (let i = -2; i <= 2; i++) { g.fillRect(Math.round(p.tx + i), Math.round(p.ty + i), 1, 1); g.fillRect(Math.round(p.tx + i), Math.round(p.ty - i), 1, 1); }
        continue;
      }
      if (b.owner && b.owner !== p && (p.mode === 'run' || p.mode === 'support')) {
        const col = p.mode === 'run' ? C.yellow : '#aef5c8';
        const d = U.dist(p.x, p.y, p.tx, p.ty);
        if (d > 8) {
          const n = Math.floor(d / 6);
          for (let i = 1; i < n; i++) { const t = i / n; if ((i + Math.floor(m.t * 8)) % 2) dot(U.lerp(p.x, p.tx, t), U.lerp(p.y, p.ty, t), col, 1); }
        }
        const r = 5 + (blink ? 0 : 1);
        g.fillStyle = col;
        for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2 + m.t; g.fillRect(Math.round(p.tx + Math.cos(an) * r), Math.round(p.ty + Math.sin(an) * r * 0.6), 1, 1); }
        if (p.mode === 'run') { PF.drawO(g, '>>', p.tx, p.ty - 10, C.yellow, 1, 'center'); }
      }
    }
    // 패스 미리보기
    if (c && b.owner === c && !c.charging && !c.pendingShot && m.phase === 'play') {
      const mate = m.mate(c);
      const plan = m.passPlan(c, mate);
      const pts = m.passDanger(plan);
      let firstDanger = null;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], z = pts[i + 1];
        const col = a.danger ? 'rgba(255,70,60,0.95)' : 'rgba(255,255,255,0.75)';
        if (a.danger && !firstDanger) firstDanger = a;
        dot(a.x, a.y, col, 2);
        dot((a.x + z.x) / 2, (a.y + z.y) / 2, col, 1);
      }
      const end = pts[pts.length - 1];
      g.fillStyle = firstDanger ? C.red : '#fff';
      for (let a = 0; a < 10; a++) { const an = a / 10 * Math.PI * 2; g.fillRect(Math.round(end.x + Math.cos(an) * 4), Math.round(end.y + Math.sin(an) * 3), 1, 1); }
      if (firstDanger) { PF.drawO(g, 'X', firstDanger.x, firstDanger.y - 3, C.red, 1, 'center'); }
    }
  },

  drawTell(g, d, m) {
    const df = m.diff, locked = d.t < df.tell * 0.45;
    const len = TUNE.lungeSpeed * TUNE.lungeTime;
    const a = locked ? (Math.floor(m.t * 16) % 2 ? 0.75 : 0.45) : 0.3;
    g.fillStyle = `rgba(232,52,44,${a})`;
    for (let s = 4; s < len; s += 2) {
      const w = locked ? 3 : 2;
      g.fillRect(Math.round(d.x + d.dirX * s - w / 2), Math.round(d.y + d.dirY * s - w / 2), w, w);
    }
    g.fillRect(Math.round(d.x - 6), Math.round(d.y), 12, 1);
  },

  drawPlayer(g, p, m) {
    if (m.ceremony && p === m.ong && m.celebrateInfo && m.celebrateInfo.t > 1.3) return;
    let pose = m.poseOf(p);
    let name = p.id + '_' + pose;
    if (p.flashT > 0 && Math.floor(p.flashT * 20) % 2) name += '_flash';
    SPR.draw(g, name, p.x, p.y, p.face < 0);
  },

  drawDef(g, d, m) {
    let pose;
    if (d.state === 'lunge') { SPR.draw(g, 'def_slide', d.x, d.y - 4, d.vx < 0); return; }
    if (d.state === 'tell') pose = 'tell';
    else if (d.state === 'down') pose = 'down';
    else if (Math.hypot(d.vx, d.vy) > 10) pose = 'run' + (Math.floor(d.animDist / 7) % 4);
    else pose = Math.floor(m.t * 2 + d.i) % 2 ? 'idle1' : 'idle0';
    SPR.draw(g, 'def_' + pose, d.x, d.y, d.face < 0);
    if (d.state === 'down') {
      g.fillStyle = C.yellow;
      for (let i = 0; i < 3; i++) { const a = m.t * 6 + i * 2.1; g.fillRect(Math.round(d.x + Math.cos(a) * 6), Math.round(d.y - 24 + Math.sin(a) * 2), 1, 1); }
    }
    if (d.state === 'tell' && Math.floor(m.t * (d.t < m.diff.tell * 0.45 ? 16 : 8)) % 2 === 0) PF.drawO(g, '!', d.x, d.y - 36, C.red, 2, 'center');
  },

  drawGK(g, m) {
    const k = m.gk;
    if (k.state === 'dive' || (k.state === 'save' && k.saveDir !== 0)) {
      const dir = k.state === 'dive' ? Math.sign(k.diveY - k.startY) || 1 : k.saveDir;
      g.save(); g.translate(Math.round(k.x), Math.round(k.y - 6)); g.rotate(dir < 0 ? -Math.PI / 2 : Math.PI / 2);
      SPR.draw(g, 'gk_dive', 0, 0, dir > 0); g.restore();
      return;
    }
    let pose = 'gkset';
    if (k.state === 'save') pose = 'gkset';
    else if (Math.abs(k.vy) > 20) pose = Math.floor(m.t * 8) % 2 ? 'run0' : 'run2';
    else if (k.state === 'set' && !k.lean) pose = Math.floor(m.t * 2) % 2 ? 'idle1' : 'gkset';
    const ly = k.lean ? k.lean * 2 : 0;
    SPR.draw(g, 'gk_' + pose, k.x, k.y + ly, true);
    if (k.lean) {
      // 사전 동작: 쏠리는 쪽으로 흔들림 표시
      g.fillStyle = 'rgba(255,255,255,0.85)';
      const yy = k.y - 12 - k.lean * 14;
      for (let i = 0; i < 3; i++) g.fillRect(Math.round(k.x - 3 + i * 3), Math.round(yy - k.lean * (i % 2)), 1, 3);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(Math.round(k.x + 4), Math.round(k.y - 10 + k.lean * 8), 1, 4);
    }
    if (k.boss) PF.drawO(g, '*', k.x, k.y - 34, C.yellow, 1, 'center');
  },

  drawNet(g, m) {
    const top = GOAL.cy - GOAL.half, bot = GOAL.cy + GOAL.half, x0 = GOAL.x + 1, x1 = GOAL.x + GOAL.depth;
    const r = m.fx.ripple;
    const bulge = (x, y) => {
      if (!r) return 0;
      const d2 = (y - r.y) ** 2 + ((x - r.x) ** 2) * 0.5;
      return 5 * Math.exp(-d2 / 90) * Math.max(0, 1 - r.t / 1.2) * (0.55 + 0.45 * Math.sin(r.t * 28));
    };
    g.fillStyle = 'rgba(235,245,240,0.75)';
    for (let x = x0 + 2; x <= x1; x += 3) for (let y = top; y <= bot; y++) g.fillRect(Math.round(x + bulge(x, y)), y, 1, 1);
    for (let y = top + 2; y < bot; y += 3) for (let x = x0; x <= x1; x++) g.fillRect(Math.round(x + bulge(x, y)), y, 1, 1);
    g.fillStyle = '#fff';
    g.fillRect(GOAL.x, top - 1, GOAL.depth + 1, 1); g.fillRect(GOAL.x, bot, GOAL.depth + 1, 1);
    // 골대 기둥
    for (const py of [top - 1, bot]) { g.fillStyle = C.ink; g.fillRect(GOAL.x - 2, py - 2, 5, 5); g.fillStyle = '#fff'; g.fillRect(GOAL.x - 1, py - 1, 3, 3); }
  },

  drawIndicators(g, m) {
    const c = m.ctrl, b = m.ball;
    const playing = m.phase === 'play' || m.phase === 'ready';
    if (!playing) return;
    const bob = Math.round(Math.sin(m.t * 6));
    for (const p of m.P) {
      const head = p.id === 'woong' ? 34 : 30;
      if (p === c) {
        // 발밑 링 + 머리 위 화살표
        g.fillStyle = C.yellow;
        for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; g.fillRect(Math.round(p.x + Math.cos(an) * 8), Math.round(p.y + Math.sin(an) * 3), 1, 1); }
        tri(g, p.x, p.y - head - 3 + bob, 3, C.yellow);
        if (p.id === 'woong' && !p.shieldUsed && b.owner === p) shieldIcon(g, p.x + 7, p.y - head - 5 + bob);
      } else if (p.mode !== 'receive') tri(g, p.x, p.y - head - 2, 2, '#aef5c8');
      if (p.oneTwoT > 0 && b.owner === p) {
        const frac = p.oneTwoT / m.diff.oneTwo;
        g.fillStyle = Math.floor(m.t * 12) % 2 ? C.yellow : '#fff';
        const n = Math.ceil(28 * frac);
        for (let a = 0; a < n; a++) { const an = -Math.PI / 2 + a / 28 * Math.PI * 2; g.fillRect(Math.round(p.x + Math.cos(an) * 14), Math.round(p.y - 10 + Math.sin(an) * 14), 2, 2); }
      }
    }
    if (!c || b.owner !== c) return;
    // 조준 화살표
    const charging = c.charging || c.pendingShot;
    const near = b.x > 250;
    if (charging || near) {
      const aim = charging ? c.aim : 0;
      const tg = m.shotTarget(aim);
      const dx = tg.x - b.x, dy = tg.y - b.y, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d, len = charging ? 20 : 14;
      g.globalAlpha = charging ? 1 : 0.55;
      g.fillStyle = charging ? C.yellow : '#fff';
      for (let s = 7; s < len; s++) g.fillRect(Math.round(b.x + ux * s), Math.round(b.y - 2 + uy * s), 1, 1);
      const hx = b.x + ux * len, hy = b.y - 2 + uy * len;
      for (let k = 1; k <= 3; k++) {
        g.fillRect(Math.round(hx - ux * k - uy * k), Math.round(hy - uy * k + ux * k), 1, 1);
        g.fillRect(Math.round(hx - ux * k + uy * k), Math.round(hy - uy * k - ux * k), 1, 1);
      }
      // 골라인 목표 표시
      g.fillRect(GOAL.x - 4, Math.round(tg.y), 3, 1); g.fillRect(GOAL.x - 3, Math.round(tg.y) - 1, 1, 3);
      // 바람이 있으면 휘는 궤적 미리보기
      if (charging && m.wind) {
        const sp = c.s.quickPow + (c.s.maxPow - c.s.quickPow) * Math.min(1, c.chargeT / c.s.chargeTime);
        const vx = ux * sp, vy = uy * sp, ay = m.windAy() * 0.7;
        g.fillStyle = 'rgba(160,230,255,0.9)';
        for (let t = 0.03; t < 0.8; t += 0.03) { const x = b.x + vx * t, y = b.y + vy * t + 0.5 * ay * t * t; if (x > GOAL.x) break; g.fillRect(Math.round(x), Math.round(y - 2), 1, 1); }
      }
      g.globalAlpha = 1;
    }
    // 차징 바
    if (c.charging) {
      const head = c.id === 'woong' ? 34 : 30;
      const ch = Math.min(1, c.chargeT / c.s.chargeTime);
      const x = Math.round(c.x - 8), y = Math.round(c.y - head - 10);
      g.fillStyle = C.ink; g.fillRect(x - 1, y - 1, 18, 5);
      g.fillStyle = '#334'; g.fillRect(x, y, 16, 3);
      g.fillStyle = ch >= 1 ? (Math.floor(m.t * 16) % 2 ? '#fff' : C.orange) : (ch > 0.7 ? C.orange : C.yellow);
      g.fillRect(x, y, Math.round(16 * ch), 3);
    }
  },

  drawWindBox(g, m) {
    const w = m.wind, x = 16, y = F.y0 + 4;
    g.fillStyle = 'rgba(0,48,43,0.8)'; g.fillRect(x, y, 58, 16);
    g.fillStyle = C.yellow; g.fillRect(x, y, 58, 1);
    const arrow = (ax, dir, str, col) => {
      g.fillStyle = col;
      const cy = y + 8;
      for (let i = -4; i <= 4; i++) g.fillRect(ax, cy + i, 1, 1);
      const tip = cy + dir * 5;
      g.fillRect(ax - 1, tip - dir, 3, 1); g.fillRect(ax - 2, tip - dir * 2, 5, 1);
      for (let k = 0; k < 3; k++) { g.fillStyle = k < Math.round(str * 3) ? col : '#335'; g.fillRect(ax + 4 + k * 3, y + 11 - k * 2, 2, 2 + k * 2); }
    };
    arrow(x + 29, w.dir, w.str, '#bfefff');
    if (w.warned && Math.floor(m.t * 5) % 2) arrow(x + 47, w.nextDir, w.nextStr, C.orange);
  },

  drawHUD(g, m) {
    g.fillStyle = C.dgreen; g.fillRect(0, 0, W, 18);
    g.fillStyle = C.orange; g.fillRect(0, 17, W, 1);
    g.fillStyle = C.ink; g.fillRect(0, 18, W, 1);
    // 시간
    g.fillStyle = '#021a17'; g.fillRect(3, 2, 44, 14);
    const low = m.time <= 10 && m.phase === 'play';
    PF.draw(g, U.fmtTime(m.time), 25, 4, low && Math.floor(m.t * 4) % 2 ? C.red : C.yellow, 2, 'center');
    // 점수판
    g.fillStyle = '#021a17'; g.fillRect(176, 2, 128, 14);
    g.fillStyle = C.orange; g.fillRect(176, 2, 2, 14);
    if (m.stage.finale) PF.draw(g, m.goals + ':' + m.opp, 240, 4, C.yellow, 2, 'center');
    else {
      PF.draw(g, m.goals + '/' + m.stage.goals, 240, 4, C.yellow, 2, 'center');
    }
    // 콤보 · 점수
    g.fillStyle = '#021a17'; g.fillRect(372, 2, 105, 14);
    PF.draw(g, U.pad(m.score, 7), 474, 4, '#fff', 2, 'right');
    const mult = m.mult();
    PF.draw(g, 'x' + (Number.isInteger(mult) ? mult : mult.toFixed(1)), 369, 4, m.combo ? C.orange : '#557', 2, 'right');
    // 하단 응원 게이지
    const gx = 78, gy = F.y1 + 5, gw = 300, gh = 7;
    g.fillStyle = C.ink; g.fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
    g.fillStyle = '#123a34'; g.fillRect(gx, gy, gw, gh);
    const fill = Math.round(gw * m.gauge / 100);
    if (m.gu > 0) {
      g.fillStyle = Math.floor(m.t * 10) % 2 ? C.orange : C.yellow; g.fillRect(gx, gy, fill, gh);
    } else {
      g.fillStyle = C.orange; g.fillRect(gx, gy, fill, gh);
      g.fillStyle = C.yellow; g.fillRect(gx, gy, fill, 2);
    }
    g.fillStyle = C.dgreen; for (let i = 1; i < 10; i++) g.fillRect(gx + i * gw / 10, gy, 1, gh);
  },

  // UI 캔버스 (한글)
  drawMatchUI(u, m) {
    TXT.ctx = u;
    // HUD 라벨
    TXT.draw(m.stage.id + '. ' + m.stage.place, 52, 4, { size: 10, color: '#cfe' });
    if (m.stage.finale) { TXT.draw('강원', 182, 4, { size: 10, color: C.yellow }); TXT.draw('상대', 298, 4, { size: 10, color: '#cfe', align: 'right' }); }
    else { TXT.draw('득점', 182, 4, { size: 10, color: C.yellow }); TXT.draw('골', 298, 4, { size: 10, color: '#cfe', align: 'right' }); }
    TXT.draw('콤보' + m.combo, 306, 4, { size: 10, color: m.combo ? C.orange : '#8aa' });
    TXT.draw(m.gu > 0 ? 'GREAT UNION!' : '나르샤 응원', 6, F.y1 + 3, { size: 10, color: m.gu > 0 ? C.yellow : '#fff' });
    const touch = document.body.classList.contains('touch');
    if (!touch) TXT.draw('Z 패스  X 슛  Esc', 474, F.y1 + 3, { size: 10, color: '#9cc', align: 'right' });
    // 바람 라벨
    if (m.wind) {
      TXT.draw('바람', 19, F.y0 + 7, { size: 10, color: '#bfefff' });
      if (m.wind.warned) TXT.draw('예고!', 78, F.y0 + 7, { size: 10, color: C.orange, alpha: Math.floor(m.t * 5) % 2 ? 1 : 0.5 });
    }
    // 이름표 (조작 전환)
    for (const p of m.P) {
      if (p.flashT > 0.2 && m.phase === 'play' && !(p.oneTwoT > 0)) TXT.draw(p.s.name + '!', p.x, p.y - (p.id === 'woong' ? 50 : 46), { size: 10, align: 'center', color: C.yellow });
      if (p.oneTwoT > 0 && m.ball.owner === p) TXT.draw('원투 타이밍!', p.x, p.y + 6, { size: 10, align: 'center', color: Math.floor(m.t * 10) % 2 ? C.yellow : '#fff' });
    }
    // 팝업
    for (const p of m.fx.pops) {
      const k = p.t / p.life, sc = k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1;
      TXT.draw(p.text, p.x, p.y - k * 18, { size: Math.round(p.size * sc), align: 'center', color: p.color, alpha: k > 0.7 ? (1 - k) / 0.3 : 1, bold: p.size >= 12 });
    }
    // 준비
    if (m.phase === 'ready') {
      const first = m.attackNo === 1;
      TXT.draw(first ? m.stage.title : '다음 공격!', 240, 96, { size: 20, align: 'center', bold: true, color: C.yellow, sw: 5 });
      TXT.draw(m.stage.finale ? '강원 ' + m.goals + ' : ' + m.opp + ' 상대 · 역전까지 ' + Math.max(0, 5 - m.goals) + '골' : '목표 ' + m.stage.goals + '골 · 현재 ' + m.goals + '골', 240, 122, { size: 12, align: 'center' });
    }
    // 배너
    const bn = m.fx.banner;
    if (bn) {
      const k = Math.min(1, bn.t / 0.25), sc = U.easeOutBack(k);
      const a = bn.t > bn.life - 0.3 ? (bn.life - bn.t) / 0.3 : 1;
      const size = bn.big ? 40 : 22;
      u.save(); u.translate(240, 104); u.scale(sc, sc);
      TXT.draw(bn.text, 0, -size / 2, { size, align: 'center', bold: true, color: bn.color, alpha: a, sw: bn.big ? 8 : 5 });
      u.restore();
      if (bn.sub) TXT.draw(bn.sub, 240, 104 + size / 2 + 6, { size: 12, align: 'center', alpha: a, color: '#fff' });
    }
    // 힌트
    if (m.hint && m.phase !== 'goal') {
      const lines = TXT.wrap(m.hint.text, 400, 11);
      const h = lines.length * 14 + 8, y = F.y1 - 8 - h;
      const w = Math.max(...lines.map(l => TXT.width(l, 11))) + 20;
      TXT.box(240 - w / 2, y, w, h);
      lines.forEach((l, i) => TXT.draw(l, 240, y + 5 + i * 14, { size: 11, align: 'center', stroke: false }));
    }
  },
};

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(U.lerp(pa >> 16 & 255, pb >> 16 & 255, t)), g = Math.round(U.lerp(pa >> 8 & 255, pb >> 8 & 255, t)), bl = Math.round(U.lerp(pa & 255, pb & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
function tri(g, x, y, s, col) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = C.ink; for (let i = 0; i <= s + 1; i++) g.fillRect(x - (s + 1 - i) - 1, y - 1 + i, (s + 1 - i) * 2 + 3, 1);
  g.fillStyle = col; for (let i = 0; i <= s; i++) g.fillRect(x - (s - i), y + i, (s - i) * 2 + 1, 1);
}
function shieldIcon(g, x, y) {
  x = Math.round(x); y = Math.round(y);
  const rows = ['.xxx.', 'xoooX', 'xoooX', '.xoX.', '..X..'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; g.fillStyle = ch === 'o' ? '#dfe7ea' : C.ink; g.fillRect(x + i, y + j, 1, 1); }));
}
