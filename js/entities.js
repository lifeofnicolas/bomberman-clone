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
    this.moveTarget = null;
    this.originTile = null;
    this.moveDir = 'down';
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
    // Wanted directions, most recently pressed axis first.
    const dirs = [];
    const h = dx > 0 ? 'right' : dx < 0 ? 'left' : null;
    const v = dy > 0 ? 'down' : dy < 0 ? 'up' : null;
    if (this.lastAxis === 'x') {
      if (h) dirs.push(h);
      if (v) dirs.push(v);
    } else {
      if (v) dirs.push(v);
      if (h) dirs.push(h);
    }

    this.moveGrid(game, dirs, this.speed * dt);

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

  // Grid-locked movement: travel from tile centre to tile centre, always
  // centred in the lane. Turns are buffered until the next centre; reversing
  // along the current axis is immediate.
  moveGrid(game, dirs, dist) {
    let remaining = dist;
    this.moving = false;
    let guard = 0;
    while (remaining > 0 && guard++ < 4) {
      if (!this.moveTarget) {
        const dir = this.pickDir(game, dirs);
        if (!dir) break;
        this.startMove(dir);
      } else if (dirs.length && dirs[0] === OPPOSITE[this.moveDir] && this.originTile) {
        // Turn back toward the tile we came from.
        const o = this.originTile;
        const t = this.moveTarget;
        if (!game.isSolidFor(o.x, o.y, this) || (o.x === this.tx && o.y === this.ty)) {
          this.moveTarget = { x: o.x, y: o.y };
          this.originTile = { x: t.x, y: t.y };
          this.moveDir = dirs[0];
          this.facing = dirs[0];
        }
      }
      const cx = centerOf(this.moveTarget.x);
      const cy = centerOf(this.moveTarget.y);
      const d = Math.abs(cx - this.x) + Math.abs(cy - this.y);
      this.moving = true;
      if (d <= remaining) {
        this.x = cx;
        this.y = cy;
        remaining -= d;
        this.moveTarget = null;
        this.originTile = null;
        if (!dirs.length) break;
      } else {
        this.x += Math.sign(cx - this.x) * Math.min(remaining, Math.abs(cx - this.x));
        this.y += Math.sign(cy - this.y) * Math.min(remaining, Math.abs(cy - this.y));
        remaining = 0;
      }
    }
    if (this.moving) this.animTime += dist / this.speed;
  }

  startMove(dir) {
    const v = DIRS[dir];
    this.originTile = { x: this.tx, y: this.ty };
    this.moveTarget = { x: this.tx + v.dx, y: this.ty + v.dy };
    this.moveDir = dir;
    this.facing = dir;
  }

  // First wanted direction whose tile is free. Walking into a bomb kicks it.
  pickDir(game, dirs) {
    for (const dir of dirs) {
      const v = DIRS[dir];
      const nx = this.tx + v.dx;
      const ny = this.ty + v.dy;
      if (!game.isSolidFor(nx, ny, this)) return dir;
      this.facing = dir;
      if (this.canKick) {
        const bomb = game.bombAt(nx, ny);
        if (bomb && !bomb.walkers.has(this) && !bomb.slideDir) game.kickBomb(bomb, dir);
      }
    }
    return null;
  }

  // Tile this player occupies or is about to occupy.
  occupies(tx, ty) {
    if (this.tx === tx && this.ty === ty) return true;
    return !!this.moveTarget && this.moveTarget.x === tx && this.moveTarget.y === ty;
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
      if (game.isSolidFor(this.origin.x, this.origin.y, this)) {
        // Both ends blocked: wait where we are and re-plan shortly.
        this.target = null;
        this.wait = 0.25;
        return;
      }
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
class Boss extends Enemy {
  constructor(theme, tx, ty, world, speedMult = 1) {
    super('boss', tx, ty, speedMult);
    const info = BOSSES[theme] || BOSSES.grass;
    this.isBoss = true;
    this.name = info.name;
    this.color = info.color;
    this.accent = info.accent;
    this.speed = (70 + world * 8) * speedMult;
    this.half = TILE * 0.42;
    this.maxHp = BOSS_BASE_HP + world * 2;
    this.hp = this.maxHp;
    this.iframes = 0;
    this.minionTimer = BOSS_MINION_INTERVAL;
  }

  update(dt, game) {
    if (this.iframes > 0) this.iframes -= dt * 1000;
    super.update(dt, game);
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
    this.orphan = false; // true once the owner's power reset stops counting it
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
