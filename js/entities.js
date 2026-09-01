// ---------------------------------------------------------------------------
// Game entities: players, enemies, bombs, explosions, power-ups, effects.
// Positions (x, y) are pixel coordinates of the entity's centre.
// ---------------------------------------------------------------------------

const EPS = 0.01;

function tileOf(px) {
  return Math.floor(px / TILE);
}

function centerOf(tile) {
  return tile * TILE + TILE / 2;
}

// ---------------------------------------------------------------------------
class Player {
  constructor(cfg, spawn) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.color = cfg.color;
    this.keys = cfg.keys;
    this.spawn = spawn;
    this.half = TILE * 0.34; // half the collision box size
    this.lives = START_LIVES;
    this.score = 0;
    this.wins = 0;
    this.kills = 0;
    this.bot = null;
    this.resetPowers();
    this.resetForLevel();
  }

  get isBot() {
    return !!this.bot;
  }

  resetPowers() {
    this.maxBombs = 1;
    this.range = 1;
    this.speedLevel = 1;
    this.canKick = false;
    this.remote = false;
    this.wallPass = false;
    this.curse = null;
    this.curseImmune = 0;
  }

  // Put the player back on their spawn tile, alive and briefly invulnerable.
  respawn(shieldMs = SPAWN_SHIELD) {
    this.x = centerOf(this.spawn.x);
    this.y = centerOf(this.spawn.y);
    this.alive = true;
    this.dying = false;
    this.deathTimer = 0;
    this.shield = shieldMs;
    this.facing = 'down';
    this.moving = false;
    this.animTime = 0;
    this.lastAxis = 'y';
    this.curse = null;
    this.curseImmune = 0;
    if (this.bot) this.bot.reset();
  }

  resetForLevel(shieldMs = SPAWN_SHIELD) {
    this.respawn(shieldMs);
    this.bombsActive = 0;
  }

  hasCurse(type) {
    return !!this.curse && this.curse.type === type;
  }

  get speed() {
    if (this.hasCurse('slow')) return BASE_SPEED * 0.6;
    return BASE_SPEED + (this.speedLevel - 1) * SPEED_STEP;
  }

  get tx() {
    return tileOf(this.x);
  }

  get ty() {
    return tileOf(this.y);
  }

  update(dt, game, input) {
    this.shield = Math.max(0, this.shield - dt * 1000);
    if (this.curse) {
      this.curse.timer -= dt * 1000;
      if (this.curse.timer <= 0) this.curse = null;
    }
    if (this.curseImmune > 0) this.curseImmune -= dt * 1000;

    const k = this.keys;
    if (input.wasPressed(k.left) || input.wasPressed(k.right)) this.lastAxis = 'x';
    if (input.wasPressed(k.up) || input.wasPressed(k.down)) this.lastAxis = 'y';

    let dx = (input.isDown(k.right) ? 1 : 0) - (input.isDown(k.left) ? 1 : 0);
    let dy = (input.isDown(k.down) ? 1 : 0) - (input.isDown(k.up) ? 1 : 0);
    if (this.hasCurse('reverse')) {
      dx = -dx;
      dy = -dy;
    }
    const both = dx !== 0 && dy !== 0;
    this.moving = dx !== 0 || dy !== 0;

    if (this.moving) {
      const dist = this.speed * dt;
      const primary = both ? this.lastAxis : dx !== 0 ? 'x' : 'y';
      if (primary === 'x') {
        this.facing = dx > 0 ? 'right' : 'left';
        const moved = this.moveAxis(game, dx * dist, 0, !both);
        if (moved < EPS && both) {
          this.facing = dy > 0 ? 'down' : 'up';
          this.moveAxis(game, 0, dy * dist, false);
        }
      } else {
        this.facing = dy > 0 ? 'down' : 'up';
        const moved = this.moveAxis(game, 0, dy * dist, !both);
        if (moved < EPS && both) {
          this.facing = dx > 0 ? 'right' : 'left';
          this.moveAxis(game, dx * dist, 0, false);
        }
      }
      this.animTime += dt;
    }

    if (this.hasCurse('diarrhea')) {
      game.tryPlaceBomb(this);
    } else if (input.wasPressed(k.bomb)) {
      if (this.remote && this.bombsActive >= this.maxBombs) game.detonate(this);
      else game.tryPlaceBomb(this);
    }
    if (this.remote && k.detonate && input.wasPressed(k.detonate)) {
      game.detonate(this);
    }
  }

  // Move along one axis with grid collision. Returns the distance moved.
  // With `assist`, a blocked player is gently nudged toward the lane centre
  // when the tile ahead in that lane is free ("corner assist").
  moveAxis(game, mx, my, assist) {
    const h = this.half;

    if (mx !== 0) {
      const dir = Math.sign(mx);
      let nx = this.x + mx;
      const tx = tileOf(nx + dir * h);
      const ty0 = tileOf(this.y - h + EPS);
      const ty1 = tileOf(this.y + h - EPS);
      let blocked = false;
      for (let ty = ty0; ty <= ty1; ty++) {
        if (game.isSolidFor(tx, ty, this)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        nx = dir > 0 ? tx * TILE - h - EPS : (tx + 1) * TILE + h + EPS;
        const row = this.ty;
        const cy = centerOf(row);
        if (this.canKick && Math.abs(this.y - cy) < TILE * 0.3) {
          const bomb = game.bombAt(tx, row);
          if (bomb && !bomb.walkers.has(this) && !bomb.slideDir) game.kickBomb(bomb, dir > 0 ? 'right' : 'left');
        }
        if (assist && Math.abs(this.y - cy) > 0.5 && !game.isSolidFor(tx, row, this)) {
          const step = Math.min(Math.abs(mx), Math.abs(cy - this.y));
          this.y += Math.sign(cy - this.y) * step;
        }
      }
      const moved = Math.abs(nx - this.x);
      this.x = nx;
      return moved;
    }

    if (my !== 0) {
      const dir = Math.sign(my);
      let ny = this.y + my;
      const ty = tileOf(ny + dir * h);
      const tx0 = tileOf(this.x - h + EPS);
      const tx1 = tileOf(this.x + h - EPS);
      let blocked = false;
      for (let tx = tx0; tx <= tx1; tx++) {
        if (game.isSolidFor(tx, ty, this)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        ny = dir > 0 ? ty * TILE - h - EPS : (ty + 1) * TILE + h + EPS;
        const col = this.tx;
        const cx = centerOf(col);
        if (this.canKick && Math.abs(this.x - cx) < TILE * 0.3) {
          const bomb = game.bombAt(col, ty);
          if (bomb && !bomb.walkers.has(this) && !bomb.slideDir) game.kickBomb(bomb, dir > 0 ? 'down' : 'up');
        }
        if (assist && Math.abs(this.x - cx) > 0.5 && !game.isSolidFor(col, ty, this)) {
          const step = Math.min(Math.abs(my), Math.abs(cx - this.x));
          this.x += Math.sign(cx - this.x) * step;
        }
      }
      const moved = Math.abs(ny - this.y);
      this.y = ny;
      return moved;
    }

    return 0;
  }
}

// ---------------------------------------------------------------------------
class Enemy {
  constructor(type, tx, ty, speedMult = 1) {
    const cfg = ENEMY_TYPES[type];
    this.type = type;
    this.cfg = cfg;
    this.color = cfg.color;
    this.speed = cfg.speed * speedMult;
    this.x = centerOf(tx);
    this.y = centerOf(ty);
    this.half = TILE * 0.34;
    this.dir = randomItem(DIR_LIST);
    this.target = null;
    this.origin = { x: tx, y: ty };
    this.wait = 0;
    this.alive = true;
    this.dying = false;
    this.deathTimer = 0;
    this.animTime = Math.random() * 10;
  }

  get tx() {
    return tileOf(this.x);
  }

  get ty() {
    return tileOf(this.y);
  }

  update(dt, game) {
    this.animTime += dt;
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    if (!this.target) this.chooseTarget(game);
    if (!this.target) return;

    // If a bomb was dropped on the tile we're walking into, turn back.
    const ttx = tileOf(this.target.x);
    const tty = tileOf(this.target.y);
    if (game.isSolidFor(ttx, tty, this) && (this.tx !== ttx || this.ty !== tty)) {
      this.target = { x: centerOf(this.origin.x), y: centerOf(this.origin.y) };
      this.dir = OPPOSITE[this.dir];
    }

    const step = this.speed * dt;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    if (Math.abs(dx) + Math.abs(dy) <= step) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.target = null;
    } else {
      this.x += Math.sign(dx) * Math.min(step, Math.abs(dx));
      this.y += Math.sign(dy) * Math.min(step, Math.abs(dy));
    }
  }

  chooseTarget(game) {
    const tx = this.tx;
    const ty = this.ty;
    this.origin = { x: tx, y: ty };

    let options = DIR_LIST.filter((d) => {
      const v = DIRS[d];
      return !game.isSolidFor(tx + v.dx, ty + v.dy, this);
    });
    if (options.length === 0) {
      this.target = null;
      this.wait = 0.25;
      return;
    }

    let choice = null;
    const flee = this.cfg.fleesBombs;
    if (flee) {
      const safe = options.filter((d) => game.dangerAt(tx + DIRS[d].dx, ty + DIRS[d].dy) === 0);
      if (safe.length) options = safe;
      if (game.dangerAt(tx, ty) > 0) {
        // Standing in a blast line: prefer stepping out of it sideways.
        choice = randomItem(options);
      }
    }
    if (!choice && this.cfg.smart) {
      const chase = game.findPlayerDirection(tx, ty, 6);
      if (chase && options.includes(chase) && Math.random() < 0.8) choice = chase;
    }
    if (!choice) {
      if (options.includes(this.dir) && Math.random() > this.cfg.turnChance) {
        choice = this.dir;
      } else {
        const forward = options.filter((d) => d !== OPPOSITE[this.dir]);
        choice = randomItem(forward.length ? forward : options);
      }
    }

    this.dir = choice;
    const v = DIRS[choice];
    this.target = { x: centerOf(tx + v.dx), y: centerOf(ty + v.dy) };
  }
}

// ---------------------------------------------------------------------------
class Bomb {
  constructor(tx, ty, owner, range, fuse) {
    this.x = centerOf(tx);
    this.y = centerOf(ty);
    this.owner = owner;
    this.range = range;
    this.timer = fuse;
    this.remote = !Number.isFinite(fuse);
    this.age = 0;
    this.exploded = false;
    this.slideDir = null;
    this.slideTarget = null;
    // Entities that were standing on the bomb when it was placed may walk off it.
    this.walkers = new Set();
  }

  get tx() {
    return tileOf(this.x);
  }

  get ty() {
    return tileOf(this.y);
  }
}

// ---------------------------------------------------------------------------
class Explosion {
  // cells: [{ x, y, dir: null | 'up' | 'down' | 'left' | 'right', end: boolean }]
  constructor(cells, owner) {
    this.cells = cells;
    this.owner = owner;
    this.timer = EXPLOSION_DURATION;
    this.age = 0;
  }

  covers(tx, ty) {
    return this.cells.some((c) => c.x === tx && c.y === ty);
  }
}

// ---------------------------------------------------------------------------
class PowerUp {
  constructor(tx, ty, type) {
    this.tx = tx;
    this.ty = ty;
    this.type = type;
    this.age = Math.random() * 10;
  }
}

class BreakingBrick {
  constructor(tx, ty) {
    this.tx = tx;
    this.ty = ty;
    this.timer = BRICK_BREAK_DURATION;
  }
}

class FallingBlock {
  constructor(tx, ty) {
    this.tx = tx;
    this.ty = ty;
    this.timer = FALLING_BLOCK_DURATION;
  }
}

class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }
}

class Floater {
  constructor(text, x, y, color = '#ffffff', size = 14, life = 900) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
  }
}
