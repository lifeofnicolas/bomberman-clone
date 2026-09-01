// ---------------------------------------------------------------------------
// Canvas renderer. Everything is drawn with primitives, no sprite files.
// Static tiles are pre-rendered once to offscreen canvases.
// ---------------------------------------------------------------------------

const Renderer = (() => {
  const tiles = {};

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  function makeTile(name, painter) {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    painter(c.getContext('2d'));
    tiles[name] = c;
  }

  function paintFloor(shade) {
    return (ctx) => {
      ctx.fillStyle = shade ? '#4caf50' : '#46a34a';
      ctx.fillRect(0, 0, TILE, TILE);
      // A few deterministic grass tufts so the floor isn't flat.
      ctx.fillStyle = shade ? '#43a047' : '#3d9a41';
      const seeds = shade ? [[6, 10], [30, 18], [18, 36], [38, 40]] : [[12, 28], [34, 8], [26, 30], [8, 42]];
      for (const [x, y] of seeds) {
        ctx.fillRect(x, y, 3, 2);
        ctx.fillRect(x + 1, y - 2, 1, 2);
      }
    };
  }

  function paintWall(ctx) {
    ctx.fillStyle = '#5f6b78';
    ctx.fillRect(0, 0, TILE, TILE);
    // Bevel
    ctx.fillStyle = '#8b98a6';
    ctx.fillRect(0, 0, TILE, 4);
    ctx.fillRect(0, 0, 4, TILE);
    ctx.fillStyle = '#3a434d';
    ctx.fillRect(0, TILE - 4, TILE, 4);
    ctx.fillRect(TILE - 4, 0, 4, TILE);
    // Inner block
    ctx.fillStyle = '#707d8b';
    ctx.fillRect(10, 10, TILE - 20, TILE - 20);
    ctx.fillStyle = '#95a2b0';
    ctx.fillRect(10, 10, TILE - 20, 3);
    ctx.fillRect(10, 10, 3, TILE - 20);
    ctx.fillStyle = '#48525c';
    ctx.fillRect(10, TILE - 13, TILE - 20, 3);
    ctx.fillRect(TILE - 13, 10, 3, TILE - 20);
  }

  function paintBrick(ctx) {
    ctx.fillStyle = '#7d3f12';
    ctx.fillRect(0, 0, TILE, TILE);
    const rowH = 12;
    const brickW = 24;
    for (let r = 0; r < TILE / rowH; r++) {
      const offset = r % 2 === 0 ? 0 : brickW / 2;
      for (let x = -brickW; x < TILE + brickW; x += brickW) {
        const bx = x + offset;
        ctx.fillStyle = '#c9702b';
        ctx.fillRect(bx + 1, r * rowH + 1, brickW - 2, rowH - 2);
        ctx.fillStyle = '#e0894a';
        ctx.fillRect(bx + 1, r * rowH + 1, brickW - 2, 2);
        ctx.fillStyle = '#a3561d';
        ctx.fillRect(bx + 1, r * rowH + rowH - 3, brickW - 2, 2);
      }
    }
    // Clip anything that spilled past the tile edges.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.globalCompositeOperation = 'source-over';
  }

  function init() {
    makeTile('floor0', paintFloor(false));
    makeTile('floor1', paintFloor(true));
    makeTile('wall', paintWall);
    makeTile('brick', paintBrick);
  }

  // ---------------------------------------------------------------------
  function drawShadow(ctx, cx, cy, w) {
    ctx.save();
    ctx.globalAlpha *= 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, w * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawExit(ctx, exit, open, time) {
    const px = exit.tx * TILE;
    const py = exit.ty * TILE;
    // Frame
    ctx.fillStyle = '#5d4037';
    roundRect(ctx, px + 6, py + 4, TILE - 12, TILE - 8, 6);
    ctx.fill();
    // Doorway
    ctx.fillStyle = open ? '#1a237e' : '#263238';
    roundRect(ctx, px + 11, py + 9, TILE - 22, TILE - 15, 10);
    ctx.fill();
    if (open) {
      const glow = 0.55 + 0.45 * Math.sin(time * 5);
      ctx.save();
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#ffee58';
      roundRect(ctx, px + 15, py + 13, TILE - 30, TILE - 21, 8);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff9c4';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', px + TILE / 2, py + TILE / 2 + 4);
    } else {
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 14, py + 20);
      ctx.lineTo(px + TILE - 14, py + 20);
      ctx.moveTo(px + 14, py + 32);
      ctx.lineTo(px + TILE - 14, py + 32);
      ctx.stroke();
    }
  }

  function drawPowerUp(ctx, pu) {
    const px = pu.tx * TILE;
    const py = pu.ty * TILE;
    const float = Math.sin(pu.age * 4) * 2;
    const cx = px + TILE / 2;
    const cy = py + TILE / 2 + float;

    ctx.fillStyle = '#fff8e1';
    ctx.strokeStyle = '#ff8f00';
    ctx.lineWidth = 3;
    roundRect(ctx, px + 7, py + 7 + float, TILE - 14, TILE - 14, 7);
    ctx.fill();
    ctx.stroke();

    if (pu.type === 'bomb') {
      ctx.fillStyle = '#212121';
      circle(ctx, cx, cy + 2, 9);
      ctx.fill();
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + 3, cy - 6);
      ctx.quadraticCurveTo(cx + 8, cy - 12, cx + 4, cy - 14);
      ctx.stroke();
      ctx.fillStyle = '#ff9800';
      circle(ctx, cx + 4, cy - 14, 2.5);
      ctx.fill();
    } else if (pu.type === 'fire') {
      ctx.fillStyle = '#ff6d00';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 13);
      ctx.quadraticCurveTo(cx + 12, cy - 2, cx + 9, cy + 6);
      ctx.quadraticCurveTo(cx + 6, cy + 13, cx, cy + 13);
      ctx.quadraticCurveTo(cx - 6, cy + 13, cx - 9, cy + 6);
      ctx.quadraticCurveTo(cx - 12, cy - 2, cx, cy - 13);
      ctx.fill();
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 3);
      ctx.quadraticCurveTo(cx + 6, cy + 4, cx + 4, cy + 9);
      ctx.quadraticCurveTo(cx, cy + 13, cx - 4, cy + 9);
      ctx.quadraticCurveTo(cx - 6, cy + 4, cx, cy - 3);
      ctx.fill();
    } else if (pu.type === 'speed') {
      ctx.fillStyle = '#fdd835';
      ctx.strokeStyle = '#f57f17';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 3, cy - 13);
      ctx.lineTo(cx - 7, cy + 2);
      ctx.lineTo(cx - 1, cy + 2);
      ctx.lineTo(cx - 3, cy + 13);
      ctx.lineTo(cx + 7, cy - 2);
      ctx.lineTo(cx + 1, cy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawBomb(ctx, b) {
    const cx = b.x;
    const cy = b.y;
    const progress = 1 - b.timer / BOMB_FUSE;
    const pulse = 1 + 0.06 * Math.sin(b.age * (6 + progress * 16));
    const r = TILE * 0.31 * pulse;

    drawShadow(ctx, cx, cy + r * 0.9, r * 0.9);

    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#546e7a');
    grad.addColorStop(1, '#0d1117');
    ctx.fillStyle = grad;
    circle(ctx, cx, cy, r);
    ctx.fill();

    if (b.timer < 700 && Math.floor(b.age * 12) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ef5350';
      circle(ctx, cx, cy, r);
      ctx.fill();
      ctx.restore();
    }

    // Fuse
    ctx.strokeStyle = '#a1887f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.25, cy - r * 0.85);
    ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 1.4, cx + r * 0.95, cy - r * 1.25);
    ctx.stroke();

    // Spark
    const flicker = Math.sin(b.age * 40);
    ctx.fillStyle = flicker > 0 ? '#ffee58' : '#ff9100';
    circle(ctx, cx + r * 0.95, cy - r * 1.25, 3 + Math.abs(flicker) * 1.5);
    ctx.fill();
  }

  function drawExplosion(ctx, ex) {
    const t = ex.age / EXPLOSION_DURATION;
    const width = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(t, 1));
    const layers = [
      { color: '#ff6d00', f: 1 },
      { color: '#ffb300', f: 0.72 },
      { color: '#fff59d', f: 0.42 },
    ];

    ctx.save();
    ctx.globalAlpha = t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1;

    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      const s = TILE * width * layer.f;
      for (const cell of ex.cells) {
        const px = cell.x * TILE;
        const py = cell.y * TILE;
        const cx = px + TILE / 2;
        const cy = py + TILE / 2;
        const horizontal = cell.dir === 'left' || cell.dir === 'right';

        if (cell.dir === null) {
          ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
        } else if (!cell.end) {
          if (horizontal) ctx.fillRect(px, cy - s / 2, TILE, s);
          else ctx.fillRect(cx - s / 2, py, s, TILE);
        } else {
          // Rounded cap at the far end of the flame.
          if (cell.dir === 'right') ctx.fillRect(px, cy - s / 2, TILE / 2, s);
          if (cell.dir === 'left') ctx.fillRect(cx, cy - s / 2, TILE / 2, s);
          if (cell.dir === 'down') ctx.fillRect(cx - s / 2, py, s, TILE / 2);
          if (cell.dir === 'up') ctx.fillRect(cx - s / 2, cy, s, TILE / 2);
          circle(ctx, cx, cy, s / 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawBreakingBrick(ctx, br) {
    const t = 1 - br.timer / BRICK_BREAK_DURATION;
    const px = br.tx * TILE;
    const py = br.ty * TILE;
    const half = TILE / 2;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    for (let qx = 0; qx < 2; qx++) {
      for (let qy = 0; qy < 2; qy++) {
        const ox = (qx ? 1 : -1) * t * 14;
        const oy = (qy ? 1 : -1) * t * 14 + t * t * 20;
        ctx.drawImage(tiles.brick, qx * half, qy * half, half, half, px + qx * half + ox, py + qy * half + oy, half, half);
      }
    }
    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    const cx = e.x;
    const bob = Math.sin(e.animTime * 6) * 2;
    let cy = e.y + bob;
    ctx.save();
    if (e.dying) {
      const t = 1 - e.deathTimer / ENEMY_DEATH_DURATION;
      ctx.globalAlpha = 1 - t;
      ctx.translate(cx, cy);
      ctx.scale(1 + t * 0.6, 1 + t * 0.6);
      ctx.translate(-cx, -cy);
    } else {
      drawShadow(ctx, cx, e.y + 19, 14);
    }

    const r = TILE * 0.35;
    // Body
    ctx.fillStyle = e.color;
    circle(ctx, cx, cy, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.2, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // Feet
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const swing = Math.sin(e.animTime * 10) * 3;
    ctx.beginPath();
    ctx.ellipse(cx - 7 + swing, cy + r - 1, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 7 - swing, cy + r - 1, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const look = DIRS[e.dir] || { dx: 0, dy: 0 };
    ctx.fillStyle = '#fff';
    circle(ctx, cx - 6, cy - 3, 4.5);
    ctx.fill();
    circle(ctx, cx + 6, cy - 3, 4.5);
    ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, cx - 6 + look.dx * 2, cy - 3 + look.dy * 2, 2.2);
    ctx.fill();
    circle(ctx, cx + 6 + look.dx * 2, cy - 3 + look.dy * 2, 2.2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (e.cfg.smart) {
      // Angry frown
      ctx.arc(cx, cy + 9, 4.5, Math.PI * 1.15, Math.PI * 1.85);
    } else {
      ctx.arc(cx, cy + 5, 4.5, Math.PI * 0.15, Math.PI * 0.85);
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawPlayer(ctx, p) {
    const cx = p.x;
    const cy = p.y;
    ctx.save();

    if (p.dying) {
      const t = 1 - p.deathTimer / RESPAWN_DELAY;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.translate(cx, cy);
      ctx.rotate(t * Math.PI * 4);
      ctx.scale(1 - t * 0.5, 1 - t * 0.5);
      ctx.translate(-cx, -cy);
    } else {
      if (p.shield > 0 && Math.floor(p.shield / 100) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }
      drawShadow(ctx, cx, cy + 20, 13);
    }

    const bob = p.moving ? Math.sin(p.animTime * 14) * 1.5 : 0;
    const swing = p.moving ? Math.sin(p.animTime * 14) * 4 : 0;
    ctx.translate(cx, cy + bob);

    // Feet
    ctx.fillStyle = '#37474f';
    ctx.beginPath();
    ctx.ellipse(-6, 17 + swing * 0.3, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(6, 17 - swing * 0.3, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#eceff1';
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    roundRect(ctx, -11, -2, 22, 18, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.fillRect(-11, 7, 22, 4);

    // Hands
    ctx.fillStyle = '#eceff1';
    circle(ctx, -14, 6 + swing * 0.5, 4);
    ctx.fill();
    ctx.stroke();
    circle(ctx, 14, 6 - swing * 0.5, 4);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = '#fafafa';
    circle(ctx, 0, -10, 12);
    ctx.fill();
    ctx.stroke();
    // Helmet
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, -10, 12, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-12, -11, 24, 3);
    // Antenna
    ctx.fillStyle = p.color;
    circle(ctx, 0, -25, 3);
    ctx.fill();
    ctx.stroke();

    // Face
    if (p.facing !== 'up') {
      const fx = p.facing === 'left' ? -3 : p.facing === 'right' ? 3 : 0;
      ctx.fillStyle = '#111';
      circle(ctx, -4 + fx, -6, 2);
      ctx.fill();
      circle(ctx, 4 + fx, -6, 2);
      ctx.fill();
      ctx.fillStyle = '#ef9a9a';
      circle(ctx, -7 + fx, -2, 1.8);
      ctx.fill();
      circle(ctx, 7 + fx, -2, 1.8);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------
  function draw(game) {
    const ctx = game.ctx;
    const grid = game.grid;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TILE;
        const py = y * TILE;
        ctx.drawImage(tiles[(x + y) % 2 ? 'floor1' : 'floor0'], px, py);
        const t = grid[y][x];
        if (t === TILE_WALL) ctx.drawImage(tiles.wall, px, py);
        else if (t === TILE_BRICK) ctx.drawImage(tiles.brick, px, py);
      }
    }

    if (game.exit && game.exit.revealed) {
      drawExit(ctx, game.exit, game.enemiesRemaining() === 0, game.elapsed);
    }

    for (const pu of game.powerups) drawPowerUp(ctx, pu);
    for (const b of game.bombs) drawBomb(ctx, b);
    for (const br of game.breaking) drawBreakingBrick(ctx, br);
    for (const ex of game.explosions) drawExplosion(ctx, ex);
    for (const e of game.enemies) drawEnemy(ctx, e);
    for (const p of game.players) {
      if (p.alive || p.dying) drawPlayer(ctx, p);
    }

    // Low-time warning tint
    if (game.state === 'playing' && game.timeLeft < 30) {
      ctx.save();
      ctx.globalAlpha = 0.08 + 0.06 * Math.sin(game.elapsed * 6);
      ctx.fillStyle = '#f44336';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }
  }

  init();
  return { draw };
})();
