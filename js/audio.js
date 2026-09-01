// ---------------------------------------------------------------------------
// Tiny procedural sound effects using the Web Audio API. No audio files needed.
// ---------------------------------------------------------------------------

class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 1; // master effects volume (0..1)
    this.suppressed = false; // true while the title-screen demo runs
    this.onReady = null; // called once the context is running
  }

  // Must be called from a user gesture (key press / click) before sounds play.
  ensure() {
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = Ctx ? new Ctx() : null;
      } catch (err) {
        this.ctx = null;
      }
    }
    // iOS reports 'interrupted' after a call or Control Center; treat any
    // non-running state as something to resume.
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().then(() => this.onReady && this.onReady()).catch(() => {});
    } else if (this.ctx && this.onReady) {
      this.onReady();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, duration, { type = 'square', volume = 0.12, slideTo = null, delay = 0, force = false } = {}) {
    if (this.muted || !this.ctx || (this.suppressed && !force)) return;
    volume *= this.volume;
    if (volume <= 0) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise(duration, volume = 0.25) {
    if (this.muted || !this.ctx || this.suppressed) return;
    volume *= this.volume;
    if (volume <= 0) return;
    const ctx = this.ctx;
    if (!this.noiseBuffer) {
      // One shared half-second noise buffer; the gain envelope shapes each hit.
      const length = Math.floor(ctx.sampleRate * 0.5);
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    duration = Math.min(duration, 0.5);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + duration + 0.02);
  }

  placeBomb() {
    this.tone(240, 0.08, { type: 'square', volume: 0.08, slideTo: 160 });
  }

  explosion() {
    this.noise(0.45, 0.35);
    this.tone(90, 0.35, { type: 'sawtooth', volume: 0.12, slideTo: 35 });
  }

  powerup() {
    this.tone(523, 0.08, { type: 'triangle', volume: 0.12 });
    this.tone(659, 0.08, { type: 'triangle', volume: 0.12, delay: 0.08 });
    this.tone(784, 0.14, { type: 'triangle', volume: 0.12, delay: 0.16 });
  }

  enemyDie() {
    this.tone(700, 0.22, { type: 'square', volume: 0.09, slideTo: 180 });
  }

  death() {
    this.tone(420, 0.7, { type: 'sawtooth', volume: 0.12, slideTo: 60 });
  }

  levelClear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone(n, 0.16, { type: 'square', volume: 0.1, delay: i * 0.13, force: true }));
  }

  victory() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((n, i) => this.tone(n, i === notes.length - 1 ? 0.5 : 0.14, { type: 'square', volume: 0.1, delay: i * 0.12, force: true }));
    notes.forEach((n, i) => this.tone(n / 2, i === notes.length - 1 ? 0.5 : 0.14, { type: 'triangle', volume: 0.1, delay: i * 0.12, force: true }));
  }

  gameOverJingle() {
    const notes = [392, 370, 349, 330, 262];
    notes.forEach((n, i) => this.tone(n, i === notes.length - 1 ? 0.6 : 0.22, { type: 'square', volume: 0.09, delay: i * 0.22, force: true }));
  }

  bossHit() {
    this.noise(0.15, 0.25);
    this.tone(220, 0.25, { type: 'sawtooth', volume: 0.12, slideTo: 110 });
  }

  bossRoar() {
    this.tone(80, 0.6, { type: 'sawtooth', volume: 0.14, slideTo: 55 });
    this.tone(120, 0.6, { type: 'square', volume: 0.06, slideTo: 70, delay: 0.05 });
  }

  countdown() {
    this.tone(660, 0.1, { type: 'square', volume: 0.08 });
  }

  go() {
    this.tone(880, 0.25, { type: 'square', volume: 0.1 });
    this.tone(1320, 0.25, { type: 'square', volume: 0.05, delay: 0.02 });
  }

  tally() {
    this.tone(1000, 0.03, { type: 'square', volume: 0.04, force: true });
  }

  menu() {
    this.tone(700, 0.05, { type: 'square', volume: 0.05, force: true });
  }

  exitOpen() {
    this.tone(392, 0.12, { type: 'triangle', volume: 0.1 });
    this.tone(523, 0.2, { type: 'triangle', volume: 0.1, delay: 0.12 });
  }

  tick() {
    this.tone(1200, 0.04, { type: 'square', volume: 0.05 });
  }

  alarm() {
    for (let i = 0; i < 3; i++) {
      this.tone(880, 0.12, { type: 'square', volume: 0.09, delay: i * 0.25 });
      this.tone(660, 0.12, { type: 'square', volume: 0.09, delay: i * 0.25 + 0.12 });
    }
  }

  kick() {
    this.tone(300, 0.07, { type: 'triangle', volume: 0.1, slideTo: 500 });
  }

  thud() {
    this.noise(0.12, 0.18);
    this.tone(70, 0.15, { type: 'sine', volume: 0.15, slideTo: 40 });
  }

  curse() {
    this.tone(200, 0.35, { type: 'sawtooth', volume: 0.08, slideTo: 90 });
    this.tone(150, 0.35, { type: 'square', volume: 0.05, slideTo: 60, delay: 0.1 });
  }
}
