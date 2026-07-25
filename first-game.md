# Make your first game

In this guide you will make a complete game called **Coin Chase**.

You control a yellow player and collect a yellow coin. Each time you collect it, your score increases and the coin moves somewhere new.

You can play with:

- the arrow keys or WASD on a computer
- a mouse, finger or stylus on a touchscreen

Do not worry about understanding every line before you begin. Type the code, run it, change it and see what happens.

That is how many programmers first learned to code: by making something appear on the screen, then changing it.

## What you will learn

By the end, you will know how to:

- create a game page
- set up Punter.js
- load images
- create sprites
- create a scene
- move a player
- support keyboard and touch controls
- detect collisions
- keep and display a score

---

# Before you start

Download Punter.js and start it:

```bash
git clone https://github.com/orca-scan/punter.js.git
cd punter.js
npm install
npm start
```

This starts a local web server and opens the games page in your browser.

Create a new file inside the `games` folder called:

```text
first-game.html
```

Your game will be available at:

```text
http://localhost:4000/games/first-game.html
```

Keep the browser open while you work. After each step:

1. save the file
2. refresh the browser
3. test what changed

---

# Part 1: Make a game page

Add this code to `games/first-game.html`:

```html
<!doctype html>
<html>
<head>
  <title>Coin Chase</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * {
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #1b2125;
    }

    canvas {
      display: block;
      touch-action: none;
    }
  </style>
  <script src="../src/punter.js"></script>
</head>
<body>
  <canvas id="game"></canvas>

  <script>
  </script>
</body>
</html>
```

Save the file and open it in your browser.

You should see a dark, empty page.

It may not look like a game yet, but you have created the screen your game will use.

## What just happened?

This creates the canvas:

```html
<canvas id="game"></canvas>
```

A canvas is an area that JavaScript can draw on. Every Punter.js game lives inside one.

This loads the game engine:

```html
<script src="../src/punter.js"></script>
```

The empty script near the bottom is where your game code will go:

```html
<script>
</script>
```

> Try it: change `#1b2125` to another colour, save the file and refresh.

---

# Part 2: Set up Punter.js

Put this inside the empty `<script>` block:

```javascript
punter.setup({
  canvas: '#game',
  debug: true,
  images: {
    player: '../images/pong/paddle.png',
    coin: '../images/pong/ball.png'
  }
});
```

Your script should now look like this:

```html
<script>
  punter.setup({
    canvas: '#game',
    debug: true,
    images: {
      player: '../images/pong/paddle.png',
      coin: '../images/pong/ball.png'
    }
  });
</script>
```

Nothing new will appear yet.

You have told Punter.js:

- which canvas to use
- which images to load
- to show its debugging information

The names on the left are short names chosen by you:

```javascript
player: '../images/pong/paddle.png'
```

Later, you can use `image: 'player'` instead of repeating the full file path.

Debug mode shows the canvas size, frame rate and sprite collision boxes. It is useful while learning.

> Try it: change `debug: true` to `debug: false`, save and refresh. Change it back before continuing.

---

# Part 3: Create a scene

A scene is one screen of your game.

A larger game might have:

- a menu scene
- a playing scene
- a game-over scene

Add this below `punter.setup(...)`:

```javascript
punter.scene('game', function () {

});

punter.go('game');
```

Your script should now look like this:

```html
<script>
  punter.setup({
    canvas: '#game',
    debug: true,
    images: {
      player: '../images/pong/paddle.png',
      coin: '../images/pong/ball.png'
    }
  });

  punter.scene('game', function () {

  });

  punter.go('game');
</script>
```

This registers a scene called `game`:

```javascript
punter.scene('game', function () {
```

This switches to it and starts the game loop:

```javascript
punter.go('game');
```

Punter.js can queue the scene while the images are still loading, so you do not need to wait for a separate ready event.

---

# Part 4: Put the player on screen

Add this inside the scene:

```javascript
var player = punter.createSprite({
  id: 'player',
  image: 'player',
  x: '10%',
  y: '40%',
  w: 32,
  h: 64
});
```

The scene should now look like this:

```javascript
punter.scene('game', function () {
  var player = punter.createSprite({
    id: 'player',
    image: 'player',
    x: '10%',
    y: '40%',
    w: 32,
    h: 64
  });
});
```

Save and refresh.

You should see a yellow player near the left side of the screen.

Punter.js draws registered sprites automatically. You do not need to call a draw method yourself.

## Understanding the sprite

Every sprite needs a unique ID:

```javascript
id: 'player'
```

This chooses the image loaded during setup:

```javascript
image: 'player'
```

These place the sprite relative to the canvas size:

```javascript
x: '10%',
y: '40%'
```

This sets its size:

```javascript
w: 32,
h: 64
```

The top-left corner of the canvas is `0, 0`:

```text
0,0 ─────────────► x
 │
 │
 ▼
 y
```

Increasing `x` moves right. Increasing `y` moves down.

> Try it: change `x` to `'50%'` and `y` to `'10%'`.

---

# Part 5: Move the player with the keyboard

A game repeatedly updates itself many times each second.

Punter.js gives you an `update` event for code that must keep running.

Add this below the player:

```javascript
punter.on('update', function () {
  if (punter.isKeyDown('left', 'a')) {
    player.moveX(-4);
  }

  if (punter.isKeyDown('right', 'd')) {
    player.moveX(4);
  }

  if (punter.isKeyDown('up', 'w')) {
    player.moveY(-4);
  }

  if (punter.isKeyDown('down', 's')) {
    player.moveY(4);
  }
});
```

Save, refresh and press the arrow keys or WASD.

You can now control your player.

## How movement works

This asks whether the left arrow or the `a` key is being held:

```javascript
if (punter.isKeyDown('left', 'a')) {
```

If either is held, this moves the player four pixels left:

```javascript
player.moveX(-4);
```

Movement follows these rules:

```text
negative x = left
positive x = right
negative y = up
positive y = down
```

Other useful key checks include:

```javascript
punter.isKeyDown('space');
punter.isKeyDown('enter');
punter.isKeyDown('escape');
```

> Try it: change every `4` to `8`. Is the game easier or harder to control?

---

# Part 6: Add mouse and touch controls

Punter.js combines mouse, touch and stylus input into one pointer.

Add this at the bottom of the same `update` function:

```javascript
if (punter.isPointerDown()) {
  player.x = punter.pointer.x - player.w / 2;
  player.y = punter.pointer.y - player.h / 2;
}
```

Your update function should now be:

```javascript
punter.on('update', function () {
  if (punter.isKeyDown('left', 'a')) {
    player.moveX(-4);
  }

  if (punter.isKeyDown('right', 'd')) {
    player.moveX(4);
  }

  if (punter.isKeyDown('up', 'w')) {
    player.moveY(-4);
  }

  if (punter.isKeyDown('down', 's')) {
    player.moveY(4);
  }

  if (punter.isPointerDown()) {
    player.x = punter.pointer.x - player.w / 2;
    player.y = punter.pointer.y - player.h / 2;
  }
});
```

Hold the mouse button and move the pointer around the screen.

On a phone or tablet, hold your finger on the screen and move it.

The subtraction keeps the centre of the player under the pointer instead of placing its top-left corner there.

---

# Part 7: Add something to collect

Add a second sprite below the player:

```javascript
var coin = punter.createSprite({
  id: 'coin',
  image: 'coin',
  x: '70%',
  y: '40%',
  w: 32,
  h: 32
});
```

Your scene should begin like this:

```javascript
punter.scene('game', function () {
  var player = punter.createSprite({
    id: 'player',
    image: 'player',
    x: '10%',
    y: '40%',
    w: 32,
    h: 64
  });

  var coin = punter.createSprite({
    id: 'coin',
    image: 'coin',
    x: '70%',
    y: '40%',
    w: 32,
    h: 32
  });
```

Save and refresh.

You should now see both the player and the coin.

At the moment you can move over the coin, but nothing happens.

The computer only does what you tell it to do.

---

# Part 8: Detect a collision

Add this to the bottom of your existing `update` function:

```javascript
if (player.isCollidingWith(coin)) {
  coin.x = 100;
  coin.y = 100;
}
```

Move the player into the coin.

The coin should jump to position `100, 100`.

This is your first game rule:

```text
WHEN the player touches the coin
MOVE the coin
```

Most games are made from small rules like this.

Punter.js checks collisions using the visible part of each image rather than all of its transparent padding. Debug mode lets you see the collision boxes.

---

# Part 9: Move the coin somewhere random

A coin that always moves to the same place is easy to predict.

Replace this:

```javascript
coin.x = 100;
coin.y = 100;
```

with this:

```javascript
coin.x = Math.random() * (punter.width - coin.w);
coin.y = Math.random() * (punter.height - coin.h);
```

`Math.random()` gives you a random number between `0` and `1`.

Multiplying it by the available width or height turns it into a random position.

Subtracting the coin's size helps keep it inside the canvas.

Collect the coin several times. It should appear somewhere different each time.

> Try it: replace `Math.random()` with `0.5`. Where does the coin appear?

---

# Part 10: Keep score

Near the top of your scene, before creating the player, add:

```javascript
var score = 0;
```

Then add this inside the collision:

```javascript
score = score + 1;
```

Your collision code should now be:

```javascript
if (player.isCollidingWith(coin)) {
  score = score + 1;
  coin.x = Math.random() * (punter.width - coin.w);
  coin.y = Math.random() * (punter.height - coin.h);
}
```

The score is changing, but it is hidden inside the computer's memory.

Next, you will draw it.

---

# Part 11: Draw the score

Add this after the `update` event, but still inside the scene:

```javascript
punter.on('draw', function () {
  this.fillStyle = 'white';
  this.font = '24px Arial';
  this.fillText('Score: ' + score, 20, 35);
});
```

Save and refresh.

You should see `Score: 0` in the corner. Each coin you collect should increase it.

## What is `this`?

Inside the `draw` event, `this` is the canvas drawing context.

This chooses the text colour:

```javascript
this.fillStyle = 'white';
```

This chooses the text size and font:

```javascript
this.font = '24px Arial';
```

This draws the score:

```javascript
this.fillText('Score: ' + score, 20, 35);
```

The final two numbers are its `x` and `y` position.

The `draw` event runs after Punter.js has drawn the sprites, so the score appears on top of them.

> Try it: change the colour, font size and position of the score.

---

# Your complete game

Your finished `first-game.html` should look like this:

```html
<!doctype html>
<html>
<head>
  <title>Coin Chase</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * {
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #1b2125;
    }

    canvas {
      display: block;
      touch-action: none;
    }
  </style>
  <script src="../src/punter.js"></script>
</head>
<body>
  <canvas id="game"></canvas>

  <script>
    punter.setup({
      canvas: '#game',
      debug: true,
      images: {
        player: '../images/pong/paddle.png',
        coin: '../images/pong/ball.png'
      }
    });

    punter.scene('game', function () {
      var score = 0;

      var player = punter.createSprite({
        id: 'player',
        image: 'player',
        x: '10%',
        y: '40%',
        w: 32,
        h: 64
      });

      var coin = punter.createSprite({
        id: 'coin',
        image: 'coin',
        x: '70%',
        y: '40%',
        w: 32,
        h: 32
      });

      punter.on('update', function () {
        if (punter.isKeyDown('left', 'a')) {
          player.moveX(-4);
        }

        if (punter.isKeyDown('right', 'd')) {
          player.moveX(4);
        }

        if (punter.isKeyDown('up', 'w')) {
          player.moveY(-4);
        }

        if (punter.isKeyDown('down', 's')) {
          player.moveY(4);
        }

        if (punter.isPointerDown()) {
          player.x = punter.pointer.x - player.w / 2;
          player.y = punter.pointer.y - player.h / 2;
        }

        if (player.isCollidingWith(coin)) {
          score = score + 1;
          coin.x = Math.random() * (punter.width - coin.w);
          coin.y = Math.random() * (punter.height - coin.h);
        }
      });

      punter.on('draw', function () {
        this.fillStyle = 'white';
        this.font = '24px Arial';
        this.fillText('Score: ' + score, 20, 35);
      });
    });

    punter.go('game');
  </script>
</body>
</html>
```

You have made a real game using:

- variables
- conditions
- friendly keyboard input
- pointer input
- movement
- random numbers
- collisions
- canvas drawing

You did not learn those things by reading their definitions first. You used them to make something work.

---

# Make it yours

Do not stop at the finished listing. Change it.

Choose one idea and try to make it work before looking for help.

## Easy changes

1. Make the player faster or slower
2. Make the player or coin larger
3. Change the background colour
4. Award five points instead of one
5. Move the score to another corner
6. Turn debug mode off

## Bigger challenges

### Keep the player on screen

At the moment, the player can leave the canvas.

Add rules that stop this happening.

You will need these values:

```javascript
player.x
player.y
player.w
player.h
punter.width
punter.height
```

Start with the left edge:

```javascript
if (player.x < 0) {
  player.x = 0;
}
```

Can you work out the other three edges?

### Add a winning score

When the player reaches 10 points, draw:

```text
YOU WIN!
```

You could use an `if` inside the `draw` event.

### Add a sound

Add a sound during setup:

```javascript
sounds: {
  collect: '../sounds/beep6.mp3'
}
```

Then play it when the coin is collected:

```javascript
punter.playSound('collect');
```

### Add an enemy

Create another sprite.

Move it during each update and restart the scene if the player touches it:

```javascript
punter.go('game');
```

Switching scene automatically removes the old sprites and clears the input state before starting again.

### Add a game-over scene

Create another scene called `gameOver` and switch to it when the player touches an enemy:

```javascript
punter.go('gameOver');
```

### Use your own artwork

Replace the existing images with PNG or SVG files of your own.

Put them in the `images` folder, add them to `punter.setup()` and use their short names when creating sprites.

---

# When something goes wrong

Every programmer makes mistakes. The useful skill is learning how to find them.

## The screen is blank

Check that:

- the file is inside the `games` folder
- the script path is `../src/punter.js`
- every `{` has a matching `}`
- every `(` has a matching `)`
- the image paths are correct
- `punter.setup()` appears before `punter.go()`

Open the browser developer tools and look at the **Console**. The first red error often tells you where the problem is.

## The player appears but does not move

Check that the `punter.on('update', ...)` code is inside the scene.

Check that you are using `punter.isKeyDown()` with Punter.js key names:

```javascript
punter.isKeyDown('left', 'a');
punter.isKeyDown('right', 'd');
punter.isKeyDown('up', 'w');
punter.isKeyDown('down', 's');
```

The names are lowercase. Multiple arguments mean **either key**, which lets the same action support arrow keys and WASD.

## Touch does not move the player

Check that the canvas CSS includes:

```css
touch-action: none;
```

Check that you are holding the screen rather than tapping it once. `punter.isPointerDown()` remains true while the pointer is held.

## The coin never detects a collision

Make sure both sprites were created with different IDs:

```javascript
id: 'player'
id: 'coin'
```

Turn on debug mode so you can see the collision boxes:

```javascript
debug: true
```

## The coin appears partly outside the screen

Make sure you subtract its size:

```javascript
punter.width - coin.w
punter.height - coin.h
```

---

# What to build next

You now know enough to begin experimenting with the other examples in the `games` folder:

- Pong
- Snake
- Breakout
- Asteroids
- Platform
- Tetris

Open the simplest game that interests you. Change one number, save it and see what happens.

Then change another.

That is how you turn somebody else's game into your own.
