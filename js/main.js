'use strict';
// ─────────────────────────────────────────────
// 시작점: 화면 크기 맞춤 · 고정 스텝 루프 · 포인터 좌표 변환
// ─────────────────────────────────────────────
(() => {
  const gc = document.getElementById('game'), uc = document.getElementById('ui'), wrap = document.getElementById('wrap');
  const g = gc.getContext('2d'), u = uc.getContext('2d');
  g.imageSmoothingEnabled = false;
  let scale = 1, dpr = 1;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const touch = document.body.classList.contains('touch');
    const portrait = vh > vw;
    // 세로 화면이면 아래쪽을 가상 패드 자리로 남긴다
    const availH = touch && portrait ? vh * 0.62 : vh;
    // 가로로 긴 휴대폰: 오른쪽에 패스·슛 버튼 자리를 비운다 (골대가 가려지지 않게)
    const wide = touch && !portrait && vw / vh >= 1.9;
    const reserveR = wide ? 124 : 0;
    let s = Math.min((vw - reserveR) / W, availH / H);
    if (s >= 2) s = Math.floor(s);
    scale = Math.max(0.5, s);
    // 휴대폰은 UI 캔버스 해상도를 2배까지만 (성능)
    dpr = Math.min(window.devicePixelRatio || 1, touch ? 2 : 3);
    const cw = Math.round(W * scale), ch = Math.round(H * scale);
    for (const c of [gc, uc]) { c.style.width = cw + 'px'; c.style.height = ch + 'px'; }
    uc.width = Math.round(cw * dpr); uc.height = Math.round(ch * dpr);
    wrap.style.left = Math.max(0, Math.round((vw - reserveR - cw) / 2)) + 'px';
    wrap.style.top = (touch && portrait ? Math.round(Math.max(0, (availH - ch) / 2)) : Math.round((vh - ch) / 2)) + 'px';
    wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  IN.onAny(() => { AU.init(); });

  // 클릭/탭 → 게임 좌표
  gc.addEventListener('pointerdown', e => {
    AU.init();
    const r = gc.getBoundingClientRect();
    IN.setPointer({ x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H });
  });

  SAVE.load();
  AU.setMuted(SAVE.data.settings.mute);
  IN.setupTouch();
  resize();
  SPR.build();

  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('12px Galmuri11'), document.fonts.load('12px Galmuri11B'), document.fonts.load('10px Galmuri9')]).catch(() => { })
    : Promise.resolve();

  Promise.all([fontsReady, SPR.tryOverrides()]).then(() => {
    GAME.go(new TitleScene());
    let last = performance.now(), acc = 0;
    const STEP = 1 / 60;
    function step() { GAME.scene.update(STEP); IN.endStep(); }
    // 테스트용: 화면이 가려져 있어도 게임을 직접 진행 (__WO.tick(초))
    window.__WO.tick = (sec = 1) => { for (let i = 0; i < Math.round(sec * 60); i++) step(); render(); };
    function frame(now) {
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.1) dt = 0.1;
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 4) { step(); acc -= STEP; steps++; }
      if (steps >= 4) acc = 0;
      render();
      // 플레이 중에만 왼쪽 화면 전체를 이동 패드로 사용
      const playing = GAME.scene instanceof PlayScene && !GAME.scene.paused;
      if (playing !== document.body.classList.contains('playing')) document.body.classList.toggle('playing', playing);
      requestAnimationFrame(frame);
    }
    function render() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      u.setTransform(1, 0, 0, 1, 0, 0);
      u.clearRect(0, 0, uc.width, uc.height);
      const k = scale * dpr;
      u.setTransform(k, 0, 0, k, 0, 0);
      TXT.ctx = u;
      GAME.scene.draw(g, u);
    }
    requestAnimationFrame(frame);
  });

  // 다른 앱으로 전환하면 자동 일시정지 · 소리 멈춤
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const sc = GAME.scene;
      if (sc instanceof PlayScene && !sc.paused && sc.m.phase !== 'done') { sc.paused = true; sc.sel = 0; }
      AU.suspend();
    } else AU.resume();
  });

  // 오프라인 실행 (서버로 열었을 때만)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }

  // 디버그/테스트용 훅 (콘솔에서 상태 확인)
  window.__WO = { GAME, SAVE, IN, get match() { return GAME.scene && GAME.scene.m; } };
})();
