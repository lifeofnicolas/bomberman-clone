// ---------------------------------------------------------------------------
// Core game: menus, level setup, simulation, and rules.
// ---------------------------------------------------------------------------

class Game {
  constructor(canvas, input, sfx, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = sfx;
    this.ui = ui;

    this.settings = Save.load();
    this.sfx.muted = !!this.settings.muted;
    this.ui.setMuted(this.sfx.muted);

    // title | setup | playing | paused | levelclear | roundover | gameover
    this.state = 'title';
    this.mode = 1; // 1 = campaign, 2 = battle
    this.level = 1;
    this.difficulty = this.settings.difficulty || 'normal';
    this.diff = DIFFICULTY[this.difficulty];
    this.theme = 'grass';
    this.elapsed = 0;
    this.timeLeft = LEVEL_TIME;
    this.lastTickSecond = -1;
    this.freeze = 0;

    this.players = [];
    this.enemies = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.breaking = [];
    this.falling = [];
    this.particles = [];
    this.floaters = [];
    this.exit = null;
    this.shake = { t: 0, mag: 0 };
    this.spiral = null;
    this.spiralIndex = 0;
    this.spiralTimer = 0;
    this.suddenDeath = false;
    this.timedOut = false;
    this.danger = new Uint8Array(COLS * ROWS);

    // Decorative arena behind the title screen.
    this.grid = buildLevel('classic', 0.55).grid;
    Renderer.setTheme(this.theme);
    this.showTitle();
  }

  saveSettings() {
    Save.save(this.settings);
  }

  keyHint(keyboardText) {
    return this.ui.isTouch() ? 'Tap a button to choose' : keyboardText;
  }

  // ------------------------------------------------------------------
  // Menus
  // ------------------------------------------------------------------
  showTitle() {
    this.state = 'title';
    this.ui.buildHud([], 1);
    const hs = this.settings.highScores;
    this.ui.showOverlay({
      title: 'BOMBERMAN',
      text: 'Blast through the bricks, defeat every enemy\nand find the hidden exit.',
      buttons: [
        { label: 'CAMPAIGN', action: () => this.showCampaignSetup() },
        { label: 'BATTLE', action: () => this.showBattleSetup() },
        { label: 'HOW TO PLAY', action: () => this.showHelp() },
      ],
      help:
        `High scores  Easy ${hs.easy}  ·  Normal ${hs.normal}  ·  Hard ${hs.hard}\n` +
        `Battle matches won: ${this.settings.battleWins}\n` +
        this.keyHint('Press 1-3 to choose · Enter to confirm'),
    });
  }

  showCampaignSetup() {
    this.state = 'setup';
    const current = this.settings.difficulty;
    const buttons = DIFFICULTY_ORDER.map((key) => ({
      label: `${DIFFICULTY[key].label.toUpperCase()}${key === current ? '  ✓' : ''}`,
      action: () => {
        this.settings.difficulty = key;
        this.saveSettings();
        this.startCampaign(key);
      },
    }));
    buttons.push({ label: 'BACK', action: () => this.showTitle(), back: true });
    this.ui.showOverlay({
      title: 'CAMPAIGN',
      text:
        'Easy  ·  5 lives, 240 s, slow enemies, lots of power-ups\n' +
        'Normal  ·  3 lives, 200 s, the classic experience\n' +
        'Hard  ·  2 lives, 150 s, fast enemies, lose power-ups on death',
      buttons,
      help: this.keyHint('Press 1-3 to choose · Esc to go back'),
      focus: DIFFICULTY_ORDER.indexOf(current),
    });
  }

  showBattleSetup() {
    this.state = 'setup';
    const b = this.settings.battle;
    const maxBots = 4 - b.humans;
    const minBots = Math.max(0, 2 - b.humans);
    b.bots = Math.min(Math.max(b.bots, minBots), maxBots);

    // Re-render after cycling an option, keeping keyboard focus where it was
    // so Enter still starts the match unless the user navigated with arrows.
    const rerender = () => {
      const focus = this.ui.focusIndex;
      this.saveSettings();
      this.showBattleSetup();
      this.ui.focusButton(focus);
    };

    this.ui.showOverlay({
      title: 'BATTLE',
      text: `${b.humans} human${b.humans > 1 ? 's' : ''} vs ${b.bots} bot${b.bots === 1 ? '' : 's'}  ·  first to ${ROUNDS_TO_WIN} rounds\nEveryone starts with 2 bombs and fire 2. The arena closes in when time runs low.`,
      buttons: [
        { label: 'START', action: () => this.startBattle() },
        {
          label: `HUMANS: ${b.humans}`,
          action: () => {
            b.humans = b.humans === 1 ? 2 : 1;
            rerender();
          },
        },
        {
          label: `BOTS: ${b.bots}`,
          action: () => {
            b.bots = b.bots + 1 > maxBots ? minBots : b.bots + 1;
            rerender();
          },
        },
        {
          label: `BOT SKILL: ${BOT_TIERS[b.skill].label.toUpperCase()}`,
          action: () => {
            const i = DIFFICULTY_ORDER.indexOf(b.skill);
            b.skill = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
            rerender();
          },
        },
        { label: 'BACK', action: () => this.showTitle(), back: true },
      ],
      help: this.keyHint('Press 1-5 to choose · Enter to start · Esc to go back\nPlayer 2 uses I J K L and Enter'),
    });
  }

  showHelp() {
    this.state = 'setup';
    const touch = this.ui.isTouch();
    this.ui.showOverlay({
      title: 'HOW TO PLAY',
      text:
        (touch
          ? 'Move with the D-pad, drop bombs with the big button.\n'
          : 'Move with W A S D or the arrow keys, drop bombs with Space.\n') +
        'Bombs explode in a cross and destroy bricks, enemies and players.\n' +
        'Campaign: defeat every enemy, then find the exit hidden under a brick.\n' +
        'Battle: last one standing wins the round.\n\n' +
        'Power-ups:  💣 extra bomb   🔥 bigger flames   ⚡ speed\n' +
        '👟 kick bombs   📡 remote bombs (bomb key again' +
        (touch ? '' : ' or E') +
        ' to detonate)\n' +
        '👻 walk through bricks   ❤ extra life   💀 a random curse for 15 s',
      buttons: [{ label: 'BACK', action: () => this.showTitle(), back: true }],
      help: this.keyHint('Esc or Enter to go back'),
    });
  }

  // ------------------------------------------------------------------
  // Game setup
  // ------------------------------------------------------------------
  startCampaign(difficulty) {
    this.mode = 1;
    this.difficulty = difficulty;
    this.diff = DIFFICULTY[difficulty];
    this.level = 1;
    const p = new Player(PLAYER_CONFIGS[0], spawnCorners()[0]);
    p.lives = this.diff.lives;
    this.players = [p];
    this.startLevel();
  }

  startBattle() {
    this.mode = 2;
    this.level = 1;
    const setup = this.settings.battle;
    const total = Math.min(4, Math.max(2, setup.humans + setup.bots));
    const corners = spawnCorners();
    this.players = [];
    for (let i = 0; i < total; i++) {
      const p = new Player(PLAYER_CONFIGS[i], corners[i]);
      if (i >= setup.humans) {
        p.bot = new Bot(p, setup.skill);
        p.name = `CPU${i - setup.humans + 1}`;
      }
      this.players.push(p);
    }
    this.startLevel();
  }

  campaignStage() {
    const idx = this.level - 1;
    const worldIdx = Math.floor(idx / LEVELS_PER_WORLD);
    return {
      world: worldIdx,
      stage: idx % LEVELS_PER_WORLD,
      loop: Math.floor(worldIdx / WORLD_ORDER.length),
      theme: WORLD_ORDER[worldIdx % WORLD_ORDER.length],
    };
  }

  startLevel() {
    const battle = this.mode === 2;
    let templateName;
    let density;
    let label;

    if (battle) {
      this.theme = WORLD_ORDER[(this.level - 1) % WORLD_ORDER.length];
      templateName = randomItem(TEMPLATE_NAMES);
      density = 0.6;
      label = `ROUND ${this.level}`;
    } else {
      const s = this.campaignStage();
      this.theme = s.theme;
      templateName = WORLD_TEMPLATES[s.theme][s.stage];
      density = Math.min(0.75, Math.max(0.3, 0.45 + s.stage * 0.05 + s.loop * 0.05 + this.diff.densityMod));
      label = `${THEMES[s.theme].name.toUpperCase()}  ${s.world % WORLD_ORDER.length + 1}-${s.stage + 1}`;
    }
    Renderer.setTheme(this.theme);

    const built = buildLevel(templateName, density, { symmetric: battle });
    this.grid = built.grid;
    const spawns = [];
    this.players.forEach((p, i) => {
      p.spawn = built.spawns[i] || spawnCorners()[i];
      spawns.push(p.spawn);
      p.resetForLevel(battle ? BATTLE_SHIELD : SPAWN_SHIELD);
      if (battle) {
        p.resetPowers();
        p.maxBombs = 2;
        p.range = 2;
      }
    });

    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.breaking = [];
    this.falling = [];
    this.particles = [];
    this.floaters = [];
    this.enemies = [];
    this.exit = null;
    this.timedOut = false;
    this.suddenDeath = false;
    this.spiral = null;
    this.spiralIndex = 0;
    this.spiralTimer = 0;
    this.shake = { t: 0, mag: 0 };
    this.exitAnnounced = false;

    // Enemies
    const roster = battle ? this.battleRoster() : this.campaignRoster();
    for (const type of roster) this.spawnEnemy(type, spawns, battle ? 1 : this.diff.speedMult);

    // Hidden exit under a brick (campaign only)
    if (!battle) {
      const bricks = tilesOfType(this.grid, TILE_BRICK);
      const far = bricks.filter((t) => manhattan(t, spawns[0]) >= 6);
      const spot = randomItem(far.length ? far : bricks);
      if (spot) this.exit = { tx: spot.x, ty: spot.y, revealed: false };
    }

    this.timeLeft = battle ? BATTLE_TIME : this.diff.levelTime;
    this.lastTickSecond = -1;
    this.state = 'playing';
    this.ui.hideOverlay();
    this.ui.buildHud(this.players, this.mode);
    this.ui.updateHud(this);
    this.announce(label);
  }

  spawnEnemy(type, spawns, speedMult) {
    const cfg = ENEMY_TYPES[type];
    const usable = (t) => this.grid[t.y][t.x] === TILE_EMPTY || (cfg.passBricks && this.grid[t.y][t.x] === TILE_BRICK);
    const all = [...tilesOfType(this.grid, TILE_EMPTY), ...(cfg.passBricks ? tilesOfType(this.grid, TILE_BRICK) : [])].filter(usable);
    const taken = (t) => this.enemies.some((e) => e.tx === t.x && e.ty === t.y);
    let candidates = all.filter((t) => !taken(t) && spawns.every((s) => manhattan(t, s) >= 6));
    if (!candidates.length) candidates = all.filter((t) => !taken(t) && spawns.every((s) => manhattan(t, s) >= 4));
    if (!candidates.length) candidates = all.filter((t) => spawns.every((s) => manhattan(t, s) >= 3));
    if (!candidates.length) return;
    const spot = randomItem(candidates);
    this.enemies.push(new Enemy(type, spot.x, spot.y, speedMult));
  }

  campaignRoster() {
    const loop = Math.floor((this.level - 1) / (LEVELS_PER_WORLD * WORLD_ORDER.length));
    const count = Math.min(14, this.diff.enemyCount(this.level) + loop * 2);
    const pacing = PACING[this.difficulty];
    let entry = pacing[0];
    for (const e of pacing) if (e.from <= this.level) entry = e;
    const pool = entry.pool;
    const smartPool = pool.filter((t) => ENEMY_TYPES[t].smart);
    const list = [];
    for (let i = 0; i < count; i++) {
      let type = randomItem(pool);
      if (!ENEMY_TYPES[type].smart && smartPool.length && Math.random() < this.diff.smartChance) {
        type = randomItem(smartPool);
      }
      list.push(type);
    }
    if (entry.from === this.level && list.length) list[0] = pool[pool.length - 1];
    return list;
  }

  battleRoster() {
    const list = ['balloom', 'balloom'];
    if (this.level >= 3) list.push('oneal');
    if (this.level >= 5) list.push('doll');
    return list;
  }

  // ------------------------------------------------------------------
  // State transitions
  // ------------------------------------------------------------------
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showOverlay({
      title: 'PAUSED',
      text: '',
      buttons: [
        { label: 'RESUME', action: () => this.resume() },
        { label: 'MAIN MENU', action: () => this.showTitle(), back: true },
      ],
      help: this.keyHint('Press P to resume'),
    });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideOverlay();
  }

  recordCampaign() {
    const p = this.players[0];
    const hs = this.settings.highScores;
    let newBest = false;
    if (p.score > (hs[this.difficulty] || 0)) {
      hs[this.difficulty] = p.score;
      newBest = true;
    }
    const bl = this.settings.bestLevel;
    if (this.level > (bl[this.difficulty] || 0)) bl[this.difficulty] = this.level;
    this.saveSettings();
    return newBest;
  }

  levelClear() {
    this.state = 'levelclear';
    const p = this.players[0];
    const timeBonus = Math.floor(this.timeLeft) * 5 * this.diff.scoreMult;
    p.score += Math.round(500 * this.diff.scoreMult + timeBonus);
    this.sfx.levelClear();
    const newBest = this.recordCampaign();
    this.ui.updateHud(this);
    const next = this.level + 1;
    const nextIdx = next - 1;
    const nextTheme = WORLD_ORDER[Math.floor(nextIdx / LEVELS_PER_WORLD) % WORLD_ORDER.length];
    this.ui.showOverlay({
      title: 'LEVEL CLEAR!',
      text:
        `Level ${this.level} complete\nTime bonus: ${Math.round(timeBonus)}\nScore: ${p.score}` +
        (newBest ? '\n★ New high score!' : '') +
        `\n\nNext: ${THEMES[nextTheme].name} ${Math.floor(nextIdx / LEVELS_PER_WORLD) % WORLD_ORDER.length + 1}-${nextIdx % LEVELS_PER_WORLD + 1}`,
      buttons: [
        {
          label: 'NEXT LEVEL',
          action: () => {
            this.level += 1;
            this.startLevel();
          },
        },
        { label: 'MAIN MENU', action: () => this.showTitle(), back: true },
      ],
      help: this.keyHint('Press Enter or Space to continue'),
    });
  }

  gameOver() {
    this.state = 'gameover';
    const p = this.players[0];
    const newBest = this.recordCampaign();
    this.ui.showOverlay({
      title: 'GAME OVER',
      text: `Final score: ${p.score}\nReached level ${this.level} (${DIFFICULTY[this.difficulty].label})` + (newBest ? '\n★ New high score!' : ''),
      buttons: [
        { label: 'PLAY AGAIN', action: () => this.startCampaign(this.difficulty) },
        { label: 'MAIN MENU', action: () => this.showTitle(), back: true },
      ],
      help: this.keyHint('Press Enter or Space to play again'),
    });
  }

  roundOver(winner) {
    this.state = 'roundover';
    if (winner) winner.wins += 1;
    this.ui.updateHud(this);

    const standings = this.players.map((p) => `${p.name}: ${p.wins}`).join('   ');
    if (winner && winner.wins >= ROUNDS_TO_WIN) {
      if (!winner.isBot) {
        this.settings.battleWins += 1;
        this.saveSettings();
      }
      this.ui.showOverlay({
        title: `${winner.name} WINS THE MATCH!`,
        text: `First to ${ROUNDS_TO_WIN} rounds\n${standings}`,
        buttons: [
          { label: 'REMATCH', action: () => this.startBattle() },
          { label: 'MAIN MENU', action: () => this.showTitle(), back: true },
        ],
        help: this.keyHint('Press Enter or Space for a rematch'),
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
        { label: 'MAIN MENU', action: () => this.showTitle(), back: true },
      ],
      help: this.keyHint('Press Enter or Space to continue'),
    });
  }

  // ------------------------------------------------------------------
  // Main update
  // ------------------------------------------------------------------
  update(dt) {
    this.elapsed += dt;
    if (this.handleGlobalKeys()) return;
    if (this.state !== 'playing') return;

    if (this.freeze > 0) {
      this.freeze -= dt * 1000;
      dt *= 0.15;
    }

    this.updateTimer(dt);
    this.buildDangerMap();

    for (const p of this.players) {
      if (p.alive) {
        if (p.bot) p.bot.think(dt, this);
        p.update(dt, this, p.bot ? p.bot.input : this.input);
      } else if (p.dying) {
        this.updateDeadPlayer(p, dt);
      }
    }

    this.updateBombs(dt);

    for (const ex of this.explosions) {
      ex.age += dt * 1000;
      ex.timer -= dt * 1000;
    }
    this.explosions = this.explosions.filter((ex) => ex.timer > 0);
    for (const br of this.breaking) br.timer -= dt * 1000;
    this.breaking = this.breaking.filter((br) => br.timer > 0);
    for (const fb of this.falling) fb.timer -= dt * 1000;
    this.falling = this.falling.filter((fb) => fb.timer > 0);

    for (const e of this.enemies) {
      if (e.alive) e.update(dt, this);
      else if (e.dying) {
        e.deathTimer -= dt * 1000;
        if (e.deathTimer <= 0) e.dying = false;
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.dying);

    for (const pu of this.powerups) pu.age += dt;
    this.updateEffects(dt);

    this.resolveCollisions();
    this.checkEndConditions();
    this.ui.updateHud(this);
  }

  updateTimer(dt) {
    if (this.mode === 1) {
      if (this.timedOut) return;
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      const whole = Math.ceil(this.timeLeft);
      if (this.timeLeft <= 10 && whole !== this.lastTickSecond) {
        this.lastTickSecond = whole;
        if (this.timeLeft > 0) this.sfx.tick();
      }
      if (this.timeLeft <= 0) {
        this.timedOut = true;
        this.announce('TIME UP!', '#ef5350');
        this.sfx.alarm();
        const spawns = this.players.map((p) => ({ x: p.tx, y: p.ty }));
        for (let i = 0; i < this.diff.timeoutPontans; i++) this.spawnEnemy('pontan', spawns, this.diff.speedMult);
      }
      return;
    }

    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= SUDDEN_DEATH_AT) this.updateSuddenDeath(dt);
    if (this.timeLeft <= 0) {
      for (const p of this.players) if (p.alive) this.killPlayer(p, true);
    }
  }

  updateSuddenDeath(dt) {
    if (!this.suddenDeath) {
      this.suddenDeath = true;
      this.spiral = spiralOrder();
      this.spiralIndex = 0;
      this.spiralTimer = 0;
      this.announce('SUDDEN DEATH!', '#ef5350');
      this.sfx.alarm();
    }
    this.spiralTimer += dt * 1000;
    while (this.spiralTimer >= SUDDEN_DEATH_INTERVAL && this.spiralIndex < this.spiral.length - 2) {
      this.spiralTimer -= SUDDEN_DEATH_INTERVAL;
      this.dropBlock(this.spiral[this.spiralIndex++]);
    }
  }

  nextSpiralTiles(n) {
    if (!this.spiral) return [];
    return this.spiral.slice(this.spiralIndex, Math.min(this.spiralIndex + n, this.spiral.length - 2));
  }

  dropBlock({ x, y }) {
    if (this.grid[y][x] === TILE_WALL) return;
    this.grid[y][x] = TILE_WALL;
    this.falling.push(new FallingBlock(x, y));
    for (const p of this.players) {
      if (p.alive && p.tx === x && p.ty === y) this.killPlayer(p, true);
    }
    for (const e of this.enemies) {
      if (e.alive && e.tx === x && e.ty === y) this.killEnemy(e, null);
    }
    for (const b of this.bombs.slice()) {
      if (b.tx === x && b.ty === y) {
        this.bombs = this.bombs.filter((o) => o !== b);
        b.owner.bombsActive = Math.max(0, b.owner.bombsActive - 1);
      }
    }
    this.powerups = this.powerups.filter((pu) => !(pu.tx === x && pu.ty === y));
    this.addShake(3);
    this.sfx.thud();
  }

  // Cheap per-frame danger map used by fleeing enemies: 0 safe, 1 in a blast
  // line, 2 currently burning.
  buildDangerMap() {
    this.danger.fill(0);
    for (const b of this.bombs) {
      this.danger[b.ty * COLS + b.tx] = 1;
      for (const dir of DIR_LIST) {
        const v = DIRS[dir];
        for (let i = 1; i <= b.range; i++) {
          const x = b.tx + v.dx * i;
          const y = b.ty + v.dy * i;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
          const t = this.grid[y][x];
          if (t === TILE_WALL) break;
          this.danger[y * COLS + x] = 1;
          if (t === TILE_BRICK) break;
        }
      }
    }
    for (const ex of this.explosions) {
      for (const c of ex.cells) this.danger[c.y * COLS + c.x] = 2;
    }
  }

  dangerAt(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return 0;
    return this.danger[y * COLS + x];
  }

  updateBombs(dt) {
    for (const b of this.bombs) {
      b.age += dt;
      if (Number.isFinite(b.timer)) b.timer -= dt * 1000;
      for (const w of b.walkers) {
        if (!this.overlapsTile(w, b.tx, b.ty)) b.walkers.delete(w);
      }
      if (b.slideDir) this.slideBomb(b, dt);
    }
    for (const b of this.bombs.slice()) {
      if (b.exploded) continue;
      if (b.timer <= 0 || this.explosions.some((ex) => ex.covers(b.tx, b.ty))) {
        this.explodeBomb(b);
      }
    }
  }

  slideBomb(b, dt) {
    const v = DIRS[b.slideDir];
    const step = KICK_SPEED * dt;
    const dx = b.slideTarget.x - b.x;
    const dy = b.slideTarget.y - b.y;
    if (Math.abs(dx) + Math.abs(dy) <= step) {
      b.x = b.slideTarget.x;
      b.y = b.slideTarget.y;
      const nx = b.tx + v.dx;
      const ny = b.ty + v.dy;
      if (this.canBombEnter(nx, ny, b)) {
        b.slideTarget = { x: centerOf(nx), y: centerOf(ny) };
      } else {
        b.slideDir = null;
        b.slideTarget = null;
      }
    } else {
      b.x += Math.sign(dx) * Math.min(step, Math.abs(dx));
      b.y += Math.sign(dy) * Math.min(step, Math.abs(dy));
    }
  }

  canBombEnter(x, y, bomb) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (this.grid[y][x] !== TILE_EMPTY) return false;
    const other = this.bombAt(x, y);
    if (other && other !== bomb) return false;
    if (this.powerups.some((pu) => pu.tx === x && pu.ty === y)) return false;
    if (this.exit && this.exit.revealed && this.exit.tx === x && this.exit.ty === y) return false;
    for (const e of [...this.players, ...this.enemies]) {
      if (e.alive && this.overlapsTile(e, x, y)) return false;
    }
    return true;
  }

  kickBomb(bomb, dir) {
    const v = DIRS[dir];
    const nx = bomb.tx + v.dx;
    const ny = bomb.ty + v.dy;
    if (!this.canBombEnter(nx, ny, bomb)) return false;
    bomb.slideDir = dir;
    bomb.slideTarget = { x: centerOf(nx), y: centerOf(ny) };
    this.sfx.kick();
    return true;
  }

  updateEffects(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 500 * dt;
      pt.life -= dt * 1000;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const f of this.floaters) {
      f.y -= 28 * dt;
      f.life -= dt * 1000;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.shake.t > 0) {
      this.shake.t -= dt * 1000;
      if (this.shake.t <= 0) this.shake.mag = 0;
    }
  }

  handleGlobalKeys() {
    const inp = this.input;
    if (inp.wasPressed('KeyM')) this.toggleMute();

    const digits = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    const numpad = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6'];
    const pressedDigit = () => {
      for (let i = 0; i < digits.length; i++) {
        if (inp.wasPressed([digits[i], numpad[i]])) return i;
      }
      return -1;
    };

    switch (this.state) {
      case 'title':
      case 'setup':
      case 'levelclear':
      case 'roundover':
      case 'gameover': {
        const d = pressedDigit();
        if (d >= 0) return this.ui.activateButton(d);
        if (inp.wasPressed(['Enter', 'NumpadEnter', 'Space'])) return this.ui.activateFocused();
        if (inp.wasPressed(['Escape', 'Backspace'])) return this.ui.backAction();
        if (inp.wasPressed(['ArrowUp', 'KeyW'])) this.ui.focusMove(-1);
        if (inp.wasPressed(['ArrowDown', 'KeyS'])) this.ui.focusMove(1);
        if (inp.wasPressed(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'])) return this.ui.activateFocused(true);
        if (this.state !== 'title' && this.state !== 'setup' && inp.wasPressed('KeyR')) {
          this.showTitle();
          return true;
        }
        return false;
      }
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
        if (inp.wasPressed(['KeyP', 'Escape', 'Enter', 'NumpadEnter', 'Space'])) {
          this.resume();
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

  toggleMute() {
    this.settings.muted = this.sfx.toggleMute();
    this.ui.setMuted(this.settings.muted);
    this.saveSettings();
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
          this.announce('EXIT OPEN!', '#ffee58');
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
    const t = this.grid[ty][tx];
    if (t === TILE_WALL) return true;
    if (t === TILE_BRICK) return !(entity.wallPass || (entity.cfg && entity.cfg.passBricks));
    const b = this.bombAt(tx, ty);
    if (b && !b.walkers.has(entity)) return !(entity.cfg && entity.cfg.passBombs);
    return false;
  }

  tryPlaceBomb(p) {
    if (!p.alive || p.hasCurse('constipation')) return false;
    if (p.bombsActive >= p.maxBombs) return false;
    const tx = p.tx;
    const ty = p.ty;
    if (this.grid[ty][tx] !== TILE_EMPTY || this.bombAt(tx, ty)) return false;

    const fuse = p.remote ? Infinity : this.mode === 1 ? this.diff.bombFuse : BOMB_FUSE;
    const bomb = new Bomb(tx, ty, p, p.range, fuse);
    for (const e of [...this.players, ...this.enemies]) {
      if (e.alive && this.overlapsTile(e, tx, ty)) bomb.walkers.add(e);
    }
    this.bombs.push(bomb);
    p.bombsActive += 1;
    this.sfx.placeBomb();
    return true;
  }

  detonate(p) {
    const bomb = this.bombs.find((b) => b.owner === p && b.remote && !b.exploded);
    if (bomb) this.explodeBomb(bomb);
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
    this.addShake(3 + bomb.range);
    for (const c of cells) {
      if (c.end) this.spawnParticles(centerOf(c.x), centerOf(c.y), 4, ['#ffb300', '#fff59d', '#ff6d00'], 140);
    }

    // Flames burn power-ups that were already lying around.
    this.powerups = this.powerups.filter((pu) => !(powerupsBefore.includes(pu) && explosion.covers(pu.tx, pu.ty)));

    for (const other of chain) this.explodeBomb(other);
  }

  destroyBrick(x, y) {
    this.grid[y][x] = TILE_EMPTY;
    this.breaking.push(new BreakingBrick(x, y));
    const theme = THEMES[this.theme];
    this.spawnParticles(centerOf(x), centerOf(y), 6, [theme.brick, theme.brickDark, theme.brickLight], 120);
    if (this.exit && this.exit.tx === x && this.exit.ty === y) {
      this.exit.revealed = true;
      return;
    }
    const chance = this.mode === 1 ? this.diff.powerupChance : POWERUP_CHANCE;
    if (Math.random() < chance) {
      let type = weightedPick(POWERUP_TABLE);
      if (this.mode === 2 && type === 'life') type = 'fire';
      this.powerups.push(new PowerUp(x, y, type));
    }
  }

  collectPowerUp(p, pu) {
    this.powerups = this.powerups.filter((x) => x !== pu);
    const info = POWERUP_INFO[pu.type];
    switch (pu.type) {
      case 'bomb':
        p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1);
        break;
      case 'fire':
        p.range = Math.min(MAX_RANGE, p.range + 1);
        break;
      case 'speed':
        p.speedLevel = Math.min(MAX_SPEED_LEVEL, p.speedLevel + 1);
        break;
      case 'kick':
        p.canKick = true;
        break;
      case 'remote':
        p.remote = true;
        break;
      case 'wallpass':
        p.wallPass = true;
        break;
      case 'life':
        p.lives = Math.min(MAX_LIVES, p.lives + 1);
        break;
      case 'skull':
        this.applyCurse(p);
        return;
      default:
        break;
    }
    p.score += Math.round(50 * (this.mode === 1 ? this.diff.scoreMult : 1));
    this.floaters.push(new Floater(info.name, p.x, p.y - 30, '#fff8e1', 13));
    this.spawnParticles(p.x, p.y, 8, ['#fff8e1', '#ffb300', p.color], 90);
    this.sfx.powerup();
  }

  applyCurse(p, type = null) {
    p.curse = { type: type || randomItem(CURSE_TYPES), timer: CURSE_DURATION };
    this.floaters.push(new Floater(CURSE_NAMES[p.curse.type], p.x, p.y - 30, '#ce93d8', 13, 1400));
    this.sfx.curse();
  }

  killPlayer(p, force = false) {
    if (!p.alive) return;
    if (!force && p.shield > 0) return;
    p.alive = false;
    p.dying = true;
    p.deathTimer = RESPAWN_DELAY;
    p.lives = Math.max(0, p.lives - 1);
    p.curse = null;
    if (this.mode === 1 && this.diff.losePowersOnDeath) p.resetPowers();
    // Remote bombs left behind get a normal fuse.
    for (const b of this.bombs) {
      if (b.owner === p && b.remote) {
        b.remote = false;
        b.timer = 1000;
      }
    }
    this.spawnParticles(p.x, p.y, 14, ['#ffffff', p.color, '#eceff1'], 160);
    this.addShake(6);
    this.freeze = 90;
    this.sfx.death();
  }

  killEnemy(e, killer) {
    if (!e.alive) return;
    e.alive = false;
    e.dying = true;
    e.deathTimer = ENEMY_DEATH_DURATION;
    const mult = this.mode === 1 ? this.diff.scoreMult : 1;
    const points = Math.round(e.cfg.score * mult);
    if (killer) {
      killer.score += points;
      killer.kills += 1;
      this.floaters.push(new Floater(`+${points}`, e.x, e.y - 20, '#ffee58', 14));
    }
    this.spawnParticles(e.x, e.y, 10, [e.color, '#ffffff'], 130);
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

    // Curses spread by touch in battle mode
    if (this.mode === 2) {
      for (const a of this.players) {
        if (!a.alive || !a.curse) continue;
        for (const b of this.players) {
          if (b === a || !b.alive || b.curse || b.curseImmune > 0) continue;
          if (Math.abs(a.x - b.x) < TILE * 0.6 && Math.abs(a.y - b.y) < TILE * 0.6) {
            b.curse = { type: a.curse.type, timer: a.curse.timer };
            a.curse = null;
            a.curseImmune = 1500;
            this.floaters.push(new Floater('Curse passed on!', b.x, b.y - 30, '#ce93d8', 13));
            this.sfx.curse();
            break;
          }
        }
      }
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

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------
  addShake(mag) {
    this.shake.mag = Math.max(this.shake.mag, mag);
    this.shake.t = 180;
  }

  spawnParticles(x, y, count, colors, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      this.particles.push(new Particle(x, y, Math.cos(a) * v, Math.sin(a) * v - 60, 350 + Math.random() * 350, randomItem(colors), 2 + Math.random() * 3));
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  }

  announce(text, color = '#ffee58') {
    this.floaters.push(new Floater(text, CANVAS_W / 2, CANVAS_H / 2 - 30, color, 34, 1800));
  }

  render() {
    Renderer.draw(this);
  }
}
