'use strict';
// ─────────────────────────────────────────────
// 경기 시뮬레이션
//  핵심 루프: 드리블로 유인 → 패스(조작 전환) → 패스한 쪽 침투 → 리턴 패스 → 원투 피니시
// ─────────────────────────────────────────────

const FAIL_TEXT = {
  steal: '뺏겼다!', intercept: '가로채기!', save: '선방!', block: '슛 차단!', post: '골대! 아깝다!',
  out: '아웃!', miss: '빗나갔다!', gk: '키퍼 캐치!',
};

function mkPlayer(id) {
  return {
    id, s: CHARS[id], x: 0, y: 0, vx: 0, vy: 0, face: 1, mode: 'support', tx: 0, ty: 0,
    animDist: 0, kickT: 0, charging: false, chargeT: 0, aim: 0, fullSnd: false, shotOneTwo: false,
    oneTwoT: 0, shieldUsed: false, slowT: 0, grace: 0, reevalT: 0, runT: 0, failT: 0,
    bufPass: 0, bufShot: 0, pendingShot: null, possX: 0, flashT: 0, celebrate: false, onIce: false, lastChargeTick: 0,
  };
}

class Match {
  constructor(stageIdx, diffKey) {
    this.si = stageIdx; this.stage = STAGES[stageIdx]; this.dk = diffKey; this.diff = DIFFS[diffKey];
    this.timeMax = stageTime(this.stage, diffKey); this.time = this.timeMax;
    this.timeStar = stageTimeStar(this.stage, diffKey);
    this.goals = 0; this.opp = this.stage.oppScore || 0;
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.gauge = 0; this.gu = 0;
    this.attackNo = 0; this.layoutIdx = -1; this.stale = 0;
    this.woong = mkPlayer('woong'); this.ong = mkPlayer('ong'); this.P = [this.woong, this.ong];
    this.ctrl = null;
    this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, state: 'own', owner: null, spin: 0, trail: [], pass: null, shot: null, ignore: null, ignoreT: 0, dx: 1, dy: 0, netT: 0 };
    this.defs = [];
    this.gk = { x: GOAL.x - 7, y: GOAL.cy, vy: 0, state: 'set', t: 0, lean: 0, leanT: 0, nextLean: 1.5, diveY: 0, startY: 0, boss: false, saveDir: 0 };
    this.fx = { parts: [], pops: [], shake: 0, shakeMag: 0, hitstop: 0, flash: 0, ripple: null, slow: 0, banner: null, ghosts: [], streaks: [] };
    this.crowdExcite = 0.2;
    this.t = 0; this.phase = 'ready'; this.phaseT = 0;
    this.lastPass = null; this.prevPass = null;
    this.resolved = false;
    this.wind = this.stage.wind ? { dir: U.pick([-1, 1]), str: 0.5, t: 9, warned: false, nextDir: 1, nextStr: 0.5 } : null;
    this.ice = []; this.iceMask = null;
    this.tut = this.stage.tutorial ? { step: 0, active: true, t: 0 } : null;
    this.hint = null;
    this.stats = { oneTwoGoals: 0, passes: 0, breaks: 0 };
    this.tied = false; this.ceremony = false;
    this.result = null;
    this.newAttack(true);
    if (this.stage.finale) AU.setIntense(false);
    if (!this.tut) this.setHint(this.stage.lesson, 5.5);
  }

  // ── 도우미 ─────────────────────────
  mate(p) { return p === this.woong ? this.ong : this.woong; }
  mult() { return Math.min(5, 1 + this.combo * 0.5); }
  onIce(x, y) {
    const k = this.iceMask; if (!k) return false;
    const ix = Math.floor(x) - k.x0, iy = Math.floor(y) - k.y0;
    return ix >= 0 && iy >= 0 && ix < k.w && iy < k.h && k.data[iy * k.w + ix] === 1;
  }

  // 얼음판: 구역(사각형) 안에 크고 작은 원을 무작위로 뿌려 녹아 붙은 구름·물웅덩이 모양을 만든다.
  // 픽셀 지도로 저장해서 화면에 보이는 모양과 미끄러짐 판정이 정확히 같다.
  buildIce(rects) {
    if (!rects.length) { this.ice = []; this.iceMask = null; return; }
    const x0 = F.x0, y0 = F.y0, w = F.x1 - F.x0, h = F.y1 - F.y0;
    const data = new Uint8Array(w * h);
    const blobs = [];
    for (const r of rects) {
      const base = Math.min(r.w, r.h);
      const n = U.clamp(Math.round(r.w * r.h / (base * base * 0.3)), 4, 12);
      const circles = [];
      for (let i = 0; i < n; i++) {
        const rad = base * U.rand(0.17, 0.27);
        // 긴 쪽을 따라 고르게 퍼뜨리되 조금씩 흔든다
        const t = (i + U.rand(0.2, 0.8)) / n;
        const cx = r.w >= r.h ? r.x + r.w * t : r.x + r.w / 2 + U.rand(-0.3, 0.3) * r.w;
        const cy = r.w >= r.h ? r.y + r.h / 2 + U.rand(-0.3, 0.3) * r.h : r.y + r.h * t;
        circles.push({ x: cx, y: cy, r: rad });
      }
      // 가장자리에 작은 혹을 붙여 구름처럼
      for (let i = U.randi(4, 7); i > 0; i--) {
        const c = U.pick(circles), a = Math.random() * Math.PI * 2;
        circles.push({ x: c.x + Math.cos(a) * c.r * 1.0, y: c.y + Math.sin(a) * c.r * 1.0, r: c.r * U.rand(0.3, 0.5) });
      }
      // 경기장 가장자리·시작 구역·골문 앞에서 잘려 직선이 되지 않게 원을 안쪽으로 당긴다
      const L = 112, Rr = GOAL.x - 34, T = F.y0 + 8, B = F.y1 - 8;
      for (const c of circles) {
        c.r = Math.min(c.r, (B - T) * 0.3);
        c.x = U.clamp(c.x, L + c.r, Rr - c.r); c.y = U.clamp(c.y, T + c.r, B - c.r);
      }
      const pad = base * 0.6;
      const bx0 = Math.max(0, Math.floor(r.x - pad - x0)), bx1 = Math.min(w, Math.ceil(r.x + r.w + pad - x0));
      const by0 = Math.max(0, Math.floor(r.y - pad - y0)), by1 = Math.min(h, Math.ceil(r.y + r.h + pad - y0));
      for (let py = by0; py < by1; py++) for (let px = bx0; px < bx1; px++) {
        const X = px + x0 + 0.5, Y = py + y0 + 0.5;
        let f = 0;
        // 시작 위치 근처(왼쪽 끝)와 골문 앞, 경기장 테두리는 비워 두되 둥글게 줄어들게
        const edge = Math.min(X - 104, GOAL.x - 26 - X, Y - F.y0 - 3, F.y1 - 3 - Y);
        if (edge <= 0) continue;
        for (const c of circles) f += (c.r * c.r) / ((X - c.x) ** 2 + (Y - c.y) ** 2 + 1);
        if (f * Math.min(1, edge / 14) >= 1) data[py * w + px] = 1;
      }
      blobs.push({ circles });
    }
    // 외톨이 픽셀 정리 (가장자리를 매끈하게)
    for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
      const i = py * w + px, nb = data[i - 1] + data[i + 1] + data[i - w] + data[i + w];
      if (data[i] && nb <= 1) data[i] = 0; else if (!data[i] && nb >= 3) data[i] = 1;
    }
    this.ice = blobs;
    this.iceMask = { x0, y0, w, h, data, ver: (this.iceMask ? this.iceMask.ver : 0) + 1 };
  }
  windAy() { return this.wind ? this.wind.dir * this.wind.str * 105 : 0; }
  activeDefs() { return this.defs.filter(d => d.state !== 'down'); }
  pop(text, x, y, color = '#fff', size = 11, life = 1.0) {
    // 가까운 곳에 막 뜬 팝업이 있으면 위로 쌓는다
    for (let i = 0; i < 4; i++) {
      if (!this.fx.pops.some(p => p.t < 0.6 && Math.abs(p.x - x) < 60 && Math.abs(p.y - p.t * 18 - y) < 11)) break;
      y -= 12;
    }
    this.fx.pops.push({ text, x, y, t: 0, life, color, size });
    if (this.fx.pops.length > 5) this.fx.pops.shift();
  }
  banner(text, sub = '', color = C.yellow, life = 1.6, big = true) { this.fx.banner = { text, sub, color, t: 0, life, big }; }
  shake(mag, dur) { if (!SAVE.data.settings.shake) return; this.fx.shake = Math.max(this.fx.shake, dur); this.fx.shakeMag = Math.max(this.fx.shakeMag, mag); }
  burst(x, y, n, colors, spd = 80, life = 0.6, grav = 0, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
      this.fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? spd * 0.5 : 0), t: 0, life: life * (0.6 + Math.random() * 0.6), c: U.pick(colors), grav, size });
    }
  }
  addPoints(n) { this.score += Math.round(n); }
  addCombo(n) {
    this.combo += n; this.maxCombo = Math.max(this.maxCombo, this.combo);
    AU.sfx('combo', this.combo);
  }
  addGauge(v) {
    if (this.gu > 0) return;
    this.gauge = Math.min(100, this.gauge + v);
    if (this.gauge >= 100) {
      this.gu = TUNE.guTime; this.gauge = 100;
      this.banner('GREAT UNION!', '함께라서 더 빠르게!', C.orange, 1.4);
      AU.sfx('gu'); AU.setChant(1.3); IN.buzz([20, 40, 20]); this.crowdExcite = 1;
    }
  }
  setHint(text, t = 99) { this.hint = text ? { text, t } : null; }

  // ── 공격 준비 ─────────────────────────
  newAttack(first = false) {
    const st = this.stage, d = this.diff;
    let li;
    if (st.finale) li = Math.min(this.goals, st.layouts.length - 1);
    else { do { li = U.randi(0, st.layouts.length - 1); } while (st.layouts.length > 1 && li === this.layoutIdx); }
    this.layoutIdx = li;
    const mirror = Math.random() < 0.5 ? -1 : 1;
    const lay = st.layouts[li].slice(0, d.maxDefs);
    const tutSlow = this.tut && this.tut.active ? 0.85 : 1;
    this.defs = lay.map((L, i) => ({
      i, role: L.r, x: L.x, y: F.cy + L.dy * mirror, homeX: L.x, homeY: F.cy + L.dy * mirror, vx: 0, vy: 0,
      state: 'move', t: 0, cd: 0.9, dirX: -1, dirY: 0, face: -1, beaten: false, engaged: 0, wasAhead: false,
      reactT: Math.random() * d.react, tgtX: L.x, tgtY: F.cy + L.dy * mirror, chasing: false, animDist: 0, onIce: false,
      speed: TUNE.defBase * d.defSpeed * st.defMul * tutSlow * ({ press: 1, block: 0.95, zone: 0.9, mark: 0.97 }[L.r]),
    }));
    this.buildIce(st.ice ? st.iceSets[li % st.iceSets.length].map(r => mirror > 0 ? { ...r } : { ...r, y: F.y0 + F.y1 - r.y - r.h }) : []);

    // 공격수 배치
    const carrier = (this.attackNo % 3 === 2 && !(this.tut && this.tut.active)) ? this.ong : this.woong;
    const other = this.mate(carrier);
    const cy = F.cy + U.rand(-28, 28);
    carrier.x = 56; carrier.y = cy;
    other.x = 96; other.y = cy + (cy > F.cy ? -50 : 50);
    for (const p of this.P) {
      Object.assign(p, { vx: 0, vy: 0, face: 1, charging: false, chargeT: 0, oneTwoT: 0, shieldUsed: false, slowT: 0, grace: 0.5, kickT: 0, failT: 0, bufPass: 0, bufShot: 0, pendingShot: null, celebrate: false, flashT: 0 });
      p.tx = p.x; p.ty = p.y;
    }
    carrier.mode = 'ctrl'; other.mode = 'support'; other.reevalT = 0;
    carrier.possX = carrier.x;
    this.ctrl = carrier;
    const b = this.ball;
    Object.assign(b, { state: 'own', owner: carrier, vx: 0, vy: 0, z: 0, pass: null, shot: null, ignore: null, trail: [], netT: 0 });
    this.placeBallAtFeet();
    // 골키퍼
    Object.assign(this.gk, { x: GOAL.x - 7, y: GOAL.cy, vy: 0, state: 'set', t: 0, lean: 0, leanT: 0, nextLean: U.rand(1.2, 2.4) });
    this.gk.boss = !!(st.finale && this.goals >= 4);
    this.lastPass = this.prevPass = null;
    this.stale = 0; this.resolved = false;
    this.phase = 'ready'; this.phaseT = TUNE.readyTime + (first ? 0.6 : 0);
    this.attackNo++;
    this.fx.ripple = null;
    if (this.tut && this.tut.active) { this.tut.step = 0; this.tut.t = 0; }
    if (this.gk.boss) this.banner('최후의 수문장', '움찔하는 쪽의 반대편을 노려요!', C.yellow, 2.0, false);
  }

  placeBallAtFeet() {
    const b = this.ball, o = b.owner; if (!o) return;
    const sp = Math.hypot(o.vx, o.vy);
    let dx = o.face, dy = 0;
    if (sp > 10) { dx = o.vx / sp; dy = o.vy / sp; b.dx = dx; b.dy = dy; }
    else if (b.dx) { dx = b.dx; dy = b.dy * 0.5; }
    const touch = sp > 10 ? (Math.sin(this.t * 17) + 1) * (o.id === 'woong' ? 0.9 : 1.6) : 0;
    const dd = o.s.ballDist + touch;
    b.x = U.clamp(o.x + dx * dd, F.x0 + 2, F.x1 - 3);
    b.y = U.clamp(o.y + dy * dd + 1, F.y0 + 2, F.y1 - 2);
    b.z = 0; b.vx = o.vx; b.vy = o.vy;
  }

  // ── 메인 업데이트 ─────────────────────────
  update(dt) {
    const fx = this.fx;
    AU.tick(dt);
    this.updateFx(dt);
    if (fx.hitstop > 0) { fx.hitstop -= dt; return; }
    let sdt = dt;
    if (fx.slow > 0) { fx.slow -= dt; sdt = dt * 0.3; }
    this.t += sdt;
    this.crowdExcite = Math.max(this.gu > 0 ? 0.8 : 0.15 + this.stage.crowd * 0.2, this.crowdExcite - dt * 0.35);
    if (this.hint && this.hint.t < 99) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }

    switch (this.phase) {
      case 'ready':
        this.phaseT -= dt;
        this.idleAll(sdt);
        if (this.phaseT <= 0) { this.phase = 'play'; AU.sfx('whistle', 1); }
        break;
      case 'play':
        this.time -= sdt;
        if (this.time <= 0) {
          this.time = 0;
          // 슛이 날아가는 중이면 결과까지 기다림 (버저비터)
          if (this.ball.state !== 'shot') { this.timeUp(); break; }
        }
        this.updatePlay(sdt);
        break;
      case 'fail':
        this.time = Math.max(0, this.time - sdt);
        this.phaseT -= dt;
        this.updateAftermath(sdt);
        if (this.phaseT <= 0) { if (this.time <= 0) this.timeUp(); else this.newAttack(); }
        break;
      case 'goal':
        this.phaseT -= dt;
        this.updateCelebration(sdt);
        if (this.phaseT < this.goalPause - 1.0 && (IN.hit('pass') || IN.hit('shoot') || IN.hit('confirm')) && !this.ceremony) this.phaseT = 0;
        if (this.phaseT <= 0) {
          if (this.goals >= this.stage.goals) this.finish(true);
          else if (this.time <= 0) this.timeUp();
          else this.newAttack();
        }
        break;
      case 'timeup':
        this.phaseT -= dt;
        this.updateAftermath(sdt);
        if (this.phaseT <= 0) this.finish(false);
        break;
    }
  }

  timeUp() {
    if (this.phase === 'timeup' || this.phase === 'done') return;
    this.phase = 'timeup'; this.phaseT = 1.6; this.time = 0;
    AU.sfx('whistle', 3);
    this.banner('타임 업!', this.goals + ' / ' + this.stage.goals + '골', '#fff', 1.6);
    for (const p of this.P) p.failT = 2;
  }

  finish(cleared) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    const timeLeft = Math.ceil(this.time);
    const timeBonus = cleared ? timeLeft * 50 : 0;
    const stars = [cleared, cleared && this.maxCombo >= this.stage.comboStar, cleared && timeLeft >= this.timeStar];
    this.result = {
      cleared, goals: this.goals, target: this.stage.goals, basePts: this.score, timeBonus,
      score: this.score + timeBonus, timeLeft, maxCombo: this.maxCombo, stars, oneTwoGoals: this.stats.oneTwoGoals,
    };
    AU.setIntense(false);
  }

  idleAll(dt) {
    for (const p of this.P) { p.vx *= 0.8; p.vy *= 0.8; }
    this.placeBallAtFeet();
    for (const d of this.defs) this.moveChar(d, 0, 0, 0, dt);
  }

  // ── 플레이 ─────────────────────────
  updatePlay(dt) {
    const b = this.ball;
    this.updateWind(dt);
    if (this.gu > 0) {
      this.gu -= dt; this.gauge = Math.max(0, this.gu / TUNE.guTime * 100);
      if (this.gu <= 0) { this.gu = 0; this.gauge = 0; AU.setChant(this.stage.crowd); }
    }
    // 패스 비행 중 입력 버퍼 (원터치 패스/슛)
    if (b.state === 'pass' && b.pass) {
      const r = b.pass.to;
      if (IN.hit('pass')) r.bufPass = 0.35;
      if (IN.hit('shoot')) r.bufShot = 0.35;
    }
    for (const p of this.P) {
      p.bufPass = Math.max(0, p.bufPass - dt); p.bufShot = Math.max(0, p.bufShot - dt);
      p.slowT = Math.max(0, p.slowT - dt); p.grace = Math.max(0, p.grace - dt);
      p.kickT = Math.max(0, p.kickT - dt); p.flashT = Math.max(0, p.flashT - dt);
      if (p === this.ctrl && (b.owner === p || b.state === 'loose' || b.state === 'shot')) this.updateCtrl(p, dt);
      else this.updateMate(p, dt);
    }
    for (const d of this.defs) this.updateDef(d, dt);
    this.updateGK(dt);
    this.separate();
    if (b.state === 'own') this.placeBallAtFeet();
    this.updateBall(dt);
    if (b.state === 'own') this.checkBreakthrough(dt);
    this.updateTutorial(dt);
    // GREAT UNION 잔상
    if (this.gu > 0 && Math.floor(this.t * 20) !== Math.floor((this.t - dt) * 20)) {
      for (const p of this.P) if (Math.hypot(p.vx, p.vy) > 20) this.fx.ghosts.push({ id: p.id, pose: this.poseOf(p), x: p.x, y: p.y, flip: p.face < 0, t: 0 });
    }
  }

  updateWind(dt) {
    const w = this.wind; if (!w) return;
    w.t -= dt;
    if (w.t <= 2.6 && !w.warned) {
      w.warned = true; w.nextDir = U.pick([-1, 1]); w.nextStr = U.pick([0.35, 0.7, 1.0]);
      AU.sfx('warn');
    }
    if (w.t <= 0) { w.dir = w.nextDir; w.str = w.nextStr; w.t = U.rand(8, 11); w.warned = false; }
  }

  // 캐릭터 이동 (얼음이면 관성)
  moveChar(ch, dx, dy, spd, dt, margin = 6) {
    const ice = this.ice.length ? this.onIce(ch.x, ch.y) : false;
    const acc = ice ? 150 : 1000, top = spd * (ice ? 1.25 : 1);
    ch.vx = U.approach(ch.vx, dx * top, acc * dt);
    ch.vy = U.approach(ch.vy, dy * top, acc * dt);
    ch.x += ch.vx * dt; ch.y += ch.vy * dt;
    const x0 = F.x0 + margin, x1 = F.x1 - margin, y0 = F.y0 + margin, y1 = F.y1 - margin;
    if (ch.x < x0) { ch.x = x0; ch.vx = 0; } else if (ch.x > x1) { ch.x = x1; ch.vx = 0; }
    if (ch.y < y0) { ch.y = y0; ch.vy = 0; } else if (ch.y > y1) { ch.y = y1; ch.vy = 0; }
    if (Math.abs(ch.vx) > 4) ch.face = ch.vx > 0 ? 1 : -1;
    ch.animDist = (ch.animDist || 0) + Math.hypot(ch.vx, ch.vy) * dt;
    if (ice && !ch.onIce && Math.hypot(ch.vx, ch.vy) > 30) this.burst(ch.x, ch.y, 3, ['#fff', C.ice], 30, 0.4);
    ch.onIce = ice;
  }
  moveToward(ch, tx, ty, spd, dt, margin = 6) {
    const dx = tx - ch.x, dy = ty - ch.y, d = Math.hypot(dx, dy);
    if (d < 2) { this.moveChar(ch, 0, 0, spd, dt, margin); return d; }
    const s = Math.min(1, d / 14);
    this.moveChar(ch, dx / d * s, dy / d * s, spd, dt, margin);
    return d;
  }

  // ── 조작 캐릭터 ─────────────────────────
  updateCtrl(p, dt) {
    const b = this.ball, d = IN.dir();
    const hasBall = b.owner === p;
    let spd = p.s.speed * (hasBall ? p.s.dribble : 1);
    if (p.charging) spd *= 0.45;
    if (p.slowT > 0) spd *= 0.5;
    if (p.pendingShot) spd *= 0.3;
    if (this.gu > 0) spd *= 1.06;
    this.moveChar(p, d.x, d.y, spd, dt);
    if (hasBall) {
      if (p.oneTwoT > 0) p.oneTwoT = Math.max(0, p.oneTwoT - dt);
      if (p.pendingShot) {
        p.pendingShot.t -= dt;
        if (p.pendingShot.t <= 0) { const s = p.pendingShot; p.pendingShot = null; this.launchShot(p, s.speed, s.aim, s.charge, s.oneTwo); }
        return;
      }
      if (!p.charging) {
        if (IN.hit('pass')) { this.doPass(p); return; }
        if (IN.hit('shoot')) this.startCharge(p);
      }
      if (p.charging) {
        p.chargeT += dt;
        // 차징 중 ↑↓ = 코스 선택 (골대 기준 좌우)
        const ay = (IN.down('down') ? 1 : 0) - (IN.down('up') ? 1 : 0) || (Math.abs(d.y) > 0.4 ? Math.sign(d.y) : 0);
        p.aim = U.clamp(p.aim + ay * 2.8 * dt, -1, 1);
        const ch = Math.min(1, p.chargeT / p.s.chargeTime);
        if (ch >= 1 && !p.fullSnd) { p.fullSnd = true; AU.sfx('full'); }
        else if (!p.fullSnd && this.t - p.lastChargeTick > 0.08) { p.lastChargeTick = this.t; AU.sfx('charge', ch); }
        if (!IN.down('shoot') || p.chargeT > 1.6) this.releaseShot(p);
      }
    }
  }

  startCharge(p) {
    const d = IN.dir();
    p.charging = true; p.chargeT = 0; p.fullSnd = false;
    // 기본은 골대 가운데. 누르는 순간 ↑↓가 있으면 그쪽 구석
    p.aim = d.y > 0.35 ? 0.75 : d.y < -0.35 ? -0.75 : 0;
    p.shotOneTwo = p.oneTwoT > 0;
    p.oneTwoT = 0;
  }

  releaseShot(p) {
    p.charging = false;
    const charge = p.chargeT < 0.12 ? 0 : Math.min(1, p.chargeT / p.s.chargeTime);
    let speed = p.s.quickPow + (p.s.maxPow - p.s.quickPow) * charge;
    if (this.gu > 0) speed *= TUNE.guShot;
    p.kickT = 0.26;
    if (p.s.kickDelay > 0) p.pendingShot = { t: p.s.kickDelay, speed, aim: p.aim, charge, oneTwo: p.shotOneTwo };
    else this.launchShot(p, speed, p.aim, charge, p.shotOneTwo);
  }

  shotTarget(aim) { return { x: GOAL.x + 6, y: GOAL.cy + aim * (GOAL.half - 3) }; }

  launchShot(p, speed, aim, charge, oneTwo) {
    const b = this.ball;
    if (b.owner !== p) return;
    const tg = this.shotTarget(aim);
    const dx = tg.x - b.x, dy = tg.y - b.y, dd = Math.hypot(dx, dy) || 1;
    b.state = 'shot'; b.owner = null; b.vx = dx / dd * speed; b.vy = dy / dd * speed;
    b.shot = { strong: charge >= 0.7, charge, oneTwo, shooter: p, speed };
    b.ignore = p; b.ignoreT = 0.3; b.trail = [];
    p.kickT = 0.26;
    this.ctrl = p;
    const strong = charge >= 0.7;
    if (strong) { this.fx.hitstop = 0.06; this.shake(2, 0.15); AU.sfx('power'); this.burst(b.x, b.y, 8, [C.yellow, '#fff', C.orange], 90, 0.35); }
    else AU.sfx('kick');
    IN.buzz(strong ? 30 : 12);
    if (oneTwo) { AU.sfx('onetwo'); this.pop('원투!', p.x, p.y - 36, C.yellow, 12, 0.8); }
    this.gkOnShot();
    this.crowdExcite = Math.max(this.crowdExcite, 0.5); AU.roar(0.25);
    if (this.tut && this.tut.active && this.tut.step < 4) this.tut.step = 4;
  }

  // 패스 목표(리드 패스)와 바람 반영 도착점
  passPlan(p, m) {
    const b = this.ball;
    const spd = TUNE.passSpeed * (this.gu > 0 ? TUNE.guPass : 1);
    let px = m.x, py = m.y, T = 0;
    // 동료가 향하는 곳을 기준으로 앞으로 보냄
    const hv = m.mode === 'run' || m.mode === 'support' ? 0.85 : 0.5;
    for (let i = 0; i < 3; i++) {
      T = Math.max(TUNE.passMin, U.dist(b.x, b.y, px, py) / spd);
      px = m.x + m.vx * T * hv; py = m.y + m.vy * T * hv;
    }
    px = U.clamp(px, F.x0 + 10, F.x1 - 14); py = U.clamp(py, F.y0 + 8, F.y1 - 8);
    T = Math.max(TUNE.passMin, U.dist(b.x, b.y, px, py) / spd);
    const drift = 0.5 * this.windAy() * T * T;
    return { aimX: px, aimY: py, lx: px, ly: U.clamp(py + drift, F.y0 + 6, F.y1 - 6), T, spd, drift };
  }

  // 패스 가로채기 반경 — 실제 판정과 미리보기가 같은 값을 쓴다
  interceptR(d, flightT) {
    if (d.state === 'tell') return 4;          // 태클 준비 중엔 발이 묶여 몸통만
    // 발을 막 떠난 공은 몸통에 맞을 때만 → 점점 발을 뻗을 수 있게
    const k = U.clamp((flightT - 0.04) / 0.14, 0, 1);
    return 4.5 + (0.5 + this.diff.intercept) * k;
  }

  // 패스 경로 위의 위험 지점 (미리보기용)
  passDanger(plan) {
    const b = this.ball, ay = this.windAy();
    const vx = (plan.aimX - b.x) / plan.T, vy0 = (plan.aimY - b.y) / plan.T;
    const pts = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = plan.T * i / N;
      const x = b.x + vx * t, y = b.y + vy0 * t + 0.5 * ay * t * t;
      let danger = false;
      for (const d of this.defs) {
        if (d.state === 'down') continue;
        // 수비가 공 도착 전에 닿을 수 있는지 (반응 시간 이후 이동 거리 포함)
        const move = d.state === 'tell' ? 0 : Math.max(0, t - this.diff.react * 0.5) * d.speed * 0.9;
        const reach = this.interceptR(d, t) + 3 + Math.min(move, 14);
        if (U.dist(x, y, d.x, d.y - 2) < reach) { danger = true; break; }
      }
      if (U.dist(x, y, this.gk.x, this.gk.y) < 12 && x > F.x1 - 40) danger = true;
      pts.push({ x, y, danger });
    }
    return pts;
  }

  lureCount(p) {
    let n = 0;
    for (const d of this.defs) {
      if (d.state === 'down') continue;
      const dd = U.dist(p.x, p.y, d.x, d.y);
      if (dd < 58 || (d.chasing && dd < 85) || d.state === 'tell') n++;
    }
    return n;
  }

  doPass(p) {
    const b = this.ball, m = this.mate(p);
    if (b.owner !== p) return;
    const plan = this.passPlan(p, m);
    b.state = 'pass'; b.owner = null;
    b.vx = (plan.aimX - b.x) / plan.T; b.vy = (plan.aimY - b.y) / plan.T;
    b.pass = { from: p, to: m, T: plan.T, t: 0, lx: plan.lx, ly: plan.ly, sx: b.x, sy: b.y };
    b.ignore = p; b.ignoreT = 0.25; b.trail = [];
    m.mode = 'receive'; m.tx = plan.lx; m.ty = plan.ly;
    p.mode = 'run'; p.runT = 2.4; p.charging = false; p.oneTwoT = 0;
    this.chooseRun(p, plan.lx, plan.ly);
    p.kickT = 0.2;
    this.prevPass = this.lastPass;
    this.lastPass = { from: p.id, to: m.id, time: this.t, fx: p.x, fy: p.y, lured: this.lureCount(p) };
    for (const d of this.defs) d.passReact = this.diff.react * 0.5;
    this.ctrl = null;
    this.stats.passes++;
    AU.sfx('pass'); IN.buzz(8);
    if (this.tut && this.tut.active) {
      if (this.tut.step <= 1 && p === this.woong) this.tut.step = 2;
      else if (this.tut.step === 2 && p === this.ong) this.tut.step = 3;
    }
  }

  // 받은 뒤 처리 (조작 전환)
  receive(p, fromPass) {
    const b = this.ball;
    b.state = 'own'; b.owner = p; b.pass = null; b.trail = [];
    const prevCtrl = this.ctrl;
    this.ctrl = p; p.mode = 'ctrl'; p.grace = TUNE.graceAfterRecv; p.possX = p.x;
    p.flashT = prevCtrl !== p ? 0.6 : 0;
    const o = this.mate(p);
    if (o.mode === 'receive' || o.mode === 'ctrl') { o.mode = 'support'; o.reevalT = 0; }
    for (const d of this.defs) d.wasAhead = false;
    AU.sfx('recv');
    if (fromPass && this.lastPass && this.lastPass.to === p.id) {
      this.rewardPass(p);
      const pp = this.prevPass, lp = this.lastPass;
      if (pp && pp.from === p.id && pp.to === lp.from && this.t - pp.time < TUNE.oneTwoMemory) {
        p.oneTwoT = this.diff.oneTwo;
        this.addCombo(1); this.addGauge(6);
      }
    }
    // 버퍼 입력: 원터치 슛/패스
    if (p.bufShot > 0) {
      p.bufShot = 0; this.startCharge(p);
      if (!IN.down('shoot')) this.releaseShot(p);
    } else if (p.bufPass > 0) {
      p.bufPass = 0; this.placeBallAtFeet(); this.doPass(p);
    }
  }

  rewardPass(p) {
    const lp = this.lastPass, dx = p.x - lp.fx, m = this.mult();
    let pts = 0, gauge = 0, label = '';
    const lo = Math.min(lp.fx, p.x) + 4, hi = Math.max(lp.fx, p.x) - 4;
    const breakers = dx > 0 ? this.defs.filter(d => d.x > lo && d.x < hi).length : 0;
    const progressive = dx >= 24;
    if (progressive) {
      pts += 100 + Math.round(dx * 0.8); gauge += 10; this.addCombo(1); this.stale = 0; label = '전진 패스';
      if (breakers > 0) { pts += 150 * breakers; gauge += 8 * breakers; this.addCombo(1); label = '라인 돌파' + (breakers > 1 ? ' x' + breakers : '') + '!'; this.stats.breaks++; }
    } else {
      this.stale++;
      if (this.stale <= 2) { pts += 20; label = '패스'; }
      else { label = ''; this.setHint('제자리 패스는 점수가 없어요. 앞으로 전진!', 2.2); }
    }
    if (this.stale < 3) {
      if (lp.lured >= 2) { pts += 200; gauge += 10; label = '유인 패스! ' + label; }
      else if (lp.lured === 1 && lp.from === 'woong') { pts += 60; gauge += 4; label = '끌어당기기! ' + label; }
    }
    if (pts > 0) {
      const total = Math.round(pts * m);
      this.addPoints(total);
      this.pop((label ? label + ' ' : '') + '+' + total, p.x, p.y - 24, progressive ? '#fff' : '#cfd8d6', 10);
    }
    this.addGauge(gauge);
  }

  checkBreakthrough(dt) {
    const c = this.ball.owner; if (!c) return;
    for (const d of this.defs) {
      const dd = U.dist(c.x, c.y, d.x, d.y);
      if (dd < 30) { d.engaged = 1.0; if (d.x >= c.x - 2) d.wasAhead = true; }
      else d.engaged = Math.max(0, d.engaged - dt);
      if (!d.beaten && d.wasAhead && d.engaged > 0 && c.x > d.x + 8 && Math.abs(c.y - d.y) < 36) {
        d.beaten = true;
        const m = this.mult(), pts = Math.round(200 * m);
        this.addPoints(pts); this.addCombo(1); this.addGauge(15); this.stats.breaks++;
        this.pop('돌파! +' + pts, c.x, c.y - 30, C.yellow, 11);
        AU.sfx('break');
      }
    }
    // 드리블 전진은 제자리 패스 카운트를 초기화
    if (c.x - c.possX > 40) this.stale = 0;
  }

  // ── 동료 AI ─────────────────────────
  updateMate(p, dt) {
    const b = this.ball;
    const spd = p.s.speed * (this.gu > 0 ? 1.06 : 1);
    if (p.celebrate) return;
    switch (p.mode) {
      case 'receive': {
        if (b.state !== 'pass' || !b.pass || b.pass.to !== p) { p.mode = 'support'; p.reevalT = 0; break; }
        this.moveToward(p, p.tx, p.ty, spd * 1.05, dt);
        if (Math.hypot(p.vx, p.vy) < 10) p.face = b.x < p.x ? -1 : 1;
        break;
      }
      case 'run': {
        p.runT -= dt;
        const d = this.moveToward(p, p.tx, p.ty, spd, dt);
        if (d < 5 || p.runT <= 0) { p.mode = 'support'; p.reevalT = 0.4; }
        break;
      }
      default: {
        const c = b.owner && b.owner !== p ? b.owner : null;
        p.reevalT -= dt;
        if (c && p.reevalT <= 0) { this.chooseSupport(p, c); p.reevalT = 0.3; }
        if (!c && b.state === 'loose') { p.tx = b.x; p.ty = b.y; }
        this.moveToward(p, p.tx, p.ty, spd * 0.92, dt);
        if (Math.hypot(p.vx, p.vy) < 10) p.face = 1;
      }
    }
  }

  laneClear(ax, ay, bx, by) {
    let min = 999;
    for (const d of this.defs) {
      if (d.state === 'down') continue;
      const r = U.segDist(d.x, d.y, ax, ay, bx, by);
      if (r.t > 0.05) min = Math.min(min, r.d);
    }
    return min;
  }
  nearestDef(x, y) {
    let min = 999;
    for (const d of this.defs) if (d.state !== 'down') min = Math.min(min, U.dist(x, y, d.x, d.y));
    return min;
  }
  spotScore(x, y, fromX, fromY, p) {
    let s = Math.min(this.nearestDef(x, y), 60) * 1.2;
    const lane = this.laneClear(fromX, fromY, x, y);
    if (lane < 10) s -= 90; else if (lane < 18) s -= 35; else s += Math.min(lane, 40) * 0.5;
    s += (x - fromX) * 0.35;
    if (x > 330) s += 12;
    if (U.dist(fromX, fromY, x, y) < 30) s -= 40;
    s -= U.dist(p.x, p.y, x, y) * 0.12;
    if (y < F.y0 + 22 || y > F.y1 - 22) s -= 12;
    if (this.ice.length && this.onIce(x, y)) s -= 8;
    if (Math.abs(y - this.gk.y) < 20 && x > F.x1 - 50) s -= 30;
    return s;
  }
  clampSpot(x, y) { return [U.clamp(x, F.x0 + 16, F.x1 - 40), U.clamp(y, F.y0 + 14, F.y1 - 14)]; }

  // 공 가진 동료 기준 대각선 지원 위치
  chooseSupport(p, c) {
    const offs = [[45, -45], [45, 45], [75, -35], [75, 35], [22, -60], [22, 60], [100, -16], [100, 16], [62, -70], [62, 70], [-12, -55], [-12, 55]];
    let best = null, bs = -1e9;
    for (const [ox, oy] of offs) {
      const [x, y] = this.clampSpot(c.x + ox, c.y + oy);
      const s = this.spotScore(x, y, c.x, c.y, p);
      if (s > bs) { bs = s; best = [x, y]; }
    }
    // 흔들림 방지: 지금 목표가 크게 나쁘지 않으면 유지
    const cur = this.spotScore(p.tx, p.ty, c.x, c.y, p) + 10;
    if (best && (bs > cur || U.dist(p.tx, p.ty, c.x, c.y) > 150)) { p.tx = best[0]; p.ty = best[1]; }
  }

  // 패스한 캐릭터의 전방 침투 목표
  chooseRun(p, fromX, fromY) {
    let best = null, bs = -1e9;
    for (const ox of [65, 95, 125]) for (const oy of [-60, -30, 0, 30, 60]) {
      const [x, y] = this.clampSpot(p.x + ox, U.lerp(p.y, F.cy, 0.35) + oy);
      let s = Math.min(this.nearestDef(x, y), 60) * 1.3;
      const lane = this.laneClear(fromX, fromY, x, y);
      if (lane < 12) s -= 70; else s += Math.min(lane, 40) * 0.6;
      s += x * 0.18 - Math.abs(y - p.y) * 0.12;
      if (U.dist(fromX, fromY, x, y) < 34) s -= 40;
      if (this.ice.length && this.onIce(x, y)) s -= 6;
      if (s > bs) { bs = s; best = [x, y]; }
    }
    p.tx = best[0]; p.ty = best[1];
  }

  // ── 수비 AI ─────────────────────────
  updateDef(d, dt) {
    const b = this.ball, df = this.diff;
    const c = b.state === 'own' ? b.owner : null;
    d.cd -= dt;
    if (d.passReact !== undefined) d.passReact -= dt;
    switch (d.state) {
      case 'down':
        d.t -= dt; d.vx *= 0.85; d.vy *= 0.85; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.t <= 0) { d.state = 'move'; d.cd = 0.5; }
        return;
      case 'tell': {
        d.t -= dt;
        d.vx *= 0.7; d.vy *= 0.7;
        // 패스로 벗겨지면 준비 자세가 끝날 때까지 발이 묶임 (유인 패스의 보상)
        if (!c || c !== d.tellTarget) { if (d.t <= 0) { d.state = 'move'; d.cd = 0.4; } return; }
        // 예고 전반부는 방향을 따라가고, 후반부는 고정(피할 수 있게)
        if (d.t > df.tell * 0.45) {
          const dx = c.x - d.x, dy = c.y - d.y, dd = Math.hypot(dx, dy) || 1;
          d.dirX = dx / dd; d.dirY = dy / dd; d.face = dx >= 0 ? 1 : -1;
        }
        if (d.t <= 0) {
          d.state = 'lunge'; d.t = TUNE.lungeTime;
          d.vx = d.dirX * TUNE.lungeSpeed; d.vy = d.dirY * TUNE.lungeSpeed;
          AU.sfx('lunge');
        }
        return;
      }
      case 'lunge': {
        d.t -= dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.x = U.clamp(d.x, F.x0 + 4, F.x1 - 4); d.y = U.clamp(d.y, F.y0 + 4, F.y1 - 4);
        if (Math.random() < 0.5) this.fx.parts.push({ x: d.x, y: d.y + 1, vx: -d.vx * 0.1, vy: -8, t: 0, life: 0.35, c: '#d8e8c0', grav: 0, size: 1 });
        if (c && U.dist(d.x, d.y, c.x, c.y) < 11 && !this.resolved) { this.tackleHit(c, d); }
        else if (b.state === 'loose' && U.dist(d.x, d.y, b.x, b.y) < 9) { this.fail('steal', d); }
        if (d.t <= 0 && d.state === 'lunge') { d.state = 'down'; d.t = df.recover; }
        return;
      }
    }
    // 패스가 막 나간 순간엔 반응 시간 동안 멈칫 (미리보기와 같은 전제)
    if (b.state === 'pass' && d.passReact > 0) { this.moveChar(d, 0, 0, d.speed, dt, 4); return; }
    // 이동 상태
    let tx = d.homeX, ty = d.homeY, spd = d.speed;
    d.chasing = false;
    const lure = c ? c.s.lureMul : 1;
    const cd = c ? U.dist(d.x, d.y, c.x, c.y) : 999;
    d.reactT -= dt;
    switch (d.role) {
      case 'press':
        if (c && cd < df.pressR * lure) { d.chasing = true; tx = c.x + c.vx * 0.15; ty = c.y + c.vy * 0.15; }
        else { tx = d.homeX; ty = d.homeY + (b.y - d.homeY) * 0.3; }
        break;
      case 'block':
        if (c) {
          if (d.reactT <= 0) {
            d.reactT = df.react;
            const m = this.mate(c);
            const L = U.dist(c.x, c.y, m.x, m.y) || 1;
            const t = U.clamp(Math.max(0.42, 22 / L), 0, 0.7);
            d.tgtX = U.lerp(c.x, m.x, t); d.tgtY = U.lerp(c.y, m.y, t);
          }
          tx = d.tgtX; ty = d.tgtY;
          if (cd < 28 * lure) { d.chasing = true; tx = c.x; ty = c.y; }
        } else { tx = d.tgtX; ty = d.tgtY; }
        break;
      case 'zone':
        tx = d.homeX + U.clamp((b.x - d.homeX) * 0.15, -16, 16);
        ty = U.clamp(U.lerp(F.cy, b.y, 0.65), d.homeY - 55, d.homeY + 55);
        if (c && cd < 34 * lure) { d.chasing = true; tx = c.x; ty = c.y; }
        break;
      case 'mark': {
        const m = c ? this.mate(c) : (b.pass ? b.pass.to : this.ong);
        if (d.reactT <= 0) { d.reactT = df.react; d.tgtX = m.x + 16; d.tgtY = m.y + (b.y - m.y) * 0.15; }
        tx = d.tgtX; ty = d.tgtY;
        if (c && cd < 26 * lure) { d.chasing = true; tx = c.x; ty = c.y; }
        break;
      }
    }
    // 패스 반응: 반응 시간이 지나면 가까운 패스 경로로 몸을 던짐
    if (b.state === 'pass' && b.pass && d.passReact <= 0) {
      const r = U.segDist(d.x, d.y, b.x, b.y, b.pass.lx, b.pass.ly);
      if (r.d < 40) { tx = r.cx; ty = r.cy; spd *= 1.1; }
    }
    // 서로 겹치지 않게 목표 약간 분산
    ty = U.clamp(ty, F.y0 + 8, F.y1 - 8);
    this.moveToward(d, tx, ty, spd, dt, 4);
    // 태클 시작 조건
    if (c && cd < TUNE.tackleRange && d.cd <= 0 && c.grace <= 0 && !this.resolved) {
      d.state = 'tell'; d.t = df.tell; d.tellTarget = c;
      const dd = cd || 1; d.dirX = (c.x - d.x) / dd; d.dirY = (c.y - d.y) / dd;
      AU.sfx('warn');
    }
  }

  tackleHit(c, d) {
    if (c.id === 'woong' && !c.shieldUsed) {
      c.shieldUsed = true; c.slowT = 0.35; c.grace = 0.5;
      d.state = 'down'; d.t = this.diff.recover; d.vx *= -0.3; d.vy *= -0.3; d.wasAhead = true; d.engaged = 1;
      this.pop('버텼다!', c.x, c.y - 34, '#fff', 11);
      AU.sfx('shield'); this.shake(1.5, 0.12); IN.buzz(25);
      this.burst(c.x, c.y - 8, 6, ['#fff', '#b9b9b9'], 60, 0.3);
      return;
    }
    d.state = 'down'; d.t = 0.8;
    this.fail('steal', d);
  }

  // 겹침 해소
  separate() {
    const bodies = [...this.P, ...this.defs.filter(d => d.state !== 'lunge')];
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], c = bodies[j];
      if (a.celebrate || c.celebrate) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), min = 11;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
      }
    }
    for (const b of bodies) { b.x = U.clamp(b.x, F.x0 + 4, F.x1 - 4); b.y = U.clamp(b.y, F.y0 + 4, F.y1 - 4); }
  }

  // ── 골키퍼 ─────────────────────────
  gkParams() {
    const d = this.diff, g = this.gk;
    return g.boss
      ? { react: d.gkReact * 0.9, speed: d.gkSpeed * 1.2, dive: d.gkDive * 1.12, reach: d.gkReach + 3, body: d.gkBody + 1, lean: Math.min(1, d.lean + 0.25) }
      : { react: d.gkReact, speed: d.gkSpeed, dive: d.gkDive, reach: d.gkReach, body: d.gkBody, lean: d.lean };
  }
  updateGK(dt) {
    const g = this.gk, b = this.ball, P = this.gkParams();
    switch (g.state) {
      case 'set': {
        g.nextLean -= dt;
        if (g.lean === 0 && g.nextLean <= 0) {
          g.nextLean = U.rand(1.0, 2.3);
          if (b.state === 'own' && b.x > 230 && Math.random() < P.lean) { g.lean = U.pick([-1, 1]); g.leanT = this.dk === 'easy' ? 0.8 : 0.6; }
        }
        if (g.lean !== 0) { g.leanT -= dt; if (g.leanT <= 0) g.lean = 0; }
        const ty = U.clamp(GOAL.cy + (b.y - GOAL.cy) * 0.62 + g.lean * 4, GOAL.cy - GOAL.half + 5, GOAL.cy + GOAL.half - 5);
        g.y = U.approach(g.y, ty, P.speed * (g.lean ? 0.5 : 1) * dt);
        const tx = GOAL.x - 7 - (b.x > 370 ? Math.min(7, (b.x - 370) * 0.09) : 0);
        g.x = U.approach(g.x, tx, 30 * dt);
        break;
      }
      case 'react':
        g.t -= dt;
        if (g.t <= 0) { g.state = 'dive'; g.t = 0.7; AU.sfx('lunge'); }
        break;
      case 'dive': {
        g.t -= dt;
        const lim = U.clamp(g.diveY, g.startY - P.reach, g.startY + P.reach);
        g.y = U.approach(g.y, lim, P.dive * dt);
        if (g.t <= 0) { g.state = 'set'; g.lean = 0; }
        break;
      }
      case 'save':
        g.t -= dt;
        break;
    }
  }
  gkOnShot() {
    const g = this.gk, b = this.ball, P = this.gkParams();
    if (g.state !== 'set') return;
    const T = Math.max(0.01, (g.x - b.x) / Math.max(1, b.vx));
    const crossY = b.y + b.vy * T + 0.5 * this.windAy() * 0.7 * T * T;
    let react = P.react;
    if (g.lean !== 0 && Math.abs(crossY - g.y) > 4) {
      if (Math.sign(crossY - g.y) !== g.lean) react += this.diff.leanPenalty;
      else react -= 0.04;
    }
    const err = this.dk === 'easy' ? U.rand(-5, 5) : this.dk === 'normal' ? U.rand(-2.5, 2.5) : U.rand(-1, 1);
    g.state = 'react'; g.t = Math.max(0.03, react); g.diveY = crossY + err; g.startY = g.y;
  }
  gkBody() {
    const g = this.gk, P = this.gkParams();
    return g.state === 'dive' ? P.body + 5 : P.body;
  }

  // ── 공 ─────────────────────────
  updateBall(dt) {
    const b = this.ball;
    const px = b.x, py = b.y;
    b.ignoreT = Math.max(0, b.ignoreT - dt);
    const sp = Math.hypot(b.vx, b.vy);
    b.spin += sp * dt * 0.12;
    if (b.state === 'pass' || b.state === 'shot' || b.state === 'loose') {
      if (b.state !== 'loose') b.vy += this.windAy() * dt * (b.state === 'shot' ? 0.7 : 1);
      if (b.state === 'loose') { const f = Math.max(0, 1 - 2.4 * dt); b.vx *= f; b.vy *= f; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (sp > 150 || b.state === 'shot') { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.shift(); }
      else if (b.trail.length) b.trail.shift();
    }
    switch (b.state) {
      case 'pass': {
        b.pass.t += dt;
        if (b.pass.t > b.pass.T * 1.25) { const f = Math.max(0, 1 - 3 * dt); b.vx *= f; b.vy *= f; }
        if (this.checkIntercept(px, py, false)) return;
        if (this.checkGKTouch(px, py, false)) return;
        // 받기: 받을 동료 또는 다른 공격수
        for (const p of this.P) {
          if (p === b.ignore && b.ignoreT > 0) continue;
          if (U.segDist(p.x, p.y, px, py, b.x, b.y).d < TUNE.receiveR) { this.receive(p, p === b.pass.to); return; }
        }
        if (Math.hypot(b.vx, b.vy) < 30) this.toLoose();
        break;
      }
      case 'shot': {
        b.z = Math.min(6, b.z + dt * 20);
        if (this.checkIntercept(px, py, true)) return;
        if (this.checkGKTouch(px, py, true)) return;
        if (this.checkGoalLine(px, py)) return;
        break;
      }
      case 'loose': {
        if (this.checkIntercept(px, py, false)) return;
        for (const p of this.P) {
          if (p === b.ignore && b.ignoreT > 0) continue;
          if (U.dist(p.x, p.y, b.x, b.y) < 9) { this.receive(p, false); return; }
        }
        break;
      }
      case 'dead': {
        const f = Math.max(0, 1 - 2.2 * dt); b.vx *= f; b.vy *= f;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z = Math.max(0, b.z - dt * 20);
        if (b.trail.length) b.trail.shift();
        return;
      }
      case 'net': {
        const f = Math.max(0, 1 - 6 * dt); b.vx *= f; b.vy *= f;
        b.x = Math.min(GOAL.x + GOAL.depth - 3, b.x + b.vx * dt); b.y += b.vy * dt;
        b.y = U.clamp(b.y, GOAL.cy - GOAL.half + 2, GOAL.cy + GOAL.half - 2);
        b.z = Math.max(0, b.z - dt * 20);
        if (b.trail.length) b.trail.shift();
        return;
      }
    }
    if (this.resolved) return;
    // 경기장 밖
    if (b.state === 'pass' || b.state === 'loose') {
      if (b.x >= GOAL.x) { this.fail('out'); b.state = 'dead'; return; }
    }
    if (b.x < F.x0 - 2 || b.y < F.y0 - 2 || b.y > F.y1 + 2 || b.x > F.x1 + 20) {
      this.fail(b.state === 'shot' ? 'miss' : 'out');
      b.state = 'dead';
    }
  }

  toLoose() {
    const b = this.ball;
    b.state = 'loose'; b.pass = null;
    // 가장 가까운 공격수가 줍도록 조작 전환
    const near = this.P.reduce((a, p) => U.dist(p.x, p.y, b.x, b.y) < U.dist(a.x, a.y, b.x, b.y) ? p : a);
    this.ctrl = near; near.mode = 'ctrl';
    const o = this.mate(near); if (o.mode === 'receive') o.mode = 'support';
  }

  checkIntercept(px, py, isShot) {
    const b = this.ball;
    for (const d of this.defs) {
      if (d.state === 'down') continue;
      const r = U.segDist(d.x, d.y - 2, px, py, b.x, b.y);
      const lim = isShot ? 6 : b.state === 'loose' ? 9 : this.interceptR(d, b.pass ? b.pass.t : 1);
      if (r.d < lim) {
        if (isShot) {
          b.state = 'dead'; b.vx = -Math.abs(b.vx) * 0.3 - 30; b.vy = U.rand(-90, 90);
          this.fail('block', d);
        } else {
          const reason = b.state === 'loose' ? 'steal' : 'intercept';
          b.state = 'dead'; b.vx = (d.x > b.x ? 1 : -1) * 40; b.vy = 0;
          this.fail(reason, d);
        }
        this.burst(b.x, b.y, 6, ['#fff', C.opp], 60, 0.3);
        return true;
      }
    }
    return false;
  }

  checkGKTouch(px, py, isShot) {
    const g = this.gk, b = this.ball;
    if (g.state === 'save') return false;
    const body = this.gkBody();
    const fx = g.x - 2;
    let hit = false, yc = b.y;
    if (px < fx && b.x >= fx) { const t = (fx - px) / ((b.x - px) || 1e-6); yc = py + (b.y - py) * t; hit = Math.abs(yc - g.y) <= body + 2; }
    else if (Math.abs(b.x - g.x) < 5 && Math.abs(b.y - g.y) <= body + 2) hit = true;
    if (!hit) return false;
    const catchIt = !isShot || (b.shot && !b.shot.strong && g.state !== 'dive');
    g.state = 'save'; g.t = 1.2; g.saveDir = Math.sign(g.y - g.startY) || 0;
    if (catchIt) { b.state = 'dead'; b.x = g.x - 4; b.y = g.y; b.vx = b.vy = 0; this.fail(isShot ? 'save' : 'gk'); }
    else {
      b.state = 'dead'; b.vx = -Math.abs(b.vx) * 0.3 - 40; b.vy = (yc < g.y ? -1 : 1) * U.rand(90, 150);
      this.fail('save');
    }
    this.shake(1.5, 0.12);
    return true;
  }

  checkGoalLine(px, py) {
    const b = this.ball;
    if (!(px < GOAL.x && b.x >= GOAL.x)) return false;
    const t = (GOAL.x - px) / ((b.x - px) || 1e-6);
    const yc = py + (b.y - py) * t;
    const off = Math.abs(yc - GOAL.cy);
    if (off <= GOAL.half - 2) { this.scoreGoal(yc); return true; }
    if (off <= GOAL.half + 2.5) {
      // 골대
      b.x = GOAL.x - 1; b.y = yc; b.vx = -Math.abs(b.vx) * 0.45; b.vy = (yc < GOAL.cy ? -1 : 1) * Math.abs(b.vy * 0.5 + 60);
      b.state = 'dead';
      AU.sfx('post'); this.shake(2, 0.15); AU.roar(0.6);
      this.fail('post');
      return true;
    }
    this.fail('miss'); b.state = 'dead';
    return true;
  }

  // ── 결과 처리 ─────────────────────────
  fail(reason, who) {
    if (this.resolved) return;
    this.resolved = true;
    this.phase = 'fail'; this.phaseT = TUNE.failPause;
    const c = this.ctrl || this.woong;
    for (const p of this.P) { p.charging = false; p.pendingShot = null; p.oneTwoT = 0; }
    if (reason === 'steal' || reason === 'intercept' || reason === 'block') c.failT = 1.2;
    const lost = this.combo;
    this.combo = 0;
    this.banner(FAIL_TEXT[reason] || '아웃!', lost >= 2 ? '콤보 ' + lost + ' 끊김' : '', reason === 'post' ? C.yellow : '#fff', 1.1, false);
    IN.buzz(reason === 'steal' || reason === 'intercept' ? 70 : 35);
    if (reason === 'steal' || reason === 'intercept') AU.sfx('steal');
    else if (reason === 'save' || reason === 'gk') AU.sfx('save');
    else if (reason === 'out' || reason === 'miss') { AU.sfx('whistle', 1); AU.roar(reason === 'miss' ? 0.5 : 0.1); }
    else if (reason === 'block') AU.sfx('save');
    const b = this.ball;
    if (b.state === 'own') {
      b.state = 'dead'; b.owner = null;
      const dx = who ? who.dirX || -1 : -1, dy = who ? who.dirY || 0 : 0;
      b.vx = dx * 90; b.vy = dy * 90;
    }
    if (who) { who.face = -1; }
    if (this.stage.finale) {
      this.time = Math.max(0, this.time - TUNE.stage5Penalty);
      this.pop('-' + TUNE.stage5Penalty + '초', 40, 30, C.red, 12, 1.2);
    }
    if (this.tut && this.tut.active) this.setHint(null);
  }

  scoreGoal(yc) {
    if (this.resolved) return;
    this.resolved = true;
    const b = this.ball, sh = b.shot || {};
    b.state = 'net'; b.y = yc; b.x = GOAL.x + 1;
    this.goals++;
    const m = this.mult();
    let pts = 1000, gauge = 30;
    const tags = [];
    if (sh.oneTwo) { pts += 800; gauge += 20; tags.push('원투 피니시!'); this.stats.oneTwoGoals++; }
    if (sh.strong) { pts += 200; tags.push('강슛'); }
    if (this.gu > 0) { pts += 300; tags.push('GREAT UNION'); }
    const total = Math.round(pts * m);
    this.addPoints(total);
    this.addCombo(sh.oneTwo ? 2 : 1);
    this.addGauge(gauge);
    this.fx.ripple = { x: GOAL.x + 5, y: yc, t: 0 };
    this.shake(3, 0.3);
    this.burst(GOAL.x - 4, yc, 26, [C.orange, C.yellow, '#fff', C.green], 140, 1.2, 180, 2);
    AU.sfx('goal'); AU.sfx('net'); IN.buzz([40, 60, 90]);
    this.crowdExcite = 1.6;
    if (sh.oneTwo) { this.fx.slow = 0.35; }
    this.phase = 'goal';
    const shooter = sh.shooter || this.ctrl || this.woong;
    for (const p of this.P) { p.celebrate = true; p.charging = false; p.pendingShot = null; }
    this.celebrateInfo = { shooter, t: 0, mx: U.clamp(shooter.x - 20, 200, 400), my: U.clamp(shooter.y, F.y0 + 30, F.y1 - 30) };
    this.goalPause = TUNE.goalPause;
    const sub = tags.join(' · ') + (tags.length ? '  ' : '') + '+' + U.comma(total);
    this.ceremony = false;
    if (this.stage.finale) {
      if (this.goals === 4) { this.tied = true; AU.setIntense(true); AU.setChant(1.4); this.goalPause += 0.8; this.banner('4 : 4 동점!', '관중석이 들썩여요! 한 골만 더!', C.yellow, 2.4); }
      else if (this.goals === 5) { this.ceremony = true; this.goalPause = 5.2; this.banner('미라클 5 : 4!', '웅심이와 옹심이의 합동 세리머니!', C.yellow, 4.6); AU.roar(1.5); }
      else this.banner('골!', sub, C.yellow, 2.0);
    } else this.banner('골!', sub, C.yellow, 2.0);
    this.phaseT = this.goalPause;
    if (sh.oneTwo) this.pop('원투 피니시!!', GOAL.x - 56, Math.min(F.y1 - 20, yc + 40), C.yellow, 14, 1.8);
    if (this.tut && this.tut.active) { this.tut.active = false; this.setHint('좋아요! 유인 → 패스 → 침투 → 리턴 → 슛, 이 흐름을 반복해요!', 3.5); }
  }

  updateAftermath(dt) {
    const b = this.ball;
    for (const p of this.P) { p.failT = Math.max(0, p.failT - dt); this.moveChar(p, 0, 0, 0, dt); p.kickT = Math.max(0, p.kickT - dt); }
    for (const d of this.defs) {
      if (d.state === 'lunge') { d.t -= dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.t <= 0) { d.state = 'down'; d.t = 0.6; } }
      else if (d.state === 'down') { d.t -= dt; d.vx *= 0.85; d.vy *= 0.85; if (d.t <= 0) d.state = 'move'; }
      else { if (d.state === 'tell') d.state = 'move'; this.moveChar(d, 0, 0, 0, dt, 4); }
    }
    if (this.gk.state === 'dive' || this.gk.state === 'react') this.updateGK(dt);
    this.updateBall(dt);
  }

  updateCelebration(dt) {
    const ci = this.celebrateInfo; ci.t += dt;
    this.updateBall(dt);
    const [a, o] = [ci.shooter, this.mate(ci.shooter)];
    if (this.ceremony) {
      // 합동 세리머니: 달려와 만나고 → 웅심이가 옹심이를 번쩍 들어올림
      const mx = 240, my = F.y1 - 34;
      this.moveToward(this.woong, mx, my, 90, dt);
      if (ci.t < 1.3) this.moveToward(this.ong, mx + 16, my, 110, dt);
      else { this.ong.x = this.woong.x; this.ong.y = this.woong.y + 0.5; this.ong.vx = this.ong.vy = 0; }
      if (ci.t > 1.3 && Math.floor(ci.t * 3) !== Math.floor((ci.t - dt) * 3)) {
        const fx = U.rand(60, 420), fy = U.rand(70, 140);
        this.burst(fx, fy, 22, [C.orange, C.yellow, '#fff', '#7fe0ff'], 70, 1.1, 40, 1);
        AU.sfx('firework');
      }
    } else {
      this.moveToward(a, ci.mx, ci.my, 80, dt);
      this.moveToward(o, ci.mx + (o.x < ci.mx ? -14 : 14), ci.my + 6, 90, dt);
    }
    for (const d of this.defs) this.moveChar(d, 0, 0, 0, dt, 4);
    if (this.gk.state !== 'save') this.gk.state = 'set';
  }

  updateTutorial(dt) {
    const tu = this.tut;
    if (!tu || !tu.active) return;
    tu.t += dt;
    const b = this.ball;
    const touch = document.body.classList.contains('touch');
    const P = touch ? '패스 버튼' : 'Z';
    const S = touch ? '슛 버튼' : 'X';
    if (tu.step === 0) {
      this.setHint('웅심이로 수비수를 끌어당겨 봐요  (이동: ' + (touch ? '왼쪽 패드' : '방향키 / WASD') + ')');
      const near = this.defs.some(d => U.dist(d.x, d.y, this.woong.x, this.woong.y) < 55);
      if ((near && tu.t > 0.8) || tu.t > 3.5) tu.step = 1;
    } else if (tu.step === 1) {
      this.setHint('지금! ' + P + '로 옹심이에게 패스  (점선 = 패스 길, 빨간색 = 위험)');
    } else if (tu.step === 2) {
      if (b.owner === this.ong) this.setHint('웅심이가 빈 공간으로 달려가요!  ' + P + '로 리턴 패스');
      else this.setHint('옹심이가 공을 받으면 조작이 바뀌어요');
    } else if (tu.step === 3) {
      if (b.owner === this.woong && this.woong.oneTwoT > 0) this.setHint('원투 타이밍! ' + S + '로 슛  (길게 = 강슛, 차징 중 ↑↓ = 코스)');
      else if (b.owner === this.woong) this.setHint(S + '로 슛! 골키퍼가 없는 구석을 노려요 (차징 중 ↑↓)');
      else this.setHint('리턴 패스가 날아가요!');
    } else if (tu.step === 4) this.setHint(null);
    // 옹심이가 직접 슛하는 경우 등
    if (tu.step === 2 && b.owner === this.ong && this.ong.charging) tu.step = 4;
  }

  // ── 연출 ─────────────────────────
  updateFx(dt) {
    const fx = this.fx;
    fx.shake = Math.max(0, fx.shake - dt); if (fx.shake <= 0) fx.shakeMag = 0;
    for (const p of fx.parts) { p.t += dt; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; }
    fx.parts = fx.parts.filter(p => p.t < p.life);
    for (const p of fx.pops) p.t += dt;
    fx.pops = fx.pops.filter(p => p.t < p.life);
    for (const g of fx.ghosts) g.t += dt;
    fx.ghosts = fx.ghosts.filter(g => g.t < 0.25);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > fx.banner.life) fx.banner = null; }
    if (fx.ripple) { fx.ripple.t += dt; if (fx.ripple.t > 1.4) fx.ripple = null; }
    // 바람 줄기
    if (this.wind) {
      const w = this.wind;
      if (Math.random() < w.str * 0.9) fx.streaks.push({ x: U.rand(F.x0, F.x1), y: w.dir > 0 ? F.y0 : F.y1, len: U.rand(5, 10), v: w.dir * w.str * U.rand(130, 190) });
      for (const s of fx.streaks) s.y += s.v * dt;
      fx.streaks = fx.streaks.filter(s => s.y > F.y0 - 12 && s.y < F.y1 + 12);
    }
  }

  // 렌더러가 쓰는 포즈 선택
  poseOf(p) {
    if (this.phase === 'goal' && p.celebrate) {
      if (this.ceremony && this.celebrateInfo.t > 1.3) return Math.floor(this.t * 5) % 2 ? 'cheer1' : 'cheer0';
      return Math.hypot(p.vx, p.vy) > 15 ? 'run' + (Math.floor(p.animDist / 6) % 4) : (Math.floor(this.t * 6) % 2 ? 'cheer1' : 'cheer0');
    }
    if (p.failT > 0) return 'fail';
    if (p.kickT > 0) return p.kickT > 0.2 ? 'kick0' : 'kick1';
    if (p.charging || p.pendingShot) return 'charge';
    if (Math.hypot(p.vx, p.vy) > 12) return 'run' + (Math.floor(p.animDist / 7) % 4);
    return Math.floor(this.t * 2.2 + (p.id === 'ong' ? 0.5 : 0)) % 2 ? 'idle1' : 'idle0';
  }
}
