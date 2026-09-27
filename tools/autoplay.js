// 브라우저 자동 플레이 봇 (검증용). 콘솔에서:
//   s=document.createElement('script');s.src='tools/autoplay.js';document.body.appendChild(s)
// 끄기: BOTK.on = false
(() => {
  const BOTK = window.BOTK = { keys: new Set(), hits: new Set(), dx: 0, dy: 0, on: true };
  const oDown = IN.down, oHit = IN.hit, oDir = IN.dir, oEnd = IN.endStep;
  IN.down = a => BOTK.on ? BOTK.keys.has(a) : oDown(a);
  IN.hit = a => BOTK.on ? (BOTK.hits.has(a) || oHit(a)) : oHit(a);
  IN.dir = () => { if (!BOTK.on) return oDir(); const m = Math.hypot(BOTK.dx, BOTK.dy); return m ? { x: BOTK.dx / m, y: BOTK.dy / m } : { x: 0, y: 0 }; };
  IN.endStep = () => { BOTK.hits.clear(); oEnd(); tick(); };
  function tick() {
    const m = window.__WO.match; BOTK.dx = 0; BOTK.dy = 0; BOTK.keys.clear();
    if (!BOTK.on || !m || m.phase !== 'play' || !m.ctrl) return;
    const b = m.ball, c = m.ctrl;
    if (b.state === 'loose') { BOTK.dx = b.x - c.x; BOTK.dy = b.y - c.y; return; }
    if (b.owner !== c) { BOTK.dx = 1; return; }
    const want = m.gk.lean ? -m.gk.lean : (m.gk.y > GOAL.cy ? -1 : 1);
    if (c.charging) {
      BOTK.keys.add(want > 0 ? 'down' : 'up'); BOTK.dy = want;
      if (c.chargeT < (c.id === 'woong' ? 0.3 : 0.2)) BOTK.keys.add('shoot');
      return;
    }
    const dg = U.dist(b.x, b.y, GOAL.x, GOAL.cy);
    const near = Math.min(...m.defs.filter(d => d.state !== 'down').map(d => U.dist(d.x, d.y, c.x, c.y)), 999);
    const tell = m.defs.some(d => d.state === 'tell' && U.dist(d.x, d.y, c.x, c.y) < 45);
    if (dg < 115 && (c.oneTwoT > 0 || dg < 80)) { BOTK.dy = want; BOTK.keys.add(want > 0 ? 'down' : 'up'); BOTK.hits.add('shoot'); BOTK.keys.add('shoot'); return; }
    const mate = m.mate(c), pl = m.passPlan(c, mate), safe = !m.passDanger(pl).some(p => p.danger);
    if ((near < 30 || tell) && safe && c.grace <= 0) { BOTK.hits.add('pass'); return; }
    if (safe && mate.x > c.x + 40 && near < 55 && c.grace <= 0) { BOTK.hits.add('pass'); return; }
    BOTK.dx = 1;
    const bl = m.defs.find(d => d.state !== 'down' && d.x > c.x && d.x - c.x < 50 && Math.abs(d.y - c.y) < 22);
    BOTK.dy = bl ? (c.y < bl.y ? -1 : 1) : (GOAL.cy - c.y) * 0.01;
  }
})();
