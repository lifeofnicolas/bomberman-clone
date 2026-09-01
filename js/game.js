// ---------------------------------------------------------------------------
// Core game: menus, level setup, simulation, and rules.
// ---------------------------------------------------------------------------

class Game {
  constructor(canvas, input, sfx, music, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = sfx;
    this.music = music;
    this.ui = ui;

    this.settings = Save.load();
    this.sfx.muted = !!this.settings.muted;
    this.sfx.volume = this.settings.sfxVolume;
    this.music.setVolume(this.settings.musicVolume);
    this.ui.setMuted(this.sfx.muted);
    this.ui.onActivate = () => this.sfx.menu();

    // title | setup | intro | playing | paused | levelclear | roundover | gameover
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
    this.demo = false;
    this.demoRestart = 0;
    this.intro = null;
    this.results = null;
    this.resetArmed = false;

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
    this.boss = null;
    this.shake = { t: 0, mag: 0 };
    this.spiral = null;
    this.spiralIndex = 0;
    this.spiralTimer = 0;
    this.suddenDeath = false;
    this.timedOut = false;
    this.danger = new Uint8Array(COLS * ROWS);

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

  isMenu() {
    return this.state === 'title' || this.state === 'setup' || this.state === 'levelclear' || this.state === 'roundover' || this.state === 'gameover' || this.state === 'paused';
  }

  // ------------------------------------------------------------------
  // Menus
  // ------------------------------------------------------------------
  showTitle() {
    this.state = 'title';
    this.ui.buildHud([], 1);
    this.music.play('title');
    if (!this.demo) this.startDemo();
    const hs = this.settings.highScores;
    this.ui.showOverlay({
      title: 'BOMBERMAN',
      text: 'Blast through the bricks, defeat every enemy\nand find the hidden exit.',
      buttons: [
        { label: 'CAMPAIGN', action: () => this.showCampaignSetup() },
        { label: 'BATTLE', action: () => this.showBattleSetup() },
        { label: 'OPTIONS', action: () => this.showOptions() },
        { label: 'HOW TO PLAY', action: () => this.showHelp() },
      ],
      help:
        `High scores  Easy ${hs.easy}  ·  Normal ${hs.normal}  ·  Hard ${hs.hard}\n` +
        `Battle matches won: ${this.settings.battleWins}\n` +
        this.keyHint('Press 1-4 to choose · Enter to confirm'),
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
        if ((this.settings.progress[key] || 1) > 1) this.showWorldSelect(key);
        else this.startCampaign(key, 0);
      },
    }));
    buttons.push({ label: 'BACK', action: () => this.showTitle(), back: true });
    this.ui.showOverlay({
      title: 'CAMPAIGN',
      text:
        'Easy  ·  5 lives, 240 s, slow enemies, lots of power-ups\n' +
        'Normal  ·  3 lives, 200 s, the classic experience\n' +
        'Hard  ·  2 lives, 150 s, fast enemies, lose power-ups on death\n\n' +
        'Five worlds of five stages. Each world ends with a boss.',
      buttons,
      help: this.keyHint('Press 1-3 to choose · Esc to go back'),
      focus: DIFFICULTY_ORDER.indexOf(current),
    });
  }

  showWorldSelect(difficulty) {
    this.state = 'setup';
    const unlocked = Math.min(WORLD_ORDER.length, this.settings.progress[difficulty] || 1);
    const buttons = [];
    for (let w = 0; w < unlocked; w++) {
      const theme = THEMES[WORLD_ORDER[w]];
      buttons.push({ label: `WORLD ${w + 1} · ${theme.name.toUpperCase()}`, action: () => this.startCampaign(difficulty, w) });
    }
    buttons.push({ label: 'BACK', action: () => this.showCampaignSetup(), back: true });
    const best = this.settings.bestLevel[difficulty] || 0;
    this.ui.showOverlay({
      title: 'SELECT WORLD',
      text: `${DIFFICULTY[difficulty].label} · ${unlocked} of ${WORLD_ORDER.length} worlds unlocked\nBest stage reached: ${best ? `${Math.floor((best - 1) / LEVELS_PER_WORLD) + 1}-${((best - 1) % LEVELS_PER_WORLD) + 1}` : '-'}`,
      buttons,
      help: this.keyHint(`Press 1-${unlocked} to choose · Esc to go back`),
      focus: unlocked - 1,
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
      help: this.keyHint('Press 1-5 to choose · Enter to start · Esc to go back\nPlayer 2 uses I J K L and Enter, or a second gamepad'),
    });
  }

  showOptions() {
    this.state = 'setup';
    const s = this.settings;
    const pct = (v) => `${Math.round(v * 100)}%`;
    const cycleVolume = (v) => (v >= 1 ? 0 : Math.min(1, v + 0.25));
    const rerender = () => {
      const focus = this.ui.focusIndex;
      this.saveSettings();
      this.showOptions();
      this.ui.focusButton(focus);
    };
    const touchLabel = s.touchUI === null || s.touchUI === undefined ? 'AUTO' : s.touchUI ? 'ON' : 'OFF';

    this.ui.showOverlay({
      title: 'OPTIONS',
      text: 'Settings are saved in this browser.',
      buttons: [
        {
          label: `MUSIC: ${pct(s.musicVolume)}`,
          action: () => {
            s.musicVolume = cycleVolume(s.musicVolume);
            this.music.setVolume(s.musicVolume);
            rerender();
          },
        },
        {
          label: `SOUND: ${pct(s.sfxVolume)}`,
          action: () => {
            s.sfxVolume = cycleVolume(s.sfxVolume);
            this.sfx.volume = s.sfxVolume;
            rerender();
          },
        },
        {
          label: `SCREEN SHAKE: ${s.shake ? 'ON' : 'OFF'}`,
          action: () => {
            s.shake = !s.shake;
            rerender();
          },
        },
        {
          label: `TOUCH CONTROLS: ${touchLabel}`,
          action: () => {
            s.touchUI = s.touchUI === null || s.touchUI === undefined ? true : s.touchUI ? false : null;
            this.ui.setTouchUI(s.touchUI === null ? this.ui.coarse : s.touchUI);
            rerender();
          },
        },
        {
          label: this.resetArmed ? 'CONFIRM RESET?' : 'RESET PROGRESS',
          action: () => {
            if (!this.resetArmed) {
              this.resetArmed = true;
            } else {
              this.resetArmed = false;
              s.highScores = { easy: 0, normal: 0, hard: 0 };
              s.bestLevel = { easy: 0, normal: 0, hard: 0 };
              s.progress = { easy: 1, normal: 1, hard: 1 };
              s.battleWins = 0;
            }
            rerender();
          },
        },
        {
          label: 'BACK',
          action: () => {
            this.resetArmed = false;
            this.showTitle();
          },
          back: true,
        },
      ],
      help: this.keyHint('Press 1-6 to choose · Esc to go back · M mutes everything'),
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
          : 'Move with W A S D or the arrow keys, drop bombs with Space.\nGamepads work too: D-pad or stick to move, A to bomb, B to detonate.\n') +
        'Bombs explode in a cross and destroy bricks, enemies and players.\n' +
        'Campaign: defeat every enemy, then find the exit hidden under a brick.\n' +
        'Every fifth stage is a boss: hit it with flames until its health bar is empty.\n' +
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
  startCampaign(difficulty, worldIdx = 0) {
    this.stopDemo();
    this.mode = 1;
    this.difficulty = difficulty;
    this.diff = DIFFICULTY[difficulty];
    this.level = worldIdx * LEVELS_PER_WORLD + 1;
    const p = new Player(PLAYER_CONFIGS[0], spawnCorners()[0]);
    p.lives = this.diff.lives;
    this.players = [p];
    this.startLevel();
  }

  startBattle() {
    this.stopDemo();
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

  // Attract mode: four hard bots fight behind the title menu.
  startDemo() {
    this.demo = true;
    this.demoRestart = 0;
    this.mode = 2;
    this.level = 1 + Math.floor(Math.random() * WORLD_ORDER.length);
    this.players = PLAYER_CONFIGS.map((cfg, i) => {
      const p = new Player(cfg, spawnCorners()[i]);
      p.bot = new Bot(p, 'hard');
      p.name = `CPU${i + 1}`;
      return p;
    });
    this.sfx.suppressed = true;
    this.setupLevel();
  }

  stopDemo() {
    this.demo = false;
    this.sfx.suppressed = false;
  }

  campaignStage() {
    const idx = this.level - 1;
    const worldIdx = Math.floor(idx / LEVELS_PER_WORLD);
    return {
      world: worldIdx,
      stage: idx % LEVELS_PER_WORLD,
      loop: Math.floor(worldIdx / WORLD_ORDER.length),
      theme: WORLD_ORDER[worldIdx % WORLD_ORDER.length],
      boss: idx % LEVELS_PER_WORLD === LEVELS_PER_WORLD - 1,
    };
  }

  isBossLevel() {
    return this.mode === 1 && this.campaignStage().boss;
  }

  // Build the arena, spawn everything, reset timers. Does not touch UI state.
  setupLevel() {
    const battle = this.mode === 2;
    let templateName;
    let density;

    if (battle) {
      this.theme = WORLD_ORDER[(this.level - 1) % WORLD_ORDER.length];
      templateName = randomItem(TEMPLATE_NAMES);
      density = 0.6;
      this.levelLabel = `ROUND ${this.level}`;
    } else {
      const s = this.campaignStage();
      this.theme = s.theme;
      templateName = s.boss ? 'arena' : WORLD_TEMPLATES[s.theme][s.stage];
      density = s.boss
        ? Math.min(0.5, Math.max(0.2, 0.32 + this.diff.densityMod))
        : Math.min(0.75, Math.max(0.3, 0.45 + s.stage * 0.05 + s.loop * 0.05 + this.diff.densityMod));
      this.levelLabel = `${THEMES[s.theme].name.toUpperCase()}  ${s.world + 1}-${s.stage + 1}`;
      if (s.boss) this.levelLabel += '  ·  BOSS';
    }
    Renderer.setTheme(this.theme);

    const built = buildLevel(templateName, density, { symmetric: battle });
    this.grid = built.grid;
    const spawns = [];
    this.players.forEach((p, i) => {
      p.spawn = built.spawns[i] || spawnCorners()[i];
      spawns.push(p.spawn);
      p.resetForLevel(battle ? BATTLE_SHIELD : SPAWN_SHIELD);
      p.levelKills = 0;
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
    this.boss = null;
    this.timedOut = false;
    this.suddenDeath = false;
    this.spiral = null;
    this.spiralIndex = 0;
    this.spiralTimer = 0;
    this.shake = { t: 0, mag: 0 };
    this.freeze = 0;
    this.exitAnnounced = false;

    // Enemies
    const roster = battle ? this.battleRoster() : this.campaignRoster();
    for (const type of roster) this.spawnEnemy(type, spawns, battle ? 1 : this.diff.speedMult);

    if (!battle && this.isBossLevel()) {
      const s = this.campaignStage();
      const cx = Math.floor(COLS / 2);
      const cy = Math.floor(ROWS / 2);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.grid[cy + dy][cx + dx] === TILE_BRICK) this.grid[cy + dy][cx + dx] = TILE_EMPTY;
      }
      this.boss = new Boss(s.theme, cx, cy, s.world + 1, this.diff.speedMult);
      this.enemies.push(this.boss);
    } else if (!battle) {
      // Hidden exit under a brick
      const bricks = tilesOfType(this.grid, TILE_BRICK);
      const far = bricks.filter((t) => manhattan(t, spawns[0]) >= 6);
      const spot = randomItem(far.length ? far : bricks);
      if (spot) this.exit = { tx: spot.x, ty: spot.y, revealed: false };
    }

    this.timeLeft = battle ? BATTLE_TIME : this.diff.levelTime;
    this.lastTickSecond = -1;
  }

  startLevel() {
    this.setupLevel();
    this.state = 'intro';
    this.intro = { t: 0, ready: false, go: false };
    this.ui.hideOverlay();
    this.ui.buildHud(this.players, this.mode);
    this.ui.updateHud(this);
    this.updateMusic();
    if (this.boss) this.sfx.bossRoar();
  }

  spawnEnemy(type, spawns, speedMult) {
    const cfg = ENEMY_TYPES[type];
    const usable = (t) => this.grid[t.y][t.x] === TILE_EMPTY || (cfg.passBricks && this.grid[t.y][t.x] === TILE_BRICK);
    const all = [...tilesOfType(this.grid, TILE_EMPTY), ...(cfg.passBricks ? tilesOfType(this.grid, TILE_BRICK) : [])].filter(usable);
    const taken = (t) => this.enemies.some((e) => e.tx === t.x && e.ty === t.y);
    let candidates = all.filter((t) => !taken(t) && spawns.every((s) => manhattan(t, s) >= 6));
    if (!candidates.length) candidates = all.filter((t) => !taken(t) && spawns.every((s) => manhattan(t, s) >= 4));
    if (!candidates.length) candidates = all.filter((t) => spawns.every((s) => manhattan(t, s) >= 3));
    if (!candidates.length) return null;
    const spot = randomItem(candidates);
    const e = new Enemy(type, spot.x, spot.y, speedMult);
    this.enemies.push(e);
    return e;
  }

  pacingPool() {
    const pacing = PACING[this.difficulty];
    let entry = pacing[0];
    for (const e of pacing) if (e.from <= this.level) entry = e;
    return entry;
  }

  campaignRoster() {
    const loop = Math.floor((this.level - 1) / (LEVELS_PER_WORLD * WORLD_ORDER.length));
    const boss = this.isBossLevel();
    const count = boss ? 2 : Math.min(14, this.diff.enemyCount(this.level) + loop * 2);
    const entry = this.pacingPool();
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
    if (!boss && entry.from === this.level && list.length) list[0] = pool[pool.length - 1];
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
    if (this.state !== 'playing' && this.state !== 'intro') return;
    this.state = 'paused';
    this.music.setDuck(0.3);
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
    this.music.setDuck(1);
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
    this.music.stop();
    const p = this.players[0];
    const mult = this.diff.scoreMult;
    const timeFrac = this.timeLeft / this.diff.levelTime;
    const stars = timeFrac >= 0.5 ? 3 : timeFrac >= 0.25 ? 2 : 1;
    const items = [
      { label: this.boss ? 'Boss defeated' : 'Stage clear', value: Math.round((this.boss ? 1500 : 500) * mult) },
      { label: 'Time bonus', value: Math.round(Math.floor(this.timeLeft) * 5 * mult) },
      { label: `Enemies defeated x${p.levelKills}`, value: Math.round(p.levelKills * 50 * mult) },
    ];
    const total = items.reduce((a, b) => a + b.value, 0);
    p.score += total;

    // Unlock the next world after a boss.
    let unlockedText = '';
    if (this.campaignStage().boss) {
      const nextWorld = Math.floor(this.level / LEVELS_PER_WORLD) + 1; // 1-based
      if (nextWorld <= WORLD_ORDER.length && (this.settings.progress[this.difficulty] || 1) < nextWorld) {
        this.settings.progress[this.difficulty] = nextWorld;
        unlockedText = `\n★ World ${nextWorld} unlocked: ${THEMES[WORLD_ORDER[nextWorld - 1]].name}`;
      }
    }
    const newBest = this.recordCampaign();
    if (this.boss) this.sfx.victory();
    else this.sfx.levelClear();
    this.ui.updateHud(this);

    const next = this.level + 1;
    const nextIdx = next - 1;
    const nextWorldIdx = Math.floor(nextIdx / LEVELS_PER_WORLD);
    const nextTheme = WORLD_ORDER[nextWorldIdx % WORLD_ORDER.length];
    this.results = {
      t: 0,
      items,
      total,
      stars,
      done: false,
      footer:
        `\nScore: ${p.score}` +
        (newBest ? '\n★ New high score!' : '') +
        unlockedText +
        `\n\nNext: ${THEMES[nextTheme].name} ${nextWorldIdx + 1}-${(nextIdx % LEVELS_PER_WORLD) + 1}`,
    };
    this.ui.showOverlay({
      title: this.boss ? 'BOSS DEFEATED!' : 'STAGE CLEAR!',
      text: '',
      buttons: [
        {
          label: 'NEXT STAGE',
          action: () => {
            this.level += 1;
            this.startLevel();
          },
        },
        { label: 'MAIN MENU', action: () => this.showTitle(), back: true },
      ],
      help: this.keyHint('Press Enter or Space to continue'),
    });
    this.renderResults();
  }

  // Animated score tally on the stage-clear screen.
  updateResults(dt) {
    const r = this.results;
    if (!r || r.done) return;
    r.t += dt * 1000;
    const totalTime = r.items.length * 450 + 400;
    if (r.t >= totalTime) r.done = true;
    else if (Math.floor(r.t / 60) !== Math.floor((r.t - dt * 1000) / 60)) this.sfx.tally();
    this.renderResults();
  }

  finishResults() {
    if (this.results) {
      this.results.done = true;
      this.renderResults();
    }
  }

  renderResults() {
    const r = this.results;
    if (!r) return;
    const lines = [];
    r.items.forEach((item, i) => {
      const start = i * 450;
      if (!r.done && r.t < start) return;
      const f = r.done ? 1 : Math.min(1, (r.t - start) / 400);
      lines.push(`${item.label}  ·  +${Math.round(item.value * f)}`);
    });
    if (r.done) {
      lines.push('', '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), r.footer.trim());
    }
    this.ui.setOverlayText(lines.join('\n'));
  }

  gameOver() {
    this.state = 'gameover';
    this.music.stop();
    this.sfx.gameOverJingle();
    const p = this.players[0];
    const newBest = this.recordCampaign();
    const s = this.campaignStage();
    this.ui.showOverlay({
      title: 'GAME OVER',
      text: `Final score: ${p.score}\nReached ${THEMES[s.theme].name} ${s.world + 1}-${s.stage + 1} (${DIFFICULTY[this.difficulty].label})` + (newBest ? '\n★ New high score!' : ''),
      buttons: [
        { label: 'RETRY WORLD', action: () => this.startCampaign(this.difficulty, Math.min(s.world, WORLD_ORDER.length - 1)) },
        { label: 'MAIN MENU', action: () => this.showTitle(), back: true },
      ],
      help: this.keyHint('Press Enter or Space to retry'),
    });
  }

  roundOver(winner) {
    this.state = 'roundover';
    this.music.stop();
    if (winner) winner.wins += 1;
    this.ui.updateHud(this);

    const standings = this.players.map((p) => `${p.name}: ${p.wins}`).join('   ');
    if (winner && winner.wins >= ROUNDS_TO_WIN) {
      if (!winner.isBot) {
        this.settings.battleWins += 1;
        this.saveSettings();
      }
      this.sfx.victory();
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

    this.sfx.levelClear();
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

  updateMusic() {
    if (this.demo || this.isMenu()) return;
    const hurry = (this.mode === 1 && !this.timedOut && this.timeLeft > 0 && this.timeLeft < 30) || this.suddenDeath;
    if (hurry) this.music.play('hurry');
    else if (this.boss) this.music.play('boss');
    else this.music.play(this.theme);
  }

  // ------------------------------------------------------------------
  // Main update
  // ------------------------------------------------------------------
  update(dt) {
    this.elapsed += dt;
    if (this.handleGlobalKeys()) return;

    if (this.state === 'levelclear') this.updateResults(dt);
    if (this.state === 'intro') {
      this.updateIntro(dt);
      this.updateEffects(dt);
      return;
    }

    const simulating = this.state === 'playing' || (this.demo && (this.state === 'title' || this.state === 'setup'));
    if (!simulating) return;

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
    if (this.boss && this.boss.alive) this.updateBoss(dt);

    for (const pu of this.powerups) pu.age += dt;
    this.updateEffects(dt);

    this.resolveCollisions();
    this.checkEndConditions();
    if (!this.demo) {
      this.updateMusic();
      this.ui.updateHud(this);
    }
  }

  updateIntro(dt) {
    const it = this.intro;
    it.t += dt * 1000;
    if (!it.ready && it.t > 300) {
      it.ready = true;
      this.sfx.countdown();
    }
    if (!it.go && it.t > INTRO_DURATION - 800) {
      it.go = true;
      this.sfx.go();
    }
    if (it.t >= INTRO_DURATION) {
      this.state = 'playing';
      this.intro = null;
    }
  }

  updateBoss(dt) {
    const b = this.boss;
    b.minionTimer -= dt * 1000;
    if (b.minionTimer <= 0) {
      b.minionTimer = BOSS_MINION_INTERVAL;
      if (this.enemiesRemaining() < 5) {
        const pool = this.pacingPool().pool.filter((t) => !ENEMY_TYPES[t].passBricks);
        const spawns = this.players.map((p) => ({ x: p.tx, y: p.ty }));
        const e = this.spawnEnemy(randomItem(pool.length ? pool : ['balloom']), spawns, this.diff.speedMult);
        if (e) {
          this.spawnParticles(e.x, e.y, 10, [b.color, b.accent], 120);
          this.sfx.curse();
        }
      }
    }
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
        const confirm = inp.wasPressed(['Enter', 'NumpadEnter', 'Space']);
        if (this.state === 'levelclear' && this.results && !this.results.done && (confirm || pressedDigit() >= 0)) {
          this.finishResults();
          return true;
        }
        const d = pressedDigit();
        if (d >= 0) return this.ui.activateButton(d);
        if (confirm) return this.ui.activateFocused();
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
      case 'intro':
        if (inp.wasPressed(['Enter', 'NumpadEnter', 'Space'])) {
          this.state = 'playing';
          this.intro = null;
          return true;
        }
        if (inp.wasPressed(['KeyP', 'Escape'])) {
          this.pause();
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
      case 'paused': {
        if (inp.wasPressed(['KeyP', 'Escape'])) {
          this.resume();
          return true;
        }
        const d = pressedDigit();
        if (d >= 0) return this.ui.activateButton(d);
        if (inp.wasPressed(['Enter', 'NumpadEnter', 'Space'])) return this.ui.activateFocused();
        if (inp.wasPressed(['ArrowUp', 'KeyW'])) this.ui.focusMove(-1);
        if (inp.wasPressed(['ArrowDown', 'KeyS'])) this.ui.focusMove(1);
        if (inp.wasPressed('KeyR')) {
          this.showTitle();
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  toggleMute() {
    this.settings.muted = this.sfx.toggleMute();
    this.music.refreshMute();
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
    if (this.demo) {
      const alive = this.players.filter((p) => p.alive);
      const dying = this.players.some((p) => p.dying);
      if (alive.length <= 1 && !dying) {
        this.demoRestart += 1;
        if (this.demoRestart > 90) this.startDemo();
      }
      return;
    }
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

  damageBoss(b, killer) {
    if (b.iframes > 0) return;
    b.hp -= 1;
    if (b.hp <= 0) {
      this.killEnemy(b, killer);
      return;
    }
    b.iframes = BOSS_IFRAMES;
    this.floaters.push(new Floater('HIT!', b.x, b.y - 40, '#ffee58', 16));
    this.spawnParticles(b.x, b.y, 12, [b.color, b.accent, '#ffffff'], 150);
    this.addShake(5);
    this.sfx.bossHit();
  }

  killEnemy(e, killer) {
    if (!e.alive) return;
    e.alive = false;
    e.dying = true;
    e.deathTimer = e.isBoss ? ENEMY_DEATH_DURATION * 2 : ENEMY_DEATH_DURATION;
    const mult = this.mode === 1 ? this.diff.scoreMult : 1;
    const points = Math.round(e.cfg.score * mult);
    if (killer) {
      killer.score += points;
      killer.kills += 1;
      killer.levelKills = (killer.levelKills || 0) + 1;
      this.floaters.push(new Floater(`+${points}`, e.x, e.y - 20, '#ffee58', 14));
    }
    this.spawnParticles(e.x, e.y, e.isBoss ? 40 : 10, [e.color, '#ffffff'], e.isBoss ? 220 : 130);
    if (e.isBoss) {
      this.exit = { tx: e.tx, ty: e.ty, revealed: true };
      this.announce(`${e.name} DEFEATED!`, '#ffee58');
      this.addShake(10);
      this.freeze = 200;
      this.sfx.bossRoar();
    } else {
      this.sfx.enemyDie();
    }
  }

  resolveCollisions() {
    // Flames vs players and enemies
    for (const ex of this.explosions) {
      for (const p of this.players) {
        if (p.alive && p.shield <= 0 && ex.covers(p.tx, p.ty)) this.killPlayer(p);
      }
      for (const e of this.enemies) {
        if (!e.alive || !ex.covers(e.tx, e.ty)) continue;
        if (e.isBoss) this.damageBoss(e, ex.owner);
        else this.killEnemy(e, ex.owner);
      }
    }

    // Enemies touching players
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const reach = TILE * 0.6 * (e.isBoss ? 1.35 : 1);
      for (const p of this.players) {
        if (!p.alive || p.shield > 0) continue;
        if (Math.abs(p.x - e.x) < reach && Math.abs(p.y - e.y) < reach) {
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
    if (this.settings.shake === false) return;
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
    if (this.demo) return;
    this.floaters.push(new Floater(text, CANVAS_W / 2, CANVAS_H / 2 - 30, color, 34, 1800));
  }

  render() {
    Renderer.draw(this);
  }
}
