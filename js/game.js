// ---------------------------------------------------------------------------
// Core game: state machine, level setup, simulation, and rules.
// ---------------------------------------------------------------------------

class Game {
  constructor(canvas, input, sfx, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = sfx;
    this.ui = ui;

    this.state = 'title'; // title | playing | paused | levelclear | roundover | gameover
    this.mode = 1; // 1 = single player campaign, 2 = two player battle
    this.level = 1;
    this.elapsed = 0;
    this.timeLeft = LEVEL_TIME;
    this.lastTickSecond = -1;

    this.players = [];
    this.enemies = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.breaking = [];
    this.exit = null;

    // Decorative arena behind the title screen.
    this.grid = generateGrid(0.55, spawnCorners());
    this.showTitle();
  }

  // ------------------------------------------------------------------
  // Screens / state transitions
  // ------------------------------------------------------------------
  showTitle() {
    this.state = 'title';
    this.ui.setTwoPlayer(false);
    this.ui.showOverlay({
      title: 'BOMBERMAN',
      text: 'Blast through the bricks, defeat every enemy\nand find the hidden exit.',
      buttons: [
        { label: '1 PLAYER', action: () => this.startGame(1) },
        { label: '2 PLAYER BATTLE', action: () => this.startGame(2) },
      ],
      help: 'Press 1 or 2 to start\nCollect power-ups: extra bombs, bigger flames, more speed',
    });
  }

  startGame(mode) {
    this.mode = mode;
    this.level = 1;
    const corners = spawnCorners();
    this.players = PLAYER_CONFIGS.slice(0, mode).map((cfg, i) => new Player(cfg, corners[i]));
    this.ui.setTwoPlayer(mode === 2);
    this.startLevel();
  }

  startLevel() {
    const spawns = this.players.map((p) => p.spawn);
    const density = this.mode === 1 ? Math.min(0.45 + this.level * 0.04, 0.72) : 0.6;
    this.grid = generateGrid(density, spawns);

    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.breaking = [];
    this.enemies = [];
    this.exit = null;

    for (const p of this.players) p.resetForLevel();

    // Enemies
    const roster = this.enemyRoster();
    let empty = tilesOfType(this.grid, TILE_EMPTY).filter((t) => spawns.every((s) => manhattan(t, s) >= 6));
    for (const type of roster) {
      if (empty.length === 0) break;
      const spot = randomItem(empty);
      empty = empty.filter((t) => t !== spot);
      this.enemies.push(new Enemy(type, spot.x, spot.y));
    }

    // Hidden exit under a brick (campaign only)
    if (this.mode === 1) {
      const bricks = tilesOfType(this.grid, TILE_BRICK);
      const far = bricks.filter((t) => manhattan(t, spawns[0]) >= 6);
      const spot = randomItem(far.length ? far : bricks);
      this.exit = { tx: spot.x, ty: spot.y, revealed: false };
    }

    this.timeLeft = this.mode === 1 ? LEVEL_TIME : BATTLE_TIME;
    this.lastTickSecond = -1;
    this.exitAnnounced = false;
    this.state = 'playing';
    this.ui.hideOverlay();
    this.ui.updateHud(this);
  }

  enemyRoster() {
    if (this.mode === 2) {
      const list = ['balloom', 'balloom'];
      if (this.level >= 3) list.push('oneal');
      return list;
    }
    const count = Math.min(2 + this.level, 10);
    const list = [];
    for (let i = 0; i < count; i++) {
      let type = 'balloom';
      if (this.level >= 3 && i % 3 === 1) type = 'oneal';
      if (this.level >= 5 && i % 4 === 2) type = 'doll';
      list.push(type);
    }
    return list;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showOverlay({
      title: 'PAUSED',
      text: '',
      buttons: [
        { label: 'RESUME', action: () => this.resume() },
        { label: 'MAIN MENU', action: () => this.showTitle() },
      ],
      help: 'Press P to resume',
    });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideOverlay();
  }

  levelClear() {
    this.state = 'levelclear';
    const p = this.players[0];
    const timeBonus = Math.floor(this.timeLeft) * 5;
    p.score += 500 + timeBonus;
    this.sfx.levelClear();
    this.ui.updateHud(this);
    this.ui.showOverlay({
      title: 'LEVEL CLEAR!',
      text: `Level ${this.level} complete\nTime bonus: ${timeBonus}\nScore: ${p.score}`,
      buttons: [
        {
          label: 'NEXT LEVEL',
          action: () => {
            this.level += 1;
            this.startLevel();
          },
        },
      ],
      help: 'Press Enter or Space to continue',
    });
  }

  gameOver() {
    this.state = 'gameover';
    const p = this.players[0];
    this.ui.showOverlay({
      title: 'GAME OVER',
      text: `Final score: ${p.score}\nReached level ${this.level}`,
      buttons: [
        { label: 'PLAY AGAIN', action: () => this.startGame(this.mode) },
        { label: 'MAIN MENU', action: () => this.showTitle() },
      ],
      help: 'Press Enter or Space to play again',
    });
  }

  roundOver(winner) {
    this.state = 'roundover';
    if (winner) winner.wins += 1;
    this.ui.updateHud(this);

    const standings = this.players.map((p) => `${p.name}: ${p.wins}`).join('   ');
    if (winner && winner.wins >= ROUNDS_TO_WIN) {
      this.ui.showOverlay({
        title: `${winner.name} WINS THE MATCH!`,
        text: `First to ${ROUNDS_TO_WIN} rounds\n${standings}`,
        buttons: [
          { label: 'REMATCH', action: () => this.startGame(2) },
          { label: 'MAIN MENU', action: () => this.showTitle() },
        ],
        help: 'Press Enter or Space for a rematch',
      });
      return;
    }

    this.ui.showOverlay({
      title: winner ? `${winner.name} WINS THE ROUND` : 'DRAW',
      text: standings,
      buttons: [
        {
          label: 'NEXT ROUND',
          action: () => {
            this.level += 1;
            this.startLevel();
          },
        },
        { label: 'MAIN MENU', action: () => this.showTitle() },
      ],
      help: 'Press Enter or Space to continue',
    });
  }

  // ------------------------------------------------------------------
  // Main update
  // ------------------------------------------------------------------
  update(dt) {
    this.elapsed += dt;
    if (this.handleGlobalKeys()) return;
    if (this.state !== 'playing') return;

    // Level timer
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    const whole = Math.ceil(this.timeLeft);
    if (this.timeLeft <= 10 && whole !== this.lastTickSecond) {
      this.lastTickSecond = whole;
      if (this.timeLeft > 0) this.sfx.tick();
    }
    if (this.timeLeft <= 0) {
      for (const p of this.players) if (p.alive) this.killPlayer(p);
      this.timeLeft = this.mode === 1 ? LEVEL_TIME : BATTLE_TIME;
    }

    // Players
    for (const p of this.players) {
      if (p.alive) p.update(dt, this, this.input);
      else if (p.dying) this.updateDeadPlayer(p, dt);
    }

    // Bombs
    for (const b of this.bombs) {
      b.age += dt;
      b.timer -= dt * 1000;
      for (const w of b.walkers) {
        if (!this.overlapsTile(w, b.tx, b.ty)) b.walkers.delete(w);
      }
    }
    for (const b of this.bombs.slice()) {
      if (b.exploded) continue;
      if (b.timer <= 0 || this.explosions.some((ex) => ex.covers(b.tx, b.ty))) {
        this.explodeBomb(b);
      }
    }

    // Explosions & breaking bricks
    for (const ex of this.explosions) {
      ex.age += dt * 1000;
      ex.timer -= dt * 1000;
    }
    this.explosions = this.explosions.filter((ex) => ex.timer > 0);
    for (const br of this.breaking) br.timer -= dt * 1000;
    this.breaking = this.breaking.filter((br) => br.timer > 0);

    // Enemies
    for (const e of this.enemies) {
      if (e.alive) e.update(dt, this);
      else if (e.dying) {
        e.deathTimer -= dt * 1000;
        if (e.deathTimer <= 0) e.dying = false;
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.dying);

    for (const pu of this.powerups) pu.age += dt;

    this.resolveCollisions();
    this.checkEndConditions();
    this.ui.updateHud(this);
  }

  handleGlobalKeys() {
    const inp = this.input;
    if (inp.wasPressed('KeyM')) this.ui.setMuted(this.sfx.toggleMute());

    switch (this.state) {
      case 'title':
        if (inp.wasPressed(['Digit1', 'Numpad1'])) {
          this.startGame(1);
          return true;
        }
        if (inp.wasPressed(['Digit2', 'Numpad2'])) {
          this.startGame(2);
          return true;
        }
        return false;
      case 'playing':
        if (inp.wasPressed(['KeyP', 'Escape'])) {
          this.pause();
          return true;
        }
        if (inp.wasPressed('KeyR')) {
          this.showTitle();
          return true;
        }
        return false;
      case 'paused':
        if (inp.wasPressed(['KeyP', 'Escape'])) {
          this.resume();
          return true;
        }
        if (inp.wasPressed('KeyR')) {
          this.showTitle();
          return true;
        }
        return false;
      case 'levelclear':
      case 'roundover':
      case 'gameover':
        if (inp.wasPressed(['Enter', 'NumpadEnter', 'Space'])) {
          this.ui.primaryAction();
          return true;
        }
        if (inp.wasPressed('KeyR')) {
          this.showTitle();
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  updateDeadPlayer(p, dt) {
    p.deathTimer -= dt * 1000;
    if (p.deathTimer > 0) return;
    p.dying = false;
    if (this.mode === 1 && p.lives > 0) {
      p.respawn();
    }
  }

  checkEndConditions() {
    if (this.state !== 'playing') return;

    if (this.mode === 1) {
      const p = this.players[0];
      if (!p.alive && !p.dying && p.lives <= 0) {
        this.gameOver();
        return;
      }
      if (this.exit && this.exit.revealed && this.enemiesRemaining() === 0) {
        if (!this.exitAnnounced) {
          this.exitAnnounced = true;
          this.sfx.exitOpen();
        }
        if (p.alive && p.tx === this.exit.tx && p.ty === this.exit.ty) {
          this.levelClear();
        }
      }
      return;
    }

    // Battle: round ends once at most one player is left and death animations finished.
    const alive = this.players.filter((p) => p.alive);
    const dying = this.players.some((p) => p.dying);
    if (alive.length <= 1 && !dying) {
      this.roundOver(alive[0] || null);
    }
  }

  // ------------------------------------------------------------------
  // Rules
  // ------------------------------------------------------------------
  enemiesRemaining() {
    return this.enemies.filter((e) => e.alive).length;
  }

  bombAt(tx, ty) {
    return this.bombs.find((b) => b.tx === tx && b.ty === ty) || null;
  }

  // Whether an entity's collision box touches a tile.
  overlapsTile(entity, tx, ty) {
    const h = entity.half;
    return (
      entity.x + h > tx * TILE &&
      entity.x - h < (tx + 1) * TILE &&
      entity.y + h > ty * TILE &&
      entity.y - h < (ty + 1) * TILE
    );
  }

  isSolidFor(tx, ty, entity) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    if (this.grid[ty][tx] !== TILE_EMPTY) return true;
    const b = this.bombAt(tx, ty);
    if (b && !b.walkers.has(entity)) return true;
    return false;
  }

  tryPlaceBomb(p) {
    if (p.bombsActive >= p.maxBombs) return;
    const tx = p.tx;
    const ty = p.ty;
    if (this.grid[ty][tx] !== TILE_EMPTY || this.bombAt(tx, ty)) return;

    const bomb = new Bomb(tx, ty, p, p.range);
    for (const e of [...this.players, ...this.enemies]) {
      if (e.alive && this.overlapsTile(e, tx, ty)) bomb.walkers.add(e);
    }
    this.bombs.push(bomb);
    p.bombsActive += 1;
    this.sfx.placeBomb();
  }

  explodeBomb(bomb) {
    if (bomb.exploded) return;
    bomb.exploded = true;
    this.bombs = this.bombs.filter((b) => b !== bomb);
    bomb.owner.bombsActive = Math.max(0, bomb.owner.bombsActive - 1);

    const powerupsBefore = this.powerups.slice();
    const cells = [{ x: bomb.tx, y: bomb.ty, dir: null, end: false }];
    const chain = [];

    for (const dir of DIR_LIST) {
      const v = DIRS[dir];
      for (let i = 1; i <= bomb.range; i++) {
        const x = bomb.tx + v.dx * i;
        const y = bomb.ty + v.dy * i;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
        const t = this.grid[y][x];
        if (t === TILE_WALL) break;
        if (t === TILE_BRICK) {
          cells.push({ x, y, dir, end: true });
          this.destroyBrick(x, y);
          break;
        }
        const other = this.bombAt(x, y);
        if (other) {
          cells.push({ x, y, dir, end: true });
          chain.push(other);
          break;
        }
        cells.push({ x, y, dir, end: i === bomb.range });
      }
    }

    const explosion = new Explosion(cells, bomb.owner);
    this.explosions.push(explosion);
    this.sfx.explosion();

    // Flames burn power-ups that were already lying around.
    this.powerups = this.powerups.filter((pu) => !(powerupsBefore.includes(pu) && explosion.covers(pu.tx, pu.ty)));

    for (const other of chain) this.explodeBomb(other);
  }

  destroyBrick(x, y) {
    this.grid[y][x] = TILE_EMPTY;
    this.breaking.push(new BreakingBrick(x, y));
    if (this.exit && this.exit.tx === x && this.exit.ty === y) {
      this.exit.revealed = true;
      return;
    }
    if (Math.random() < POWERUP_CHANCE) {
      this.powerups.push(new PowerUp(x, y, randomItem(POWERUP_TYPES)));
    }
  }

  collectPowerUp(p, pu) {
    if (pu.type === 'bomb') p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1);
    if (pu.type === 'fire') p.range = Math.min(MAX_RANGE, p.range + 1);
    if (pu.type === 'speed') p.speedLevel = Math.min(MAX_SPEED_LEVEL, p.speedLevel + 1);
    p.score += 50;
    this.powerups = this.powerups.filter((x) => x !== pu);
    this.sfx.powerup();
  }

  killPlayer(p) {
    if (!p.alive) return;
    p.alive = false;
    p.dying = true;
    p.deathTimer = RESPAWN_DELAY;
    p.lives = Math.max(0, p.lives - 1);
    this.sfx.death();
  }

  killEnemy(e, killer) {
    if (!e.alive) return;
    e.alive = false;
    e.dying = true;
    e.deathTimer = ENEMY_DEATH_DURATION;
    if (killer) killer.score += e.cfg.score;
    this.sfx.enemyDie();
  }

  resolveCollisions() {
    // Flames vs players and enemies
    for (const ex of this.explosions) {
      for (const p of this.players) {
        if (p.alive && p.shield <= 0 && ex.covers(p.tx, p.ty)) this.killPlayer(p);
      }
      for (const e of this.enemies) {
        if (e.alive && ex.covers(e.tx, e.ty)) this.killEnemy(e, ex.owner);
      }
    }

    // Enemies touching players
    for (const e of this.enemies) {
      if (!e.alive) continue;
      for (const p of this.players) {
        if (!p.alive || p.shield > 0) continue;
        if (Math.abs(p.x - e.x) < TILE * 0.6 && Math.abs(p.y - e.y) < TILE * 0.6) {
          this.killPlayer(p);
        }
      }
    }

    // Power-ups
    for (const p of this.players) {
      if (!p.alive) continue;
      const pu = this.powerups.find((u) => u.tx === p.tx && u.ty === p.ty);
      if (pu) this.collectPowerUp(p, pu);
    }
  }

  // Direction from (tx, ty) toward a visible player in the same row/column,
  // or null. Used by "smart" enemies.
  findPlayerDirection(tx, ty, maxDist) {
    for (const p of this.players) {
      if (!p.alive) continue;
      const px = p.tx;
      const py = p.ty;
      if (py === ty && px !== tx) {
        const sx = Math.sign(px - tx);
        const dist = Math.abs(px - tx);
        if (dist <= maxDist && this.clearLine(tx, ty, sx, 0, dist)) return sx > 0 ? 'right' : 'left';
      }
      if (px === tx && py !== ty) {
        const sy = Math.sign(py - ty);
        const dist = Math.abs(py - ty);
        if (dist <= maxDist && this.clearLine(tx, ty, 0, sy, dist)) return sy > 0 ? 'down' : 'up';
      }
    }
    return null;
  }

  clearLine(tx, ty, sx, sy, dist) {
    for (let i = 1; i < dist; i++) {
      const x = tx + sx * i;
      const y = ty + sy * i;
      if (this.grid[y][x] !== TILE_EMPTY || this.bombAt(x, y)) return false;
    }
    return true;
  }

  render() {
    Renderer.draw(this);
  }
}
