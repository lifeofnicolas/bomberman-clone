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
      battle: { humans: 1, bots: 1, skill: 'normal', map: 'small' },
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
      return this.sanitize(this.merge(base, data));
    } catch (err) {
      return base;
    }
  },

  // Copy saved values over the defaults, keeping only values of the expected type.
  merge(base, data) {
    if (!data || typeof data !== 'object') return base;
    for (const key of Object.keys(base)) {
      if (!(key in data)) continue;
      const bv = base[key];
      const dv = data[key];
      if (bv === null) {
        if (typeof dv === 'boolean' || dv === null) base[key] = dv;
        continue;
      }
      if (bv && typeof bv === 'object' && !Array.isArray(bv)) {
        base[key] = this.merge(bv, dv);
        continue;
      }
      if (typeof dv !== typeof bv) continue;
      if (typeof dv === 'number' && !Number.isFinite(dv)) continue;
      base[key] = dv;
    }
    return base;
  },

  // Clamp ranges and enums so a hand-edited or stale save cannot break menus or audio.
  sanitize(s) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    if (!DIFFICULTY[s.difficulty]) s.difficulty = 'normal';
    if (!BOT_TIERS[s.battle.skill]) s.battle.skill = 'normal';
    if (!MAP_SIZES[s.battle.map]) s.battle.map = 'small';
    s.battle.humans = clamp(Math.round(s.battle.humans), 1, 2);
    s.battle.bots = clamp(Math.round(s.battle.bots), 0, 3);
    s.musicVolume = clamp(s.musicVolume, 0, 1);
    s.sfxVolume = clamp(s.sfxVolume, 0, 1);
    for (const key of Object.keys(s.progress)) s.progress[key] = clamp(Math.round(s.progress[key]), 1, WORLD_ORDER.length);
    for (const key of Object.keys(s.highScores)) s.highScores[key] = Math.max(0, Math.round(s.highScores[key]));
    for (const key of Object.keys(s.bestLevel)) s.bestLevel[key] = Math.max(0, Math.round(s.bestLevel[key]));
    s.battleWins = Math.max(0, Math.round(s.battleWins));
    return s;
  },

  save(data) {
    try {
      window.localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (err) {
      /* ignore */
    }
  },
};
