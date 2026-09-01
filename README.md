# Bomberman Clone

A browser-based Bomberman clone written in plain HTML5 Canvas and JavaScript.
No build step, no dependencies.

## Play

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Modes

- **1 Player** – Campaign. Blast bricks, defeat every enemy, then find the exit
  hidden under one of the bricks to advance. Levels get denser and spawn more
  (and smarter) enemies. You have 3 lives and 200 seconds per level.
- **2 Player Battle** – Local versus on one keyboard. Last player standing wins
  the round; first to 3 rounds wins the match. A few enemies roam the arena to
  keep things interesting.

## Controls

| Action | Player 1                | Player 2 |
| ------ | ----------------------- | -------- |
| Move   | `W A S D` or Arrow keys | `I J K L` |
| Bomb   | `Space`                 | `Enter`  |

Global: `P` / `Esc` pause, `M` mute, `R` back to the menu.
On the menu, press `1` or `2` to start.

## Power-ups

Destroying bricks sometimes reveals a power-up. Flames destroy uncollected
power-ups, so grab them quickly.

- 💣 **Bomb** – carry one more bomb at a time (max 8)
- 🔥 **Fire** – flames reach one tile further (max 8)
- ⚡ **Speed** – move faster (max 5)

## Enemies

- **Balloom** (pink) – slow, wanders randomly. 100 pts
- **Oneal** (blue) – faster, chases you when it sees you. 200 pts
- **Doll** (yellow) – fast and aggressive. 400 pts

## Project layout

```
index.html        page, HUD, overlay
css/style.css     styling
js/constants.js   grid size, timings, key bindings, enemy stats
js/audio.js       procedural Web Audio sound effects
js/input.js       keyboard state
js/level.js       arena generation helpers
js/entities.js    Player, Enemy, Bomb, Explosion, PowerUp
js/render.js      canvas drawing
js/game.js        rules, state machine, collisions
js/main.js        HUD/overlay glue and the game loop
```
