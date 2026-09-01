// ---------------------------------------------------------------------------
// Touch controls: a virtual D-pad plus action buttons that feed key codes
// into the shared Input instance, so the game code is unchanged.
// ---------------------------------------------------------------------------

class TouchControls {
  constructor(input, root) {
    this.input = input;
    this.root = root;
    this.onAny = null;
    this.pad = root.querySelector('#dpad');
    this.active = new Map(); // pointerId -> Set(codes)
    this.rect = null;

    // 8 sectors starting at "right", going clockwise.
    this.sectors = [
      ['ArrowRight'],
      ['ArrowRight', 'ArrowDown'],
      ['ArrowDown'],
      ['ArrowDown', 'ArrowLeft'],
      ['ArrowLeft'],
      ['ArrowLeft', 'ArrowUp'],
      ['ArrowUp'],
      ['ArrowUp', 'ArrowRight'],
    ];

    if (this.pad) this.bindPad();
    root.querySelectorAll('[data-code]').forEach((btn) => this.bindButton(btn));
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  codesAt(e) {
    const r = this.rect || this.pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return [];
    const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7;
    return this.sectors[sector];
  }

  apply(id, codes) {
    const prev = this.active.get(id) || new Set();
    const next = new Set(codes);
    for (const c of prev) if (!next.has(c)) this.input.release(c);
    for (const c of next) if (!prev.has(c)) this.input.press(c);
    this.active.set(id, next);
    this.pad.dataset.dir = codes.join(' ');
    if (this.onAny) this.onAny();
  }

  bindPad() {
    const pad = this.pad;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.rect = pad.getBoundingClientRect();
      try {
        pad.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      this.apply(e.pointerId, this.codesAt(e));
    });
    pad.addEventListener('pointermove', (e) => {
      if (this.active.has(e.pointerId)) this.apply(e.pointerId, this.codesAt(e));
    });
    const end = (e) => {
      if (!this.active.has(e.pointerId)) return;
      this.apply(e.pointerId, []);
      this.active.delete(e.pointerId);
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, end);
  }

  bindButton(btn) {
    const code = btn.dataset.code;
    const press = (e) => {
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      this.input.press(code);
      btn.classList.add('held');
      if (this.onAny) this.onAny();
    };
    const release = () => {
      this.input.release(code);
      btn.classList.remove('held');
    };
    btn.addEventListener('pointerdown', press);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, release);
  }

  releaseAll() {
    for (const [id, codes] of this.active) {
      for (const c of codes) this.input.release(c);
      this.active.delete(id);
    }
    this.root.querySelectorAll('[data-code]').forEach((btn) => {
      this.input.release(btn.dataset.code);
      btn.classList.remove('held');
    });
  }
}
