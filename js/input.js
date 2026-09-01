// ---------------------------------------------------------------------------
// Keyboard state tracker. `isDown` is level-triggered, `wasPressed` is
// edge-triggered and cleared at the end of every frame.
// ---------------------------------------------------------------------------

class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.onAny = null; // callback fired on every key press (used to unlock audio)

    window.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (this.onAny) this.onAny();
    });

    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });

    // Losing focus means we never receive the matching keyup events.
    window.addEventListener('blur', () => {
      this.down.clear();
      this.pressed.clear();
    });
  }

  isDown(codes) {
    if (Array.isArray(codes)) return codes.some((c) => this.down.has(c));
    return this.down.has(codes);
  }

  wasPressed(codes) {
    if (Array.isArray(codes)) return codes.some((c) => this.pressed.has(c));
    return this.pressed.has(codes);
  }

  // Programmatic key press/release (used by touch controls).
  press(code) {
    if (this.down.has(code)) return;
    this.down.add(code);
    this.pressed.add(code);
    if (this.onAny) this.onAny();
  }

  release(code) {
    this.down.delete(code);
  }

  endFrame() {
    this.pressed.clear();
  }
}
