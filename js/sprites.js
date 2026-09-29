'use strict';
// ─────────────────────────────────────────────
// 픽셀 스프라이트 생성기
// 공식 마스코트 이미지(gangwon-fc.com/club/mascot)의 특징을 참고해 코드로 찍는다.
//  · 웅심이: 회색 곰, 정수리 털 한 줌, 진회색 귀 안쪽·눈썹, 흰 주둥이 + 갈색 코,
//            주황 볼, 흰 테두리 주황 눈동자, 가슴의 흰 반달, 두꺼운 검은 외곽선
//  · 옹심이: 황갈색 달걀형 감자, 머리 위 초록 새싹 두 잎, 점무늬, ω 입, 살구색 볼, 흰 다리
// 교체: assets/sprites.json 과 PNG 시트를 넣으면 같은 이름의 프레임을 덮어쓴다. (README 참고)
// ─────────────────────────────────────────────
const SPR = (() => {
  const frames = {};   // name -> { c: canvas, ox, oy }
  const K = C.ink;

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function pen(ctx) {
    return {
      px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); },
      rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); },
      ell(cx, cy, rx, ry, c) {
        ctx.fillStyle = c;
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
          for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
          }
      },
    };
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  // 불투명 픽셀 둘레에 1px 외곽선
  function outline(c, col = K) {
    const ctx = c.getContext('2d'), w = c.width, h = c.height;
    const img = ctx.getImageData(0, 0, w, h), d = img.data, src = new Uint8ClampedArray(d);
    const [r, g, b] = hexRgb(col);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3]) continue;
      const on = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && src[(yy * w + xx) * 4 + 3] > 0;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
  }
  function tint(c, col, a) {
    const t = mk(c.width, c.height), ctx = t.getContext('2d');
    ctx.drawImage(c, 0, 0); ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, 0, c.width, c.height);
    return t;
  }
  function reg(name, c, ox, oy) { frames[name] = { c, ox, oy }; }

  // ── 웅심이 ─────────────────────────────
  const WG = '#b9b9b9', WD = '#7b7b7b', WS = '#9d9d9d', WN = '#9a3a20', WO = '#e26a30';
  function woong(pose) {
    const c = mk(28, 32), p = pen(c.getContext('2d'));
    const X = 1, Y = 1; // 외곽선 여백
    let legs = [[9, 24], [14, 24]], arms = [[6.5, 20], [19.5, 20]], bob = 0, f = 1, eyes = 'open', sit = false;
    switch (pose) {
      case 'idle1': bob = 1; break;
      case 'run0': legs = [[8, 23], [15, 24]]; arms = [[6.5, 21], [19.5, 19]]; break;
      case 'run1': legs = [[10, 24], [13, 23]]; bob = -1; break;
      case 'run2': legs = [[8, 24], [15, 23]]; arms = [[6.5, 19], [19.5, 21]]; break;
      case 'run3': legs = [[10, 23], [13, 24]]; bob = -1; break;
      case 'kick0': legs = [[9, 24], [11, 23]]; arms = [[6, 18], [20, 21]]; break;
      case 'kick1': legs = [[8, 24], [17, 22]]; arms = [[6, 18], [20.5, 18]]; bob = -1; break;
      case 'charge': legs = [[8, 24], [12, 24]]; arms = [[6, 19], [20, 20]]; bob = 1; eyes = 'focus'; break;
      case 'fail': legs = [[9, 25], [15, 25]]; arms = [[7, 22], [19, 22]]; bob = 2; eyes = 'sad'; sit = true; break;
      case 'cheer0': arms = [[5.5, 14], [20.5, 14]]; eyes = 'happy'; break;
      case 'cheer1': arms = [[5, 12], [21, 12]]; legs = [[9, 23], [14, 23]]; bob = -2; eyes = 'happy'; break;
      case 'front': f = 0; break;
      case 'front1': f = 0; bob = 1; break;
      case 'frontcheer': f = 0; arms = [[5, 12], [21, 12]]; eyes = 'happy'; break;
    }
    const by = bob;
    // 다리
    for (const [lx, ly] of legs) p.rect(X + lx, Y + ly, 3, sit ? 3 : 4, WG);
    // 팔 (몸 뒤)
    p.ell(X + arms[0][0], Y + arms[0][1] + by, 1.9, 2.8, WG);
    // 몸통
    p.ell(X + 13, Y + 21 + by, 6.2, 4.8, WG);
    // 가슴 반달 (흰색)
    for (const x of [10, 11, 14, 15]) p.px(X + x, Y + 19 + by, '#fff');
    for (const x of [11, 12, 13, 14]) p.px(X + x, Y + 20 + by, '#fff');
    p.ell(X + arms[1][0], Y + arms[1][1] + by, 1.9, 2.8, WG);
    // 귀
    p.ell(X + 6, Y + 6 + by, 2.8, 2.8, WG); p.ell(X + 20, Y + 6 + by, 2.8, 2.8, WG);
    p.ell(X + 6, Y + 6.4 + by, 1.3, 1.3, WD); p.ell(X + 20, Y + 6.4 + by, 1.3, 1.3, WD);
    // 머리
    p.ell(X + 13, Y + 11 + by, 7.8, 6.8, WG);
    // 정수리 털
    for (const [tx, ty] of [[12, 4], [13, 4], [14, 4], [13, 3], [14, 3], [14, 2], [15, 2], [15, 1]]) p.px(X + tx, Y + ty + by, WG);
    // 목 그늘
    for (let x = 10; x <= 16; x++) p.px(X + x, Y + 17 + by, WS);
    // 눈썹
    p.rect(X + 8 + f, Y + 7 + by, 2, 1, WD); p.rect(X + 16 + f, Y + 7 + by, 2, 1, WD);
    // 눈
    for (const ex of [8 + f, 16 + f]) {
      const ey = Y + 9 + by;
      if (eyes === 'happy') { p.px(X + ex, ey + 1, K); p.px(X + ex + 1, ey, K); p.px(X + ex + 2, ey + 1, K); continue; }
      if (eyes === 'sad') { p.rect(X + ex, ey + 1, 2, 1, K); continue; }
      if (eyes === 'focus') { p.rect(X + ex, ey, 2, 2, K); p.px(X + ex + 1, ey + 1, WO); continue; }
      p.px(X + ex, ey, '#fff'); p.px(X + ex + 1, ey, K); p.px(X + ex, ey + 1, K); p.px(X + ex + 1, ey + 1, WO);
      p.px(X + ex, ey - 1, K); p.px(X + ex + 1, ey - 1, K);
    }
    // 볼
    p.ell(X + 6.5 + f * 0.6, Y + 13 + by, 1.7, 1.3, WO); p.ell(X + 19.5 + f * 0.6, Y + 13 + by, 1.7, 1.3, WO);
    // 주둥이 · 코 · 입
    p.ell(X + 13 + f, Y + 13.4 + by, 3.3, 2.4, '#fff');
    p.rect(X + 12 + f, Y + 12 + by, 2, 1, WN);
    if (eyes === 'happy') { p.rect(X + 12 + f, Y + 14 + by, 2, 1, K); p.px(X + 12 + f, Y + 15 + by, WO); }
    else { p.px(X + 11 + f, Y + 14 + by, K); p.px(X + 12 + f, Y + 13 + by, K); p.px(X + 13 + f, Y + 13 + by, K); p.px(X + 14 + f, Y + 14 + by, K); }
    outline(c);
    return c;
  }

  // ── 옹심이 ─────────────────────────────
  const OT = '#c9a47a', OS = '#a8845c', OP = '#8a6a48', OL = '#78c850', OLD = '#3f8f3a', OC = '#f0bf8e';
  function ong(pose) {
    const c = mk(24, 28), p = pen(c.getContext('2d'));
    const X = 1, Y = 1;
    let legs = [[8, 22], [12, 22]], arms = [[3.8, 15], [18.2, 15]], bob = 0, f = 1, eyes = 'open', squash = 0, sit = false;
    switch (pose) {
      case 'idle1': bob = 1; squash = 1; break;
      case 'run0': legs = [[7, 21], [13, 22]]; arms = [[3.8, 16], [18.2, 14]]; bob = -1; break;
      case 'run1': legs = [[9, 22], [11, 21]]; break;
      case 'run2': legs = [[7, 22], [13, 21]]; arms = [[3.8, 14], [18.2, 16]]; bob = -1; break;
      case 'run3': legs = [[9, 21], [11, 22]]; break;
      case 'kick0': legs = [[8, 22], [10, 21]]; arms = [[3.5, 13], [18.5, 16]]; break;
      case 'kick1': legs = [[7, 22], [15, 20]]; arms = [[3.5, 13], [18.8, 13]]; bob = -1; break;
      case 'charge': legs = [[7, 22], [11, 22]]; bob = 1; squash = 1; eyes = 'focus'; break;
      case 'fail': legs = [[8, 23], [12, 23]]; arms = [[4.5, 18], [17.5, 18]]; bob = 2; squash = 1; eyes = 'sad'; sit = true; break;
      case 'cheer0': arms = [[3, 10], [19, 10]]; eyes = 'happy'; break;
      case 'cheer1': arms = [[2.5, 8], [19.5, 8]]; legs = [[8, 21], [12, 21]]; bob = -3; eyes = 'happy'; break;
      case 'front': f = 0; break;
      case 'front1': f = 0; bob = 1; squash = 1; break;
      case 'frontcheer': f = 0; arms = [[2.5, 8], [19.5, 8]]; eyes = 'happy'; break;
    }
    const by = bob;
    for (const [lx, ly] of legs) p.rect(X + lx, Y + ly, 2, sit ? 2 : 3, '#fff');
    p.ell(X + arms[0][0], Y + arms[0][1] + by, 1.4, 1.8, OT);
    // 몸통(감자 달걀형)
    for (let y = 7; y <= 22; y++) {
      const t = (y + 0.5 - 15) / 8;
      if (Math.abs(t) > 1) continue;
      const hw = (6.6 + squash * 0.5) * Math.sqrt(1 - t * t) * (0.8 + 0.2 * (y - 7) / 15);
      const x0 = Math.round(11 - hw), x1 = Math.round(11 + hw) - 1;
      const yy = Y + y + by + (squash && y < 10 ? 1 : 0);
      p.rect(X + x0, yy, x1 - x0 + 1, 1, OT);
      p.px(X + x1, yy, OS);
      if (y >= 20) p.rect(X + x0 + 1, yy, x1 - x0, 1, OS);
    }
    // 뾰족한 머리 끝
    p.px(X + 12, Y + 6 + by, OT); p.px(X + 13, Y + 6 + by, OT); p.px(X + 13, Y + 5 + by, OT);
    // 새싹
    p.px(X + 10, Y + 6 + by, OLD); p.px(X + 10, Y + 5 + by, OLD); p.px(X + 10, Y + 4 + by, OLD);
    p.ell(X + 7.5, Y + 3.8 + by, 2.5, 1.3, OL); p.px(X + 7, Y + 4 + by, OLD); p.px(X + 8, Y + 4 + by, OLD);
    p.ell(X + 12, Y + 2.4 + by, 1.3, 2.2, OL); p.px(X + 12, Y + 2 + by, OLD);
    // 점무늬
    for (const [sx, sy] of [[15, 10], [6, 18], [11, 20], [16, 19], [9, 9]]) p.px(X + sx, Y + sy + by, OP);
    p.ell(X + arms[1][0], Y + arms[1][1] + by, 1.4, 1.8, OT);
    // 얼굴
    const fy = Y + by + (squash ? 1 : 0);
    p.rect(X + 7 + f, fy + 10, 2, 1, OP); p.rect(X + 13 + f, fy + 10, 2, 1, OP);
    for (const ex of [8 + f, 13 + f]) {
      if (eyes === 'happy') { p.px(X + ex - 1, fy + 13, K); p.px(X + ex, fy + 12, K); p.px(X + ex + 1, fy + 13, K); }
      else if (eyes === 'sad') p.rect(X + ex - 1, fy + 13, 2, 1, K);
      else if (eyes === 'focus') p.rect(X + ex, fy + 12, 1, 2, K);
      else { p.rect(X + ex, fy + 12, 1, 2, K); }
    }
    p.rect(X + 6 + f, fy + 14, 2, 1, OC); p.rect(X + 14 + f, fy + 14, 2, 1, OC);
    for (const [mx, my] of [[9, 15], [10, 16], [11, 15], [12, 16], [13, 15]]) p.px(X + mx + f - 1, fy + my, K);
    outline(c);
    return c;
  }

  // ── 상대 수비수 / 골키퍼 ─────────────────
  // kit: 'basic'(파란 기본 유니폼) · 'stripes'(빨강·검정 가로줄무늬, 5스테이지 상대)
  const SR = '#d8232e', SB = '#262626';
  function defender(pose, gk, kit = 'basic') {
    const st = kit === 'stripes' && !gk;
    const main = gk ? C.gk : st ? SR : C.opp, dark = gk ? C.gkDark : st ? '#a8151f' : C.oppDark, light = gk ? '#dcff6a' : '#6f82ea';
    const shorts = st ? '#1e1e1e' : '#fff';
    const skin = '#f2c79c', hair = gk ? '#6b3a1c' : '#3a2616';
    const wide = pose === 'slide' || pose === 'dive';
    const c = mk(wide ? 32 : 22, wide ? 18 : 28), p = pen(c.getContext('2d'));
    const X = 1, Y = 1;
    if (pose === 'slide' || pose === 'dive') {
      // 오른쪽으로 몸을 던진 자세
      p.ell(X + 5, Y + 7, 4, 4, skin); p.ell(X + 5, Y + 5.5, 4.2, 2.6, hair);
      p.px(X + 7, Y + 7, K);
      p.rect(X + 9, Y + 5, 9, 6, main);
      if (st) { for (let x = 0; x < 9; x++) if ((x >> 1) % 2) p.rect(X + 9 + x, Y + 5, 1, 6, SB); }   // 누운 몸이라 줄무늬가 세로로
      else { p.rect(X + 11, Y + 5, 1, 6, light); p.rect(X + 14, Y + 5, 1, 6, light); }
      p.rect(X + 18, Y + 5, 3, 6, shorts);
      p.rect(X + 21, Y + 5, 6, 2, dark); p.rect(X + 21, Y + 9, 5, 2, dark);
      p.rect(X + 27, Y + 5, 2, 2, K); p.rect(X + 26, Y + 9, 2, 2, K);
      if (pose === 'dive') { p.rect(X + 1, Y + 1, 3, 3, '#fff'); p.rect(X + 1, Y + 11, 3, 3, '#fff'); }
      else { p.rect(X + 11, Y + 2, 2, 3, main); p.rect(X + 11, Y + 11, 2, 3, main); }
      outline(c);
      return c;
    }
    let legs = [[7, 21], [11, 21]], arms = [[4, 12], [14, 12]], bob = 0, crouch = 0, eyes = 'n';
    switch (pose) {
      case 'idle1': bob = 1; break;
      case 'run0': legs = [[6, 20], [12, 21]]; arms = [[4, 13], [14, 11]]; break;
      case 'run1': legs = [[8, 21], [10, 20]]; bob = -1; break;
      case 'run2': legs = [[6, 21], [12, 20]]; arms = [[4, 11], [14, 13]]; break;
      case 'run3': legs = [[8, 20], [10, 21]]; bob = -1; break;
      case 'tell': legs = [[6, 21], [12, 21]]; arms = [[3, 13], [15, 13]]; crouch = 2; eyes = 'angry'; break;
      case 'down': legs = [[6, 22], [12, 22]]; arms = [[4, 15], [14, 15]]; crouch = 3; eyes = 'dizzy'; break;
      case 'gkset': legs = [[6, 21], [12, 21]]; arms = [[2, 10], [16, 10]]; crouch = 1; break;
      case 'leanL': legs = [[5, 21], [11, 21]]; arms = [[1, 9], [15, 12]]; crouch = 1; break;
      case 'leanR': legs = [[7, 21], [13, 21]]; arms = [[3, 12], [17, 9]]; crouch = 1; break;
    }
    const by = bob + crouch;
    for (const [lx, ly] of legs) { p.rect(X + lx, Y + ly, 3, 3, dark); p.rect(X + lx, Y + ly + 3, 3, 1, K); }
    p.rect(X + 6, Y + 17 + by, 9, 4 - Math.min(crouch, 1), shorts);
    p.rect(X + arms[0][0], Y + arms[0][1] + by, 2, 5, main);
    p.rect(X + arms[1][0], Y + arms[1][1] + by, 2, 5, main);
    if (st) for (const [ax, ay] of arms) p.rect(X + ax, Y + ay + 2 + by, 2, 1, SB);
    const glove = gk ? '#fff' : skin;
    p.rect(X + arms[0][0], Y + arms[0][1] + 5 + by, 2, gk ? 2 : 1, glove);
    p.rect(X + arms[1][0], Y + arms[1][1] + 5 + by, 2, gk ? 2 : 1, glove);
    p.rect(X + 6, Y + 11 + by, 9, 7, main);
    if (st) { for (const r of [2, 3, 6]) p.rect(X + 6, Y + 11 + r + by, 9, 1, SB); p.rect(X + 9, Y + 11 + by, 3, 1, SB); }   // 가로줄무늬
    else { p.rect(X + 8, Y + 11 + by, 1, 7, light); p.rect(X + 12, Y + 11 + by, 1, 7, light); p.rect(X + 9, Y + 11 + by, 3, 1, '#fff'); }
    p.ell(X + 10.5, Y + 7 + by, 4.6, 4.4, skin);
    p.ell(X + 10.2, Y + 5 + by, 4.9, 2.8, hair); p.rect(X + 6, Y + 5 + by, 2, 3, hair);
    if (eyes === 'dizzy') { p.px(X + 11, Y + 7 + by, K); p.px(X + 13, Y + 8 + by, K); }
    else if (eyes === 'angry') { p.px(X + 11, Y + 7 + by, K); p.px(X + 13, Y + 7 + by, K); p.px(X + 12, Y + 6 + by, K); p.px(X + 14, Y + 6 + by, K); }
    else { p.px(X + 11, Y + 7 + by, K); p.px(X + 13, Y + 7 + by, K); }
    outline(c);
    return c;
  }

  function ball(frame) {
    const c = mk(9, 9), p = pen(c.getContext('2d'));
    p.ell(4.5, 4.5, 3, 3, '#fff');
    p.px(3, 3, '#d8d8d8');
    const spots = [[[4, 4], [2, 5]], [[5, 3], [3, 5]], [[4, 5], [6, 3]]][frame % 3];
    for (const [x, y] of spots) p.px(x, y, K);
    p.px(6, 6, '#bdbdbd');
    outline(c);
    return c;
  }

  function star(on) {
    const c = mk(13, 13), p = pen(c.getContext('2d'));
    const rows = ['.....x.....', '.....x.....', '....xxx....', 'xxxxxxxxxxx', '.xxxxxxxxx.', '..xxxxxxx..', '..xxxxxxx..', '.xxxx.xxxx.', '.xx.....xx.', 'x.........x'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'x') p.px(x + 1, y + 2, on ? C.yellow : '#44544f'); }));
    if (on) { p.px(5, 6, '#fff'); p.px(6, 5, '#fff'); }
    outline(c);
    return c;
  }

  function build() {
    const mascotPoses = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'kick0', 'kick1', 'charge', 'fail', 'cheer0', 'cheer1', 'front', 'front1', 'frontcheer'];
    for (const pz of mascotPoses) {
      reg('woong_' + pz, woong(pz), 14, 30);
      reg('ong_' + pz, ong(pz), 12, 26);
    }
    const defPoses = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'tell', 'down'];
    for (const pz of defPoses) { reg('def_' + pz, defender(pz, false), 11, 27); reg('dst_' + pz, defender(pz, false, 'stripes'), 11, 27); }
    reg('def_slide', defender('slide', false), 16, 13);
    reg('dst_slide', defender('slide', false, 'stripes'), 16, 13);
    for (const pz of ['gkset', 'idle1', 'leanL', 'leanR', 'run0', 'run2', 'down']) reg('gk_' + pz, defender(pz, true), 11, 27);
    reg('gk_dive', defender('dive', true), 16, 13);
    for (let i = 0; i < 3; i++) reg('ball' + i, ball(i), 4, 4);
    reg('star_on', star(true), 6, 6); reg('star_off', star(false), 6, 6);
    // GREAT UNION 잔상용 주황 틴트
    for (const k of Object.keys(frames)) if (k.startsWith('woong_') || k.startsWith('ong_')) {
      frames[k + '_ghost'] = { c: tint(frames[k].c, C.orange, 0.85), ox: frames[k].ox, oy: frames[k].oy };
    }
    for (const k of Object.keys(frames)) if (k.startsWith('woong_') || k.startsWith('ong_')) if (!k.endsWith('_ghost')) {
      frames[k + '_flash'] = { c: tint(frames[k].c, '#ffffff', 0.7), ox: frames[k].ox, oy: frames[k].oy };
    }
  }

  // 선택적 교체: assets/sprites.json = { "sheet": "파일.png", "frames": { "woong_idle0": [x,y,w,h,ox,oy], ... } }
  function tryOverrides() {
    return fetch('assets/sprites.json').then(r => r.ok ? r.json() : null).then(cfg => {
      if (!cfg || !cfg.sheet || !cfg.frames) return;
      return new Promise(res => {
        const img = new Image();
        img.onload = () => {
          for (const [name, [x, y, w, h, ox, oy]] of Object.entries(cfg.frames)) {
            const c = mk(w, h); c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
            frames[name] = { c, ox, oy };
          }
          res();
        };
        img.onerror = res; img.src = 'assets/' + cfg.sheet;
      });
    }).catch(() => { });
  }

  function draw(ctx, name, x, y, flip = false, alpha = 1) {
    const fr = frames[name]; if (!fr) return;
    x = Math.round(x); y = Math.round(y);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
      ctx.drawImage(fr.c, -fr.ox, -fr.oy); ctx.restore();
    } else ctx.drawImage(fr.c, x - fr.ox, y - fr.oy);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  return { build, draw, frames, tryOverrides, mk, pen, outline };
})();
