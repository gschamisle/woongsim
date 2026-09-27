'use strict';
// ─────────────────────────────────────────────
// 로컬 저장: 난이도별 해금 · 최고 점수 · 별 · 설정
// ─────────────────────────────────────────────
const SAVE = {
  KEY: 'woongsim-miracle-onetwo-v1',
  data: null,

  blank() {
    const stages = {};
    for (const d of DIFF_KEYS) {
      stages[d] = STAGES.map(() => ({ best: 0, bestGoals: 0, stars: [false, false, false], cleared: false }));
    }
    return { unlocked: { easy: 1, normal: 1, hard: 1 }, stages, settings: { mute: false, shake: true }, endingSeen: {} };
  },

  load() {
    const d = this.blank();
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          for (const k of DIFF_KEYS) {
            const u = s.unlocked && s.unlocked[k];
            if (Number.isInteger(u)) d.unlocked[k] = U.clamp(u, 1, STAGES.length);
            const arr = s.stages && s.stages[k];
            if (Array.isArray(arr)) arr.forEach((st, i) => {
              if (i >= STAGES.length || !st) return;
              const t = d.stages[k][i];
              t.best = Math.max(0, +st.best || 0);
              t.bestGoals = Math.max(0, +st.bestGoals || 0);
              t.cleared = !!st.cleared;
              if (Array.isArray(st.stars)) t.stars = [0, 1, 2].map(j => !!st.stars[j]);
            });
          }
          if (s.settings) {
            d.settings.mute = !!s.settings.mute;
            d.settings.shake = s.settings.shake !== false;
          }
          if (s.endingSeen) d.endingSeen = s.endingSeen;
        }
      }
    } catch (e) { /* 저장소 차단 · 손상 시 기본값 */ }
    this.data = d;
    return d;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* 무시 */ }
  },

  // 결과 반영. 반환: { newBest, newStars:[bool...], unlockedNext }
  record(diffKey, stageIdx, res) {
    const st = this.data.stages[diffKey][stageIdx];
    const out = { newBest: false, newStars: [false, false, false], unlockedNext: false };
    if (res.score > st.best) { st.best = res.score; out.newBest = true; }
    st.bestGoals = Math.max(st.bestGoals, res.goals);
    res.stars.forEach((v, i) => { if (v && !st.stars[i]) { st.stars[i] = true; out.newStars[i] = true; } });
    if (res.cleared) {
      st.cleared = true;
      const next = stageIdx + 2;
      if (next <= STAGES.length && this.data.unlocked[diffKey] < next) {
        this.data.unlocked[diffKey] = next; out.unlockedNext = true;
      }
    }
    this.save();
    return out;
  },

  totalStars(diffKey) {
    return this.data.stages[diffKey].reduce((a, s) => a + s.stars.filter(Boolean).length, 0);
  },
};
