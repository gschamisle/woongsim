'use strict';
// ─────────────────────────────────────────────
// WebAudio 칩튠 · 효과음 · 관중 응원(북 + 박수)
// 외부 파일 없이 전부 합성한다.
// ─────────────────────────────────────────────
const AU = (() => {
  let ac = null, master, musicBus, sfxBus, crowdBus, noiseBuf, crowdSrc, crowdFilter, crowdGain;
  let muted = false;
  const seq = { song: null, step: 0, next: 0, timer: null, tempo: 140, chant: 0, intense: false };
  let crowdBase = 0.2, crowdBoost = 0;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
    crowdBus = ac.createGain(); crowdBus.gain.value = 0.9; crowdBus.connect(master);
    // 노이즈 버퍼
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 관중 웅성임: 루프 노이즈 → 밴드패스
    crowdSrc = ac.createBufferSource(); crowdSrc.buffer = noiseBuf; crowdSrc.loop = true;
    crowdFilter = ac.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 700; crowdFilter.Q.value = 0.6;
    crowdGain = ac.createGain(); crowdGain.gain.value = 0;
    crowdSrc.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(crowdBus);
    crowdSrc.start();
    seq.timer = setInterval(schedule, 25);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.02);
  }

  // ── 기본 음원 ─────────────────
  function tone(freq, t, dur, type = 'square', vol = 0.2, bus = sfxBus, slideTo = null, attack = 0.005) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol = 0.2, type = 'highpass', freq = 2000, bus = sfxBus, q = 0.7) {
    if (!ac) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function kickDrum(t, vol = 0.5, bus = musicBus) { tone(150, t, 0.16, 'sine', vol, bus, 45); }
  function snare(t, vol = 0.25, bus = musicBus) { noise(t, 0.12, vol, 'bandpass', 1800, bus, 0.8); tone(220, t, 0.06, 'triangle', vol * 0.5, bus, 120); }
  function hat(t, vol = 0.08, bus = musicBus) { noise(t, 0.03, vol, 'highpass', 7000, bus); }
  function clap(t, vol = 0.18) {
    for (let i = 0; i < 3; i++) noise(t + i * 0.012, 0.05, vol, 'bandpass', 1400 + i * 300, crowdBus, 1.2);
  }
  function bigDrum(t, vol = 0.35) { tone(90, t, 0.28, 'sine', vol, crowdBus, 50); noise(t, 0.06, vol * 0.3, 'lowpass', 400, crowdBus); }

  // ── 곡 데이터 (16분음표 단위, 0 = 쉼표) ─────────────────
  const SONGS = {
    title: {
      tempo: 118,
      lead: [67, 0, 72, 0, 76, 0, 72, 0, 74, 0, 71, 0, 67, 0, 0, 0, 69, 0, 72, 0, 77, 0, 76, 0, 74, 72, 71, 0, 72, 0, 0, 0,
        76, 0, 76, 77, 79, 0, 76, 0, 77, 0, 74, 0, 71, 0, 0, 0, 72, 0, 74, 0, 76, 0, 79, 0, 77, 0, 74, 0, 72, 0, 0, 0],
      chords: [48, 55, 53, 48, 45, 50, 43, 48], drums: 'k...h...s...h...k.k.h...s...h.h.',
    },
    stage: {
      tempo: 146,
      lead: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 76, 74, 72, 0, 0, 0, 74, 0, 77, 0, 81, 0, 79, 0, 77, 76, 74, 0, 76, 0, 0, 0,
        79, 0, 79, 81, 79, 0, 76, 0, 77, 0, 77, 79, 77, 0, 74, 0, 76, 0, 76, 77, 79, 0, 84, 0, 83, 0, 79, 0, 81, 0, 83, 0],
      chords: [48, 53, 55, 48, 45, 53, 55, 55], drums: 'k.h.s.h.k.k.s.hhk.h.s.h.k.h.s.ss',
    },
    night: {
      tempo: 150,
      lead: [69, 0, 72, 0, 76, 0, 72, 74, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 77, 0, 76, 74, 72, 0, 74, 0, 0, 0,
        81, 0, 79, 0, 76, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 77, 0, 79, 0, 81, 0, 83, 0, 84, 0, 0, 0],
      chords: [45, 41, 43, 48, 45, 41, 43, 43], drums: 'k.h.s.hkk.h.s.h.k.h.s.hkk.hhs.ss',
    },
    tense: {
      tempo: 168,
      lead: [76, 0, 76, 0, 79, 0, 76, 0, 81, 0, 79, 0, 76, 0, 74, 0, 76, 0, 76, 0, 79, 0, 81, 0, 83, 0, 84, 0, 83, 0, 81, 0,
        84, 0, 83, 0, 81, 0, 79, 0, 81, 0, 79, 0, 76, 0, 79, 0, 81, 0, 81, 83, 84, 0, 86, 0, 88, 0, 86, 0, 84, 0, 0, 0],
      chords: [45, 45, 41, 41, 43, 43, 40, 45], drums: 'kkh.s.hkkkh.s.hhkkh.s.hkk.h.sss',
    },
    ending: {
      tempo: 104,
      lead: [76, 0, 74, 0, 72, 0, 67, 0, 69, 0, 72, 0, 74, 0, 0, 0, 76, 0, 79, 0, 77, 76, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0,
        72, 0, 74, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 0, 0, 77, 0, 76, 0, 74, 0, 71, 0, 72, 0, 0, 0, 0, 0, 0, 0],
      chords: [48, 45, 41, 43, 48, 45, 41, 48], drums: 'k.......s.......k.......s...h...',
    },
    result: {
      tempo: 130,
      lead: [72, 76, 79, 84, 0, 0, 79, 84, 0, 0, 0, 0, 0, 0, 0, 0],
      chords: [48, 48], drums: 'k...s...k.k.s...', once: true,
    },
  };

  function schedule() {
    if (!ac || !seq.song) return;
    const song = SONGS[seq.song];
    const tempo = seq.intense ? Math.max(song.tempo, 168) : song.tempo;
    const stepDur = 60 / tempo / 4;
    while (seq.next < ac.currentTime + 0.12) {
      const i = seq.step, t = seq.next;
      const L = song.lead.length;
      if (song.once && i >= L) { seq.song = null; return; }
      const n = song.lead[i % L];
      if (n) tone(mtof(n), t, stepDur * 1.7, 'square', 0.085, musicBus);
      // 베이스: 8스텝마다 코드
      const ch = song.chords[Math.floor((i % L) / 8) % song.chords.length];
      const bp = i % 8;
      if (bp === 0 || bp === 3 || bp === 4 || bp === 6) tone(mtof(ch + (bp === 4 ? 7 : bp === 6 ? 12 : 0)), t, stepDur * 1.4, 'triangle', 0.22, musicBus);
      // 드럼
      const dch = song.drums[i % song.drums.length];
      if (dch === 'k') kickDrum(t, 0.38);
      else if (dch === 's') snare(t, 0.16);
      else if (dch === 'h') hat(t, 0.05);
      if (seq.intense && i % 2 === 0) hat(t, 0.04);
      // 관중 응원: 큰북 + "짝짝 짝짝짝" 박수
      if (seq.chant > 0) {
        const cv = seq.chant;
        const c16 = i % 16;
        if (c16 === 0 || c16 === 8) bigDrum(t, 0.22 * cv);
        if ([0, 4, 8, 10, 12].includes(c16) && Math.floor(i / 16) % 2 === 1) clap(t, 0.12 * cv);
        if (seq.intense && (c16 === 4 || c16 === 12)) bigDrum(t, 0.18 * cv);
      }
      seq.step++; seq.next += stepDur;
    }
  }

  function music(name) {
    if (!ac) { seq.song = name; return; }
    if (seq.song === name && !SONGS[name].once) return;
    seq.song = name; seq.step = 0; seq.next = ac.currentTime + 0.05; seq.intense = false;
  }
  function stopMusic() { seq.song = null; }
  function setIntense(v) { seq.intense = v; }
  function setChant(v) { seq.chant = v; }

  // 관중 소리 크기 (0~1). boost는 순간 함성.
  function setCrowd(level) { crowdBase = level; }
  function roar(amount = 1) { crowdBoost = Math.min(1.4, crowdBoost + amount); }
  function tick(dt) {
    if (!ac) return;
    crowdBoost = Math.max(0, crowdBoost - dt * 0.55);
    const v = 0.03 + crowdBase * 0.07 + crowdBoost * 0.3;
    crowdGain.gain.setTargetAtTime(v, ac.currentTime, 0.08);
    crowdFilter.frequency.setTargetAtTime(600 + crowdBoost * 600, ac.currentTime, 0.1);
  }

  // ── 효과음 ─────────────────
  function sfx(name, arg = 0) {
    if (!ac) return;
    const t = ac.currentTime + 0.005;
    switch (name) {
      case 'pass': tone(620, t, 0.07, 'square', 0.14, sfxBus, 900); noise(t, 0.04, 0.15, 'lowpass', 900); break;
      case 'recv': tone(880, t, 0.05, 'square', 0.08); break;
      case 'kick': tone(190, t, 0.12, 'sine', 0.5, sfxBus, 60); noise(t, 0.06, 0.3, 'lowpass', 1500); break;
      case 'power':
        tone(160, t, 0.18, 'sine', 0.6, sfxBus, 45); noise(t, 0.08, 0.4, 'lowpass', 1200);
        noise(t + 0.02, 0.3, 0.18, 'bandpass', 3000, sfxBus, 2); break;
      case 'charge': tone(300 + arg * 500, t, 0.05, 'square', 0.04); break;
      case 'full': tone(1320, t, 0.08, 'square', 0.08); tone(1760, t + 0.06, 0.1, 'square', 0.08); break;
      case 'post': tone(1250, t, 0.5, 'square', 0.12); tone(1680, t, 0.45, 'triangle', 0.14); tone(830, t, 0.3, 'sine', 0.2); break;
      case 'whistle':
        for (let i = 0; i < (arg || 1); i++) {
          const s = t + i * 0.22;
          const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
          o.type = 'sine'; o.frequency.value = 2250; l.frequency.value = 28; lg.gain.value = 120;
          l.connect(lg); lg.connect(o.frequency);
          g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.12, s + 0.01);
          g.gain.setValueAtTime(0.12, s + (arg > 2 && i === arg - 1 ? 0.55 : 0.16));
          g.gain.exponentialRampToValueAtTime(0.0001, s + (arg > 2 && i === arg - 1 ? 0.7 : 0.2));
          o.connect(g); g.connect(sfxBus); o.start(s); l.start(s); o.stop(s + 0.8); l.stop(s + 0.8);
        }
        break;
      case 'goal':
        [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(mtof(m), t + i * 0.06, 0.25, 'square', 0.1));
        noise(t, 0.3, 0.25, 'lowpass', 600); roar(1.3); break;
      case 'net': noise(t, 0.25, 0.25, 'bandpass', 500, sfxBus, 0.5); break;
      case 'steal': tone(420, t, 0.25, 'square', 0.12, sfxBus, 120); break;
      case 'save': tone(140, t, 0.12, 'sine', 0.4, sfxBus, 70); noise(t, 0.1, 0.25, 'lowpass', 800); roar(0.4); break;
      case 'warn': tone(990, t, 0.05, 'square', 0.07); tone(990, t + 0.09, 0.05, 'square', 0.07); break;
      case 'lunge': noise(t, 0.2, 0.2, 'bandpass', 900, sfxBus, 1); break;
      case 'shield': tone(300, t, 0.1, 'square', 0.12, sfxBus, 500); tone(600, t + 0.08, 0.1, 'square', 0.1); break;
      case 'combo': tone(mtof(72 + Math.min(arg, 12)), t, 0.09, 'square', 0.09); tone(mtof(79 + Math.min(arg, 12)), t + 0.05, 0.1, 'square', 0.07); break;
      case 'onetwo': [79, 84, 88].forEach((m, i) => tone(mtof(m), t + i * 0.045, 0.12, 'square', 0.09)); break;
      case 'break': tone(mtof(74), t, 0.07, 'square', 0.1); tone(mtof(81), t + 0.06, 0.12, 'square', 0.1); break;
      case 'gu': [67, 71, 74, 79, 83, 86].forEach((m, i) => tone(mtof(m), t + i * 0.05, 0.2, 'square', 0.1)); roar(0.9); break;
      case 'ui': tone(700, t, 0.04, 'square', 0.07); break;
      case 'ok': tone(880, t, 0.05, 'square', 0.09); tone(1320, t + 0.05, 0.08, 'square', 0.09); break;
      case 'back': tone(500, t, 0.06, 'square', 0.08, sfxBus, 300); break;
      case 'star': tone(mtof(84 + arg * 4), t, 0.2, 'square', 0.1); tone(mtof(91 + arg * 4), t + 0.08, 0.25, 'triangle', 0.1); break;
      case 'tick': tone(1500, t, 0.03, 'square', 0.05); break;
      case 'fail': tone(392, t, 0.15, 'square', 0.1); tone(330, t + 0.15, 0.15, 'square', 0.1); tone(262, t + 0.3, 0.3, 'square', 0.1); break;
      case 'firework': noise(t, 0.5, 0.2, 'lowpass', 1200); tone(600 + Math.random() * 600, t, 0.3, 'sine', 0.05, sfxBus, 200); break;
    }
  }

  function suspend() { if (ac && ac.state === 'running') ac.suspend(); }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  return { init, setMuted, suspend, resume, music, stopMusic, setIntense, setChant, setCrowd, roar, tick, sfx, get ready() { return !!ac; } };
})();
