# punter.js

A lightweight, dependency-free JavaScript 2D game engine for the browser. Drop in a script tag and start building.

**Why punter.js:**
* **No build step** - pure ES5, one script tag, no bundler or transpiler needed
* **Auto-scaling canvas** - fixed internal coordinates scale to any screen; sprites reposition automatically on resize
* **Retina support** - renders at device pixel ratio (up to 2×) automatically
* **Pixel-accurate collision** - bounding boxes ignore transparent pixels, so irregular shapes collide correctly
* **Unified touch and mouse** - one input path handles both mouse clicks and mobile taps
* **Fixed-timestep game loop** - game logic runs at consistent speed regardless of frame rate
* **CSS/HTML state hooks** - writes `data-punter-*` attributes and CSS variables to `<html>` for pure-CSS loading screens and scene transitions

---

## Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [punter.init()](#punter-init)
- [Scenes](#scenes)
- [Events](#events)
- [Sprites](#sprites)
  - [Creating a Sprite](#creating-a-sprite)
  - [Sprite Properties](#sprite-properties)
  - [Sprite Methods](#sprite-methods)
  - [Collision Detection](#collision-detection)
  - [Animation](#animation)
  - [Scrolling & Parallax](#scrolling--parallax)
- [Sound](#sound)
- [Input](#input)
- [Game Loop Control](#game-loop-control)
- [Engine Properties](#engine-properties)
- [CSS & HTML Hooks](#css--html-hooks)
- [Debug Mode](#debug-mode)
- [Browser Support](#browser-support)

---

## Requirements

- A modern browser with `fetch`, `Promise`, and `AudioContext` support
- A `<canvas>` element on the page

---

## Installation

Download `punter.js` and include it with a script tag - before your game code:

```html
<canvas id="game"></canvas>
<script src="punter.js"></script>
<script>
  // your game code here
</script>
```

---

## Quick Start

```html
<canvas id="game"></canvas>
<script src="punter.js"></script>
<script>
  punter.init({
    canvas: '#game',
    sprites: {
      player: 'images/player.png'
    },
    sounds: {
      jump: 'sounds/jump.mp3'
    }
  });

  punter.on('ready', function () {
    punter.go('level1');
  });

  punter.scene('level1', function () {

    var player = punter.createSprite({
      id: 'player',
      key: 'player',
      x: '50%',
      y: '50%'
    });

    punter.on('update', function () {
      if (punter.keys['ArrowRight']) player.moveX(3);
      if (punter.keys['ArrowLeft'])  player.moveX(-3);
      if (punter.keys['ArrowUp'])    player.moveY(-3);
      if (punter.keys['ArrowDown'])  player.moveY(3);
    });

    punter.on('draw', function () {
      player.draw(this);
    });

  });
</script>
```

---

## `punter.init()`

**What this does:** This is the engine's start-up call. You tell it which canvas to draw on, which images to preload, and which sounds to load. Nothing else will work until `init` has finished loading everything - that's what the `ready` event is for.

```js
punter.init({
  canvas: '#game',       // the canvas to draw on
  debug: false,          // set to true to show FPS, bounding boxes, and labels
  sprites: {
    player:  'images/player.png',
    enemy:   'images/enemy.png',
    coin:    'images/coin.png'
  },
  sounds: {
    jump:    'sounds/jump.mp3',
    collect: 'sounds/collect.mp3'
  }
});

punter.on('ready', function () {
  // safe to create sprites and go to a scene here
  punter.go('menu');
});
```

### Config Options

Option    | Type                            | Required | Description
----------|---------------------------------|----------|-------------------------------------------------------------------------
`canvas`  | `string` or `HTMLCanvasElement` | Yes      | A CSS selector (`'#game'`) or a direct canvas element reference
`debug`   | `boolean`                       | No       | Enables the debug overlay (FPS, sprite bounds, labels). Default: `false`
`sprites` | `object`                        | No       | Key/URL pairs of images to preload: `{ key: 'path/to/image.png' }`
`sounds`  | `object`                        | No       | Key/URL pairs of audio files to preload: `{ key: 'path/to/sound.mp3' }`

---

## Scenes

**What this does:** Scenes are the different "screens" in your game - the main menu, level 1, a game over screen, etc. You define each scene as a named function, then switch between them with `punter.go()`.

```js
// Define scenes anywhere before calling punter.go()
punter.scene('menu', function () {

  var title = punter.createSprite({ id: 'title', key: 'titleImage', x: '50%', y: '30%' });

  punter.on('draw', function () {
    title.draw(this);
  });

  punter.on('update', function () {
    // switch to level1 when the screen is tapped or clicked
    if (punter.mouse.clicked) {
      punter.go('level1');
    }
  });

});

punter.scene('level1', function () {
  // level setup here
});

// Switching scenes clears the previous update/draw handlers automatically
punter.go('menu');
```

### Methods

Method                   | Description
-------------------------|-------------------------------------------------------------------------------------------------------
`punter.scene(name, fn)` | Registers a scene. `name` is a string key; `fn` is the setup function that runs when the scene starts.
`punter.go(name)`        | Switches to the named scene. Starts the game loop if it isn't already running. Clears all input state.

---

## Events

**What this does:** Events let your code react to things the engine does. The two you'll use most are `update` (run your game logic here) and `draw` (draw your sprites here). These are called automatically by the engine ~60 times per second.

```js
punter.on('ready', function () {
  // fires once - all images and sounds are loaded, safe to start
  punter.go('level1');
});

punter.on('update', function () {
  // fires ~60 times/sec - move things, check collisions, handle input
});

punter.on('draw', function () {
  // fires every frame - draw your sprites
  // 'this' inside draw is the canvas 2D context
  player.draw(this);
});

punter.on('resize', function () {
  // fires when the browser window or device orientation changes
});

punter.on('go', function (sceneName) {
  // fires every time punter.go() is called - receives the new scene name
});
```

### Event Reference

Event    | Callback signature    | When it fires
---------|-----------------------|--------------------------------------------------------------
`ready`  | `function()`          | Once, after all sprites and sounds have finished loading
`update` | `function()`          | Every logic tick (~60/sec) - put movement and game logic here
`draw`   | `function()`          | Every render frame - `this` is the canvas 2D context
`resize` | `function()`          | When the browser window resizes or orientation changes
`go`     | `function(sceneName)` | When `punter.go()` is called; receives the new scene name

> Each event can only have one handler at a time. Calling `punter.on('update', fn)` again replaces the previous handler. Switching scenes via `punter.go()` automatically clears the `update` and `draw` handlers.

---

## Sprites

**What this does:** A sprite is any image in your game - a character, an obstacle, a background, a coin. You create a sprite by giving it an ID, pointing it at a preloaded image, and setting its starting position. The engine handles scaling, cropping, and drawing it to the canvas.

### Creating a Sprite

```js
var player = punter.createSprite({
  id:  'player',    // unique ID - no two sprites can share one
  key: 'player',    // matches a key from config.sprites
  x:   '50%',       // horizontal position - number (pixels) or percent string
  y:   '80%'        // vertical position - number (pixels) or percent string
});

// Sprite with a fixed size
var background = punter.createSprite({
  id: 'bg',
  key: 'background',
  x: 0,
  y: 0,
  w: '100%',   // width as percent of canvas width
  h: '100%'    // height as percent of canvas height
});
```

### Creation Options

Option           | Type                   | Default    | Description
-----------------|------------------------|------------|-----------------------------------------------------------------------------------------------------------
`id`             | `string`               | -          | **Required.** Unique identifier for this sprite.
`key`            | `string` or `string[]` | -          | **Required.** Image key from `config.sprites`. Pass an array for animation frames: `['frame1', 'frame2']`.
`x`              | `number` or `string`   | -          | **Required.** Horizontal position in pixels or as `'50%'`.
`y`              | `number` or `string`   | -          | **Required.** Vertical position in pixels or as `'50%'`.
`w`              | `number` or `string`   | auto       | Width in pixels or percent. Inferred from image if omitted.
`h`              | `number` or `string`   | auto       | Height in pixels or percent. Inferred from image if omitted.
`preserveAspect` | `boolean`              | `true`     | Keep the image's aspect ratio when only one dimension is set.
`collidable`     | `boolean`              | `true`     | Compute a pixel-accurate bounding box for collision checks.
`outline`        | `string`               | `null`     | Draw a coloured border around the sprite (e.g. `'red'`). Useful for debugging.
`repeatX`        | `boolean`              | `false`    | Tile the image horizontally across the full canvas width (e.g. for a floor).
`repeatY`        | `boolean`              | `false`    | Tile the image vertically across the full canvas height (e.g. for a wall).
`clipHeight`     | `number`               | `null`     | Limit how many pixels tall the sprite is drawn - useful for fill/progress bars.
`clipFrom`       | `string`               | `'bottom'` | Which end to clip from: `'top'` or `'bottom'`.

### Sprite Properties

After creation, these properties are available on the sprite object:

Property      | Type                 | Writable | Description
--------------|----------------------|----------|---------------------------------------------------------------------------------------------
`x`           | `number`             | Yes      | Current horizontal position in pixels.
`y`           | `number`             | Yes      | Current vertical position in pixels.
`w`           | `number`             | Yes      | Current width in pixels.
`h`           | `number`             | Yes      | Current height in pixels.
`actualW`     | `number`             | No       | Rendered width (floored). Read-only.
`actualH`     | `number`             | No       | Rendered height, respecting `clipHeight`. Read-only.
`initialX`    | `number`             | Yes      | The x position the sprite started at (used by `bounce()`).
`initialY`    | `number`             | Yes      | The y position the sprite started at (used by `bounce()`).
`frame`       | `number\ | null`     | Yes      | Override the current animation frame index. Set to `null` to let `animate()` control it.
`visible`     | `boolean`            | No       | `true` if any part of the sprite is within the canvas bounds. Read-only.
`seen`        | `boolean`            | Yes      | Becomes `true` once the sprite has been visible on screen. Can be reset manually.
`destroyed`   | `boolean`            | No       | `true` after `destroy()` has been called. Read-only.
`bounds`      | `object`             | No       | Pixel-accurate bounding box: `{ x, y, w, h }`. Updated each frame after `draw()`. Read-only.
`collidable`  | `boolean`            | Yes      | Whether to compute collision bounds.
`clipHeight`  | `number\ | null`     | Yes      | Current clip height.
`key`         | `string\ | string[]` | Yes      | The image key (or array of keys for animation).
`id`          | `string`             | No       | The sprite's unique ID.
`aspectRatio` | `number`             | No       | Width-to-height ratio of the original image. Read-only.

### Sprite Methods

#### `sprite.draw(ctx)`

Draws the sprite to the canvas. Call this inside your `draw` event handler. `ctx` is the canvas 2D context passed as `this` in the `draw` callback.

```js
punter.on('draw', function () {
  player.draw(this);
  enemy.draw(this);
});
```

#### `sprite.moveX(dx)` / `sprite.moveY(dy)`

Move the sprite by `dx` pixels horizontally or `dy` pixels vertically. Call these in your `update` handler.

```js
punter.on('update', function () {
  if (punter.keys['ArrowRight']) player.moveX(3);
  if (punter.keys['ArrowLeft'])  player.moveX(-3);
  if (punter.keys['Space'])      player.moveY(-5); // jump
});
```

#### `sprite.center(offsetX?, offsetY?)`

Centers the sprite on the canvas. Optional pixel offsets shift it from the centre.

```js
player.center();         // perfectly centred
player.center(0, -50);   // centred, but 50px above the middle
```

Also available as `sprite.centerX(offsetX?)` and `sprite.centerY(offsetY?)` to centre on one axis only.

#### `sprite.bounce(range?, speed?)`

Makes the sprite float up and down in a smooth sine-wave motion. Call every frame in `update`.

```js
punter.on('update', function () {
  coin.bounce(6, 12);  // range: 6px, speed: 12 (higher = slower)
});
```

Parameter | Type     | Default | Description
----------|----------|---------|--------------------------------------------------
`range`   | `number` | `8`     | Max pixels to move up/down from `initialY`.
`speed`   | `number` | `10`    | Controls how fast the bounce is. Higher = slower.

#### `sprite.animate(delayMs)`

Advances to the next animation frame. Call every frame in `update`. Requires `key` to be an array of image keys.

```js
var run = punter.createSprite({
  id: 'runner',
  key: ['run1', 'run2', 'run3', 'run4'],
  x: 100, y: 200
});

punter.on('update', function () {
  run.animate(120); // switch frame every 120ms
});
```

> Set `sprite.frame` to a specific index to manually control the frame instead of letting `animate()` cycle through.

#### `sprite.destroy()`

Removes the sprite from the engine. Any subsequent `draw()` calls on it will be ignored. The `sprite.destroyed` property becomes `true`.

```js
if (player.isCollidingWith(enemy)) {
  enemy.destroy();
  punter.playSound('explosion');
}
```

### Collision Detection

**What this does:** Collision detection lets you know when two sprites are touching or overlapping. The engine uses each image's actual pixel content to build a tight bounding box - transparent areas around the image are ignored - so collisions feel accurate even for irregularly shaped sprites.

```js
punter.on('update', function () {
  if (player.isCollidingWith(bullet)) {
    punter.playSound('hit');
    bullet.destroy();
    // handle player damage
  }
});
```

#### `sprite.isCollidingWith(otherSprite)`

Returns `true` if the bounding boxes of the two sprites overlap, `false` otherwise. Both sprites must have `collidable: true` (which is the default).

```js
var hit = player.isCollidingWith(enemy); // true or false
```

> Bounding boxes are automatically updated each frame when the sprite is drawn. Always call `sprite.draw()` before checking collisions.

### Animation

Sprites can cycle through multiple images to create animations. Pass an array of keys to `key` when creating the sprite, then call `animate()` each frame:

```js
punter.init({
  sprites: {
    idle1: 'images/idle1.png',
    idle2: 'images/idle2.png',
    idle3: 'images/idle3.png'
  }
});

var character = punter.createSprite({
  id: 'char',
  key: ['idle1', 'idle2', 'idle3'],
  x: 100, y: 100
});

punter.on('update', function () {
  character.animate(150); // new frame every 150ms
});

punter.on('draw', function () {
  character.draw(this);
});
```

To manually jump to a specific frame, set `character.frame = 2`. To hand control back to `animate()`, set it to `null`.

### Scrolling & Parallax

Three methods are available for scrolling behaviour on sprites used as backgrounds or moving scenery:

#### `sprite.parallaxScrollX(speed, respawnAfterMs, offset?)`

Moves the sprite left or right continuously. When it goes fully off-screen, it waits `respawnAfterMs` milliseconds then reappears from the opposite edge. Great for clouds, birds, or background layers.

```js
var cloud = punter.createSprite({ id: 'cloud1', key: 'cloud', x: 0, y: 50, w: 120, h: 60 });

punter.on('update', function () {
  cloud.parallaxScrollX(-2, 1000); // move left at 2px/frame, respawn after 1 second
});
```

Parameter        | Type     | Description
-----------------|----------|----------------------------------------------------------------------
`speed`          | `number` | Pixels per frame. Negative = left, positive = right.
`respawnAfterMs` | `number` | Milliseconds to wait before reappearing from the opposite edge.
`offset`         | `number` | Extra pixels beyond the screen edge before respawning. Default: `50`.

#### `sprite.parallaxScrollY(speed, respawnAfterMs, offset?)`

Same as `parallaxScrollX` but moves vertically.

```js
punter.on('update', function () {
  rain.parallaxScrollY(4, 500); // fall down at 4px/frame, respawn after 0.5s
});
```

#### `sprite.loopScrollX(speed)`

Moves the sprite horizontally and immediately wraps it to the other side when it exits the canvas - no delay. Useful for seamlessly looping backgrounds.

```js
var ground = punter.createSprite({ id: 'ground', key: 'ground', x: 0, y: '90%', w: '100%', h: 64 });

punter.on('update', function () {
  ground.loopScrollX(-3); // scroll left and wrap
});
```

---

## Sound

**What this does:** punter.js preloads audio files and lets you play and stop them by name. Works on mobile too - sounds are decoded using the Web Audio API, so they play instantly without delay.

```js
punter.init({
  sounds: {
    jump:  'sounds/jump.mp3',
    music: 'sounds/theme.mp3'
  }
});

punter.on('ready', function () {
  // play background music, looping
  punter.playSound('music', { loop: true, volume: 0.5 });

  punter.go('level1');
});

// play a one-shot sound effect
punter.playSound('jump');

// stop a sound that's playing
punter.stopSound('music');
```

### `punter.playSound(name, options?)`

Plays a preloaded sound. If the sound is already playing, it stops and restarts it.

Option   | Type      | Default | Description
---------|-----------|---------|--------------------------------------------------------------------
`volume` | `number`  | `1`     | Volume from `0` (silent) to `1` (full).
`loop`   | `boolean` | `false` | If `true`, the sound repeats indefinitely.
`once`   | `boolean` | `false` | If `true`, the sound is not tracked - `stopSound()` cannot stop it.
`speed`  | `number`  | `1`     | Playback speed multiplier. `0.5` = half speed, `2` = double speed.

### `punter.stopSound(name)`

Stops all currently playing instances of the named sound.

---

## Input

**What this does:** The engine tracks keyboard keys and mouse/touch taps for you. You check the current state of these in your `update` handler each frame. Touch events on mobile are automatically translated into mouse events, so the same code works on phones and desktops.

### Keyboard

`punter.keys` is a plain object where each key name maps to `true` when held down and `false` (or absent) when released.

```js
punter.on('update', function () {
  if (punter.keys['ArrowLeft'])  player.moveX(-3);
  if (punter.keys['ArrowRight']) player.moveX(3);
  if (punter.keys['ArrowUp'])    player.moveY(-3);
  if (punter.keys['ArrowDown'])  player.moveY(3);
  if (punter.keys[' '])          player.moveY(-8); // spacebar to jump
  if (punter.keys['Escape'])     punter.go('menu');
});
```

Key names match the browser's [KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) values: `'ArrowLeft'`, `'ArrowRight'`, `'ArrowUp'`, `'ArrowDown'`, `'Enter'`, `'Escape'`, `' '` (space), letter keys (`'a'`, `'A'`), etc.

### Mouse & Touch

`punter.mouse` tracks the current pointer position and whether a click or tap has occurred.

```js
punter.on('update', function () {
  if (punter.mouse.clicked) {
    // player tapped or clicked - punter.mouse.x / .y has the position
    fireAt(punter.mouse.x, punter.mouse.y);
  }
});
```

Property               | Type      | Description
-----------------------|-----------|------------------------------------------------------------
`punter.mouse.x`       | `number`  | Horizontal position of the last click/tap in canvas pixels.
`punter.mouse.clicked` | `boolean` | `true` for one frame after a click or tap.

> `mouse.clicked` is **not** automatically reset - call `punter.clearInput()` at the end of handling it, or at the start of each scene.

### `punter.clearInput()`

Resets all keyboard key states to `false` and clears `mouse.clicked`. Called automatically whenever `punter.go()` switches scenes.

```js
punter.on('update', function () {
  if (punter.mouse.clicked) {
    punter.go('level1');
    // no need to clear - punter.go() does it automatically
  }
});
```

---

## Game Loop Control

**What this does:** The game loop is what makes `update` and `draw` fire continuously. It starts automatically when you call `punter.go()`. These methods let you pause and resume it manually - for example, when showing a pause menu.

```js
// Pause the loop (stops update and draw from firing)
punter.pause();

// Resume from where it left off
punter.resume();

// Force a single redraw without running update logic
// Useful after a resize when the loop isn't running
punter.redraw();
```

Method            | Description
------------------|-------------------------------------------------------
`punter.pause()`  | Stops the game loop. The screen freezes.
`punter.resume()` | Restarts the game loop.
`punter.redraw()` | Redraws all sprites once without advancing game logic.

---

## Engine Properties

These are read-only properties available on the `punter` object at any time:

Property             | Type                       | Description
---------------------|----------------------------|----------------------------------------------------------------------------
`punter.width`       | `number`                   | Internal canvas width in pixels (adjusted for device pixel ratio).
`punter.height`      | `number`                   | Internal canvas height in pixels (adjusted for device pixel ratio).
`punter.frame`       | `number`                   | Current frame counter, cycling 1–60.
`punter.totalFrames` | `number`                   | Total number of frames rendered since the loop started.
`punter.running`     | `boolean`                  | `true` if the game loop is currently running.
`punter.paused`      | `boolean`                  | `true` if the loop has been paused.
`punter.resized`     | `boolean`                  | `true` for one frame after a resize event.
`punter.isMobile`    | `boolean`                  | `true` if the engine detected a mobile device.
`punter.isDesktop`   | `boolean`                  | `true` if the engine detected a desktop device.
`punter.orientation` | `string`                   | `'portrait'` or `'landscape'` based on current window dimensions.
`punter.sceneName`   | `string`                   | The name of the currently active scene, or `''` if none.
`punter.debug`       | `boolean`                  | Whether debug mode is active. Can be set at runtime: `punter.debug = true`.
`punter.canvas`      | `HTMLCanvasElement`        | The raw canvas element.
`punter.ctx`         | `CanvasRenderingContext2D` | The canvas 2D drawing context.
`punter.sprites`     | `Sprite[]`                 | Array of all live (non-destroyed) sprites.

### `punter.getSprite(id)`

Retrieves a sprite by its ID. Returns `null` if not found.

```js
var player = punter.getSprite('player');
if (player) player.moveX(5);
```

---

## CSS & HTML Hooks

**What this does:** As the engine runs, it automatically sets CSS variables and HTML attributes on the `<html>` element. You can use these in your CSS to style the page differently based on the current game state - for example, hiding the loader once assets are ready, or applying a different layout in landscape mode.

### HTML Attributes

The engine adds these attributes to the `<html>` element:

Attribute                 | Values                       | Description
--------------------------|------------------------------|--------------------------------------------------------------
`data-punter-loading`     | `"true"` / removed           | Present while assets are loading; removed when `ready` fires.
`data-punter-debug`       | `"true"` / removed           | Present when debug mode is on.
`data-punter-device`      | `"mobile"` / `"desktop"`     | Set based on user agent detection.
`data-punter-orientation` | `"portrait"` / `"landscape"` | Updated on every resize.
`data-punter-scene`       | scene name string            | The name of the current scene; updated on `punter.go()`.

**Example - show a loading screen:**

```css
/* show loader until engine is ready */
#loader { display: block; }
html[data-punter-loading] #loader { display: block; }
html:not([data-punter-loading]) #loader { display: none; }

/* different layout per orientation */
html[data-punter-orientation="landscape"] .controls { flex-direction: row; }
html[data-punter-orientation="portrait"]  .controls { flex-direction: column; }
```

### CSS Variables

These are set on the `<html>` element and updated whenever the window resizes:

Variable       | Description
---------------|------------------------------------------
`--punter-vpw` | Viewport width in pixels (e.g. `375px`).
`--punter-vph` | Viewport height in pixels (e.g. `667px`).

```css
.hud {
  width: var(--punter-vpw);
  height: var(--punter-vph);
}
```

---

## Debug Mode

**What this does:** Turning on debug mode overlays useful information directly onto the game canvas - handy when you're trying to understand why a sprite is in the wrong place or why a collision isn't triggering.

Enable it in `punter.init()`:

```js
punter.init({ canvas: '#game', debug: true, sprites: { ... } });
```

Or toggle it at any time:

```js
punter.debug = true;
punter.debug = false;
```

When debug mode is active, the engine draws:

- **FPS counter** and current canvas resolution in the bottom-right corner
- **Red bounding boxes** around each collidable sprite's collision area
- **Position and size labels** (`x=100 y=200 (32x32)`) near each sprite

### Customising the Debug Overlay

The overlay colours and font are pulled from CSS variables on `:root`. Add these to your stylesheet to customise them:

```css
:root {
  --punter-debug-background: rgba(0, 0, 0, 0.6);
  --punter-debug-text: #00ff00;
  --punter-debug-font: 11px 'Courier New', monospace;
}
```

Variable                    | Default                 | Description
----------------------------|-------------------------|----------------------------------------
`--punter-debug-background` | `rgba(255,255,255,0.7)` | Background colour of debug label boxes.
`--punter-debug-text`       | `red`                   | Text colour of debug labels.
`--punter-debug-font`       | `12px monospace`        | Font for debug labels.

---

## Browser Support

punter.js requires:

- `fetch` (for loading sounds)
- `Promise`
- `requestAnimationFrame`
- `AudioContext` / `webkitAudioContext`
- `canvas` 2D context with `getImageData`

All major browsers (Chrome, Firefox, Safari, Edge) support these. For older browsers, polyfills for `fetch` and `Promise` are sufficient.
- Don't manually resize the canvas - the engine owns that via `resize()`.