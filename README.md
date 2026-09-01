# Bomberman Clone

A browser-based Bomberman clone written in plain HTML5 Canvas and JavaScript.
No build step, no dependencies. Works on desktop (keyboard or gamepad) and
mobile (touch), and installs as a PWA for offline play. Music and sound
effects are generated procedurally with the Web Audio API.

## Play

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Serving over HTTPS (or localhost) also enables the service worker, so the game
keeps working offline and can be added to a phone's home screen.

## Modes

### Campaign

Blast bricks, defeat every enemy, then step on the exit hidden under a brick.
Five themed worlds of five stages each (Green Fields, Frozen Depths, Desert
Ruins, Iron Works, Magma Core), each with hand-designed layouts and its own
music. Every fifth stage is a boss fight: a large enemy with a health bar that
takes several hits, shrugs off damage for a moment after each one, and calls
in minions. Beating a boss unlocks the next world, and unlocked worlds can be
started directly from the world select. After the last world the campaign
loops with more enemies.

Each stage opens with a Ready/Go card and ends with a score tally (stage
bonus, time bonus, enemies defeated) and a one-to-three star time rating.

Pick a difficulty:

| | Lives | Time | Enemies | Extras |
| --- | --- | --- | --- | --- |
| Easy | 5 | 240 s | few, slow | lots of power-ups |
| Normal | 3 | 200 s | classic | |
| Hard | 2 | 150 s | many, fast, smarter | shorter fuse, lose power-ups on death, 2x score |

When the timer runs out, invincible-looking Pontans flood the arena instead of
an instant game over. High scores and best levels are saved per difficulty.

### Battle

Local versus for 2 to 4 players: 1 or 2 humans on one keyboard plus 0 to 3
bots. Last one standing wins the round, first to 3 rounds wins the match.
Everyone starts with 2 bombs and fire 2. A few monsters roam the arena. When
45 seconds remain, sudden death starts and indestructible blocks spiral inward
from the edges.

Bots come in three skill levels. They build a danger map of every bomb
(including chain reactions), search for safe tiles, hunt power-ups, dig toward
opponents and only drop a bomb when they have an escape route. Easy bots react
slowly and make mistakes; hard bots do not.

## Controls

| Action | Player 1 | Player 2 |
| ------ | ----------------------- | -------- |
| Move | `W A S D` or Arrow keys | `I J K L` |
| Bomb | `Space` | `Enter` |
| Detonate (remote) | `E` or bomb key again | `O` or bomb key again |

Global: `P` / `Esc` pause, `M` mute, `R` back to the menu. Menus can be driven
with the number keys, arrows, `Enter` and `Esc`.

Gamepads: the first pad controls Player 1 and the second Player 2. D-pad or
left stick moves, `A` drops a bomb, `B` detonates remote bombs, `Start`
pauses. In menus `A` confirms and `B` goes back.

On touch devices a virtual D-pad, bomb button and pause button appear
automatically; the 🎮 button in the HUD toggles them manually. Landscape
phones get the D-pad and buttons on either side of the board.

## Options

The Options menu sets music and sound volume, screen shake, and whether the
touch controls are shown (auto, on, off), and can reset saved progress.
Settings, high scores, best stages, unlocked worlds and battle wins are stored
in the browser's localStorage. The title screen runs an attract-mode battle
between four bots.

## Power-ups

Destroying bricks sometimes reveals a power-up. Flames destroy uncollected
power-ups, so grab them quickly.

- 💣 **Extra Bomb** – carry one more bomb at a time (max 8)
- 🔥 **Fire Up** – flames reach one tile further (max 8)
- ⚡ **Speed Up** – move faster (max 5)
- 👟 **Bomb Kick** – walk into a bomb to send it sliding
- 📡 **Remote Bomb** – bombs only explode when you detonate them
- 👻 **Wall Pass** – walk through bricks
- ❤ **Extra Life** – campaign only
- 💀 **Skull** – a random 15-second curse: reversed controls, uncontrollable
  bombing (with normal fuses, even if you hold the remote), no bombs, or slow
  motion. In battle, touching another player passes the curse on.

## Enemies

| Enemy | Points | Behaviour |
| --- | --- | --- |
| Balloom (pink) | 100 | slow, wanders |
| Oneal (blue) | 200 | chases when it sees you |
| Doll (yellow square) | 400 | fast, erratic |
| Minvo (orange square) | 800 | fast, chases, dodges bombs |
| Kondoria (purple ghost) | 1000 | slow, passes through bricks |
| Ovapi (teal ghost) | 2000 | passes through bricks |
| Pass (orange diamond) | 4000 | fast, walks over bombs, dodges |
| Pontan (white star) | 8000 | fastest, passes everything |

## Tests

`tests/e2e.js` is a headless Playwright smoke test that drives the real page:
menus, campaign, boss fight, world unlock, battle with bots, sudden death,
power-ups, persistence and touch controls.

```sh
npm i -g playwright && npx playwright install chromium
node tests/e2e.js
```

## Project layout

```
index.html        page, HUD, overlay, touch controls
css/style.css     responsive layout, touch UI
manifest.json     PWA manifest
sw.js             offline cache service worker
icons/            app icons
js/constants.js   tuning, difficulty, enemy roster, themes, worlds
js/storage.js     localStorage settings and records
js/audio.js       procedural Web Audio sound effects
js/music.js       procedural chiptune tracks and scheduler
js/input.js       keyboard state (also fed by touch and gamepad)
js/touch.js       virtual D-pad and buttons
js/gamepad.js     Gamepad API polling
js/level.js       layout templates, level building, sudden-death spiral
js/entities.js    Player, Enemy, Boss, Bomb, Explosion, PowerUp, effects
js/bot.js         bot AI (danger map, time-aware BFS, decision loop)
js/render.js      canvas drawing, themes, high-DPI scaling
js/game.js        menus, rules, state machine, collisions, attract mode
js/main.js        HUD/overlay glue, device handling, game loop
tests/e2e.js      headless browser test suite
```
