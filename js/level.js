// ---------------------------------------------------------------------------
// Level generation helpers. The arena is the classic Bomberman layout: a solid
// border, indestructible pillars on every even/even tile, and randomly placed
// destructible bricks everywhere else.
// ---------------------------------------------------------------------------

function tileKey(x, y) {
  return `${x},${y}`;
}

// The four corners of the arena, in the order players are assigned to them.
function spawnCorners() {
  return [
    { x: 1, y: 1 },
    { x: COLS - 2, y: ROWS - 2 },
    { x: COLS - 2, y: 1 },
    { x: 1, y: ROWS - 2 },
  ];
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
    for (const [dx, dy] of offsets) {
      set.add(tileKey(s.x + dx, s.y + dy));
    }
  }
  return set;
}

function generateGrid(density, spawns) {
  const keep = protectedTiles(spawns);
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      if (border || pillar) {
        row.push(TILE_WALL);
      } else if (!keep.has(tileKey(x, y)) && Math.random() < density) {
        row.push(TILE_BRICK);
      } else {
        row.push(TILE_EMPTY);
      }
    }
    grid.push(row);
  }
  return grid;
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
