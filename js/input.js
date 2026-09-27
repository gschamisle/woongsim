'use strict';
// ─────────────────────────────────────────────
// 입력: 키보드(e.code 기준이라 한/영 상태와 무관) + 모바일 가상 패드 + 포인터(메뉴 클릭)
// 눌림(hit)은 고정 스텝이 한 번 소비할 때까지 유지된다.
// ─────────────────────────────────────────────
const IN = (() => {
  const MAP = {
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    pass: ['KeyZ', 'KeyJ'], shoot: ['KeyX', 'KeyK'],
    confirm: ['Enter', 'Space', 'KeyZ', 'NumpadEnter'], back: ['Escape', 'Backspace', 'KeyX'],
    pause: ['Escape', 'KeyP'], retry: ['KeyR'], mute: ['KeyM'], shake: ['KeyH'],
  };
  const held = new Set(), hitSet = new Set(), relSet = new Set();
  const vHeld = new Set();                 // 가상 버튼
  const stick = { x: 0, y: 0, active: false };
  let pointer = null;                      // 마지막 클릭(게임 좌표)
  let anyKey = false;
  const listeners = [];

  function actionsFor(code) { const a = []; for (const k in MAP) if (MAP[k].includes(code)) a.push(k); return a; }

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    anyKey = true;
    listeners.forEach(f => f());
    if (e.repeat) return;
    for (const a of actionsFor(e.code)) { if (!held.has(a + ':' + e.code)) hitSet.add(a); held.add(a + ':' + e.code); }
  });
  window.addEventListener('keyup', e => {
    for (const a of actionsFor(e.code)) { held.delete(a + ':' + e.code); relSet.add(a); }
  });
  window.addEventListener('blur', () => { held.clear(); vHeld.clear(); stick.x = stick.y = 0; });

  function isDown(a) {
    if (vHeld.has(a)) return true;
    for (const k of held) if (k.startsWith(a + ':')) return true;
    return false;
  }

  // ── 가상 패드 ─────────────────
  function setupTouch() {
    const body = document.body;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if ('ontouchstart' in window || coarse) body.classList.add('touch');
    window.addEventListener('touchstart', () => { body.classList.add('touch'); listeners.forEach(f => f()); }, { passive: true });

    // 이동 패드: 왼쪽 화면 어디를 눌러도 그 자리에 패드가 생긴다 (플레이 중)
    const st = document.getElementById('stick'), knob = document.getElementById('knob'), zone = document.getElementById('stickZone');
    let sid = null, cx = 0, cy = 0;
    const R = () => st.offsetWidth / 2 - 10;
    const moveStick = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const r = R(), d = Math.hypot(dx, dy);
      if (d > r) { dx *= r / d; dy *= r / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const nx = dx / r, ny = dy / r, m = Math.hypot(nx, ny);
      if (m < 0.22) { stick.x = stick.y = 0; } else { stick.x = nx; stick.y = ny; }
      stick.active = true;
    };
    const startStick = (e, floating) => {
      e.preventDefault(); AU.init();
      if (sid !== null) return;
      sid = e.pointerId;
      if (floating) {
        const half = st.offsetWidth / 2;
        const x = Math.min(Math.max(e.clientX, half + 4), window.innerWidth / 2);
        const y = Math.min(Math.max(e.clientY, half + 4), window.innerHeight - half - 4);
        st.style.left = (x - half) + 'px'; st.style.top = (y - half) + 'px'; st.style.bottom = 'auto';
        st.classList.add('float');
      }
      const r = st.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      (floating ? zone : st).setPointerCapture(sid);
      moveStick(e);
    };
    const endStick = e => {
      if (e.pointerId !== sid) return;
      sid = null; stick.x = stick.y = 0; stick.active = false; knob.style.transform = '';
      st.style.left = st.style.top = st.style.bottom = ''; st.classList.remove('float');
    };
    st.addEventListener('pointerdown', e => startStick(e, false));
    zone.addEventListener('pointerdown', e => startStick(e, true));
    for (const el of [st, zone]) {
      el.addEventListener('pointermove', e => { if (e.pointerId === sid) moveStick(e); });
      el.addEventListener('pointerup', endStick); el.addEventListener('pointercancel', endStick);
    }

    const bind = (id, actions) => {
      const b = document.getElementById(id);
      const on = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); for (const a of actions) { if (!vHeld.has(a)) hitSet.add(a); vHeld.add(a); } AU.init(); listeners.forEach(f => f()); };
      const off = e => { b.classList.remove('on'); for (const a of actions) { if (vHeld.has(a)) relSet.add(a); vHeld.delete(a); } };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
      b.addEventListener('contextmenu', e => e.preventDefault());
    };
    bind('bPass', ['pass', 'confirm']);
    bind('bShoot', ['shoot']);
    const pb = document.getElementById('bPause');
    pb.addEventListener('pointerdown', e => { e.preventDefault(); hitSet.add('pause'); AU.init(); });
  }

  // 진동 피드백 (흔들림·진동 설정이 켜져 있을 때, 지원 기기에서만)
  function buzz(pattern) {
    try { if (navigator.vibrate && SAVE.data && SAVE.data.settings.shake && document.body.classList.contains('touch')) navigator.vibrate(pattern); } catch (e) { }
  }

  return {
    setupTouch, buzz,
    down: isDown,
    hit(a) { return hitSet.has(a); },
    rel(a) { return relSet.has(a); },
    consume(a) { hitSet.delete(a); },
    // 이동 방향 (정규화). 키보드 우선, 없으면 스틱
    dir() {
      let x = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
      let y = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0);
      if (x || y) { const m = Math.hypot(x, y); return { x: x / m, y: y / m }; }
      if (stick.x || stick.y) { const m = Math.max(1, Math.hypot(stick.x, stick.y)); return { x: stick.x / m, y: stick.y / m }; }
      return { x: 0, y: 0 };
    },
    // 메뉴용 방향 입력 (스틱은 무시; 메뉴는 탭으로)
    endStep() { hitSet.clear(); relSet.clear(); pointer = null; },
    setPointer(p) { pointer = p; },
    get pointer() { return pointer; },
    onAny(f) { listeners.push(f); },
    get anyKey() { return anyKey; },
  };
})();
