'use strict';
// ─────────────────────────────────────────────
// 화면 흐름: 타이틀 → 난이도 → 스테이지 선택 → 스테이지 소개 → 플레이 → 결과 → (다음) → 엔딩
// ─────────────────────────────────────────────

const GAME = {
  scene: null, t: 0,
  diff: 'easy', stageIdx: 0,
  go(s) { this.scene = s; if (s.enter) s.enter(); },
};

// 버튼 공통
function hitBtn(btns) {
  const p = IN.pointer; if (!p) return -1;
  const inside = (b, m) => p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m && b.enabled !== false;
  const exact = btns.findIndex(b => inside(b, 0));
  if (exact >= 0 || !isTouch()) return exact;
  // 손가락용: 버튼 둘레 여유 영역에서 가장 가까운 버튼
  let best = -1, bd = 1e9;
  btns.forEach((b, i) => { if (!inside(b, 7)) return; const d = Math.abs(p.y - (b.y + b.h / 2)); if (d < bd) { bd = d; best = i; } });
  return best;
}
function drawBtn(g, b, sel, t) {
  const on = sel && b.enabled !== false;
  g.fillStyle = C.ink; g.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
  g.fillStyle = b.enabled === false ? '#2a3533' : on ? C.orange : C.dgreen;
  g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = on ? C.yellow : '#0f4a42'; g.fillRect(b.x, b.y, b.w, 2);
  if (on) { g.fillStyle = C.yellow; const bx = b.x - 6 + Math.round(Math.sin(t * 8)); g.fillRect(bx, b.y + b.h / 2 - 2, 2, 5); g.fillRect(bx + 2, b.y + b.h / 2 - 1, 1, 3); }
}
function btnText(b, sel) {
  TXT.draw(b.label, b.x + b.w / 2, b.y + b.h / 2 - (b.size || 12) / 2 - 1, { size: b.size || 12, align: 'center', color: b.enabled === false ? '#789' : sel ? '#fff' : '#dfe' , bold: sel });
}
function menuNav(sel, n, horiz = false) {
  const prev = horiz ? 'left' : 'up', next = horiz ? 'right' : 'down';
  if (IN.hit(prev)) { AU.sfx('ui'); return (sel + n - 1) % n; }
  if (IN.hit(next)) { AU.sfx('ui'); return (sel + 1) % n; }
  return sel;
}
function toggleMute() {
  SAVE.data.settings.mute = !SAVE.data.settings.mute; SAVE.save(); AU.setMuted(SAVE.data.settings.mute);
}
function toggleShake() { SAVE.data.settings.shake = !SAVE.data.settings.shake; SAVE.save(); if (SAVE.data.settings.shake) IN.buzz(30); }
function isTouch() { return document.body.classList.contains('touch'); }
function isIOSBrowser() { return /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone; }
function canFullscreen() { const el = document.documentElement; return isTouch() && !!(el.requestFullscreen || el.webkitRequestFullscreen) && document.fullscreenEnabled !== false; }
function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function toggleFullscreen() {
  const d = document;
  if (isFullscreen()) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const el = d.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  Promise.resolve(req.call(el)).then(() => {
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { });
  }).catch(() => { });
}
function globalKeys() {
  if (IN.hit('mute')) toggleMute();
}
function dimBG(g, theme, a = 0.55) {
  g.drawImage(R.getBG(theme), 0, 0);
  g.fillStyle = `rgba(0,30,26,${a})`; g.fillRect(0, 0, W, H);
}
function big(g, name, x, y, flip, k = 2) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(k, k); SPR.draw(g, name, 0, 0, flip); g.restore();
}
function starRow(g, x, y, stars, gap = 14) { stars.forEach((s, i) => SPR.draw(g, s ? 'star_on' : 'star_off', x + i * gap, y)); }

// ── 타이틀 ─────────────────────────
class TitleScene {
  enter() { this.t = 0; this.sel = 0; AU.music('title'); AU.setCrowd(0.3); AU.setChant(0); }
  get btns() {
    const s = SAVE.data.settings;
    const bs = [
      { x: 180, y: 168, w: 120, h: 18, label: '시작하기' },
      { x: 180, y: 190, w: 120, h: 16, label: '소리: ' + (s.mute ? '꺼짐' : '켜짐'), size: 11 },
      { x: 180, y: 209, w: 120, h: 16, label: '흔들림·진동: ' + (s.shake ? '켜짐' : '꺼짐'), size: 11 },
    ];
    if (canFullscreen()) bs.push({ x: 180, y: 228, w: 120, h: 14, label: isFullscreen() ? '전체 화면 끄기' : '전체 화면 (가로)', size: 10 });
    return bs;
  }
  update(dt) {
    this.t += dt; globalKeys();
    const bs = this.btns;
    this.sel = menuNav(this.sel, bs.length);
    const h = hitBtn(bs);
    if (h >= 0) { this.sel = h; this.activate(); return; }
    if (IN.hit('confirm')) this.activate();
  }
  activate() {
    AU.init();
    if (this.sel === 0) { AU.sfx('ok'); GAME.go(new DiffScene()); }
    else if (this.sel === 1) { toggleMute(); AU.sfx('ui'); }
    else if (this.sel === 2) { toggleShake(); AU.sfx('ui'); }
    else { toggleFullscreen(); AU.sfx('ui'); }
  }
  draw(g, u) {
    const t = this.t;
    g.drawImage(R.getBG('arena'), 0, 0);
    R.drawSceneryAnim(g, 'arena', t, null);
    R.drawCrowd(g, 'arena', t, 0.7);
    g.fillStyle = 'rgba(0,30,26,0.35)'; g.fillRect(0, 0, W, H);
    g.fillStyle = C.dgreen; g.fillRect(0, 0, W, 18);
    // 타이틀 마스코트 연출(2배): 원투 패스 → 공 저글링 → 옹심이가 웅심이 머리 위로 폴짝
    const L = t % 7;
    const wx = 74, ox = 406, gy = 236;
    let ball = { x: wx + 20, y: gy - 6 }, wp = 'front', op = 'front', ongOnHead = false, oxx = ox;
    if (L < 1) { const k = L; ball = { x: U.lerp(wx + 20, ox - 20, k), y: gy - 6 - Math.sin(k * Math.PI) * 80 }; wp = k < 0.2 ? 'kick1' : 'idle0'; }
    else if (L < 2) { const k = L - 1; ball = { x: U.lerp(ox - 20, wx + 20, k), y: gy - 6 - Math.sin(k * Math.PI) * 80 }; op = k < 0.2 ? 'kick1' : 'idle0'; wp = 'idle0'; }
    else if (L < 3.2) { const k = (L - 2) / 1.2; ball = { x: wx + 20, y: gy - 8 - Math.abs(Math.sin(k * Math.PI * 3)) * 30 }; wp = 'front1'; op = 'cheer' + (Math.floor(t * 6) % 2); }
    else if (L < 4) { const k = (L - 3.2) / 0.8; oxx = U.lerp(ox, wx, k); op = 'run' + (Math.floor(t * 12) % 4); }
    else if (L < 6) { ongOnHead = true; wp = 'frontcheer'; }
    else { const k = (L - 6); oxx = U.lerp(wx, ox, k); op = 'run' + (Math.floor(t * 12) % 4); }
    const opFlip = L >= 3.2 && L < 4 ? true : L >= 6 ? false : (L >= 1 && L < 3.2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx - 14, gy - 2, 28, 5); if (!ongOnHead) g.fillRect(oxx - 12, gy - 2, 24, 5);
    big(g, 'woong_' + wp, wx, gy, false);
    if (ongOnHead) big(g, 'ong_frontcheer', wx, gy - 52 - Math.abs(Math.sin(t * 7)) * 5, false);
    else big(g, 'ong_' + op, oxx, gy, opFlip);
    if (!ongOnHead && L < 3.2) big(g, 'ball' + (Math.floor(t * 10) % 3), ball.x, ball.y, false);
    if (ongOnHead) { g.fillStyle = C.yellow; for (let i = 0; i < 4; i++) { const a = t * 3 + i * 1.6; g.fillRect(Math.round(wx + Math.cos(a) * 34), Math.round(gy - 118 + Math.sin(a) * 8), 2, 2); } }
    const bs = this.btns; bs.forEach((b, i) => drawBtn(g, b, i === this.sel, t));
    // UI
    TXT.ctx = u;
    TXT.draw('비공식 강원FC 팬게임', 240, 3, { size: 10, align: 'center', color: '#cfe', stroke: false });
    const bob = Math.sin(t * 2) * 2;
    TXT.draw('웅심옹심', 240, 30 + bob, { size: 48, align: 'center', bold: true, color: C.orange, sw: 10 });
    TXT.draw('미라클 원투', 240, 84, { size: 22, align: 'center', bold: true, color: C.yellow, sw: 6 });
    if (L >= 4 && L < 6) TXT.draw('함께라면 역전도 가능해!', 96, 112, { size: 11, align: 'center', color: '#fff' });
    else if (L < 2) TXT.draw(L < 1 ? '옹심아, 받아!' : '웅심아, 리턴!', L < 1 ? wx + 6 : ox - 6, L < 1 ? 160 : 170, { size: 11, align: 'center' });
    bs.forEach((b, i) => btnText(b, i === this.sel));
    const touch = document.body.classList.contains('touch');
    TXT.draw(touch ? (isIOSBrowser() ? '아이폰: 공유 → 홈 화면에 추가하면 전체 화면으로 즐길 수 있어요' : '버튼을 탭하세요') : '↑↓ 선택 · Z / Enter 결정 · M 소리', 240, 245, { size: 10, align: 'center', color: '#bdd' });
    TXT.draw('캐릭터 능력·스토리는 이 게임을 위한 창작 설정입니다', 240, 256, { size: 10, align: 'center', color: '#8aa', stroke: false });
  }
}

// ── 난이도 선택 ─────────────────────────
class DiffScene {
  enter() { this.t = 0; this.sel = DIFF_KEYS.indexOf(GAME.diff); AU.music('title'); }
  get btns() { return DIFF_KEYS.map((k, i) => ({ x: 24 + i * 148, y: 60, w: 136, h: 150, label: '' })); }
  update(dt) {
    this.t += dt; globalKeys();
    this.sel = menuNav(this.sel, 3, true);
    this.sel = menuNav(this.sel, 3, false);
    const h = hitBtn(this.btns);
    if (h >= 0) { this.sel = h; this.pick(); return; }
    if (IN.hit('confirm')) this.pick();
    else if (IN.hit('back')) { AU.sfx('back'); GAME.go(new TitleScene()); }
  }
  pick() { AU.sfx('ok'); GAME.diff = DIFF_KEYS[this.sel]; GAME.go(new StageSelectScene()); }
  draw(g, u) {
    dimBG(g, 'chuncheon', 0.6);
    const bs = this.btns;
    bs.forEach((b, i) => {
      const d = DIFFS[DIFF_KEYS[i]], sel = i === this.sel;
      g.fillStyle = C.ink; g.fillRect(b.x - 2, b.y - 2 - (sel ? 3 : 0), b.w + 4, b.h + 4);
      g.fillStyle = sel ? '#0d4d45' : C.dgreen; g.fillRect(b.x, b.y - (sel ? 3 : 0), b.w, b.h);
      g.fillStyle = d.color; g.fillRect(b.x, b.y - (sel ? 3 : 0), b.w, 4);
      if (sel) { g.fillStyle = C.yellow; g.fillRect(b.x - 2, b.y - 5, b.w + 4, 1); g.fillRect(b.x - 2, b.y + b.h, b.w + 4, 1); }
      const st = SAVE.totalStars(DIFF_KEYS[i]);
      SPR.draw(g, 'star_on', b.x + 44, b.y + 128 - (sel ? 3 : 0));
      // 마스코트 미니 초상
      SPR.draw(g, i === 0 ? 'ong_front' : i === 1 ? 'woong_front' : 'woong_charge', b.x + b.w / 2, b.y + 106 - (sel ? 3 : 0), false);
      b.st = st;
    });
    TXT.ctx = u;
    TXT.draw('난이도 선택', 240, 22, { size: 20, align: 'center', bold: true, color: C.yellow, sw: 5 });
    bs.forEach((b, i) => {
      const d = DIFFS[DIFF_KEYS[i]], sel = i === this.sel, oy = sel ? -3 : 0;
      TXT.draw(d.name, b.x + b.w / 2, b.y + 10 + oy, { size: 18, align: 'center', bold: true, color: d.color });
      TXT.draw('— ' + d.sub + ' —', b.x + b.w / 2, b.y + 32 + oy, { size: 11, align: 'center' });
      TXT.draw(d.desc, b.x + b.w / 2, b.y + 50 + oy, { size: 10, align: 'center', color: '#cfe' });
      TXT.draw('시간 ' + d.time + '초 · 태클 예고 ' + d.tell + '초', b.x + b.w / 2, b.y + 64 + oy, { size: 10, align: 'center', color: '#cfe' });
      TXT.draw(b.st + ' / 15', b.x + 54, b.y + 122 + oy, { size: 11, color: C.yellow });
      TXT.draw('해금 ' + SAVE.data.unlocked[DIFF_KEYS[i]] + '/5', b.x + b.w - 8, b.y + 136 + oy, { size: 10, align: 'right', color: '#9bb' });
    });
    TXT.draw(isTouch() ? '카드를 탭해서 선택' : '←→ 선택 · Z / Enter 결정 · Esc 뒤로', 240, 236, { size: 10, align: 'center', color: '#bdd' });
    TXT.draw('모든 난이도에서 같은 5개 스테이지를 순서대로 해금해요', 240, 250, { size: 10, align: 'center', color: '#8aa', stroke: false });
  }
}

// ── 스테이지 선택 ─────────────────────────
class StageSelectScene {
  enter() {
    this.t = 0; this.msg = null;
    const un = SAVE.data.unlocked[GAME.diff];
    this.sel = Math.min(GAME.stageIdx, un - 1);
    AU.music('title');
  }
  get btns() { return STAGES.map((s, i) => ({ x: 14 + i * 92, y: 40, w: 84, h: 112, enabled: i < SAVE.data.unlocked[GAME.diff] })); }
  update(dt) {
    this.t += dt; globalKeys();
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    this.sel = menuNav(this.sel, 5, true);
    const p = IN.pointer;
    if (p) {
      const i = this.btns.findIndex(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      if (i >= 0) { this.sel = i; this.pick(); return; }
      if (p.y > 222 && p.x < 120) { AU.sfx('back'); GAME.go(new DiffScene()); return; }
    }
    if (IN.hit('confirm')) this.pick();
    else if (IN.hit('back')) { AU.sfx('back'); GAME.go(new DiffScene()); }
  }
  pick() {
    if (this.sel >= SAVE.data.unlocked[GAME.diff]) { AU.sfx('back'); this.msg = { text: '이전 스테이지를 클리어하면 열려요', t: 1.5 }; return; }
    AU.sfx('ok'); GAME.stageIdx = this.sel; GAME.go(new StageIntroScene());
  }
  draw(g, u) {
    dimBG(g, STAGES[this.sel].theme, 0.55);
    const bs = this.btns;
    bs.forEach((b, i) => {
      const sel = i === this.sel, oy = sel ? -3 : 0, st = STAGES[i], rec = SAVE.data.stages[GAME.diff][i];
      g.fillStyle = sel ? C.yellow : C.ink; g.fillRect(b.x - 2, b.y - 2 + oy, b.w + 4, b.h + 4);
      g.fillStyle = C.dgreen; g.fillRect(b.x, b.y + oy, b.w, b.h);
      // 미니 풍경
      g.drawImage(R.getBG(st.theme), 0, 18, 480, 60, b.x + 2, b.y + 2 + oy, b.w - 4, 26);
      if (!b.enabled) {
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(b.x, b.y + oy, b.w, b.h);
        // 자물쇠
        const lx = b.x + b.w / 2 - 5, ly = b.y + 56 + oy;
        g.fillStyle = C.ink; g.fillRect(lx - 1, ly - 1, 12, 11); g.fillStyle = '#aab'; g.fillRect(lx, ly, 10, 9);
        g.fillStyle = C.ink; g.fillRect(lx + 2, ly - 6, 1, 6); g.fillRect(lx + 7, ly - 6, 1, 6); g.fillRect(lx + 2, ly - 7, 6, 1); g.fillRect(lx + 4, ly + 3, 2, 3);
      } else starRow(g, b.x + 22, b.y + 88 + oy, rec.stars, 14);
    });
    // 선택 상세
    const st = STAGES[this.sel], rec = SAVE.data.stages[GAME.diff][this.sel];
    g.fillStyle = 'rgba(0,48,43,0.9)'; g.fillRect(14, 166, 452, 52); g.fillStyle = C.orange; g.fillRect(14, 166, 452, 2);
    drawBtn(g, { x: 14, y: 226, w: 90, h: 16 }, false, this.t);
    TXT.ctx = u;
    const d = DIFFS[GAME.diff];
    TXT.draw('스테이지 선택', 240, 4, { size: 18, align: 'center', bold: true, color: C.yellow, sw: 5 });
    TXT.draw(d.name + ' — ' + d.sub, 466, 8, { size: 11, align: 'right', color: d.color });
    bs.forEach((b, i) => {
      const s = STAGES[i], oy = i === this.sel ? -3 : 0, r = SAVE.data.stages[GAME.diff][i];
      TXT.draw('STAGE ' + s.id, b.x + b.w / 2, b.y + 31 + oy, { size: 10, align: 'center', color: C.yellow });
      TXT.draw(s.place.length > 6 ? s.place.replace(' ', '\n').split('\n')[0] : s.place, b.x + b.w / 2, b.y + 44 + oy, { size: 11, align: 'center', bold: true });
      if (s.place.length > 6) TXT.draw(s.place.split(' ').slice(1).join(' '), b.x + b.w / 2, b.y + 57 + oy, { size: 10, align: 'center' });
      if (b.enabled) {
        TXT.draw(s.title, b.x + b.w / 2, b.y + 71 + oy, { size: 10, align: 'center', color: '#cfe' });
        TXT.draw(r.best ? U.comma(r.best) : '-', b.x + b.w / 2, b.y + 98 + oy, { size: 10, align: 'center', color: r.cleared ? '#fff' : '#9bb' });
      }
    });
    TXT.draw(st.id + '. ' + st.place + ' — ' + st.title + '   (목표 ' + st.goals + '골 · ' + stageTime(st, GAME.diff) + '초)', 22, 172, { size: 11, color: C.yellow });
    TXT.wrap(st.story, 436, 10).slice(0, 2).forEach((l, i) => TXT.draw(l, 22, 188 + i * 13, { size: 10, stroke: false }));
    TXT.draw('최고 ' + U.comma(rec.best) + '점 · 최다 ' + rec.bestGoals + '골', 460, 204, { size: 10, align: 'right', color: '#9cc', stroke: false });
    TXT.draw('← 난이도', 59, 228, { size: 10, align: 'center' });
    TXT.draw(isTouch() ? '스테이지를 탭해서 선택' : '←→ 선택 · Z / Enter 결정 · Esc 뒤로', 300, 229, { size: 10, align: 'center', color: '#bdd' });
    if (this.msg) TXT.draw(this.msg.text, 240, 140, { size: 13, align: 'center', color: C.orange, bold: true });
  }
}

// ── 스테이지 소개 (별 조건 사전 안내) ─────────────────────────
class StageIntroScene {
  enter() { this.t = 0; }
  update(dt) {
    this.t += dt; globalKeys();
    const p = IN.pointer;
    if (p && p.y > 222 && p.x < 120) { AU.sfx('back'); GAME.go(new StageSelectScene()); return; }
    if ((IN.hit('confirm') || IN.hit('pass') || (p && this.t > 0.2)) && this.t > 0.2) { AU.sfx('ok'); GAME.go(new PlayScene()); }
    else if (IN.hit('back')) { AU.sfx('back'); GAME.go(new StageSelectScene()); }
  }
  draw(g, u) {
    const st = STAGES[GAME.stageIdx], dk = GAME.diff, rec = SAVE.data.stages[dk][GAME.stageIdx];
    dimBG(g, st.theme, 0.5);
    g.fillStyle = 'rgba(0,48,43,0.92)'; g.fillRect(20, 26, 440, 190); g.fillStyle = C.orange; g.fillRect(20, 26, 440, 2); g.fillStyle = C.yellow; g.fillRect(20, 214, 440, 2);
    [0, 1, 2].forEach(i => SPR.draw(g, rec.stars[i] ? 'star_on' : 'star_off', 38, 146 + i * 15));
    SPR.draw(g, 'woong_front', 408, 128, false); SPR.draw(g, 'ong_front', 436, 128, false);
    drawBtn(g, { x: 14, y: 226, w: 90, h: 16 }, false, this.t);
    drawBtn(g, { x: 300, y: 224, w: 166, h: 20 }, true, this.t);
    TXT.ctx = u;
    TXT.draw('STAGE ' + st.id + '  ' + st.place, 34, 34, { size: 12, color: C.yellow });
    TXT.draw(st.title, 34, 50, { size: 22, bold: true, color: '#fff', sw: 5 });
    TXT.wrap(st.story, 400, 10).forEach((l, i) => TXT.draw(l, 34, 80 + i * 13, { size: 10, stroke: false, color: '#dfe' }));
    TXT.draw('새로운 공략', 34, 110, { size: 10, color: C.orange });
    TXT.wrap(st.lesson, 360, 10).forEach((l, i) => TXT.draw(l, 34, 123 + i * 12, { size: 10, stroke: false }));
    const tstar = stageTimeStar(st, dk);
    TXT.draw('클리어: 제한 시간 ' + stageTime(st, dk) + '초 안에 ' + st.goals + '골' + (st.finale ? ' (0:4에서 5:4로 역전)' : ''), 50, 141, { size: 10 });
    TXT.draw('콤보: 최대 콤보 ' + st.comboStar + ' 이상 달성하고 클리어', 50, 156, { size: 10 });
    TXT.draw('시간: 남은 시간 ' + tstar + '초 이상으로 클리어', 50, 171, { size: 10 });
    TXT.draw('웅심이: ' + CHARS.woong.blurb, 34, 188, { size: 9, color: '#cfe', stroke: false });
    TXT.draw('옹심이: ' + CHARS.ong.blurb, 34, 200, { size: 9, color: '#cfe', stroke: false });
    TXT.draw('← 뒤로', 59, 228, { size: 10, align: 'center' });
    TXT.draw(isTouch() ? '탭해서 킥오프!' : '킥오프!  (Z / Enter)', 383, 229, { size: 11, align: 'center', bold: true });
  }
}

// ── 플레이 ─────────────────────────
class PlayScene {
  enter() {
    this.m = new Match(GAME.stageIdx, GAME.diff);
    this.paused = false; this.sel = 0; this.t = 0;
    const st = this.m.stage;
    AU.music(THEMES[st.theme].song);
    AU.setCrowd(st.crowd); AU.setChant(st.crowd); AU.setIntense(false);
  }
  get pbtns() {
    const s = SAVE.data.settings;
    return [
      { x: 176, y: 90, w: 128, h: 18, label: '계속하기' },
      { x: 176, y: 112, w: 128, h: 18, label: '다시 시작' },
      { x: 176, y: 134, w: 128, h: 18, label: '스테이지 선택' },
      { x: 176, y: 160, w: 128, h: 16, label: '소리: ' + (s.mute ? '꺼짐' : '켜짐'), size: 11 },
      { x: 176, y: 180, w: 128, h: 16, label: '흔들림·진동: ' + (s.shake ? '켜짐' : '꺼짐'), size: 11 },
    ];
  }
  update(dt) {
    this.t += dt; globalKeys();
    if (this.paused) {
      this.sel = menuNav(this.sel, 5);
      const h = hitBtn(this.pbtns);
      if (h >= 0) { this.sel = h; this.pauseAct(); return; }
      if (IN.hit('pause')) { this.paused = false; AU.sfx('back'); return; }
      if (IN.hit('confirm')) this.pauseAct();
      else if (IN.hit('retry')) this.retry();
      return;
    }
    if (IN.hit('pause') && this.m.phase !== 'done') { this.paused = true; this.sel = 0; AU.sfx('ui'); return; }
    this.m.update(dt);
    if (this.m.phase === 'done') GAME.go(new ResultScene(this.m.result));
  }
  retry() { AU.sfx('ok'); GAME.go(new PlayScene()); }
  pauseAct() {
    switch (this.sel) {
      case 0: this.paused = false; AU.sfx('ok'); break;
      case 1: this.retry(); break;
      case 2: AU.sfx('back'); AU.setIntense(false); GAME.go(new StageSelectScene()); break;
      case 3: toggleMute(); break;
      case 4: toggleShake(); break;
    }
  }
  draw(g, u) {
    R.drawMatch(g, this.m);
    TXT.ctx = u;
    R.drawMatchUI(u, this.m);
    if (this.paused) {
      g.fillStyle = 'rgba(0,20,18,0.72)'; g.fillRect(0, 0, W, H);
      const bs = this.pbtns; bs.forEach((b, i) => drawBtn(g, b, i === this.sel, this.t));
      TXT.draw('일시정지', 240, 60, { size: 20, align: 'center', bold: true, color: C.yellow, sw: 5 });
      bs.forEach((b, i) => btnText(b, i === this.sel));
      if (!isTouch()) TXT.draw('Esc 계속 · R 다시 시작', 240, 206, { size: 10, align: 'center', color: '#bdd' });
    }
  }
}

// ── 결과 ─────────────────────────
class ResultScene {
  constructor(res) { this.res = res; }
  enter() {
    this.t = 0; this.sel = 0;
    this.rec = SAVE.record(GAME.diff, GAME.stageIdx, this.res);
    this.best = SAVE.data.stages[GAME.diff][GAME.stageIdx].best;
    this.bestGoals = SAVE.data.stages[GAME.diff][GAME.stageIdx].bestGoals;
    this.isLast = GAME.stageIdx === STAGES.length - 1;
    AU.setIntense(false); AU.setChant(this.res.cleared ? 1 : 0.1);
    if (this.res.cleared) { AU.music('result'); AU.roar(1); } else { AU.stopMusic(); AU.sfx('fail'); }
    this.starSnd = 0;
  }
  get btns() {
    const r = this.res;
    if (!r.cleared) return [
      { x: 170, y: 190, w: 140, h: 22, label: isTouch() ? '재도전!' : '재도전 (R / Z)', act: 'retry' },
      { x: 170, y: 218, w: 140, h: 16, label: '스테이지 선택', size: 11, act: 'select' },
    ];
    return [
      { x: 120, y: 204, w: 116, h: 22, label: this.isLast ? '엔딩 보기' : '다음 스테이지', act: this.isLast ? 'ending' : 'next' },
      { x: 244, y: 204, w: 76, h: 22, label: isTouch() ? '재도전' : '재도전 R', act: 'retry', size: 11 },
      { x: 328, y: 204, w: 90, h: 22, label: '스테이지 선택', act: 'select', size: 10 },
    ];
  }
  update(dt) {
    this.t += dt; globalKeys();
    // 별 등장 효과음
    const n = Math.min(3, Math.floor((this.t - 0.6) / 0.35) + 1);
    while (this.starSnd < n && this.starSnd < 3) { if (this.res.stars[this.starSnd]) AU.sfx('star', this.starSnd); this.starSnd++; }
    if (this.t < 0.35) return;
    const bs = this.btns;
    this.sel = menuNav(this.sel, bs.length, true);
    const h = hitBtn(bs);
    if (h >= 0) { this.sel = h; this.act(bs[h].act); return; }
    if (IN.hit('retry')) this.act('retry');
    else if (IN.hit('confirm')) this.act(bs[this.sel].act);
    else if (IN.hit('back')) this.act('select');
  }
  act(a) {
    if (a === 'retry') { AU.sfx('ok'); GAME.go(new PlayScene()); }
    else if (a === 'select') { AU.sfx('back'); GAME.go(new StageSelectScene()); }
    else if (a === 'next') { AU.sfx('ok'); GAME.stageIdx++; GAME.go(new StageIntroScene()); }
    else if (a === 'ending') { AU.sfx('ok'); GAME.go(new EndingScene()); }
  }
  draw(g, u) {
    const r = this.res, st = STAGES[GAME.stageIdx];
    dimBG(g, st.theme, 0.6);
    R.drawCrowd(g, st.theme, this.t, r.cleared ? 1.2 : 0.1);
    g.fillStyle = 'rgba(0,48,43,0.93)'; g.fillRect(60, 28, 360, 196); g.fillStyle = r.cleared ? C.orange : '#667'; g.fillRect(60, 28, 360, 3);
    // 마스코트 반응
    const cheer = Math.floor(this.t * 5) % 2;
    if (r.cleared) { SPR.draw(g, 'woong_' + (cheer ? 'cheer1' : 'cheer0'), 92, 120, false); SPR.draw(g, 'ong_' + (cheer ? 'cheer0' : 'cheer1'), 388, 120, true); }
    else { SPR.draw(g, 'woong_fail', 92, 120, false); SPR.draw(g, 'ong_fail', 388, 120, true); }
    if (r.cleared) {
      for (let i = 0; i < 3; i++) {
        const k = U.clamp((this.t - 0.6 - i * 0.35) / 0.25, 0, 1);
        if (k <= 0) { SPR.draw(g, 'star_off', 196 + i * 44, 86); continue; }
        const on = r.stars[i];
        g.save(); g.translate(196 + i * 44, 86); const s = on ? U.easeOutBack(k) * 1.5 : 1; g.scale(s, s);
        SPR.draw(g, on ? 'star_on' : 'star_off', 0, 0); g.restore();
      }
    }
    const bs = this.btns; bs.forEach((b, i) => drawBtn(g, b, i === this.sel, this.t));
    TXT.ctx = u;
    TXT.draw(st.id + '. ' + st.place + ' — ' + st.title, 240, 36, { size: 11, align: 'center', color: '#cfe' });
    TXT.draw(r.cleared ? '스테이지 클리어!' : '아쉬워요!', 240, 52, { size: 22, align: 'center', bold: true, color: r.cleared ? C.yellow : '#fff', sw: 5 });
    if (r.cleared) {
      const labels = ['클리어', '콤보 ' + st.comboStar + '+', '시간 ' + stageTimeStar(st, GAME.diff) + '초+'];
      labels.forEach((l, i) => TXT.draw(l, 196 + i * 44, 96, { size: 9, align: 'center', color: r.stars[i] ? C.yellow : '#789', stroke: false }));
      const rows = [
        ['득점', r.goals + ' / ' + r.target + '골' + (st.finale ? '  (' + r.goals + ' : 4)' : '')],
        ['플레이 점수', U.comma(r.basePts)],
        ['남은 시간 보너스', r.timeLeft + '초 × 50 = ' + U.comma(r.timeBonus)],
        ['최대 콤보 · 원투 골', r.maxCombo + ' · ' + r.oneTwoGoals + '골'],
      ];
      rows.forEach(([a, b], i) => { TXT.draw(a, 130, 112 + i * 14, { size: 10, color: '#cfe', stroke: false }); TXT.draw(b, 350, 112 + i * 14, { size: 10, align: 'right', stroke: false }); });
      TXT.draw('최종 ' + U.comma(r.score) + '점', 240, 172, { size: 16, align: 'center', bold: true, color: C.yellow });
      TXT.draw((this.rec.newBest ? '최고 기록 갱신! ' : '최고 기록 ') + U.comma(this.best), 240, 190, { size: 10, align: 'center', color: this.rec.newBest ? C.orange : '#9cc' });
    } else {
      TXT.draw('득점 ' + r.goals + ' / ' + r.target + '골', 240, 86, { size: 18, align: 'center', bold: true });
      const left = r.target - r.goals;
      TXT.draw(left === 1 ? '딱 한 골 모자랐어요! 한 판 더?' : left + '골 더 넣으면 클리어!', 240, 110, { size: 11, align: 'center', color: C.yellow });
      TXT.draw('이번 점수 ' + U.comma(r.score) + ' · 최대 콤보 ' + r.maxCombo, 240, 132, { size: 10, align: 'center', color: '#cfe' });
      TXT.draw('최고 기록 ' + U.comma(this.best) + '점 · 최다 ' + this.bestGoals + '골', 240, 148, { size: 10, align: 'center', color: '#9cc' });
      TXT.draw('팁: 수비를 끌어당긴 뒤 패스, 리턴을 받자마자 슛!', 240, 168, { size: 10, align: 'center', color: '#bdd', stroke: false });
    }
    if (this.rec.unlockedNext && !this.isLast) TXT.draw('다음 스테이지 해금!', 240, 230, { size: 10, align: 'center', color: C.orange });
    bs.forEach((b, i) => btnText(b, i === this.sel));
  }
}

// ── 엔딩 ─────────────────────────
class EndingScene {
  enter() {
    this.t = 0;
    SAVE.data.endingSeen[GAME.diff] = true; SAVE.save();
    AU.music('ending'); AU.setChant(0.4); AU.setCrowd(0.4);
    this.lines = [
      [1.5, '옹심이', '저는 그냥 말하는 감자예요…'],
      [4.5, '옹심이', '그래도 오늘은 골 넣는 감자였죠!'],
      [7.5, '웅심이', '나르샤의 응원이 있으면 우린 어디서든 함께 뛸 수 있어.'],
      [10.5, '둘이 함께', '고마워요! GREAT UNION!'],
    ];
    this.parts = [];
  }
  update(dt) {
    this.t += dt; globalKeys();
    if (Math.random() < dt * 3 && this.t > 10) {
      const x = U.rand(40, 440), y = U.rand(30, 90);
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, v = U.rand(20, 60); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, c: U.pick([C.orange, C.yellow, '#fff', C.green]) }); }
      AU.sfx('firework');
    }
    for (const p of this.parts) { p.t += dt; p.vy += 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.t < 1.4);
    if (this.t > 1 && (IN.hit('confirm') || IN.hit('back') || IN.pointer)) {
      if (this.t < 13) this.t = 13;
      else { AU.sfx('ok'); GAME.go(new TitleScene()); }
    }
  }
  draw(g, u) {
    const t = this.t;
    // 노을 하늘 + 강원의 산
    for (let y = 0; y < H; y++) { g.fillStyle = mixHex('#3a2a6a', '#ffb070', Math.min(1, y / 150)); g.fillRect(0, y, W, 1); }
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(240, 150, 26, 0, Math.PI * 2); g.fill();
    for (let x = 0; x < W; x++) { const h = 150 - 18 * (0.6 * Math.sin(x * 0.02) + 0.4 * Math.sin(x * 0.051 + 1)); g.fillStyle = '#5a3f6a'; g.fillRect(x, Math.round(h), 1, 200); }
    for (let x = 0; x < W; x++) { const h = 172 - 10 * Math.sin(x * 0.03 + 2); g.fillStyle = '#2f5a4a'; g.fillRect(x, Math.round(h), 1, 200); }
    g.fillStyle = '#3f8a4a'; g.fillRect(0, 196, W, 74);
    g.fillStyle = '#4f9a55'; for (let x = 0; x < W; x += 30) g.fillRect(x, 196, 15, 74);
    // 마스코트 등장 → 머리 위로 폴짝 → 손 흔들기 (2배)
    const walk = Math.min(1, t / 3);
    const wx = U.lerp(-30, 210, walk), ox = U.lerp(-80, 272, walk), gy = 238;
    const moving = walk < 1;
    const op = moving ? 'run' + (Math.floor(t * 10) % 4) : 'front';
    const wp = moving ? 'run' + (Math.floor(t * 8) % 4) : (t > 7 ? 'frontcheer' : 'front');
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx - 14, gy - 2, 28, 5);
    big(g, 'woong_' + wp, wx, gy, false);
    if (t < 6) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(ox - 12, gy - 2, 24, 5); big(g, 'ong_' + (t > 4 && t < 6 ? 'cheer' + (Math.floor(t * 4) % 2) : op), ox, gy, false); }
    else if (t < 6.6) { const k = (t - 6) / 0.6; big(g, 'ong_front', U.lerp(272, wx, k), U.lerp(gy, gy - 52, k) - Math.sin(k * Math.PI) * 36, false); }
    else big(g, 'ong_' + (Math.floor(t * 4) % 2 ? 'frontcheer' : 'front1'), wx, gy - 52 - Math.abs(Math.sin(t * 5)) * 3, false);
    if (t > 6.6) {
      g.fillStyle = '#ff7a9a';
      const hx = Math.round(wx + 30), hy = Math.round(gy - 126 - ((t * 20) % 24));
      g.fillRect(hx, hy, 2, 2); g.fillRect(hx + 3, hy, 2, 2); g.fillRect(hx, hy + 2, 5, 1); g.fillRect(hx + 1, hy + 3, 3, 1); g.fillRect(hx + 2, hy + 4, 1, 1);
    }
    for (const p of this.parts) { g.globalAlpha = 1 - p.t / 1.4; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    g.globalAlpha = 1;
    TXT.ctx = u;
    TXT.draw('미라클 5:4', 240, 16, { size: 26, align: 'center', bold: true, color: C.yellow, sw: 6, alpha: Math.min(1, t / 1) });
    let cur = null; for (const l of this.lines) if (t >= l[0]) cur = l;
    if (cur && t < 13) {
      TXT.box(50, 58, 380, 36);
      TXT.draw(cur[1], 60, 62, { size: 10, color: C.orange, stroke: false });
      TXT.draw(cur[2], 240, 76, { size: 12, align: 'center', stroke: false });
    }
    if (t >= 13) {
      const d = DIFFS[GAME.diff];
      TXT.draw(d.name + ' — ' + d.sub + ' 모드 완주!', 240, 56, { size: 14, align: 'center', bold: true });
      TXT.draw('모은 별 ' + SAVE.totalStars(GAME.diff) + ' / 15', 240, 76, { size: 11, align: 'center', color: C.yellow });
      TXT.draw('비공식 팬게임 · 웅심이·옹심이와 구단 색상의 권리는 강원FC에 있습니다.', 240, 96, { size: 9, align: 'center', color: '#fff' });
      TXT.draw('캐릭터 능력과 스테이지 이야기는 이 게임을 위한 창작 설정입니다.', 240, 108, { size: 9, align: 'center', color: '#fff' });
      TXT.draw('5스테이지는 2019.6.23 포항전 5:4 역전승에서 영감을 받은 창작 도전입니다.', 240, 120, { size: 9, align: 'center', color: '#fff' });
      TXT.draw(isTouch() ? '탭해서 타이틀로' : 'Z / Enter: 타이틀로', 240, 140, { size: 11, align: 'center', color: C.yellow, alpha: Math.floor(t * 2) % 2 ? 1 : 0.5 });
    } else if (t > 1) TXT.draw('Z: 넘기기', 470, 256, { size: 10, align: 'right', color: '#fff', alpha: 0.7 });
  }
}
