// 헤드리스 자동 검증: node tools/sim-test.js
// 게임 로직(match.js)을 그대로 불러와 봇이 플레이하며 판정·밸런스를 점검한다.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

// ── 최소 브라우저 흉내 ─────────────────
const store = {};
const ctx = {
  console, Math, JSON, Date, Promise, setInterval: () => 0, clearInterval() { },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  document: { body: { classList: { contains: () => false, add() { } } }, createElement: () => ({ getContext: () => null }) },
  window: {},
};
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
load('js/util.js'); load('js/data.js'); load('js/save.js');
vm.runInContext(`
  var AU = { sfx(){}, roar(){}, tick(){}, setChant(){}, setIntense(){}, setCrowd(){}, music(){}, init(){} };
  var BOT = { keys: new Set(), hits: new Set(), dx: 0, dy: 0 };
  var IN = {
    down: a => BOT.keys.has(a), hit: a => BOT.hits.has(a), rel: () => false,
    dir: () => { const m = Math.hypot(BOT.dx, BOT.dy); return m ? { x: BOT.dx / m, y: BOT.dy / m } : { x: 0, y: 0 }; },
    endStep() { BOT.hits.clear(); }, get pointer() { return null; }, buzz() { },
  };
`, ctx);
load('js/match.js');
vm.runInContext('SAVE.load();', ctx);
const { Match, BOT, IN, SAVE, STAGES, DIFF_KEYS, GOAL, F, U } = new Proxy({}, { get: (_, k) => vm.runInContext(k, ctx) });

// ── 봇 ─────────────────
function botStep(m) {
  const b = m.ball, c = m.ctrl;
  BOT.dx = 0; BOT.dy = 0; BOT.keys.clear();
  if (m.phase !== 'play' || !c) return;
  if (b.state === 'loose') { BOT.dx = b.x - c.x; BOT.dy = b.y - c.y; return; }
  if (b.owner !== c) { BOT.dx = 1; return; }
  if (c.charging) {
    const want = m.gk.y > GOAL.cy ? -1 : 1;           // 골키퍼 반대쪽 구석
    const aimTarget = m.gk.lean ? -m.gk.lean : want;
    if (c.aim < aimTarget - 0.1) { BOT.dy = 1; BOT.keys.add('down'); } else if (c.aim > aimTarget + 0.1) { BOT.dy = -1; BOT.keys.add('up'); }
    if (c.chargeT < (c.id === 'woong' ? 0.25 : 0.15)) BOT.keys.add('shoot');
    return;
  }
  const dg = U.dist(b.x, b.y, GOAL.x, GOAL.cy);
  const near = Math.min(...m.defs.filter(d => d.state !== 'down').map(d => U.dist(d.x, d.y, c.x, c.y)), 999);
  const tell = m.defs.some(d => d.state === 'tell' && U.dist(d.x, d.y, c.x, c.y) < 45);
  if (dg < 115 && (c.oneTwoT > 0 || dg < 80 || m.laneClear(b.x, b.y, GOAL.x, GOAL.cy) > 14)) {
    const want = m.gk.lean ? -m.gk.lean : (m.gk.y > GOAL.cy ? -1 : 1);
    BOT.dy = want; BOT.dx = 0.3; BOT.keys.add(want > 0 ? 'down' : 'up');
    BOT.hits.add('shoot'); BOT.keys.add('shoot'); return;
  }
  const mate = m.mate(c);
  const plan = m.passPlan(c, mate), pts = m.passDanger(plan);
  const safe = !pts.some(p => p.danger);
  if ((near < 30 || tell) && safe && c.grace <= 0) { BOT.hits.add('pass'); return; }
  if (safe && mate.x > c.x + 40 && near < 55 && c.grace <= 0) { BOT.hits.add('pass'); return; }
  // 전진하면서 수비를 피함
  BOT.dx = 1;
  const blocker = m.defs.find(d => d.state !== 'down' && d.x > c.x && d.x - c.x < 50 && Math.abs(d.y - c.y) < 22);
  if (blocker) BOT.dy = c.y < blocker.y ? -1 : 1; else BOT.dy = (GOAL.cy - c.y) * 0.01;
  if (tell) { const d = m.defs.find(d => d.state === 'tell'); BOT.dy = d.dirY > 0 ? -1.5 : 1.5; }
}

function runStage(si, dk, seedLimit = 200) {
  const m = new Match(si, dk);
  const reasons = {}; let goals = 0, goalEvents = 0, prevGoals = 0, steps = 0, attacks = 0;
  const origFail = m.fail.bind(m);
  let lastSafe = null, passT = 0;
  const origPass = m.doPass.bind(m);
  m.doPass = (p) => { const pl = m.passPlan(p, m.mate(p)); lastSafe = !m.passDanger(pl).some(q => q.danger); passT = m.t; origPass(p); };
  m.fail = (r, w) => {
    if (!m.resolved) {
      reasons[r] = (reasons[r] || 0) + 1;
      if (r === 'intercept') { const k = (lastSafe ? 'safe' : 'risky') + ':' + (w ? w.role : '?') + ':' + (m.t - passT < 0.15 ? 'early' : 'late'); DIAG[k] = (DIAG[k] || 0) + 1; }
    }
    origFail(r, w);
  };
  const origGoal = m.scoreGoal.bind(m);
  m.scoreGoal = (y) => { goalEvents++; origGoal(y); };
  while (m.phase !== 'done' && steps < 60 * 400) {
    botStep(m);
    m.update(1 / 60);
    IN.endStep();
    if (m.phase === 'goal' && m.goals !== prevGoals) { if (m.goals - prevGoals !== 1) throw new Error('골 중복 집계'); prevGoals = m.goals; }
    // 불변식: 공 소유자와 상태 일관성
    if (m.ball.state === 'own' && !m.ball.owner) throw new Error('own 상태인데 소유자 없음');
    for (const p of [...m.P, ...m.defs]) if (!(p.x >= F.x0 && p.x <= F.x1 && p.y >= F.y0 && p.y <= F.y1)) throw new Error('캐릭터가 경기장 밖: ' + (p.id || p.role));
    steps++;
  }
  if (m.phase !== 'done') throw new Error('스테이지가 끝나지 않음');
  return { r: m.result, reasons, goalEvents, attacks: m.attackNo, secs: steps / 60 };
}

// ── 1) 밸런스 · 판정 통계 ─────────────────
let fails = 0;
const DIAG = {};
process.on('exit', () => { if (process.env.DIAG) console.log('가로채기 분석', DIAG); });
const N = +process.argv[2] || 12;
for (const dk of DIFF_KEYS) {
  for (let si = 0; si < STAGES.length; si++) {
    let clears = 0, goals = 0, att = 0, onetwo = 0, combo = 0, tl = 0, s2 = 0, s3 = 0; const rs = {};
    for (let k = 0; k < N; k++) {
      try {
        const o = runStage(si, dk);
        if (o.goalEvents !== o.r.goals) throw new Error('골 이벤트 수 불일치');
        clears += o.r.cleared ? 1 : 0; if (o.r.cleared) tl += o.r.timeLeft; s2 += o.r.stars[1] ? 1 : 0; s3 += o.r.stars[2] ? 1 : 0; goals += o.r.goals; att += o.attacks; onetwo += o.r.oneTwoGoals; combo += o.r.maxCombo;
        for (const [a, b] of Object.entries(o.reasons)) rs[a] = (rs[a] || 0) + b;
      } catch (e) { fails++; console.log('ERROR', dk, si + 1, e.message); }
    }
    const rsS = Object.entries(rs).map(([a, b]) => a + ':' + b).join(' ');
    console.log(`${dk.padEnd(6)} S${si + 1} 클리어 ${clears}/${N}  평균골 ${(goals / N).toFixed(1)}  공격수 ${(att / N).toFixed(1)}  원투골 ${(onetwo / N).toFixed(1)}  최대콤보 ${(combo / N).toFixed(1)}  남은시간 ${clears ? (tl / clears).toFixed(0) : '-'}  별2 ${s2} 별3 ${s3} | ${rsS}`);
  }
}

// ── 2) 특정 시나리오 ─────────────────
function check(name, fn) { try { fn(); console.log('OK  ', name); } catch (e) { fails++; console.log('FAIL', name, '-', e.message); } }
const play = (m) => { m.phase = 'play'; };

check('패스가 수비 몸에 걸리면 가로채기', () => {
  const m = new Match(0, 'normal'); play(m);
  const d = m.defs[0]; d.state = 'move'; d.cd = 99;
  m.woong.x = 100; m.woong.y = 150; m.ong.x = 200; m.ong.y = 150; m.ong.vx = m.ong.vy = 0;
  m.placeBallAtFeet(); d.x = 150; d.y = 151;
  m.doPass(m.woong);
  for (let i = 0; i < 60 && m.phase === 'play'; i++) m.update(1 / 60);
  if (m.phase !== 'fail') throw new Error('가로채지 않음: ' + m.phase);
});
check('빈 패스 길은 동료에게 도착하고 조작 전환', () => {
  const m = new Match(0, 'normal'); play(m);
  m.defs.forEach(d => { d.x = 400; d.y = 70; d.cd = 99; d.state = 'down'; d.t = 99; });
  m.woong.x = 100; m.woong.y = 150; m.ong.x = 170; m.ong.y = 110; m.placeBallAtFeet();
  m.doPass(m.woong);
  for (let i = 0; i < 90 && m.ball.state === 'pass'; i++) m.update(1 / 60);
  if (m.ball.owner !== m.ong || m.ctrl !== m.ong) throw new Error('조작 전환 실패');
});
check('리턴 패스 → 원투 창 → 슛 시 원투 플래그', () => {
  const m = new Match(0, 'normal'); play(m);
  m.defs.forEach(d => { d.state = 'down'; d.t = 99; d.x = 60; d.y = 70; });
  m.woong.x = 150; m.woong.y = 150; m.ong.x = 210; m.ong.y = 110; m.placeBallAtFeet();
  m.doPass(m.woong);
  for (let i = 0; i < 90 && m.ball.state === 'pass'; i++) m.update(1 / 60);
  m.doPass(m.ong);
  for (let i = 0; i < 120 && m.ball.state === 'pass'; i++) m.update(1 / 60);
  if (m.ball.owner !== m.woong) throw new Error('리턴 미수신');
  if (!(m.woong.oneTwoT > 0)) throw new Error('원투 창 없음');
  m.startCharge(m.woong);
  if (!m.woong.shotOneTwo) throw new Error('원투 플래그 없음');
});
check('골 한 번만 집계 (골라인 위 반복 업데이트)', () => {
  const m = new Match(0, 'easy'); play(m);
  const b = m.ball; b.state = 'shot'; b.owner = null; b.x = GOAL.x - 3; b.y = GOAL.cy; b.vx = 400; b.vy = 0; b.shot = { strong: false };
  m.gk.y = GOAL.cy - 20; m.gk.state = 'save';
  for (let i = 0; i < 120; i++) m.update(1 / 60);
  if (m.goals !== 1) throw new Error('goals=' + m.goals);
  // 넣은 뒤 다시 골라인을 넘기려 해도 추가 집계 없음
  m.scoreGoal(GOAL.cy); if (m.goals !== 1) throw new Error('중복 집계');
});
check('골대 맞으면 골 아님', () => {
  const m = new Match(0, 'easy'); play(m);
  const b = m.ball; b.state = 'shot'; b.owner = null; b.x = GOAL.x - 3; b.y = GOAL.cy - GOAL.half; b.vx = 400; b.vy = 0; b.shot = { strong: false };
  m.gk.state = 'save';
  for (let i = 0; i < 5; i++) m.update(1 / 60);
  if (m.goals !== 0 || m.phase !== 'fail') throw new Error('phase=' + m.phase + ' goals=' + m.goals);
});
check('중앙 슛은 골키퍼가 막음', () => {
  const m = new Match(0, 'hard'); play(m);
  const b = m.ball; m.gk.y = GOAL.cy; m.gk.state = 'set';
  b.state = 'own'; b.owner = m.woong; m.woong.x = 360; m.woong.y = GOAL.cy; m.placeBallAtFeet(); m.ctrl = m.woong;
  m.launchShot(m.woong, 300, 0, 0, false);
  for (let i = 0; i < 60 && m.phase === 'play'; i++) m.update(1 / 60);
  if (m.phase !== 'fail') throw new Error('막지 못함');
});
check('가까운 구석 슛은 들어감 (쉬움)', () => {
  const m = new Match(0, 'easy'); play(m);
  const b = m.ball; m.gk.y = GOAL.cy; m.gk.state = 'set';
  m.woong.x = 395; m.woong.y = GOAL.cy - 10; m.ctrl = m.woong; b.owner = m.woong; b.state = 'own'; m.placeBallAtFeet();
  m.defs.forEach(d => { d.x = 100; d.state = 'down'; d.t = 9; });
  m.launchShot(m.woong, 420, 1, 1, false);
  for (let i = 0; i < 60 && m.phase === 'play'; i++) m.update(1 / 60);
  if (m.goals !== 1) throw new Error('phase=' + m.phase);
});
check('시간 종료 → 결과(실패)', () => {
  const m = new Match(0, 'normal'); play(m); m.time = 0.05;
  for (let i = 0; i < 400 && m.phase !== 'done'; i++) m.update(1 / 60);
  if (m.phase !== 'done' || m.result.cleared) throw new Error('phase=' + m.phase);
});
check('시간 종료 직전 슛은 결과까지 기다림(버저비터)', () => {
  const m = new Match(0, 'easy'); play(m);
  m.defs.forEach(d => { d.state = 'down'; d.t = 99; d.x = 100; });
  m.woong.x = 400; m.woong.y = GOAL.cy - 8; m.ctrl = m.woong; m.placeBallAtFeet(); m.gk.y = GOAL.cy + 15;
  m.launchShot(m.woong, 420, -1, 1, false); m.time = 0.01;
  for (let i = 0; i < 400 && m.phase !== 'done'; i++) m.update(1 / 60);
  if (m.result.goals !== 1) throw new Error('버저비터 골 무시됨');
});
check('실패 후 다음 공격으로 재시작(스테이지 유지)', () => {
  const m = new Match(1, 'normal'); play(m); m.goals = 2; const t0 = m.time;
  m.fail('steal', m.defs[0]);
  for (let i = 0; i < 200 && m.phase !== 'ready'; i++) m.update(1 / 60);
  if (m.phase !== 'ready' || m.goals !== 2 || m.combo !== 0 || m.ball.owner == null) throw new Error('재시작 이상');
  if (!(m.time < t0)) throw new Error('실패 연출 중 시간이 흐르지 않음');
});
check('5스테이지: 실패 시 5초 감소 · 상대 4점 고정', () => {
  const m = new Match(4, 'normal'); play(m); const t0 = m.time;
  m.fail('out');
  if (Math.abs((t0 - m.time) - 5) > 0.01 || m.opp !== 4) throw new Error('t=' + (t0 - m.time));
  if (m.timeMax !== 130) throw new Error('보통 5스테이지 시간 ' + m.timeMax);
});
check('얼음판: 공격마다 무작위 구름 모양 · 판정과 모양 일치', () => {
  const m = new Match(2, 'normal');
  const shapes = new Set();
  for (let k = 0; k < 12; k++) {
    m.newAttack();
    const km = m.iceMask; if (!km) throw new Error('얼음 없음');
    let n = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (let y = 0; y < km.h; y++) for (let x = 0; x < km.w; x++) if (km.data[y * km.w + x]) { n++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (n < 1500) throw new Error('얼음이 너무 작음 ' + n);
    // 네모가 아니다: 전체 경계 상자에서 얼음이 차지하는 비율이 1보다 확실히 작다
    const fill = n / ((maxX - minX + 1) * (maxY - minY + 1));
    if (fill > 0.85) throw new Error('너무 네모남 ' + fill.toFixed(2));
    // 시작 위치와 골문 앞은 비어 있음
    for (const p of m.P) if (m.onIce(p.x, p.y)) throw new Error('시작 위치가 얼음 위');
    if (m.onIce(GOAL.x - 10, GOAL.cy)) throw new Error('골문 앞이 얼음');
    // 판정 = 지도
    const px = minX + km.x0 + 0.5, py = minY + km.y0 + 0.5;
    if (m.onIce(px, py) !== !!km.data[minY * km.w + minX]) throw new Error('판정 불일치');
    shapes.add(n);
  }
  if (shapes.size < 6) throw new Error('모양이 거의 같음');
  // 얼음 위에선 관성: 같은 입력에서 가속이 느리다
  const k = m.iceMask; let ix = -1, iy = -1;
  for (let y = 5; y < k.h - 5 && ix < 0; y++) for (let x = 5; x < k.w - 5; x++) if (k.data[y * k.w + x] && k.data[y * k.w + x + 3] && k.data[(y + 3) * k.w + x] && k.data[(y - 3) * k.w + x] && k.data[y * k.w + x - 3]) { ix = x; iy = y; break; }
  const ch = { x: ix + k.x0 + 0.5, y: iy + k.y0 + 0.5, vx: 0, vy: 0 };
  m.moveChar(ch, 1, 0, 80, 1 / 60);
  if (!(ch.vx < 5)) throw new Error('얼음 위 가속이 너무 빠름 ' + ch.vx);
});
check('콤보 배율 최대 5배', () => { const m = new Match(0, 'easy'); m.combo = 40; if (m.mult() !== 5) throw new Error(m.mult()); });
check('제자리 패스 반복은 점수 없음', () => {
  const m = new Match(0, 'easy'); play(m);
  m.defs.forEach(d => { d.state = 'down'; d.t = 999; d.x = 400; d.y = 60; });
  let before;
  for (let k = 0; k < 6; k++) {
    const a = m.ctrl, bmate = m.mate(a);
    a.x = 100; a.y = 150; bmate.x = 100; bmate.y = 110 + (k % 2) * 80; bmate.vx = bmate.vy = 0; m.placeBallAtFeet();
    if (k === 3) before = m.score;
    m.doPass(a);
    for (let i = 0; i < 90 && m.ball.state === 'pass'; i++) m.update(1 / 60);
  }
  if (m.score !== before) throw new Error('점수 증가 ' + (m.score - before));
});
check('웅심이 태클 1회 버티기, 옹심이는 뺏김', () => {
  const m = new Match(0, 'normal'); play(m);
  m.tackleHit(m.woong, m.defs[0]); if (m.phase !== 'play') throw new Error('웅심이 뺏김');
  m.tackleHit(m.woong, m.defs[0]); if (m.phase !== 'fail') throw new Error('두 번째도 버팀');
  const m2 = new Match(0, 'normal'); play(m2); m2.ctrl = m2.ong; m2.ball.owner = m2.ong;
  m2.tackleHit(m2.ong, m2.defs[0]); if (m2.phase !== 'fail') throw new Error('옹심이 버팀');
});
check('저장: 기록 · 해금 · 별 · 설정 유지', () => {
  SAVE.data = SAVE.blank();
  const o = SAVE.record('hard', 0, { score: 12345, goals: 3, cleared: true, stars: [true, false, true] });
  if (!o.unlockedNext || SAVE.data.unlocked.hard !== 2 || SAVE.data.unlocked.easy !== 1) throw new Error('해금');
  SAVE.data.settings.mute = true; SAVE.save();
  SAVE.record('hard', 0, { score: 100, goals: 1, cleared: false, stars: [false, false, false] });
  SAVE.load();
  const s = SAVE.data.stages.hard[0];
  if (s.best !== 12345 || !s.stars[0] || s.stars[1] || !s.stars[2] || !SAVE.data.settings.mute || SAVE.data.unlocked.hard !== 2) throw new Error(JSON.stringify(s));
  store[SAVE.KEY] = '{broken'; SAVE.load(); if (SAVE.data.unlocked.easy !== 1) throw new Error('손상 복구 실패');
});
console.log(fails ? `\n실패 ${fails}건` : '\n모든 검사 통과');
process.exit(fails ? 1 : 0);
