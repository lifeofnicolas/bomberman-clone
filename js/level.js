// ---------------------------------------------------------------------------
// Level construction. Arenas come from hand-designed 15x13 templates:
//   '#' indestructible wall      '.' floor that never gets a brick
//   '?' floor that may get a brick (rolled against density)
//   'S' player spawn (floor)
// All templates are point-symmetric so battle rounds are fair.
// ---------------------------------------------------------------------------

const TEMPLATES = {
  classic: [
    '###############',
    '#S???????????S#',
    '#?#?#?#?#?#?#?#',
    '#?????????????#',
    '#?#?#?#?#?#?#?#',
    '#?????????????#',
    '#?#?#?#?#?#?#?#',
    '#?????????????#',
    '#?#?#?#?#?#?#?#',
    '#?????????????#',
    '#?#?#?#?#?#?#?#',
    '#S???????????S#',
    '###############',
  ],
  arena: [
    '###############',
    '#S...?????...S#',
    '#..?.?????.?..#',
    '#.???..#..???.#',
    '#??.?.###.?.??#',
    '#???.?.#.?.???#',
    '#????.....????#',
    '#???.?.#.?.???#',
    '#??.?.###.?.??#',
    '#.???..#..???.#',
    '#..?.?????.?..#',
    '#S...?????...S#',
    '###############',
  ],
  cross: [
    '###############',
    '#S.?.?.#.?.?.S#',
    '#.#?#?.#.?#?#.#',
    '#???.?.?.?.???#',
    '#?#?#?.#.?#?#?#',
    '#?...?...?...?#',
    '###?###.###?###',
    '#?...?...?...?#',
    '#?#?#?.#.?#?#?#',
    '#???.?.?.?.???#',
    '#.#?#?.#.?#?#.#',
    '#S.?.?.#.?.?.S#',
    '###############',
  ],
  rooms: [
    '###############',
    '#S..#?????#..S#',
    '#.?.#?#?#?#.?.#',
    '#..??.....??..#',
    '#.?.#?#?#?#.?.#',
    '#...#?????#...#',
    '##?####.####?##',
    '#...#?????#...#',
    '#.?.#?#?#?#.?.#',
    '#..??.....??..#',
    '#.?.#?#?#?#.?.#',
    '#S..#?????#..S#',
    '###############',
  ],
  maze: [
    '###############',
    '#S.?.#...#.?.S#',
    '#.#.#.#.#.#.#.#',
    '#.#?..#?#..?#.#',
    '#.###.#.#.###.#',
    '#...#.?.?.#...#',
    '#.#.###.###.#.#',
    '#...#.?.?.#...#',
    '#.###.#.#.###.#',
    '#.#?..#?#..?#.#',
    '#.#.#.#.#.#.#.#',
    '#S.?.#...#.?.S#',
    '###############',
  ],
};
const TEMPLATE_NAMES = Object.keys(TEMPLATES);

function tileKey(x, y) {
  return `${x},${y}`;
}

// Corner spawns in the order players are assigned to them: TL, BR, TR, BL.
function spawnCorners() {
  return [
    { x: 1, y: 1 },
    { x: COLS - 2, y: ROWS - 2 },
    { x: COLS - 2, y: 1 },
    { x: 1, y: ROWS - 2 },
  ];
}

function cornerRank(s) {
  const left = s.x < COLS / 2;
  const top = s.y < ROWS / 2;
  if (left && top) return 0;
  if (!left && !top) return 1;
  if (!left && top) return 2;
  return 3;
}

// Tiles that must stay brick-free so players have room to move on spawn.
function protectedTiles(spawns) {
  const set = new Set();
  const offsets = [
    [0, 0],
    [1, 0], [2, 0], [-1, 0], [-2, 0],
    [0, 1], [0, 2], [0, -1], [0, -2],
  ];
  for (const s of spawns) {
    for (const [dx, dy] of offsets) set.add(tileKey(s.x + dx, s.y + dy));
  }
  return set;
}

// Classic layout at any size: border, pillars on even/even tiles, corner
// spawns, and optionally an open plaza in the middle for boss fights.
function proceduralTemplate(cols, rows, opts = {}) {
  const lines = [];
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      const corner = (x === 1 || x === cols - 2) && (y === 1 || y === rows - 2);
      const plaza = opts.plaza && Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2;
      if (border || (pillar && !plaza)) line += '#';
      else if (corner) line += 'S';
      else if (plaza) line += '.';
      else line += '?';
    }
    lines.push(line);
  }
  // A few random wall blocks to break up the regular pillar pattern.
  if (opts.blocks) {
    const grid = lines.map((l) => l.split(''));
    for (let i = 0; i < opts.blocks; i++) {
      const bx = 3 + Math.floor(Math.random() * (cols - 6));
      const by = 3 + Math.floor(Math.random() * (rows - 6));
      if (grid[by][bx] === '?' && Math.abs(bx - cx) + Math.abs(by - cy) > 3) {
        grid[by][bx] = '#';
        grid[rows - 1 - by][cols - 1 - bx] = '#'; // keep it point-symmetric
      }
    }
    return grid.map((l) => l.join(''));
  }
  return lines;
}

// Build a grid from a template. Returns { grid, spawns }.
// opts.symmetric mirrors the brick roll so both halves get identical bricks.
// Templates are 15x13; any other arena size uses the procedural layout.
function buildLevel(templateName, density, opts = {}) {
  let tpl = TEMPLATES[templateName] || TEMPLATES.classic;
  if (COLS !== BASE_COLS || ROWS !== BASE_ROWS || templateName === 'procedural') {
    tpl = proceduralTemplate(COLS, ROWS, { plaza: !!opts.plaza, blocks: opts.blocks || 0 });
  }
  const grid = [];
  const spawns = [];
  const eligible = [];

  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const ch = tpl[y][x];
      if (ch === '#') {
        row.push(TILE_WALL);
      } else {
        row.push(TILE_EMPTY);
        if (ch === 'S') spawns.push({ x, y });
        if (ch === '?') eligible.push({ x, y });
      }
    }
    grid.push(row);
  }
  spawns.sort((a, b) => cornerRank(a) - cornerRank(b));

  const keep = protectedTiles(spawns);
  const rolled = new Set();
  for (const t of eligible) {
    if (keep.has(tileKey(t.x, t.y))) continue;
    if (opts.symmetric) {
      const mx = COLS - 1 - t.x;
      const my = ROWS - 1 - t.y;
      const mirrorKey = tileKey(mx, my);
      if (rolled.has(mirrorKey)) {
        if (grid[my][mx] === TILE_BRICK) grid[t.y][t.x] = TILE_BRICK;
        rolled.add(tileKey(t.x, t.y));
        continue;
      }
    }
    if (Math.random() < density) grid[t.y][t.x] = TILE_BRICK;
    rolled.add(tileKey(t.x, t.y));
  }

  return { grid, spawns };
}

// Backwards-compatible helper used for the decorative title-screen arena.
function generateGrid(density, spawns) {
  return buildLevel('classic', density, {}).grid;
}

function tilesOfType(grid, type) {
  const out = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === type) out.push({ x, y });
    }
  }
  return out;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function weightedPick(table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = Math.random() * total;
  for (const [item, w] of table) {
    r -= w;
    if (r <= 0) return item;
  }
  return table[table.length - 1][0];
}

// Order in which sudden-death blocks fall: an inward spiral over the inner area.
function spiralOrder() {
  const out = [];
  let x0 = 1;
  let y0 = 1;
  let x1 = COLS - 2;
  let y1 = ROWS - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push({ x, y: y0 });
    for (let y = y0 + 1; y <= y1; y++) out.push({ x: x1, y });
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push({ x, y: y1 });
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push({ x: x0, y });
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return out;
}
