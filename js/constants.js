// ---------------------------------------------------------------------------
// Shared constants. All scripts are classic (non-module) scripts, so these are
// visible everywhere once this file has loaded.
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

// Gameplay tuning
const LEVEL_TIME = 200; // seconds, single player
const BATTLE_TIME = 120; // seconds, two player battle
const START_LIVES = 3;
const ROUNDS_TO_WIN = 3;
const POWERUP_CHANCE = 0.32;

const BASE_SPEED = 120; // pixels per second
const SPEED_STEP = 28;
const MAX_SPEED_LEVEL = 5;
const MAX_BOMBS = 8;
const MAX_RANGE = 8;

const POWERUP_TYPES = ['bomb', 'fire', 'speed'];

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const DIR_LIST = ['up', 'down', 'left', 'right'];
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

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
    },
  },
];

const ENEMY_TYPES = {
  // Slow, wanders aimlessly.
  balloom: { color: '#ef6c8f', speed: 60, score: 100, smart: false, turnChance: 0.15 },
  // Medium speed, chases the player when it sees them.
  oneal: { color: '#7fd3f0', speed: 90, score: 200, smart: true, turnChance: 0.3 },
  // Fast and aggressive.
  doll: { color: '#ffd54f', speed: 115, score: 400, smart: true, turnChance: 0.4 },
};

// Keys whose browser default (page scroll, etc.) we suppress while playing.
const PREVENT_DEFAULT_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
