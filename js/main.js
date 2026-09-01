// ---------------------------------------------------------------------------
// DOM glue (HUD + overlay), device handling, and the main loop.
// ---------------------------------------------------------------------------

class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.overlay = $('overlay');
    this.overlayTitle = $('overlay-title');
    this.overlayText = $('overlay-text');
    this.overlayButtons = $('overlay-buttons');
    this.overlayHelp = $('overlay-help');
    this.hudPlayers = $('hud-players');
    this.levelLabel = $('hud-level-label');
    this.level = $('hud-level');
    this.time = $('hud-time');
    this.timerStat = this.time.parentElement;
    this.mute = $('hud-mute');
    this.touchToggle = $('hud-touch');
    this.touchDetonate = $('touch-detonate');
    this.buttons = [];
    this.focusIndex = 0;
    this.touch = false;
    this.playerRefs = [];
    this.onTouchToggle = null;
    this.touchToggle.addEventListener('click', () => {
      if (this.onTouchToggle) this.onTouchToggle();
    });
  }

  set(el, value) {
    const text = String(value);
    if (el.textContent !== text) el.textContent = text;
  }

  isTouch() {
    return this.touch;
  }

  setTouchUI(on) {
    this.touch = !!on;
    document.body.classList.toggle('touch-ui', this.touch);
    this.touchToggle.classList.toggle('active', this.touch);
  }

  // ---------------- overlay ----------------
  showOverlay({ title, text, buttons, help, focus }) {
    this.set(this.overlayTitle, title);
    this.set(this.overlayText, text || '');
    this.set(this.overlayHelp, help || '');
    this.overlayButtons.innerHTML = '';
    this.buttons = [];
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        btn.blur();
        b.action();
      });
      this.overlayButtons.appendChild(btn);
      this.buttons.push({ el: btn, action: b.action, back: !!b.back });
    }
    this.overlay.classList.add('visible');
    this.focusButton(typeof focus === 'number' && focus >= 0 ? focus : 0);
  }

  hideOverlay() {
    this.overlay.classList.remove('visible');
    this.buttons = [];
  }

  focusButton(i) {
    if (!this.buttons.length) return;
    this.focusIndex = Math.min(Math.max(i, 0), this.buttons.length - 1);
    this.buttons.forEach((b, idx) => b.el.classList.toggle('focused', idx === this.focusIndex));
  }

  focusMove(delta) {
    if (!this.buttons.length) return;
    this.focusButton((this.focusIndex + delta + this.buttons.length) % this.buttons.length);
  }

  activateButton(i) {
    const b = this.buttons[i];
    if (!b) return false;
    b.action();
    return true;
  }

  // Enter/Space activates the focused button. With `cycleOnly`, only buttons
  // that are neither primary nor "back" respond (used for left/right arrows).
  activateFocused(cycleOnly = false) {
    const b = this.buttons[this.focusIndex];
    if (!b) return false;
    if (cycleOnly && (this.focusIndex === 0 || b.back)) return false;
    b.action();
    return true;
  }

  primaryAction() {
    return this.activateButton(0);
  }

  backAction() {
    const b = this.buttons.find((x) => x.back);
    if (!b) return false;
    b.action();
    return true;
  }

  // ---------------- HUD ----------------
  buildHud(players, mode) {
    this.hudPlayers.innerHTML = '';
    this.playerRefs = [];
    const battle = mode === 2;
    for (const p of players) {
      const group = document.createElement('div');
      group.className = 'hud-group';
      const label = document.createElement('span');
      label.className = 'hud-label';
      label.style.background = p.color;
      label.textContent = p.name;
      group.appendChild(label);

      const make = (icon, title) => {
        const span = document.createElement('span');
        span.className = 'hud-stat';
        span.title = title;
        span.innerHTML = `${icon} <b></b>`;
        group.appendChild(span);
        return span.querySelector('b');
      };
      const refs = {
        lives: make(battle ? '🏆' : '❤', battle ? 'Rounds won' : 'Lives'),
        bombs: make('💣', 'Bombs'),
        range: make('🔥', 'Flame range'),
        speed: make('⚡', 'Speed'),
      };
      const extras = document.createElement('span');
      extras.className = 'hud-extras';
      group.appendChild(extras);
      refs.extras = extras;
      const score = document.createElement('span');
      score.className = 'hud-stat score';
      score.title = 'Score';
      score.innerHTML = '<b></b>';
      group.appendChild(score);
      refs.score = score.querySelector('b');
      this.hudPlayers.appendChild(group);
      this.playerRefs.push(refs);
    }
    this.set(this.levelLabel, battle ? 'ROUND' : 'LEVEL');
    this.hudPlayers.classList.toggle('many', players.length > 2);
  }

  updateHud(game) {
    const battle = game.mode === 2;
    game.players.forEach((p, i) => {
      const refs = this.playerRefs[i];
      if (!refs) return;
      this.set(refs.lives, battle ? p.wins : p.lives);
      this.set(refs.bombs, p.maxBombs);
      this.set(refs.range, p.range);
      this.set(refs.speed, p.speedLevel);
      let extras = '';
      if (p.canKick) extras += '👟';
      if (p.remote) extras += '📡';
      if (p.wallPass) extras += '👻';
      if (p.curse) extras += '💀';
      this.set(refs.extras, extras);
      this.set(refs.score, p.score);
    });
    this.set(this.level, game.level);
    this.set(this.time, Math.ceil(game.timeLeft));
    const warn = game.state === 'playing' && ((game.mode === 1 && game.timeLeft < 30) || game.suddenDeath);
    this.timerStat.classList.toggle('warning', warn);
    const p1 = game.players[0];
    this.touchDetonate.classList.toggle('hidden', !(p1 && p1.remote && !p1.isBot));
  }

  setMuted(muted) {
    this.set(this.mute, muted ? '🔇' : '🔊');
    this.mute.title = muted ? 'Sound off (M)' : 'Sound on (M)';
  }
}

(function main() {
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const input = new Input();
  const sfx = new Sfx();
  const ui = new UI();

  // Touch UI: auto-detect, unless the user forced it on/off.
  const saved = Save.load();
  const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  ui.setTouchUI(saved.touchUI === null || saved.touchUI === undefined ? coarse : saved.touchUI);

  const game = new Game(canvas, input, sfx, ui);
  window.game = game; // handy for debugging in the console

  ui.onTouchToggle = () => {
    const on = !ui.isTouch();
    ui.setTouchUI(on);
    game.settings.touchUI = on;
    game.saveSettings();
    if (game.state === 'title') game.showTitle();
  };
  document.getElementById('hud-mute').addEventListener('click', () => game.toggleMute());

  const touch = new TouchControls(input, document.getElementById('touch'));
  touch.onAny = () => sfx.ensure();

  // Browsers require a user gesture before audio can start.
  input.onAny = () => sfx.ensure();
  document.addEventListener('pointerdown', () => sfx.ensure(), { passive: true });
  document.addEventListener('touchend', () => sfx.ensure(), { passive: true });

  // Sharper canvas on high-DPI screens: scale the backing store (max 2x).
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const k = Math.min(2, Math.max(1, Math.ceil((dpr * rect.width) / CANVAS_W)));
    if (canvas.width !== CANVAS_W * k) {
      canvas.width = CANVAS_W * k;
      canvas.height = CANVAS_H * k;
      Renderer.setScale(k);
    }
  }
  fitCanvas();
  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(stage);
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', fitCanvas);

  // Pause when the tab/app goes to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.state === 'playing') game.pause();
      input.down.clear();
    } else if (sfx.ctx && sfx.ctx.state !== 'running') {
      sfx.ctx.resume().catch(() => {});
    }
  });
  window.addEventListener('pagehide', () => {
    if (game.state === 'playing') game.pause();
  });

  // Offline support when served over HTTPS (or localhost).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // avoid huge steps after a tab switch
    game.update(dt);
    game.render();
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
