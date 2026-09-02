// ---------------------------------------------------------------------------
// Canvas renderer. Everything is drawn with primitives, no sprite files.
// Static tiles are pre-rendered per theme (and per device scale) to
// offscreen canvases.
// ---------------------------------------------------------------------------

const Renderer = (() => {
  let tiles = {};
  let theme = THEMES.grass;
  let scale = 1;

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
    c.width = Math.round(TILE * scale);
    c.height = Math.round(TILE * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    painter(ctx);
    tiles[name] = c;
  }

  function paintFloor(shade) {
    return (ctx) => {
      ctx.fillStyle = shade ? theme.floorA : theme.floorB;
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = theme.tuft;
      const seeds = shade ? [[6, 10], [30, 18], [18, 36], [38, 40]] : [[12, 28], [34, 8], [26, 30], [8, 42]];
      for (const [x, y] of seeds) {
        ctx.fillRect(x, y, 3, 2);
        ctx.fillRect(x + 1, y - 2, 1, 2);
      }
    };
  }

  function paintWall(ctx) {
    ctx.fillStyle = theme.wall;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = theme.wallLight;
    ctx.fillRect(0, 0, TILE, 4);
    ctx.fillRect(0, 0, 4, TILE);
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(0, TILE - 4, TILE, 4);
    ctx.fillRect(TILE - 4, 0, 4, TILE);
    ctx.fillStyle = theme.wallInner;
    ctx.fillRect(10, 10, TILE - 20, TILE - 20);
    ctx.fillStyle = theme.wallLight;
    ctx.fillRect(10, 10, TILE - 20, 3);
    ctx.fillRect(10, 10, 3, TILE - 20);
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(10, TILE - 13, TILE - 20, 3);
    ctx.fillRect(TILE - 13, 10, 3, TILE - 20);
  }

  function paintBrick(ctx) {
    ctx.fillStyle = theme.mortar;
    ctx.fillRect(0, 0, TILE, TILE);
    const rowH = 12;
    const brickW = 24;
    for (let r = 0; r < TILE / rowH; r++) {
      const offset = r % 2 === 0 ? 0 : brickW / 2;
      for (let x = -brickW; x < TILE + brickW; x += brickW) {
        const bx = x + offset;
        ctx.fillStyle = theme.brick;
        ctx.fillRect(bx + 1, r * rowH + 1, brickW - 2, rowH - 2);
        ctx.fillStyle = theme.brickLight;
        ctx.fillRect(bx + 1, r * rowH + 1, brickW - 2, 2);
        ctx.fillStyle = theme.brickDark;
        ctx.fillRect(bx + 1, r * rowH + rowH - 3, brickW - 2, 2);
      }
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.globalCompositeOperation = 'source-over';
  }

  function rebuild() {
    tiles = {};
    makeTile('floor0', paintFloor(false));
    makeTile('floor1', paintFloor(true));
    makeTile('wall', paintWall);
    makeTile('brick', paintBrick);
  }

  function setTheme(name) {
    theme = THEMES[name] || THEMES.grass;
    rebuild();
  }

  function setScale(k) {
    if (k === scale) return;
    scale = k;
    rebuild();
  }

  function drawTile(ctx, name, px, py) {
    ctx.drawImage(tiles[name], px, py, TILE, TILE);
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
    ctx.fillStyle = '#5d4037';
    roundRect(ctx, px + 6, py + 4, TILE - 12, TILE - 8, 6);
    ctx.fill();
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

  function drawHeart(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s);
    ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.2, cx - s * 0.7, cy - s * 1.2, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.2, cx + s * 1.4, cy - s * 0.2, cx, cy + s);
    ctx.closePath();
  }

  function drawPowerUp(ctx, pu) {
    const px = pu.tx * TILE;
    const py = pu.ty * TILE;
    const float = Math.sin(pu.age * 4) * 2;
    const cx = px + TILE / 2;
    const cy = py + TILE / 2 + float;
    const skull = pu.type === 'skull';

    ctx.fillStyle = skull ? '#37474f' : '#fff8e1';
    ctx.strokeStyle = skull ? '#b0bec5' : '#ff8f00';
    ctx.lineWidth = 3;
    roundRect(ctx, px + 7, py + 7 + float, TILE - 14, TILE - 14, 7);
    ctx.fill();
    ctx.stroke();

    switch (pu.type) {
      case 'bomb':
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
        break;
      case 'fire':
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
        break;
      case 'speed':
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
        break;
      case 'kick':
        // Boot
        ctx.fillStyle = '#8d6e63';
        roundRect(ctx, cx - 6, cy - 12, 10, 16, 3);
        ctx.fill();
        roundRect(ctx, cx - 6, cy - 1, 18, 10, 3);
        ctx.fill();
        ctx.fillStyle = '#3e2723';
        roundRect(ctx, cx - 7, cy + 6, 20, 5, 2);
        ctx.fill();
        ctx.fillStyle = '#ffcc80';
        ctx.fillRect(cx - 4, cy - 10, 6, 2);
        break;
      case 'remote':
        // Antenna with waves
        ctx.strokeStyle = '#42a5f5';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 12);
        ctx.lineTo(cx, cy - 4);
        ctx.stroke();
        ctx.fillStyle = '#1e88e5';
        circle(ctx, cx, cy - 6, 3.5);
        ctx.fill();
        ctx.fillStyle = '#546e7a';
        roundRect(ctx, cx - 8, cy + 8, 16, 6, 2);
        ctx.fill();
        for (let i = 1; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(cx, cy - 6, 6 + i * 4, -Math.PI * 0.8, -Math.PI * 0.2);
          ctx.stroke();
        }
        break;
      case 'wallpass':
        // Ghost
        ctx.fillStyle = '#ab47bc';
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 10, Math.PI, 0);
        ctx.lineTo(cx + 10, cy + 10);
        ctx.lineTo(cx + 5, cy + 6);
        ctx.lineTo(cx, cy + 11);
        ctx.lineTo(cx - 5, cy + 6);
        ctx.lineTo(cx - 10, cy + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        circle(ctx, cx - 4, cy - 3, 2.5);
        ctx.fill();
        circle(ctx, cx + 4, cy - 3, 2.5);
        ctx.fill();
        break;
      case 'life':
        ctx.fillStyle = '#ef5350';
        drawHeart(ctx, cx, cy + 1, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        circle(ctx, cx - 4, cy - 4, 2.5);
        ctx.fill();
        break;
      case 'skull':
        ctx.fillStyle = '#eceff1';
        circle(ctx, cx, cy - 3, 9);
        ctx.fill();
        roundRect(ctx, cx - 6, cy + 3, 12, 7, 2);
        ctx.fill();
        ctx.fillStyle = '#37474f';
        circle(ctx, cx - 3.5, cy - 4, 2.5);
        ctx.fill();
        circle(ctx, cx + 3.5, cy - 4, 2.5);
        ctx.fill();
        ctx.fillRect(cx - 4, cy + 5, 2, 4);
        ctx.fillRect(cx - 1, cy + 5, 2, 4);
        ctx.fillRect(cx + 2, cy + 5, 2, 4);
        break;
      default:
        break;
    }
  }

  function drawBomb(ctx, b) {
    const cx = b.x;
    const cy = b.y;
    const progress = b.remote ? 0.2 : 1 - b.timer / BOMB_FUSE;
    const pulse = 1 + 0.06 * Math.sin(b.age * (6 + progress * 16));
    const r = TILE * 0.31 * pulse;

    drawShadow(ctx, cx, cy + r * 0.9, r * 0.9);

    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, b.remote ? '#5c8fb0' : '#546e7a');
    grad.addColorStop(1, b.remote ? '#0d2233' : '#0d1117');
    ctx.fillStyle = grad;
    circle(ctx, cx, cy, r);
    ctx.fill();

    if (!b.remote && b.timer < 700 && Math.floor(b.age * 12) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ef5350';
      circle(ctx, cx, cy, r);
      ctx.fill();
      ctx.restore();
    }

    if (b.remote) {
      // Antenna with a blinking LED
      ctx.strokeStyle = '#90a4ae';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.3, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.3, cy - r * 1.5);
      ctx.stroke();
      ctx.fillStyle = Math.floor(b.age * 4) % 2 === 0 ? '#ff1744' : '#b71c1c';
      circle(ctx, cx + r * 0.3, cy - r * 1.55, 3.5);
      ctx.fill();
      return;
    }

    ctx.strokeStyle = '#a1887f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.25, cy - r * 0.85);
    ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 1.4, cx + r * 0.95, cy - r * 1.25);
    ctx.stroke();

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
    const src = tiles.brick;
    const sh = src.width / 2;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    for (let qx = 0; qx < 2; qx++) {
      for (let qy = 0; qy < 2; qy++) {
        const ox = (qx ? 1 : -1) * t * 14;
        const oy = (qy ? 1 : -1) * t * 14 + t * t * 20;
        ctx.drawImage(src, qx * sh, qy * sh, sh, sh, px + qx * half + ox, py + qy * half + oy, half, half);
      }
    }
    ctx.restore();
  }

  function drawFallingBlock(ctx, fb) {
    const t = 1 - fb.timer / FALLING_BLOCK_DURATION;
    const px = fb.tx * TILE;
    const py = fb.ty * TILE;
    const drop = (1 - t) * (1 - t) * 90;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.5 * t;
    ctx.fillStyle = '#000';
    ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
    ctx.globalAlpha = 1;
    ctx.drawImage(tiles.wall, px, py - drop, TILE, TILE);
    ctx.restore();
  }

  function drawSpiralWarning(ctx, game) {
    const next = game.nextSpiralTiles(3);
    if (!next.length) return;
    const pulse = 0.25 + 0.2 * Math.sin(game.elapsed * 12);
    next.forEach((t, i) => {
      ctx.save();
      ctx.globalAlpha = pulse * (1 - i * 0.25);
      ctx.fillStyle = '#d50000';
      ctx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------------
  function bodyPath(ctx, shape, cx, cy, r, time) {
    ctx.beginPath();
    switch (shape) {
      case 'square':
        roundRect(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.35);
        break;
      case 'ghost': {
        ctx.arc(cx, cy - r * 0.15, r, Math.PI, 0);
        const bottom = cy + r * 0.85;
        ctx.lineTo(cx + r, bottom);
        const waves = 3;
        for (let i = 0; i < waves; i++) {
          const x0 = cx + r - (i * 2 * r) / waves;
          const x1 = cx + r - ((i + 1) * 2 * r) / waves;
          const wobble = Math.sin(time * 6 + i) * 2;
          ctx.quadraticCurveTo((x0 + x1) / 2, bottom - r * 0.3 + wobble, x1, bottom);
        }
        ctx.closePath();
        break;
      }
      case 'diamond':
        ctx.moveTo(cx, cy - r * 1.1);
        ctx.lineTo(cx + r * 1.1, cy);
        ctx.lineTo(cx, cy + r * 1.1);
        ctx.lineTo(cx - r * 1.1, cy);
        ctx.closePath();
        break;
      case 'boss': {
        // Big rounded body with horns
        roundRect(ctx, cx - r, cy - r * 0.9, r * 2, r * 1.9, r * 0.5);
        ctx.moveTo(cx - r * 0.7, cy - r * 0.8);
        ctx.lineTo(cx - r * 0.9, cy - r * 1.5);
        ctx.lineTo(cx - r * 0.3, cy - r * 0.9);
        ctx.moveTo(cx + r * 0.7, cy - r * 0.8);
        ctx.lineTo(cx + r * 0.9, cy - r * 1.5);
        ctx.lineTo(cx + r * 0.3, cy - r * 0.9);
        break;
      }
      case 'star': {
        const spikes = 5;
        for (let i = 0; i < spikes * 2; i++) {
          const rad = i % 2 === 0 ? r * 1.2 : r * 0.6;
          const a = (i * Math.PI) / spikes - Math.PI / 2 + time * 0.8;
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
      default:
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
    }
  }

  function drawBossBar(ctx, e) {
    const w = TILE * 1.6;
    const x = e.x - w / 2;
    const y = e.y - TILE * 0.95;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, x - 2, y - 2, w + 4, 10, 4);
    ctx.fill();
    const f = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = f > 0.5 ? '#66bb6a' : f > 0.25 ? '#ffa726' : '#ef5350';
    ctx.fillRect(x, y, w * f, 6);
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(e.name, e.x, y - 5);
  }

  function drawEnemy(ctx, e, game) {
    const cx = e.x;
    const bob = Math.sin(e.animTime * 6) * 2;
    const cy = e.y + bob;
    const shape = e.cfg.shape;
    ctx.save();
    const flash = e.isBoss && e.alive && e.iframes > 0 && Math.floor(e.iframes / 80) % 2 === 0;
    if (e.dying) {
      const dur = e.isBoss ? ENEMY_DEATH_DURATION * 2 : ENEMY_DEATH_DURATION;
      const t = 1 - e.deathTimer / dur;
      ctx.globalAlpha = 1 - t;
      ctx.translate(cx, cy);
      ctx.scale(1 + t * 0.6, 1 + t * 0.6);
      ctx.translate(-cx, -cy);
    } else {
      if (e.cfg.passBricks && game.grid[e.ty] && game.grid[e.ty][e.tx] === TILE_BRICK) ctx.globalAlpha = 0.75;
      if (shape === 'star') ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(e.animTime * 8);
      drawShadow(ctx, cx, e.y + 19, 14);
    }

    const r = e.isBoss ? TILE * 0.62 : TILE * 0.35;
    ctx.fillStyle = e.color;
    bodyPath(ctx, shape, cx, cy, r, e.animTime);
    ctx.fill();
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.2, -0.6, 0, Math.PI * 2);
    ctx.fill();

    if (shape !== 'ghost' && shape !== 'star') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const swing = Math.sin(e.animTime * 10) * 3;
      ctx.beginPath();
      ctx.ellipse(cx - 7 + swing, cy + r - 1, 5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 7 - swing, cy + r - 1, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const look = DIRS[e.dir] || { dx: 0, dy: 0 };
    const es = e.isBoss ? 1.7 : 1; // eye scale
    ctx.fillStyle = e.isBoss ? e.accent : '#fff';
    circle(ctx, cx - 6 * es, cy - 3 * es, 4.5 * es);
    ctx.fill();
    circle(ctx, cx + 6 * es, cy - 3 * es, 4.5 * es);
    ctx.fill();
    ctx.fillStyle = shape === 'star' || e.isBoss ? '#c62828' : '#111';
    circle(ctx, cx - 6 * es + look.dx * 2, cy - 3 * es + look.dy * 2, 2.2 * es);
    ctx.fill();
    circle(ctx, cx + 6 * es + look.dx * 2, cy - 3 * es + look.dy * 2, 2.2 * es);
    ctx.fill();

    ctx.strokeStyle = shape === 'star' ? '#c62828' : '#111';
    ctx.lineWidth = 1.8 * es;
    ctx.beginPath();
    if (e.isBoss) {
      // Toothy grin
      ctx.moveTo(cx - 12, cy + 12);
      ctx.lineTo(cx + 12, cy + 12);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 5 - 2, cy + 12);
        ctx.lineTo(cx + i * 5 + 2, cy + 12);
        ctx.lineTo(cx + i * 5, cy + 18);
        ctx.closePath();
        ctx.fill();
      }
    } else if (e.cfg.smart) {
      ctx.arc(cx, cy + 9, 4.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      ctx.arc(cx, cy + 5, 4.5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    ctx.restore();
    if (e.isBoss && e.alive) drawBossBar(ctx, e);
  }

  function drawPlayer(ctx, p, game) {
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
      if (p.shield > 0 && Math.floor(p.shield / 100) % 2 === 0) ctx.globalAlpha = 0.45;
      if (p.wallPass && game.grid[p.ty] && game.grid[p.ty][p.tx] === TILE_BRICK) ctx.globalAlpha *= 0.7;
      drawShadow(ctx, cx, cy + 20, 13);
      if (p.curse) {
        ctx.save();
        ctx.globalAlpha *= 0.35 + 0.25 * Math.sin(game.elapsed * 10);
        ctx.fillStyle = '#7b1fa2';
        circle(ctx, cx, cy, 24);
        ctx.fill();
        ctx.restore();
      }
    }

    const bob = p.moving ? Math.sin(p.animTime * 14) * 1.5 : 0;
    const swing = p.moving ? Math.sin(p.animTime * 14) * 4 : 0;
    ctx.translate(cx, cy + bob);

    ctx.fillStyle = p.canKick ? '#5d4037' : '#37474f';
    ctx.beginPath();
    ctx.ellipse(-6, 17 + swing * 0.3, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(6, 17 - swing * 0.3, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eceff1';
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    roundRect(ctx, -11, -2, 22, 18, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.fillRect(-11, 7, 22, 4);

    ctx.fillStyle = '#eceff1';
    circle(ctx, -14, 6 + swing * 0.5, 4);
    ctx.fill();
    ctx.stroke();
    circle(ctx, 14, 6 - swing * 0.5, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fafafa';
    circle(ctx, 0, -10, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, -10, 12, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-12, -11, 24, 3);

    // Antenna: blue dish when the player has remote bombs
    if (p.remote) {
      ctx.strokeStyle = '#263238';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(0, -27);
      ctx.stroke();
      ctx.fillStyle = '#42a5f5';
      ctx.beginPath();
      ctx.arc(0, -27, 5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      circle(ctx, 0, -25, 3);
      ctx.fill();
      ctx.stroke();
    }

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

    // Curse countdown
    if (p.curse && !p.dying) {
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.fillStyle = '#e1bee7';
      const label = `\u2620 ${Math.ceil(p.curse.timer / 1000)}`;
      const ty = game.mode === 2 ? cy - 48 : cy - 36;
      ctx.strokeText(label, cx, ty);
      ctx.fillText(label, cx, ty);
      ctx.restore();
    }

    // Name tag in battle mode
    if (game.mode === 2 && !p.dying) {
      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(p.name).width + 8;
      roundRect(ctx, cx - w / 2, cy - 44, w, 13, 4);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.fillText(p.name, cx, cy - 34);
      ctx.restore();
    }
  }

  function drawParticles(ctx, particles) {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(ctx, floaters) {
    ctx.textAlign = 'center';
    for (const f of floaters) {
      const t = f.life / f.maxLife;
      ctx.globalAlpha = t < 0.4 ? t / 0.4 : 1;
      ctx.font = `bold ${f.size}px sans-serif`;
      ctx.lineWidth = Math.max(2, f.size / 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawIntro(ctx, game) {
    const it = game.intro;
    if (!it) return;
    const t = it.t;
    const slide = Math.min(1, t / 350);
    const ease = 1 - Math.pow(1 - slide, 3);
    const fadeOut = t > INTRO_DURATION - 250 ? (INTRO_DURATION - t) / 250 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fadeOut);
    const h = 120;
    const y = CANVAS_H / 2 - h / 2;
    ctx.fillStyle = 'rgba(10, 12, 20, 0.82)';
    ctx.fillRect(0, y, CANVAS_W, h);
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(0, y, CANVAS_W * ease, 4);
    ctx.fillRect(CANVAS_W * (1 - ease), y + h - 4, CANVAS_W * ease, 4);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb300';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(game.levelLabel, CANVAS_W / 2 + (1 - ease) * 300, y + 46);

    const goPhase = t > INTRO_DURATION - 800;
    const word = goPhase ? 'GO!' : 'READY';
    const pulse = goPhase ? 1 + Math.min(0.5, (t - (INTRO_DURATION - 800)) / 600) : 1;
    ctx.fillStyle = goPhase ? '#ffee58' : '#e8e9f0';
    ctx.font = `bold ${Math.round(40 * pulse)}px sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(word, CANVAS_W / 2, y + 100);
    ctx.fillText(word, CANVAS_W / 2, y + 100);
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  function draw(game) {
    const ctx = game.ctx;
    const grid = game.grid;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();

    if (game.shake.mag > 0) {
      ctx.translate((Math.random() - 0.5) * 2 * game.shake.mag, (Math.random() - 0.5) * 2 * game.shake.mag);
    }

    const fallingKeys = new Set(game.falling.map((fb) => fb.ty * COLS + fb.tx));
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TILE;
        const py = y * TILE;
        drawTile(ctx, (x + y) % 2 ? 'floor1' : 'floor0', px, py);
        const t = grid[y][x];
        if (t === TILE_WALL && !fallingKeys.has(y * COLS + x)) drawTile(ctx, 'wall', px, py);
        else if (t === TILE_BRICK) drawTile(ctx, 'brick', px, py);
      }
    }

    if (game.suddenDeath) drawSpiralWarning(ctx, game);
    if (game.exit && game.exit.revealed) drawExit(ctx, game.exit, game.enemiesRemaining() === 0, game.elapsed);

    for (const pu of game.powerups) drawPowerUp(ctx, pu);
    for (const b of game.bombs) drawBomb(ctx, b);
    for (const br of game.breaking) drawBreakingBrick(ctx, br);
    for (const fb of game.falling) drawFallingBlock(ctx, fb);
    for (const ex of game.explosions) drawExplosion(ctx, ex);
    for (const e of game.enemies) drawEnemy(ctx, e, game);
    for (const p of game.players) {
      if (p.alive || p.dying) drawPlayer(ctx, p, game);
    }
    drawParticles(ctx, game.particles);
    drawFloaters(ctx, game.floaters);

    ctx.restore();

    if (game.state === 'intro') drawIntro(ctx, game);

    if (game.state === 'playing' && ((game.mode === 1 && game.timeLeft < 30) || game.suddenDeath)) {
      ctx.save();
      ctx.globalAlpha = 0.08 + 0.06 * Math.sin(game.elapsed * 6);
      ctx.fillStyle = '#f44336';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }
  }

  rebuild();
  return { draw, setTheme, setScale, forceRebuild: rebuild };
})();
