# punter.js

[![Tests](https://github.com/orca-scan/punter.js/actions/workflows/ci.yml/badge.svg)](https://github.com/orca-scan/punter.js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/punter.js)](https://www.npmjs.com/package/punter.js)
[![license](https://img.shields.io/github/license/orca-scan/punter.js)](https://github.com/orca-scan/punter.js/blob/master/LICENSE)

<p align="center"><img src="images/punterjs.png" width="290" height="174" /></p>

A simple, dependency-free 2D engine for mobile-first web games. No build step, just one script tag and one `<canvas>`. Handles sprites, scenes, animation, sound, collision, and touch/mouse input, with a correct fixed-timestep game loop under the hood.

**New to game programming?** A few terms used throughout this doc:
- **Canvas** - an HTML element you can draw on with JavaScript, pixel by pixel. Every game punter.js runs lives inside one `<canvas>`.
- **Sprite** - a game object made from an image, like the player, an enemy, or a coin. It has a position and can move, animate, and collide with other sprites.
- **Scene** - one "screen" of your game, like a menu, a level, or a game-over screen. You set up sprites and logic inside a scene.
- **Game loop** - the code that runs over and over, many times per second, to update positions and redraw everything. This is what makes a game feel alive instead of a static picture.

## Requirements

- A modern browser with `fetch` and `Promise` support (polyfill older browsers if needed)
- A `<canvas>` element on the page

## Quick Start

```html
<canvas id="game"></canvas>
<script src="punter.js"></script>
<script>
  punter.setup({
    canvas: '#game',
    debug: false, // set true to see FPS, bounds boxes, sprite labels
    images: {
      player: 'images/player.png',
      enemy: 'images/enemy.png'
    },
    sounds: {
      jump: 'sounds/jump.mp3'
    }
  });

  punter.scene('level1', function () {
    var player = punter.createSprite({
      id: 'player',
      image: 'player',
      x: 50,
      y: 50
    });

    punter.on('update', function () {
      if (punter.keys['ArrowRight']) player.moveX(2);
    });

    punter.on('draw', function () {
      // sprites are drawn automatically each frame;
      // use this handler for HUD/overlay drawing on top
    });
  });

  // go() can be called immediately - it's queued until setup() finishes loading
  punter.go('level1');
</script>
```

Walking through what this does: `setup()` loads your images and sounds and prepares the canvas. `scene()` defines what happens on a screen called `'level1'` - here, it creates one sprite (the player) and tells the engine what to do every frame (`update`) and after drawing (`draw`). `go()` switches to that scene and starts the game running.

The library attaches itself to the page as a single global, `punter` - meaning after the `<script>` tag loads, you can just start typing `punter.` anywhere in your own code, no importing required.

## 1. `punter.setup(config)`

Call this once, right at the start. It loads all your images and sounds ahead of time (so nothing is missing mid-game), sets up the canvas, and fires the `ready` event when everything's finished loading.

| Option   | Type           | Description                                              |
|----------|----------------|----------------------------------------------------------|
| `canvas` | string/element | CSS selector or a `<canvas>` element                     |
| `debug`  | boolean        | Shows FPS counter, sprite bounds, and position labels    |
| `images` | object         | `{ key: imageUrl }` map - preloaded before `ready` fires |
| `sounds` | object         | `{ key: soundUrl }` map - decoded before `ready` fires   |

The `images` and `sounds` options are just name-to-file lookups - you pick a short name (like `player`) and point it at the actual file (like `images/player.png`), then refer to it by that short name everywhere else in your code.

## 2. Scenes

A scene is a named function that sets up `update`/`draw` handlers and creates sprites - think of it as "everything that happens on this particular screen of the game."

```js
punter.scene('menu', function () {
  // set up sprites and handlers here
});

punter.go('menu'); // destroys sprites from the previous scene, then switches and starts the loop
```

`scene()` just *registers* a scene under a name - it doesn't run anything yet. `go()` is what actually switches to it and starts things moving. You'll usually have several scenes (a menu, a level, a game-over screen) and use `go()` to jump between them, e.g. `punter.go('gameOver')` when the player loses.

`punter.go()` can be called before `setup()` has finished loading - it queues the scene name and runs it automatically once assets are ready, so you don't need to wait on the `ready` event just to call `go()`. It always tears down every sprite from the current scene and clears input state before running the new scene's handler - scenes don't need to clean up after themselves, the engine does it for you.

## 3. Sprites (`punter.createSprite(opts)`)

A sprite is any image-based object in your game - the player, an enemy, a coin, a wall. You create one by giving it a unique `id`, telling it which loaded `image` to use, and where to place it (`x`, `y`).

```js
var enemy = punter.createSprite({
  id: 'enemy1',        // must be unique
  image: 'enemy',       // matches a key from config.images (or an array of keys for animation)
  x: 100, y: 200,       // position (number or '%' string, e.g. '50%')
  w: 32, h: 32,         // optional size (auto-detected from image if omitted)
  collidable: true,     // computes bounding box for collisions (default: true)
  outline: 'red'        // optional debug outline color
});
```

`x` and `y` are the sprite's position in pixels, measured from the top-left corner of the canvas - so `x: 0, y: 0` is the top-left, and increasing `x` moves right, increasing `y` moves down. Once created, `enemy` is a normal JavaScript object you keep a reference to and call methods on, like `enemy.moveX(5)`.

Useful sprite methods:

- `sprite.moveX(dx)` / `sprite.moveY(dy)` - move by a delta (a number of pixels to shift by, positive or negative)
- `sprite.center()` / `centerX()` / `centerY()` - center on canvas
- `sprite.animate(delayMs)` - cycle through frames if `image` is an array (for walk cycles, etc.)
- `sprite.bounce(range, speed)` - sinusoidal floating/bobbing effect (a smooth up-and-down wobble, handy for coins or menu items)
- `sprite.parallaxScrollX(speed, respawnMs)` / `parallaxScrollY(...)` - scroll and respawn offscreen after a delay (backgrounds/obstacles)
- `sprite.loopScrollX(speed)` - scroll and instantly wrap around
- `sprite.isCollidingWith(otherSprite)` - trimmed bounding-box overlap check; call this in your `update` handler to detect, e.g., the player touching an enemy
- `sprite.destroy()` - remove it from the engine, e.g. when an enemy is defeated

Useful sprite properties (read-only getters - values you can read but not set directly):

- `sprite.visible` - whether any part of the sprite is within canvas bounds
- `sprite.seen` - becomes `true` the first time the sprite is drawn while visible
- `sprite.actualW` / `actualH` - resolved pixel size, accounting for `clipHeight`

## 4. Input

This is how you find out what the player is doing - which keys are held down, and where they've clicked or tapped.

```js
punter.keys['ArrowUp']   // true while held down
punter.mouse.x, punter.mouse.y, punter.mouse.clicked  // works for touch too
punter.clearInput()      // resets all key states and the clicked flag
```

`punter.keys` is just an object where the key name (like `'ArrowUp'` or `'a'`) maps to `true` or `false`. Check it inside your `update` handler to react to held-down keys. `punter.mouse` works the same way for clicks and taps - `mouse.clicked` is `true` for one frame after a click/tap happens, and `mouse.x`/`mouse.y` tell you where.

## 5. Sound

```js
punter.playSound('jump', { volume: 0.8, loop: false, speed: 1 });
punter.stopSound('jump');
```

`playSound` takes the short name you gave a sound in `setup()`'s `sounds` option, plus optional settings - `volume` (0 to 1), `loop` (repeat forever or not), and `speed` (1 is normal, 2 is double speed, etc.).

Playback uses the Web Audio API (decoded `AudioBuffer`s), not `<audio>` elements - `playSound` on an already-playing sound restarts it rather than layering. In practice: calling `playSound('jump')` twice quickly won't give you two overlapping jump sounds, it'll just restart the one sound.

## 6. Events (`punter.on(event, fn)`)

Events are how you plug your own code into the engine's game loop - you give it a function, and the engine calls that function at the right moment.

| Event    | When it fires                                                                                                                                         |
|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ready`  | Once, after all assets are loaded - only needed if you have logic that must run once loading completes; `go()` itself doesn't require waiting on this |
| `update` | ~60 times/sec (fixed timestep) - put game logic here                                                                                                  |
| `draw`   | Once per animation frame, after sprites auto-draw - use for HUD/overlays                                                                              |
| `resize` | Whenever the canvas resizes                                                                                                                           |
| `go`     | Whenever `punter.go()` switches scenes                                                                                                                |

`update` is where almost all your game logic lives - moving things, checking collisions, reading input, checking win/lose conditions. It's called roughly 60 times every second, so anything you put there runs continuously while the game is active.

Sprites draw themselves automatically each frame - you don't need to call `sprite.draw()` yourself. The `draw` event is for extra stuff on top, like a score counter or "Game Over" text, since it's not tied to any one sprite.

## How the Game Loop Works

This is the engine that keeps everything moving. `punter.go(sceneName)` auto-starts a fixed-timestep loop (60 updates/sec) once a scene is active:

1. `update` runs 0+ times to catch up to real time (capped at 100ms per frame to avoid a spiral of death)
2. Canvas is cleared
3. All registered sprites are drawn automatically
4. The `draw` event handler runs, for HUD/overlay drawing on top
5. Repeats via `requestAnimationFrame`

"Fixed timestep" means `update` always advances your game logic by the same fixed amount each time it runs, no matter how fast or slow the player's device actually is. This matters because without it, the same game would play at different speeds on different phones - a slow device would make your character move in slow motion, a fast one would speed it up. This engine avoids that problem for you.

Use `punter.pause()` / `punter.resume()` to stop/restart it without losing sprite state - handy for a pause menu.

## Gotchas for Beginners

- **Sprite IDs must be unique** - reusing one throws an error.
- **Images must finish loading before creating a sprite manually outside the `images` config** - the engine throws if the image isn't ready. In practice: always create sprites using images you listed in `setup()`'s `images` option, and you won't hit this.
- **`repeatX` and `repeatY` are mutually exclusive** on a single sprite.
- Percentage strings (`'50%'`) for `x`/`y`/`w`/`h` are resolved relative to canvas size and re-resolve automatically on resize.
- Don't manually resize the canvas - the engine owns that via its own `resize()` handling.
- `punter.setup()` must be called before `createSprite`, `playSound`, `pause`, or `resume` - each throws otherwise. This is just saying: always call `setup()` first, before anything else.

---

## What's actually different here

- **Content-trimmed bounding boxes for collision.** The overlap test itself is a plain AABB (rectangle overlap) check, but the box isn't the full sprite sheet - `getBounds` does a per-pixel alpha scan of each image once, finds the tightest rect containing non-transparent pixels, and caches it per image key. So hitboxes match the visible artwork instead of whatever padding is baked into the source image.
- **A real fixed-timestep loop.** The loop runs `update` on a 60Hz accumulator, decoupled from `draw`, with a 100ms-per-frame cap to avoid a spiral of death after a tab is backgrounded. Game logic behaves the same on a 60Hz and 144Hz screen - most hand-rolled canvas code skips this and gets frame-rate-dependent movement.
- **Touch and mouse are unified correctly.** One `keys`/`mouse` input model, with coordinate mapping that accounts for canvas CSS scaling (`getBoundingClientRect` + scale factor) and devicePixelRatio, plus explicit suppression of the synthetic mousedown that follows a touchstart so clicks don't double-fire.
- **DPR-aware canvas buffer.** The canvas backing buffer is sized at `internalResolution × devicePixelRatio` (capped at 2x) so art stays sharp on retina screens without you managing that yourself.

None of this is exotic - it's the stuff that's easy to get subtly wrong when you write it yourself, done once, correctly, so you don't have to.

## What it doesn't do

- **No physics.** No gravity, velocity/acceleration model, or collision resolution - `isCollidingWith` tells you two sprites overlap; what happens next (bounce back, stop, lose a life) is up to you to code.
- **No tilemaps.** No Tiled import, no level-editor pipeline.
- **No plugin system, no modules.** Single file, ~1700 lines, vanilla ES5-style JS, one global (`punter`).
- **No WebGL.** Canvas 2D only.

If you need physics or tilemaps, look at Phaser or Kaboom/Kaplay instead.

## Responsive Canvas

The canvas always matches the real screen's aspect ratio - landscape screens get a landscape canvas, portrait screens get a portrait canvas. There's no portrait lock and no letterboxing (black bars).

Internally, `resize()` uses a 375×667 reference resolution purely as a starting point for arithmetic: it picks whichever axis (width or height) that reference matches the current orientation on, holds that axis fixed, and computes the other axis from the screen's actual ratio. The result is an internal resolution whose aspect ratio equals the screen's aspect ratio exactly, every time - 375×667 never appears in the final canvas size except by coincidence.

The backing buffer is additionally scaled by devicePixelRatio (capped at 2x) for crisp rendering on retina displays. Sprites automatically reposition/resize on resize - you don't need to do anything manually.

## Debug Mode

Set `debug: true` in `setup()` (or `punter.debug = true` later) to see:

- FPS, frame count, canvas size, and orientation (bottom-right overlay)
- Red collision-box outlines on every collidable sprite
- Position/size labels under each sprite

This is genuinely useful while learning - turning it on lets you *see* the invisible collision boxes and frame rate, which makes it much easier to understand why something isn't colliding the way you expect.

Debug mode, device type, and orientation are also reflected as `data-punter-*` attributes on `<html>` (e.g. `data-punter-device`, `data-punter-orientation`, `data-punter-scene`) and as `--punter-vpw` / `--punter-vph` CSS custom properties, if you want to hook into them from your own CSS.

## Other engine properties

`punter` exposes a handful of read-only state properties beyond what's covered above:

| Property                        | Description                                             |
|---------------------------------|---------------------------------------------------------|
| `punter.sceneName`              | name of the currently active scene                      |
| `punter.sprites`                | array of all currently registered sprites               |
| `punter.getSprite(id)`          | look up a sprite by id, or `null`                       |
| `punter.width` / `height`       | current canvas pixel dimensions                         |
| `punter.running` / `paused`     | loop state                                              |
| `punter.resized`                | `true` for the frame in which a resize occurred         |
| `punter.isMobile` / `isDesktop` | based on a `navigator.userAgent` check                  |
| `punter.orientation`            | `'portrait'` or `'landscape'`, from viewport dimensions |
| `punter.dpr`                    | the devicePixelRatio in use (capped at 2)               |

## License

[MIT License](LICENSE). Built by the [Orca Scan Team](https://orcascan.com/about-us) to power [OrcaCam](https://orcascan.com/game).