// End-to-end smoke test. Run with: node tests/e2e.js
// Requires Playwright with Chromium (npm i -g playwright && npx playwright install chromium).
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (opts = {}) => {
    const page = await browser.newPage(opts);
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(URL);
    await page.waitForTimeout(300);
    return page;
  };
  const state = (page) => page.evaluate(() => game.state);
  const title = (page) => page.evaluate(() => document.getElementById('overlay-title').textContent);
  const press = async (page, key, wait = 90) => { await page.keyboard.press(key); await page.waitForTimeout(wait); };

  // ------------------------------------------------------------ desktop
  let page = await open({ viewport: { width: 900, height: 1000 } });
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(300);

  check('title with demo running', (await state(page)) === 'title' && (await page.evaluate(() => game.demo && game.players.length === 4)));
  await page.waitForTimeout(2500);
  const demoBombs = await page.evaluate(() => game.bombs.length + game.explosions.length + (tilesOfType(game.grid, TILE_BRICK).length < 60 ? 1 : 0));
  check('demo bots are active', demoBombs > 0, 'activity=' + demoBombs);
  check('sfx suppressed in demo', await page.evaluate(() => game.sfx.suppressed === true));

  // Options
  await press(page, 'Digit3');
  check('options screen', (await title(page)) === 'OPTIONS');
  await press(page, 'Digit1');
  check('music volume cycles', await page.evaluate(() => game.settings.musicVolume === 0.75 && game.music.volume === 0.75));
  await press(page, 'Digit3');
  check('shake toggles off', await page.evaluate(() => game.settings.shake === false));
  await press(page, 'Digit3');
  await press(page, 'Digit5');
  check('reset arms', (await page.evaluate(() => [...document.querySelectorAll('#overlay button')].map((b) => b.textContent).join('|'))).includes('CONFIRM'));
  await press(page, 'Escape');
  check('back to title', (await title(page)) === 'BOMBERMAN' && (await page.evaluate(() => game.resetArmed === false)));

  // Campaign start -> intro -> playing
  await press(page, 'Digit1');
  await press(page, 'Digit2', 150); // normal (no world select yet)
  check('intro state', (await state(page)) === 'intro' && (await page.evaluate(() => !game.demo && !game.sfx.suppressed && game.players.length === 1)));
  await page.waitForTimeout(2600);
  check('intro -> playing', (await state(page)) === 'playing');
  check('theme music selected', await page.evaluate(() => game.music.track === 'grass'));

  // Player can move and bomb
  const x0 = await page.evaluate(() => game.players[0].x);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  check('player moves', (await page.evaluate(() => game.players[0].x)) > x0);
  await press(page, 'Space');
  check('bomb placed', (await page.evaluate(() => game.bombs.length)) === 1);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(350); await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(500); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(2500);
  check('bomb exploded, player safe', await page.evaluate(() => game.bombs.length === 0 && game.players[0].alive));

  // Pause during intro & playing
  await press(page, 'KeyP');
  check('paused', (await state(page)) === 'paused' && (await page.evaluate(() => game.music.duck === 0.3)));
  await press(page, 'KeyP');
  check('resumed', (await state(page)) === 'playing' && (await page.evaluate(() => game.music.duck === 1)));

  // Level clear with results tally
  await page.evaluate(() => {
    game.enemies.forEach((e) => game.killEnemy(e, game.players[0]));
    game.destroyBrick(game.exit.tx, game.exit.ty);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const p = game.players[0]; p.x = centerOf(game.exit.tx); p.y = centerOf(game.exit.ty); });
  await page.waitForTimeout(150);
  check('stage clear screen', (await state(page)) === 'levelclear' && (await title(page)) === 'STAGE CLEAR!');
  const partial = await page.evaluate(() => document.getElementById('overlay-text').textContent);
  await press(page, 'Enter'); // skip tally
  const full = await page.evaluate(() => ({ text: document.getElementById('overlay-text').textContent, done: game.results.done, state: game.state }));
  check('tally skip fills results', full.done && full.state === 'levelclear' && full.text.includes('★') && full.text.length >= partial.length, full.text.split('\n')[0]);
  await press(page, 'Enter', 200);
  check('next stage intro', (await state(page)) === 'intro' && (await page.evaluate(() => game.level === 2)));

  // Jump to boss level (1-5)
  await page.evaluate(() => { game.level = 5; game.startLevel(); });
  await page.waitForTimeout(100);
  const bossInfo = await page.evaluate(() => ({ boss: !!game.boss, hp: game.boss && game.boss.hp, name: game.boss && game.boss.name, exit: game.exit, label: game.levelLabel, music: game.music.track, enemies: game.enemies.length }));
  check('boss level set up', bossInfo.boss && bossInfo.hp === 7 && !bossInfo.exit && bossInfo.label.includes('BOSS') && bossInfo.music === 'boss', JSON.stringify(bossInfo));
  await press(page, 'Enter'); // skip intro
  // damage boss via explosions
  await page.evaluate(() => { game.players[0].shield = 99999; });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => { const b = game.boss; game.explosions.push(new Explosion([{ x: b.tx, y: b.ty, dir: null, end: false }], game.players[0])); });
    await page.waitForTimeout(60);
    await page.evaluate(() => { game.boss.iframes = 0; });
  }
  await page.waitForTimeout(100);
  const afterBoss = await page.evaluate(() => ({ alive: game.boss.alive, exit: game.exit, score: game.players[0].score }));
  check('boss dies after hits, exit appears', !afterBoss.alive && afterBoss.exit && afterBoss.exit.revealed, JSON.stringify(afterBoss));
  await page.evaluate(() => { game.enemies.forEach((e) => { if (e.alive) game.killEnemy(e, game.players[0]); }); });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { const p = game.players[0]; p.x = centerOf(game.exit.tx); p.y = centerOf(game.exit.ty); });
  await page.waitForTimeout(150);
  const unlocked = await page.evaluate(() => ({ state: game.state, progress: game.settings.progress.normal, saved: Save.load().progress.normal, title: document.getElementById('overlay-title').textContent }));
  check('boss clear unlocks world 2', unlocked.state === 'levelclear' && unlocked.progress === 2 && unlocked.saved === 2 && unlocked.title === 'BOSS DEFEATED!', JSON.stringify(unlocked));
  await press(page, 'Enter'); await press(page, 'Enter', 200);
  check('world 2 starts', await page.evaluate(() => game.level === 6 && game.theme === 'ice' && game.state === 'intro'));

  // Game over -> retry world
  await page.evaluate(() => { game.state = 'playing'; game.intro = null; game.players[0].lives = 1; game.killPlayer(game.players[0], true); });
  await page.waitForTimeout(2100);
  check('game over', (await state(page)) === 'gameover');
  await press(page, 'Enter', 200);
  check('retry restarts at world 2', await page.evaluate(() => game.level === 6 && game.state === 'intro'));

  // Menu -> world select shown now that world 2 unlocked
  await press(page, 'KeyP'); await press(page, 'Digit2', 150); // pause -> main menu
  check('menu restarts demo', (await state(page)) === 'title' && (await page.evaluate(() => game.demo && game.music.track === 'title')));
  await press(page, 'Digit1'); await press(page, 'Digit2');
  check('world select', (await title(page)) === 'SELECT WORLD' && (await page.evaluate(() => document.querySelectorAll('#overlay button').length === 3)));
  await press(page, 'Digit2', 200);
  check('start from world 2', await page.evaluate(() => game.level === 6 && game.state === 'intro' && !game.demo));

  // Time-out pontans + hurry music
  await page.evaluate(() => { game.state = 'playing'; game.intro = null; game.timeLeft = 25; });
  await page.waitForTimeout(120);
  check('hurry music under 30s', await page.evaluate(() => game.music.track === 'hurry'));
  await page.evaluate(() => { game.timeLeft = 0.01; });
  await page.waitForTimeout(120);
  check('timeout spawns pontans', await page.evaluate(() => game.timedOut && game.enemies.some((e) => e.type === 'pontan')));

  // Kick / remote / curse / wallpass quick checks
  await page.evaluate(() => {
    const p = game.players[0]; p.shield = 99999; p.x = centerOf(1); p.y = centerOf(1);
    for (let x = 2; x <= 6; x++) game.grid[1][x] = TILE_EMPTY;
    game.bombs = []; p.bombsActive = 0; p.canKick = true;
    game.bombs.push(new Bomb(2, 1, p, 1, 999999)); p.bombsActive = 1;
  });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
  check('kick slides bomb', await page.evaluate(() => game.bombs.length === 1 && game.bombs[0].tx > 2), await page.evaluate(() => game.bombs.map((b) => b.tx + ',' + b.ty).join()));
  await page.evaluate(() => { game.bombs = []; game.players[0].bombsActive = 0; game.players[0].remote = true; });
  await press(page, 'Space');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(600); await page.keyboard.up('ArrowDown');
  const before = await page.evaluate(() => game.bombs.length);
  await press(page, 'KeyE');
  check('remote detonate', before === 1 && (await page.evaluate(() => game.bombs.length === 0 && game.explosions.length >= 1)));

  // Battle: setup keys, 3 bots, sudden death, round end
  await page.evaluate(() => game.showTitle());
  await press(page, 'Digit2');
  await press(page, 'Digit3'); await press(page, 'Digit3'); await press(page, 'Digit4');
  check('battle setup cycles', await page.evaluate(() => game.settings.battle.bots === 3 && game.settings.battle.skill === 'hard' && game.ui.focusIndex === 0));
  await press(page, 'Enter', 150);
  check('battle intro with bots', await page.evaluate(() => game.state === 'intro' && game.players.length === 4 && game.players.filter((p) => p.isBot).length === 3 && !game.demo));
  await press(page, 'Enter');
  await page.waitForTimeout(6000);
  check('bots play', await page.evaluate(() => tilesOfType(game.grid, TILE_BRICK).length < 60 || game.bombs.length > 0 || game.players.some((p) => !p.alive)));
  await page.evaluate(() => { if (game.state === 'playing') game.timeLeft = SUDDEN_DEATH_AT + 0.05; });
  await page.waitForTimeout(2500);
  check('sudden death drops blocks', await page.evaluate(() => game.state !== 'playing' || (game.suddenDeath && game.spiralIndex > 3)));
  let guard = 0;
  while (guard++ < 140 && (await state(page)) === 'playing') await page.waitForTimeout(500);
  check('round ends', (await state(page)) === 'roundover', await title(page));
  await press(page, 'Enter', 200);
  check('next round', await page.evaluate(() => game.level === 2 && game.state === 'intro'));

  // Persistence shape: old save without new keys
  await page.evaluate(() => localStorage.setItem('bomberman.v1', JSON.stringify({ muted: true, battle: { humans: 2 } })));
  await page.reload(); await page.waitForTimeout(300);
  check('old save merges', await page.evaluate(() => game.settings.muted === true && game.settings.battle.humans === 2 && game.settings.battle.bots >= 0 && game.settings.progress.normal === 1 && game.settings.musicVolume === 0.5));
  await page.close();

  // ------------------------------------------------------------ mobile
  page = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  check('touch ui on phone', await page.evaluate(() => document.body.classList.contains('touch-ui')));
  await page.tap('#overlay-buttons button:nth-child(1)'); await page.waitForTimeout(100);
  await page.tap('#overlay-buttons button:nth-child(2)'); await page.waitForTimeout(200);
  check('touch starts campaign', (await state(page)) === 'intro');
  await page.evaluate(() => { game.state = 'playing'; game.intro = null; });
  const pad = await (await page.$('#dpad')).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const px0 = await page.evaluate(() => game.players[0].x);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + pad.width * 0.85, y: pad.y + pad.height / 2 }] });
  await page.waitForTimeout(350);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('dpad moves player', (await page.evaluate(() => game.players[0].x)) > px0);
  await page.tap('.tbtn.bomb'); await page.waitForTimeout(80);
  check('touch bomb button', (await page.evaluate(() => game.bombs.length)) === 1);
  await page.tap('.tbtn.small'); await page.waitForTimeout(80);
  check('touch pause button', (await state(page)) === 'paused');
  await page.close();

  await browser.close();
  console.log('\nERRORS:', errors.length ? errors : 'none');
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  process.exit(failed || errors.length ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(2); });
