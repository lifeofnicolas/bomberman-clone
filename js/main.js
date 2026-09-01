// ---------------------------------------------------------------------------
// DOM glue (HUD + overlay) and the main loop.
// ---------------------------------------------------------------------------

class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.overlay = $('overlay');
    this.overlayTitle = $('overlay-title');
    this.overlayText = $('overlay-text');
    this.overlayButtons = $('overlay-buttons');
    this.overlayHelp = $('overlay-help');
    this.hudP2 = $('hud-p2');
    this.timerStat = $('hud-time').parentElement;
    this.levelLabel = $('hud-level-label');
    this.mute = $('hud-mute');
    this.p1 = { lives: $('hud-lives'), bombs: $('hud-bombs'), range: $('hud-range'), speed: $('hud-speed') };
    this.p2 = { lives: $('hud-lives2'), bombs: $('hud-bombs2'), range: $('hud-range2'), speed: $('hud-speed2') };
    this.level = $('hud-level');
    this.time = $('hud-time');
    this.score = $('hud-score');
    this.primary = null;
  }

  set(el, value) {
    const text = String(value);
    if (el.textContent !== text) el.textContent = text;
  }

  showOverlay({ title, text, buttons, help }) {
    this.set(this.overlayTitle, title);
    this.set(this.overlayText, text || '');
    this.set(this.overlayHelp, help || '');
    this.overlayButtons.innerHTML = '';
    this.primary = buttons.length ? buttons[0].action : null;
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        btn.blur();
        b.action();
      });
      this.overlayButtons.appendChild(btn);
    }
    this.overlay.classList.add('visible');
  }

  hideOverlay() {
    this.overlay.classList.remove('visible');
    this.primary = null;
  }

  primaryAction() {
    if (this.primary) this.primary();
  }

  setTwoPlayer(on) {
    this.hudP2.classList.toggle('hidden', !on);
    this.set(this.levelLabel, on ? 'ROUND' : 'LEVEL');
  }

  setMuted(muted) {
    this.set(this.mute, muted ? '\u{1F507}' : '\u{1F50A}');
    this.mute.title = muted ? 'Sound off (M)' : 'Sound on (M)';
  }

  updateHud(game) {
    const battle = game.mode === 2;
    game.players.forEach((p, i) => {
      const refs = i === 0 ? this.p1 : this.p2;
      this.set(refs.lives, battle ? p.wins : p.lives);
      refs.lives.parentElement.title = battle ? 'Rounds won' : 'Lives';
      this.set(refs.bombs, p.maxBombs);
      this.set(refs.range, p.range);
      this.set(refs.speed, p.speedLevel);
    });
    this.set(this.level, game.level);
    this.set(this.time, Math.ceil(game.timeLeft));
    this.timerStat.classList.toggle('warning', game.state === 'playing' && game.timeLeft < 30);
    if (game.players[0]) this.set(this.score, game.players[0].score);
  }
}

(function main() {
  const canvas = document.getElementById('game');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const input = new Input();
  const sfx = new Sfx();
  const ui = new UI();
  const game = new Game(canvas, input, sfx, ui);
  window.game = game; // handy for debugging in the console

  // Browsers require a user gesture before audio can start.
  input.onAny = () => sfx.ensure();
  document.addEventListener('pointerdown', () => sfx.ensure(), { passive: true });

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
