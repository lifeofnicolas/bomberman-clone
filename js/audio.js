// ---------------------------------------------------------------------------
// Tiny procedural sound effects using the Web Audio API. No audio files needed.
// ---------------------------------------------------------------------------

class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
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
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, duration, { type = 'square', volume = 0.12, slideTo = null, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
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
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
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
    notes.forEach((n, i) => this.tone(n, 0.16, { type: 'square', volume: 0.1, delay: i * 0.13 }));
  }

  exitOpen() {
    this.tone(392, 0.12, { type: 'triangle', volume: 0.1 });
    this.tone(523, 0.2, { type: 'triangle', volume: 0.1, delay: 0.12 });
  }

  tick() {
    this.tone(1200, 0.04, { type: 'square', volume: 0.05 });
  }
}
