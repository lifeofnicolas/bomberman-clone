// ---------------------------------------------------------------------------
// localStorage persistence for settings and records. Fails silently when
// storage is unavailable (private mode, file:// in some browsers).
// ---------------------------------------------------------------------------

const Save = {
  KEY: 'bomberman.v1',

  defaults() {
    return {
      muted: false,
      musicVolume: 0.5,
      sfxVolume: 1,
      shake: true,
      difficulty: 'normal',
      progress: { easy: 1, normal: 1, hard: 1 }, // worlds unlocked per difficulty
      battle: { humans: 1, bots: 1, skill: 'normal' },
      touchUI: null, // null = auto-detect, true/false = forced
      highScores: { easy: 0, normal: 0, hard: 0 },
      bestLevel: { easy: 0, normal: 0, hard: 0 },
      battleWins: 0,
    };
  },

  load() {
    const base = this.defaults();
    try {
      const raw = window.localStorage.getItem(this.KEY);
      if (!raw) return base;
      const data = JSON.parse(raw);
      return this.merge(base, data);
    } catch (err) {
      return base;
    }
  },

  merge(base, data) {
    if (!data || typeof data !== 'object') return base;
    for (const key of Object.keys(base)) {
      if (!(key in data)) continue;
      const bv = base[key];
      const dv = data[key];
      if (bv && typeof bv === 'object' && !Array.isArray(bv)) base[key] = this.merge(bv, dv);
      else base[key] = dv;
    }
    return base;
  },

  save(data) {
    try {
      window.localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (err) {
      /* ignore */
    }
  },
};
