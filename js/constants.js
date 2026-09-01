// ---------------------------------------------------------------------------
// Shared constants and data tables. All scripts are classic (non-module)
// scripts, so these are visible everywhere once this file has loaded.
// ---------------------------------------------------------------------------

const COLS = 15;
const ROWS = 13;
const TILE = 48;
const CANVAS_W = COLS * TILE; // 720
const CANVAS_H = ROWS * TILE; // 624

const TILE_EMPTY = 0;
const TILE_WALL = 1;
const TILE_BRICK = 2;

// Timing (milliseconds unless stated otherwise)
const BOMB_FUSE = 2500;
const EXPLOSION_DURATION = 450;
const BRICK_BREAK_DURATION = 350;
const ENEMY_DEATH_DURATION = 600;
const RESPAWN_DELAY = 1800;
const SPAWN_SHIELD = 2000;
const BATTLE_SHIELD = 3000;
const CURSE_DURATION = 15000;
const FALLING_BLOCK_DURATION = 300;

// Gameplay tuning
const LEVEL_TIME = 200; // seconds, single player (overridden by difficulty)
const BATTLE_TIME = 120; // seconds, battle rounds
const SUDDEN_DEATH_AT = 45; // seconds left when the arena starts closing in
const SUDDEN_DEATH_INTERVAL = 300; // ms between falling blocks
const START_LIVES = 3;
const ROUNDS_TO_WIN = 3;
const POWERUP_CHANCE = 0.32;
const MAX_LIVES = 9;

const BASE_SPEED = 120; // pixels per second
const SPEED_STEP = 28;
const MAX_SPEED_LEVEL = 5;
const MAX_BOMBS = 8;
const MAX_RANGE = 8;
const KICK_SPEED = 320; // pixels per second for kicked bombs

// Weighted power-up drop table.
const POWERUP_TABLE = [
  ['bomb', 30],
  ['fire', 30],
  ['speed', 14],
  ['kick', 8],
  ['remote', 5],
  ['wallpass', 4],
  ['life', 3],
  ['skull', 6],
];
const POWERUP_INFO = {
  bomb: { name: 'Extra Bomb', color: '#212121' },
  fire: { name: 'Fire Up', color: '#ff6d00' },
  speed: { name: 'Speed Up', color: '#fdd835' },
  kick: { name: 'Bomb Kick', color: '#8d6e63' },
  remote: { name: 'Remote Bomb', color: '#42a5f5' },
  wallpass: { name: 'Wall Pass', color: '#ab47bc' },
  life: { name: 'Extra Life', color: '#ef5350' },
  skull: { name: 'Cursed!', color: '#424242' },
};
const CURSE_TYPES = ['reverse', 'diarrhea', 'constipation', 'slow'];
const CURSE_NAMES = {
  reverse: 'Reversed controls',
  diarrhea: 'Bomb diarrhea',
  constipation: 'No bombs',
  slow: 'Slowed down',
};

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const DIR_LIST = ['up', 'down', 'left', 'right'];
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Player slots. The first two are human-controllable; slots 3 and 4 are only
// ever driven by bots (their key codes are placeholders that no keyboard emits).
const PLAYER_CONFIGS = [
  {
    id: 0,
    name: 'P1',
    color: '#4fc3f7',
    keys: {
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      bomb: ['Space'],
      detonate: ['ShiftLeft', 'KeyE'],
    },
  },
  {
    id: 1,
    name: 'P2',
    color: '#ff8a65',
    keys: {
      up: ['KeyI'],
      down: ['KeyK'],
      left: ['KeyJ'],
      right: ['KeyL'],
      bomb: ['Enter', 'NumpadEnter'],
      detonate: ['ShiftRight', 'KeyO'],
    },
  },
  {
    id: 2,
    name: 'P3',
    color: '#aed581',
    keys: { up: ['Bot3Up'], down: ['Bot3Down'], left: ['Bot3Left'], right: ['Bot3Right'], bomb: ['Bot3Bomb'], detonate: ['Bot3Det'] },
  },
  {
    id: 3,
    name: 'P4',
    color: '#ce93d8',
    keys: { up: ['Bot4Up'], down: ['Bot4Down'], left: ['Bot4Left'], right: ['Bot4Right'], bomb: ['Bot4Bomb'], detonate: ['Bot4Det'] },
  },
];

// Enemy roster, loosely based on the classic NES set.
const ENEMY_TYPES = {
  balloom: { name: 'Balloom', color: '#ef6c8f', speed: 60, score: 100, smart: false, passBricks: false, passBombs: false, fleesBombs: false, turnChance: 0.15, shape: 'round' },
  oneal: { name: 'Oneal', color: '#7fd3f0', speed: 90, score: 200, smart: true, passBricks: false, passBombs: false, fleesBombs: false, turnChance: 0.3, shape: 'round' },
  doll: { name: 'Doll', color: '#ffd54f', speed: 115, score: 400, smart: false, passBricks: false, passBombs: false, fleesBombs: false, turnChance: 0.45, shape: 'square' },
  minvo: { name: 'Minvo', color: '#ff7043', speed: 125, score: 800, smart: true, passBricks: false, passBombs: false, fleesBombs: true, turnChance: 0.35, shape: 'square' },
  kondoria: { name: 'Kondoria', color: '#7e57c2', speed: 40, score: 1000, smart: true, passBricks: true, passBombs: false, fleesBombs: false, turnChance: 0.2, shape: 'ghost' },
  ovapi: { name: 'Ovapi', color: '#26a69a', speed: 70, score: 2000, smart: false, passBricks: true, passBombs: false, fleesBombs: false, turnChance: 0.25, shape: 'ghost' },
  pass: { name: 'Pass', color: '#ffa726', speed: 125, score: 4000, smart: true, passBricks: false, passBombs: true, fleesBombs: true, turnChance: 0.3, shape: 'diamond' },
  pontan: { name: 'Pontan', color: '#ffffff', speed: 140, score: 8000, smart: true, passBricks: true, passBombs: true, fleesBombs: true, turnChance: 0.5, shape: 'star' },
  boss: { name: 'Boss', color: '#b71c1c', speed: 70, score: 5000, smart: true, passBricks: false, passBombs: false, fleesBombs: true, turnChance: 0.3, shape: 'boss' },
};

// Campaign difficulty presets.
const DIFFICULTY = {
  easy: {
    label: 'Easy',
    lives: 5,
    levelTime: 240,
    enemyCount: (lvl) => Math.min(2 + Math.floor(lvl * 0.7), 7),
    speedMult: 0.85,
    smartChance: 0.15,
    powerupChance: 0.45,
    losePowersOnDeath: false,
    bombFuse: 2800,
    densityMod: -0.08,
    scoreMult: 0.5,
    timeoutPontans: 2,
  },
  normal: {
    label: 'Normal',
    lives: 3,
    levelTime: 200,
    enemyCount: (lvl) => Math.min(2 + lvl, 10),
    speedMult: 1.0,
    smartChance: 0.4,
    powerupChance: 0.32,
    losePowersOnDeath: false,
    bombFuse: 2500,
    densityMod: 0,
    scoreMult: 1.0,
    timeoutPontans: 3,
  },
  hard: {
    label: 'Hard',
    lives: 2,
    levelTime: 150,
    enemyCount: (lvl) => Math.min(3 + Math.ceil(lvl * 1.3), 14),
    speedMult: 1.2,
    smartChance: 0.7,
    powerupChance: 0.24,
    losePowersOnDeath: true,
    bombFuse: 2200,
    densityMod: 0.06,
    scoreMult: 2.0,
    timeoutPontans: 4,
  },
};
const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

// World bosses (one per theme). HP and speed scale with the world number.
const BOSSES = {
  grass: { name: 'Mossback', color: '#2e7d32', accent: '#a5d6a7' },
  ice: { name: 'Frostjaw', color: '#0277bd', accent: '#b3e5fc' },
  desert: { name: 'Dune King', color: '#ef6c00', accent: '#ffe0b2' },
  factory: { name: 'Gearhead', color: '#455a64', accent: '#ffab00' },
  volcano: { name: 'Magmaw', color: '#b71c1c', accent: '#ffca28' },
};
const BOSS_BASE_HP = 5;
const BOSS_IFRAMES = 1200;
const BOSS_MINION_INTERVAL = 9000;
const INTRO_DURATION = 2400;

// Which enemy types can appear from a given campaign level onward.
const PACING = {
  easy: [
    { from: 1, pool: ['balloom'] },
    { from: 4, pool: ['balloom', 'oneal'] },
    { from: 7, pool: ['balloom', 'oneal', 'doll'] },
    { from: 10, pool: ['oneal', 'doll', 'kondoria'] },
    { from: 13, pool: ['doll', 'kondoria', 'ovapi'] },
    { from: 16, pool: ['doll', 'minvo', 'ovapi', 'pass'] },
    { from: 21, pool: ['minvo', 'ovapi', 'pass', 'pontan'] },
  ],
  normal: [
    { from: 1, pool: ['balloom'] },
    { from: 2, pool: ['balloom', 'oneal'] },
    { from: 4, pool: ['balloom', 'oneal', 'doll'] },
    { from: 6, pool: ['oneal', 'doll', 'minvo'] },
    { from: 8, pool: ['oneal', 'doll', 'kondoria'] },
    { from: 10, pool: ['doll', 'minvo', 'ovapi'] },
    { from: 12, pool: ['minvo', 'kondoria', 'ovapi', 'pass'] },
    { from: 15, pool: ['minvo', 'ovapi', 'pass', 'pontan'] },
  ],
  hard: [
    { from: 1, pool: ['balloom', 'oneal'] },
    { from: 3, pool: ['oneal', 'doll'] },
    { from: 5, pool: ['oneal', 'doll', 'minvo'] },
    { from: 7, pool: ['doll', 'minvo', 'kondoria'] },
    { from: 9, pool: ['minvo', 'kondoria', 'ovapi'] },
    { from: 11, pool: ['minvo', 'ovapi', 'pass'] },
    { from: 13, pool: ['ovapi', 'pass', 'pontan'] },
  ],
};

// Visual themes; one per campaign world.
const THEMES = {
  grass: {
    name: 'Green Fields',
    floorA: '#4caf50', floorB: '#46a34a', tuft: '#3d9a41',
    wall: '#5f6b78', wallLight: '#8b98a6', wallDark: '#3a434d', wallInner: '#707d8b',
    brick: '#c9702b', brickLight: '#e0894a', brickDark: '#a3561d', mortar: '#7d3f12',
  },
  ice: {
    name: 'Frozen Depths',
    floorA: '#b3e5fc', floorB: '#a4dbf7', tuft: '#8fd0f2',
    wall: '#37474f', wallLight: '#607d8b', wallDark: '#1c262b', wallInner: '#455a64',
    brick: '#7fb3d5', brickLight: '#a9d1ea', brickDark: '#5c93b8', mortar: '#3f6f8f',
  },
  desert: {
    name: 'Desert Ruins',
    floorA: '#e6c48a', floorB: '#dcb877', tuft: '#c9a463',
    wall: '#8d6e4a', wallLight: '#b08f66', wallDark: '#5c4630', wallInner: '#9c7c55',
    brick: '#c48b4f', brickLight: '#dba56a', brickDark: '#9c6a36', mortar: '#7a4f24',
  },
  factory: {
    name: 'Iron Works',
    floorA: '#616161', floorB: '#585858', tuft: '#4e4e4e',
    wall: '#263238', wallLight: '#4f5b62', wallDark: '#101820', wallInner: '#37474f',
    brick: '#b0bec5', brickLight: '#cfd8dc', brickDark: '#8a9ba3', mortar: '#546e7a',
  },
  volcano: {
    name: 'Magma Core',
    floorA: '#4e342e', floorB: '#452d27', tuft: '#3c2521',
    wall: '#212121', wallLight: '#484848', wallDark: '#0a0a0a', wallInner: '#2f2f2f',
    brick: '#ff7043', brickLight: '#ff8a65', brickDark: '#d84315', mortar: '#7f2a12',
  },
};
const WORLD_ORDER = ['grass', 'ice', 'desert', 'factory', 'volcano'];
const LEVELS_PER_WORLD = 5;
const WORLD_TEMPLATES = {
  grass: ['classic', 'arena', 'classic', 'rooms', 'arena'],
  ice: ['cross', 'classic', 'maze', 'arena', 'classic'],
  desert: ['rooms', 'cross', 'classic', 'maze', 'arena'],
  factory: ['maze', 'rooms', 'cross', 'classic', 'rooms'],
  volcano: ['classic', 'cross', 'maze', 'rooms', 'arena'],
};

// Keys whose browser default (page scroll, etc.) we suppress while playing.
const PREVENT_DEFAULT_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
