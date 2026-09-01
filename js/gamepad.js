// ---------------------------------------------------------------------------
// Gamepad support via the Gamepad API. Pad 0 drives Player 1, pad 1 drives
// Player 2, by emitting the same key codes the keyboard would. In menus the
// first pad also navigates: D-pad/stick = arrows, A/Start = Enter, B = back.
// ---------------------------------------------------------------------------

const PAD_MAPS = [
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Space', detonate: 'KeyE' },
  { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', bomb: 'Enter', detonate: 'KeyO' },
];

class GamepadInput {
  constructor(input, isMenu) {
    this.input = input;
    this.isMenu = isMenu; // () => boolean, true while a menu is open
    this.held = [new Set(), new Set()];
    this.connected = 0;
    this.onConnect = null;
    window.addEventListener('gamepadconnected', (e) => {
      this.connected++;
      if (this.onConnect) this.onConnect(e.gamepad);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = Math.max(0, this.connected - 1);
    });
  }

  poll() {
    if (!navigator.getGamepads) return;
    let pads;
    try {
      pads = navigator.getGamepads();
    } catch (err) {
      return;
    }
    let slot = 0;
    for (const pad of pads) {
      if (!pad || !pad.connected || slot >= PAD_MAPS.length) continue;
      this.apply(slot, this.codesFor(pad, PAD_MAPS[slot], slot === 0 && this.isMenu()));
      slot++;
    }
    for (let i = slot; i < this.held.length; i++) this.apply(i, new Set());
  }

  codesFor(pad, map, menu) {
    const b = (i) => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const codes = new Set();
    if (b(12) || ay < -0.5) codes.add(map.up);
    if (b(13) || ay > 0.5) codes.add(map.down);
    if (b(14) || ax < -0.5) codes.add(map.left);
    if (b(15) || ax > 0.5) codes.add(map.right);
    if (menu) {
      if (b(0) || b(9)) codes.add('Enter');
      if (b(1) || b(8)) codes.add('Backspace');
    } else {
      if (b(0) || b(2)) codes.add(map.bomb);
      if (b(1) || b(3) || b(5) || b(7)) codes.add(map.detonate);
      if (b(9)) codes.add('KeyP');
    }
    return codes;
  }

  apply(slot, codes) {
    const prev = this.held[slot];
    for (const c of prev) if (!codes.has(c)) this.input.release(c);
    for (const c of codes) if (!prev.has(c)) this.input.press(c);
    this.held[slot] = codes;
  }
}
