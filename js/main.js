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
    this.touchDetonate = $('touch-detonate');
    this.buttons = [];
    this.focusIndex = 0;
    this.touch = false;
    this.coarse = false;
    this.playerRefs = [];
    this.onActivate = null;
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
      btn.tabIndex = -1; // keyboard handling is done by the game, not the DOM
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        btn.blur();
        this.fire(b);
      });
      this.overlayButtons.appendChild(btn);
      this.buttons.push({ el: btn, action: b.action, back: !!b.back, cycle: !!b.cycle });
    }
    this.overlay.classList.add('visible');
    this.focusButton(typeof focus === 'number' && focus >= 0 ? focus : 0);
  }

  setOverlayText(text) {
    this.set(this.overlayText, text);
  }

  hideOverlay() {
    this.overlay.classList.remove('visible');
    this.buttons = [];
  }

  fire(b) {
    if (this.onActivate) this.onActivate();
    b.action();
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
    this.fire(b);
    return true;
  }

  // Enter/Space activates the focused button. With `cycleOnly`, only buttons
  // flagged as option cyclers respond (used for left/right arrows).
  activateFocused(cycleOnly = false) {
    const b = this.buttons[this.focusIndex];
    if (!b) return false;
    if (cycleOnly && !b.cycle) return false;
    this.fire(b);
    return true;
  }

  primaryAction() {
    return this.activateButton(0);
  }

  backAction() {
    const b = this.buttons.find((x) => x.back);
    if (!b) return false;
    this.fire(b);
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
    this.set(this.levelLabel, battle ? 'ROUND' : 'STAGE');
    this.hudPlayers.classList.toggle('many', players.length > 2);
    if (!players.length) {
      this.set(this.level, '-');
      this.set(this.time, '-');
      this.timerStat.classList.remove('warning');
    }
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
      if (p.curse) extras += `💀${Math.ceil(p.curse.timer / 1000)}s`;
      this.set(refs.extras, extras);
      this.set(refs.score, p.score);
    });
    if (battle) {
      this.set(this.level, game.level);
    } else {
      const s = game.campaignStage();
      this.set(this.level, `${s.world + 1}-${s.stage + 1}`);
    }
    this.set(this.time, Math.ceil(game.timeLeft));
    const warn = game.state === 'playing' && ((game.mode === 1 && game.timeLeft < 30) || game.suddenDeath);
    this.timerStat.classList.toggle('warning', warn);
    const p1 = game.players[0];
    this.touchDetonate.classList.toggle('hidden', !(p1 && p1.remote && !p1.isBot));
  }

  setMuted(muted) {
    document.body.classList.toggle('muted', !!muted);
  }
}

(function main() {
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const input = new Input();
  const sfx = new Sfx();
  const music = new Music(sfx);
  const ui = new UI();

  // Touch UI: auto-detect, unless the user forced it on/off.
  const saved = Save.load();
  ui.coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  ui.setTouchUI(saved.touchUI === null || saved.touchUI === undefined ? ui.coarse : saved.touchUI);

  const game = new Game(canvas, input, sfx, music, ui);
  window.game = game; // handy for debugging in the console

  const touch = new TouchControls(input, document.getElementById('touch'));
  touch.onAny = () => sfx.ensure();

  const pads = new GamepadInput(input, () => game.isMenu() || game.state === 'intro');
  pads.onConnect = (pad) => {
    game.floaters.push(new Floater('Gamepad connected', CANVAS_W / 2, CANVAS_H - 40, '#aed581', 16, 2000));
  };

  // Browsers require a user gesture before audio can start; music waits for it.
  sfx.onReady = () => music.resume();
  input.onAny = () => sfx.ensure();
  document.addEventListener('pointerdown', () => sfx.ensure(), { passive: true });
  document.addEventListener('touchend', () => sfx.ensure(), { passive: true });

  // Sharper canvas on high-DPI screens: scale the backing store (max 2x).
  // Also keeps the CSS layout in sync with the current arena size.
  const app = document.getElementById('app');
  function fitCanvas() {
    app.style.setProperty('--cols', COLS);
    app.style.setProperty('--rows', ROWS);
    app.style.setProperty('--board-w', `${CANVAS_W}px`);
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const k = Math.min(2, Math.max(1, Math.ceil((dpr * rect.width) / CANVAS_W)));
    if (canvas.width !== CANVAS_W * k || canvas.height !== CANVAS_H * k) {
      canvas.width = CANVAS_W * k;
      canvas.height = CANVAS_H * k;
      Renderer.setScale(k);
      Renderer.forceRebuild();
    }
  }
  game.onArenaResize = fitCanvas;
  fitCanvas();
  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(stage);
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', fitCanvas);

  // Pause when the tab/app goes to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.state === 'playing' || game.state === 'intro') game.pause();
      input.down.clear();
      music.stopTimer();
    } else {
      if (sfx.ctx && sfx.ctx.state !== 'running') sfx.ctx.resume().catch(() => {});
      music.resume();
    }
  });
  window.addEventListener('pagehide', () => {
    if (game.state === 'playing' || game.state === 'intro') game.pause();
  });

  // Offline support when served over HTTPS (or localhost).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // avoid huge steps after a tab switch
    try {
      pads.poll();
      game.update(dt);
      game.render();
    } catch (err) {
      // Never let a single bad frame kill the loop.
      console.error(err);
    } finally {
      input.endFrame();
    }
  }
  requestAnimationFrame(frame);
})();
