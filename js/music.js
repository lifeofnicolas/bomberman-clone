// ---------------------------------------------------------------------------
// Procedural chiptune music. Tracks are short looping patterns (8th-note
// steps) played with a square lead, triangle bass and simple drums through
// the Web Audio API. No audio files needed.
// ---------------------------------------------------------------------------

// Patterns use semitone offsets from `root`; null = rest.
const MUSIC_TRACKS = {
  title: {
    bpm: 128,
    root: 57,
    bass: [0, 0, 0, 0, 5, 5, 5, 5, 7, 7, 7, 7, 3, 3, 5, 5],
    lead: [12, null, 15, 12, 10, null, 7, null, 12, null, 15, 17, 15, null, 12, null, 8, null, 12, 8, 7, null, 3, null, 5, 7, 8, 7, 5, null, 3, null],
    drums: true,
  },
  grass: {
    bpm: 118,
    root: 60,
    bass: [0, 0, 7, 7, 9, 9, 7, 7, 5, 5, 4, 4, 7, 7, 7, 7],
    lead: [0, 4, 7, 4, 9, 7, 4, null, 0, 4, 7, 9, 12, null, 9, 7, 5, 9, 12, 9, 7, 4, 0, null, 2, 4, 5, 7, 4, null, 2, null],
    drums: true,
  },
  ice: {
    bpm: 96,
    root: 62,
    bass: [0, null, 7, null, 0, null, 7, null, -2, null, 5, null, -2, null, 5, null],
    lead: [7, null, null, 10, null, 12, null, null, 10, null, 7, null, null, null, null, null, 5, null, null, 8, null, 10, null, null, 8, null, 5, null, 3, null, null, null],
    drums: false,
  },
  desert: {
    bpm: 112,
    root: 64,
    bass: [0, 0, 0, 1, 0, 0, 0, -2, 0, 0, 0, 1, 3, 3, 1, 1],
    lead: [7, 8, 7, 5, 3, null, 1, null, 0, null, 1, 3, 5, null, 3, null, 7, 8, 10, 8, 7, null, 5, null, 3, 5, 3, 1, 0, null, null, null],
    drums: true,
  },
  factory: {
    bpm: 136,
    root: 55,
    bass: [0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 5, 5, 3, 3],
    lead: [12, 12, null, 12, 10, null, 12, null, 15, null, 12, null, 10, 7, null, null, 12, 12, null, 12, 10, null, 12, null, 17, null, 15, null, 12, null, null, null],
    drums: true,
  },
  volcano: {
    bpm: 144,
    root: 60,
    bass: [0, 0, 0, 0, 3, 3, 0, 0, 5, 5, 3, 3, 0, 0, -2, -2],
    lead: [12, null, 12, 15, 12, null, 10, null, 12, null, 12, 15, 17, null, 15, null, 12, null, 12, 15, 12, null, 10, null, 8, null, 10, null, 7, null, null, null],
    drums: true,
  },
  hurry: {
    bpm: 172,
    root: 57,
    bass: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -2, -2, -2, -2],
    lead: [12, null, 12, null, 13, null, 12, null, 10, null, 12, null, 13, 15, 13, 12, 12, null, 12, null, 13, null, 12, null, 15, null, 13, null, 12, 10, null, null],
    drums: true,
  },
  boss: {
    bpm: 150,
    root: 50,
    bass: [0, 0, 6, 6, 0, 0, 5, 5, 0, 0, 6, 6, 8, 8, 6, 5],
    lead: [12, null, 18, null, 17, null, 12, null, 15, null, 12, null, 11, null, null, null, 12, null, 18, null, 17, null, 20, null, 18, 17, 15, 12, 11, null, null, null],
    drums: true,
  },
};

class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.track = null;
    this.volume = 0.5;
    this.duck = 1;
    this.gain = null;
    this.noise = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  get ctx() {
    return this.sfx.ctx;
  }

  midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  ensureGraph() {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.08);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    this.applyGain();
    return true;
  }

  applyGain() {
    if (!this.gain) return;
    const target = this.sfx.muted ? 0 : this.volume * this.duck;
    this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    this.applyGain();
  }

  setDuck(d) {
    this.duck = d;
    this.applyGain();
  }

  refreshMute() {
    this.applyGain();
  }

  // Select a track. Starts immediately if audio is unlocked; otherwise it
  // starts on the next call to resume() (after the first user gesture).
  play(name) {
    if (this.track === name) return;
    this.track = name;
    this.step = 0;
    this.stopTimer();
    this.resume();
  }

  stop() {
    this.track = null;
    this.stopTimer();
  }

  stopTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  resume() {
    if (!this.track || this.timer) return;
    if (!this.ensureGraph() || this.ctx.state !== 'running') return;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.loop();
  }

  loop() {
    const tr = MUSIC_TRACKS[this.track];
    if (!tr || !this.ctx) {
      this.timer = null;
      return;
    }
    const stepDur = 60 / tr.bpm / 2;
    const now = this.ctx.currentTime;
    // After a stall, skip ahead instead of dumping every missed note at once.
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.35) {
      this.scheduleStep(tr, this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
    this.timer = setTimeout(() => this.loop(), 80);
  }

  scheduleStep(tr, step, t, stepDur) {
    const bass = tr.bass[step % tr.bass.length];
    const lead = tr.lead[step % tr.lead.length];
    if (bass !== null && bass !== undefined) this.note(this.midiToFreq(tr.root - 12 + bass), t, stepDur * 0.9, 'triangle', 0.16);
    if (lead !== null && lead !== undefined) {
      // Hold the note through following rests.
      let len = 1;
      while (len < 4 && tr.lead[(step + len) % tr.lead.length] === null) len++;
      this.note(this.midiToFreq(tr.root + lead), t, stepDur * len * 0.85, 'square', 0.07);
    }
    if (tr.drums) {
      if (step % 4 === 0) this.kick(t);
      if (step % 2 === 1) this.hat(t, step % 8 === 7 ? 0.05 : 0.03);
    }
  }

  note(freq, t, dur, type, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  kick(t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  hat(t, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(filter).connect(g).connect(this.gain);
    src.start(t);
  }
}
