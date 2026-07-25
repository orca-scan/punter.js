# Build your first game: Crystal Collector

You've got 30 seconds. How many gems can you grab?

That's the entire game - and you're about to build it from scratch. When you're done you'll have a rocket ship that you control, purple gems scattered across a dark arena, a countdown timer that turns red when time is running out, sound effects, and a game-over screen that saves your best score.

The whole thing is under 160 lines of code.

---

## Before you start

Download the project and start a local web server so you can test the game in your browser:

```bash
git clone https://github.com/orca-scan/punter.js.git
cd punter.js
npm install
npm start
```

`git clone` downloads the project. `npm install` downloads everything the project needs. `npm start` runs a tiny web server on your machine.

Then open `http://localhost:4000/games/first-game.html` in your browser. Every time you save the file, just refresh to see the changes.

---

## Step 1 - The HTML shell

Every Punter.js game lives inside a single HTML file. It needs a `<canvas>` element (the drawing surface) and the engine script.

```html
<!doctype html>
<html>
  <head>
    <title>Crystal Collector</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; background: #0a0e1a; overflow: hidden; }
      canvas { display: block; background: #0d1b2a; }
    </style>
    <script src="../src/punter.js"></script>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script>
      // your game code goes here
    </script>
  </body>
</html>
```

The CSS fills the whole browser window and hides any scrollbars. The dark background colour (`#0a0e1a`) gives it an instant space-game look. The engine sizes the canvas automatically.

---

## Step 2 - Settings and state

At the top of your `<script>`, set up the numbers that control your game and create the named slots (variables) that will hold things like the player and the score. Keeping them at the top means you can tweak them without hunting through the code.

```js
// game settings - change these to make the game easier or harder
var SPEED      = 5 * punter.dpr;  // pixels the rocket moves each frame
var GEM_SIZE   = 28 * punter.dpr; // how big each gem is drawn
var GEM_COUNT  = 7;               // gems on screen at once
var TIME_LIMIT = 30;              // seconds per round

// game state - reset each round inside the play screen
var player, gems, score, startFrame, timeLeft, flashFrames, lowTimeWarned, highScore;
```

`punter.dpr` is the device pixel ratio. Multiplying sizes by it makes everything look sharp on high-resolution screens like a MacBook Retina display or a phone.

---

## Step 3 - Load your images and sounds

`punter.setup()` tells the engine which images and sounds to preload. Nothing starts until everything is ready.

```js
punter.setup({
  canvas: '#game',
  images: {
    player: '../images/first-game/player.svg',
    gem:    '../images/first-game/coin.svg'
  },
  sounds: {
    collect: '../sounds/bling1.mp3',  // plays when you grab a gem
    warning: '../sounds/alarm2.mp3',  // plays at 10 seconds remaining
    end:     '../sounds/fanfare1.mp3' // plays when time runs out
  }
});
```

This is structured like a list of nicknames and file paths. The names on the left - `player`, `gem`, `collect` - are the short nicknames you'll use everywhere else in your code. The paths on the right tell the engine where to find the actual files. Punter has a whole folder of ready-made sounds - check `sounds/` if you want to swap them out.

---

## Step 4 - Define a scene

A scene is a screen in your game - a level, a menu, a game-over screen. You define one with `punter.scene()` and jump to it with `punter.go()`.

```js
punter.scene('play', function () {
  // everything in here runs when the scene starts
});

punter.go('play');
```

When the player restarts, `punter.go('play')` runs that block of code again from scratch - everything from the previous screen is cleaned up automatically. You'll add a second screen for game over later.

---

## Step 5 - Reset everything and spawn the rocket

At the top of the scene's code block, set all the game variables back to their starting values. This runs every time the screen starts - including when the player hits "restart". Then create the player sprite (a sprite is just an image the engine draws and moves around for you).

```js
punter.scene('play', function () {

  score         = 0;
  gems          = [];
  flashFrames   = 0;
  lowTimeWarned = false;
  startFrame    = punter.totalFrames; // snapshot the current frame count
  highScore     = parseInt(localStorage.getItem('crystalHigh') || '0', 10);

  player = punter.createSprite({
    id:    'player',
    image: 'player',
    x:     punter.width  / 2,
    y:     punter.height / 2
  });

  // scatter starting gems
  for (var i = 0; i < GEM_COUNT; i++) {
    spawnGem();
  }

});
```

`punter.totalFrames` has been ticking up since the engine started. Saving the current number here lets you calculate how many seconds have passed since *this round* began - that's your countdown.

`localStorage` is a built-in browser feature that saves small bits of data permanently on your computer. Even if you close the tab and come back tomorrow, the high score will still be there.

---

## Step 6 - Move the rocket

`punter.on('update', ...)` tells the engine "run this code approximately 60 times per second". That repetition is what makes things move smoothly - each run is called a *frame*.

```js
punter.on('update', function () {

  // WASD or arrow keys move the rocket
  if (punter.isKeyDown('left',  'a')) player.moveX(-SPEED);
  if (punter.isKeyDown('right', 'd')) player.moveX(SPEED);
  if (punter.isKeyDown('up',    'w')) player.moveY(-SPEED);
  if (punter.isKeyDown('down',  's')) player.moveY(SPEED);

  // stop the rocket from flying off the edge
  player.x = Math.max(0, Math.min(player.x, punter.width  - player.w));
  player.y = Math.max(0, Math.min(player.y, punter.height - player.h));

});
```

`punter.isKeyDown()` accepts friendly names like `'left'`, `'up'`, `'space'`, or any letter. Passing two names - `'left', 'a'` - means either key works, so the game supports both arrow keys and WASD at the same time.

`Math.max` and `Math.min` keep the position between `0` (the left/top edge) and the far edge of the screen. Without this the rocket would fly off into nothing and disappear.

---

## Step 7 - The countdown timer

Still inside the `update` code block, add the timer. Every 60 frames is one second.

```js
// work out how many seconds are left in this round
timeLeft = Math.max(0, TIME_LIMIT - Math.floor((punter.totalFrames - startFrame) / 60));

// play a warning beep when 10 seconds remain
if (timeLeft <= 10 && !lowTimeWarned) {
  lowTimeWarned = true;
  punter.playSound('warning');
}

// switch to game-over when time hits zero
if (timeLeft === 0) {
  punter.playSound('end');
  if (score > highScore) {
    localStorage.setItem('crystalHigh', String(score));
  }
  punter.go('gameover');
  return; // stop the rest of the update running this frame
}
```

`lowTimeWarned` is a simple on/off switch. Once it's flipped to `true`, the `if` block won't run again - so the warning sound only plays once instead of 60 times per second for the remaining 10 seconds.

---

## Step 8 - Grab gems and keep score

After the timer code, check whether the rocket is touching any gems.

```js
for (var i = gems.length - 1; i >= 0; i--) {
  if (player.isCollidingWith(gems[i])) {
    gems[i].destroy();   // remove the sprite from the engine
    gems.splice(i, 1);   // remove it from your array too
    score++;
    flashFrames = 8;     // start a brief purple flash effect
    punter.playSound('collect');
    spawnGem();          // immediately place a new gem somewhere else
  }
}

// count the flash down one step per frame
if (flashFrames > 0) flashFrames--;
```

Looping **backwards** (`i--`) is important here. When you remove an item from a list, everything after it shifts down by one position. Going backwards means the shift only affects items you've already checked.

`isCollidingWith()` does all the overlap maths for you - it returns `true` the moment two sprites are touching.

---

## Step 9 - Draw the HUD

Sprites are drawn automatically, but for text like a score or timer you need to draw them yourself. Punter gives you a `draw` block that runs once per frame, after all sprites.

The drawing pen - `ctx` - is passed straight into your function. You don't need to understand all of it, just these basics:

| What you set | What it does |
|---|---|
| `ctx.fillStyle` | Pick a colour (hex like `'#ff4444'` or rgba for transparency) |
| `ctx.font` | Set text size and font, e.g. `'bold 20px monospace'` |
| `ctx.textAlign` | Where the text anchors: `'left'`, `'center'`, or `'right'` |
| `ctx.textBaseline` | Vertical anchor: `'top'`, `'middle'`, or `'bottom'` |
| `ctx.fillText(text, x, y)` | Stamp text onto the screen at that position |
| `ctx.fillRect(x, y, w, h)` | Draw a filled rectangle (useful for overlays) |

`ctx` is a standard browser [Canvas 2D rendering context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) - the full reference covers everything from gradients and shadows to curves and image drawing.

Think of it like choosing a pen colour and then stamping something onto the screen. Every time you change `fillStyle` or `font`, the next `fillText` or `fillRect` uses those settings.

```js
punter.on('draw', function (ctx) { // ctx is the drawing pen, passed in automatically
  var dpr = punter.dpr;

  // purple flash on gem collect - a rectangle over the whole screen that fades out
  if (flashFrames > 0) {
    ctx.fillStyle = 'rgba(168,85,247,' + (flashFrames / 8 * 0.2) + ')';
    ctx.fillRect(0, 0, punter.width, punter.height);
  }

  // gem count - top left corner
  ctx.fillStyle    = '#e879f9';                              // purple text
  ctx.font         = 'bold ' + (20 * dpr) + 'px monospace'; // size scales with screen
  ctx.textBaseline = 'top';                                  // measure from the top of the letters
  ctx.textAlign    = 'left';                                 // anchor to the left edge
  ctx.fillText('GEMS  ' + score, 14 * dpr, 14 * dpr);       // stamp it 14px from the corner

  // personal best - smaller, faded white, just below the score
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font      = (13 * dpr) + 'px monospace';
  ctx.fillText('BEST  ' + highScore, 14 * dpr, 40 * dpr);

  // countdown timer - top right corner, turns red when under 10 seconds
  ctx.fillStyle    = timeLeft <= 10 ? '#ff4444' : '#7ecfff';
  ctx.font         = 'bold ' + (20 * dpr) + 'px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'right';                                // anchor to the right edge this time
  ctx.fillText('TIME  ' + timeLeft, punter.width - 14 * dpr, 14 * dpr);

  // controls hint - centred at the bottom, very faint
  ctx.fillStyle    = 'rgba(255,255,255,0.25)';
  ctx.font         = (12 * dpr) + 'px monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign    = 'center';
  ctx.fillText('WASD or arrow keys to move', punter.width / 2, punter.height - 10 * dpr);
});
```

Notice the pattern: set the colour, set the font, stamp the text. That's all drawing really is. The timer colour switches from blue to red automatically because of the `? :` shorthand on that one line. It reads like a question: "is `timeLeft` 10 or less? If yes, use red. If no, use blue."

---

## Step 10 - The game-over scene

When time runs out, the game switches to a new screen. This one darkens the display, shows the score, and waits for the player to restart. It uses the same `ctx` drawing pen you learned in Step 9 - just more `fillText` calls stacked vertically.

```js
punter.scene('gameover', function () {

  highScore = parseInt(localStorage.getItem('crystalHigh') || '0', 10);
  var isNewBest = score > 0 && score >= highScore;

  // wait for the player to press a key or tap the screen to restart
  punter.on('update', function () {
    if (punter.isKeyDown('enter', 'space') || punter.pointer.clicked) {
      punter.go('play'); // restart - the play scene resets everything
    }
  });

  punter.on('draw', function (ctx) {
    var w   = punter.width;
    var h   = punter.height;
    var dpr = punter.dpr;

    // semi-transparent black rectangle over the whole screen = dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);

    // centre all text in the middle of the screen
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // headline - purple if it's a new record, white otherwise
    ctx.fillStyle = isNewBest ? '#e879f9' : '#ffffff';
    ctx.font      = 'bold ' + (38 * dpr) + 'px monospace';
    ctx.fillText(isNewBest ? 'NEW BEST!' : "TIME'S UP!", w / 2, h / 2 - 52 * dpr);

    // final gem count
    ctx.fillStyle = '#e879f9';
    ctx.font      = 'bold ' + (30 * dpr) + 'px monospace';
    ctx.fillText(score + (score === 1 ? ' GEM' : ' GEMS'), w / 2, h / 2);

    // personal best
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font      = (16 * dpr) + 'px monospace';
    ctx.fillText('BEST: ' + highScore, w / 2, h / 2 + 38 * dpr);

    // restart prompt
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font      = (14 * dpr) + 'px monospace';
    ctx.fillText('SPACE or tap to play again', w / 2, h / 2 + 72 * dpr);
  });
});
```

The whole trick here is the same three-step pattern from Step 9: pick a colour, pick a font, stamp text. The `h / 2 - 52 * dpr` math just offsets each line vertically so they don't overlap. You can eyeball these numbers - change them, refresh, and see what looks good.

Switching screens with `punter.go()` destroys all sprites from the previous screen automatically. No cleanup code needed.

---

## Step 11 - The gem spawner and starting the game

Add the `spawnGem` function (it places a new gem on screen) and the `punter.go('play')` line at the bottom of your script. `punter.go('play')` is what actually starts the game.

```js
// place a gem at a random position, trying not to land directly on the player
function spawnGem() {
  var margin = GEM_SIZE * 2;
  var x, y, tries = 0;

  do {
    x = margin + Math.random() * (punter.width  - margin * 2);
    y = margin + Math.random() * (punter.height - margin * 2);
    tries++;
  } while (tries < 10 && player && Math.abs(x - player.x) < 70 * punter.dpr && Math.abs(y - player.y) < 70 * punter.dpr);

  gems.push(punter.createSprite({
    id:    'gem-' + Date.now() + '-' + gems.length,
    image: 'gem',
    x:     x,
    y:     y,
    w:     GEM_SIZE,
    h:     GEM_SIZE
  }));
}

punter.go('play');
```

The `do...while` loop tries up to 10 random positions and picks the first one that isn't directly on top of the player. If it can't find one in 10 tries it gives up - better a slightly awkward placement than the code running forever.

`punter.go()` can be called before `setup()` finishes loading. The engine remembers it and starts the scene as soon as everything is ready.

---

## What you've built

Open `http://localhost:4000/games/first-game.html` and give it a go.

You now have:
- A **rocket sprite** that moves instantly in any direction with WASD or arrow keys
- **Seven purple gems** that teleport to new positions the moment you collect them
- A **30-second countdown** timer that turns red and beeps when you're almost out of time
- A **flash effect** each time you grab a gem
- A **game-over screen** that celebrates if you beat your personal best
- A **high score** stored in the browser so it survives across sessions

---

## Challenge yourself

Once the basic game works, try breaking things on purpose and seeing what happens. Here are some ideas to push it further:

- **Crank the difficulty** - lower `TIME_LIMIT` to 20, or raise `GEM_COUNT` to 15 and watch the arena fill up
- **Add an enemy** - create a sprite that slowly moves toward the player each frame; touching it ends the round early with `punter.go('gameover')`
- **Give gems different values** - make some gems worth 1 point and some worth 3, and colour them differently; the expensive ones should be harder to reach
- **Add a high-score leaderboard** - store the top 5 scores in `localStorage` as a JSON string and display all of them on the game-over screen
- **Touch controls** - `punter.pointer.x` and `punter.pointer.y` give the current finger position; move the rocket toward that point every frame instead of reading keys
- **See a bigger game** - open `games/snake.html` or `games/breakout.html` to see the same engine used for something more complex; the code patterns are identical

