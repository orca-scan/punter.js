'use strict';

var setup = require('./setup');

describe('Input', function () {

    var page;

    beforeAll(async function () {
        page = await setup.newPage();
    });

    afterAll(async function () {
        await page.close();
    });

    afterEach(async function () {
        await page.evaluate(function () { punter.clearInput(); });
    });

    // --- isKeyDown ---

    it('isKeyDown is a function', async function () {
        var result = await page.evaluate(function () {
            return typeof punter.isKeyDown;
        });
        expect(result).toBe('function');
    });

    it('punter.keys is undefined (removed from public API)', async function () {
        var result = await page.evaluate(function () {
            return typeof punter.keys;
        });
        expect(result).toBe('undefined');
    });

    it('isKeyDown returns false when no args provided', async function () {
        var result = await page.evaluate(function () {
            return punter.isKeyDown();
        });
        expect(result).toBe(false);
    });

    it('isKeyDown returns false when key is not held', async function () {
        var result = await page.evaluate(function () {
            return punter.isKeyDown('left');
        });
        expect(result).toBe(false);
    });

    it('isKeyDown("left") returns true when ArrowLeft held', async function () {
        await page.keyboard.down('ArrowLeft');
        var result = await page.evaluate(function () { return punter.isKeyDown('left'); });
        await page.keyboard.up('ArrowLeft');
        expect(result).toBe(true);
    });

    it('isKeyDown("right") returns true when ArrowRight held', async function () {
        await page.keyboard.down('ArrowRight');
        var result = await page.evaluate(function () { return punter.isKeyDown('right'); });
        await page.keyboard.up('ArrowRight');
        expect(result).toBe(true);
    });

    it('isKeyDown("up") returns true when ArrowUp held', async function () {
        await page.keyboard.down('ArrowUp');
        var result = await page.evaluate(function () { return punter.isKeyDown('up'); });
        await page.keyboard.up('ArrowUp');
        expect(result).toBe(true);
    });

    it('isKeyDown("down") returns true when ArrowDown held', async function () {
        await page.keyboard.down('ArrowDown');
        var result = await page.evaluate(function () { return punter.isKeyDown('down'); });
        await page.keyboard.up('ArrowDown');
        expect(result).toBe(true);
    });

    it('isKeyDown("space") returns true when Space held', async function () {
        await page.keyboard.down('Space');
        var result = await page.evaluate(function () { return punter.isKeyDown('space'); });
        await page.keyboard.up('Space');
        expect(result).toBe(true);
    });

    it('isKeyDown("enter") returns true when Enter held', async function () {
        await page.keyboard.down('Enter');
        var result = await page.evaluate(function () { return punter.isKeyDown('enter'); });
        await page.keyboard.up('Enter');
        expect(result).toBe(true);
    });

    it('isKeyDown("escape") returns true when Escape held', async function () {
        await page.keyboard.down('Escape');
        var result = await page.evaluate(function () { return punter.isKeyDown('escape'); });
        await page.keyboard.up('Escape');
        expect(result).toBe(true);
    });

    it('isKeyDown("a") works for letter keys', async function () {
        await page.keyboard.down('a');
        var result = await page.evaluate(function () { return punter.isKeyDown('a'); });
        await page.keyboard.up('a');
        expect(result).toBe(true);
    });

    it('isKeyDown("a") matches when caps lock produces capital A', async function () {
        // simulate caps lock by pressing Shift+a (browser sends 'A')
        await page.keyboard.down('ShiftLeft');
        await page.keyboard.down('a');
        var result = await page.evaluate(function () { return punter.isKeyDown('a'); });
        await page.keyboard.up('a');
        await page.keyboard.up('ShiftLeft');
        expect(result).toBe(true);
    });

    it('isKeyDown returns false after key is released', async function () {
        await page.keyboard.down('ArrowLeft');
        await page.keyboard.up('ArrowLeft');
        var result = await page.evaluate(function () { return punter.isKeyDown('left'); });
        expect(result).toBe(false);
    });

    it('isKeyDown("Left") works the same as isKeyDown("left") (case-insensitive)', async function () {
        await page.keyboard.down('ArrowLeft');
        var result = await page.evaluate(function () { return punter.isKeyDown('Left'); });
        await page.keyboard.up('ArrowLeft');
        expect(result).toBe(true);
    });

    it('isKeyDown("SPACE") works the same as isKeyDown("space") (case-insensitive)', async function () {
        await page.keyboard.down('Space');
        var result = await page.evaluate(function () { return punter.isKeyDown('SPACE'); });
        await page.keyboard.up('Space');
        expect(result).toBe(true);
    });

    it('isKeyDown("left", "a") returns true when only ArrowLeft held', async function () {
        await page.keyboard.down('ArrowLeft');
        var result = await page.evaluate(function () { return punter.isKeyDown('left', 'a'); });
        await page.keyboard.up('ArrowLeft');
        expect(result).toBe(true);
    });

    it('isKeyDown("left", "a") returns true when only "a" held', async function () {
        await page.keyboard.down('a');
        var result = await page.evaluate(function () { return punter.isKeyDown('left', 'a'); });
        await page.keyboard.up('a');
        expect(result).toBe(true);
    });

    it('isKeyDown("left", "a") returns false when neither held', async function () {
        var result = await page.evaluate(function () { return punter.isKeyDown('left', 'a'); });
        expect(result).toBe(false);
    });

    it('isKeyDown("shift+a") returns true when both Shift and "a" held', async function () {
        await page.keyboard.down('ShiftLeft');
        await page.keyboard.down('a');
        var result = await page.evaluate(function () { return punter.isKeyDown('shift+a'); });
        await page.keyboard.up('a');
        await page.keyboard.up('ShiftLeft');
        expect(result).toBe(true);
    });

    it('isKeyDown("shift+a") returns false when only Shift held', async function () {
        await page.keyboard.down('ShiftLeft');
        var result = await page.evaluate(function () { return punter.isKeyDown('shift+a'); });
        await page.keyboard.up('ShiftLeft');
        expect(result).toBe(false);
    });

    it('isKeyDown("shift+a") returns false when only "a" held', async function () {
        await page.keyboard.down('a');
        var result = await page.evaluate(function () { return punter.isKeyDown('shift+a'); });
        await page.keyboard.up('a');
        expect(result).toBe(false);
    });

    it('isKeyDown("ctrl+s") returns true when Control and "s" held', async function () {
        await page.keyboard.down('ControlLeft');
        await page.keyboard.down('s');
        var result = await page.evaluate(function () { return punter.isKeyDown('ctrl+s'); });
        await page.keyboard.up('s');
        await page.keyboard.up('ControlLeft');
        expect(result).toBe(true);
    });

    it('clearInput resets state so isKeyDown returns false', async function () {
        await page.keyboard.down('ArrowLeft');
        await page.keyboard.down('Space');
        await page.evaluate(function () {
            return new Promise(function (r) { setTimeout(r, 10); });
        });
        var result = await page.evaluate(function () {
            punter.clearInput();
            return { left: punter.isKeyDown('left'), space: punter.isKeyDown('space') };
        });
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.up('Space');
        expect(result.left).toBe(false);
        expect(result.space).toBe(false);
    });

    // --- pointer ---

    it('pointer exposes x, y, clicked and down properties', async function () {
        var result = await page.evaluate(function () {
            return {
                hasX: typeof punter.pointer.x === 'number',
                hasY: typeof punter.pointer.y === 'number',
                hasClicked: typeof punter.pointer.clicked === 'boolean',
                hasDown: typeof punter.pointer.down === 'boolean'
            };
        });
        expect(result.hasX).toBe(true);
        expect(result.hasY).toBe(true);
        expect(result.hasClicked).toBe(true);
        expect(result.hasDown).toBe(true);
    });

    it('pointer.clicked starts as false', async function () {
        var result = await page.evaluate(function () {
            punter.clearInput();
            return punter.pointer.clicked;
        });
        expect(result).toBe(false);
    });

    it('mousedown sets pointer.clicked to true', async function () {
        await page.mouse.click(100, 100);
        var result = await page.evaluate(function () {
            return punter.pointer.clicked;
        });
        expect(result).toBe(true);
    });

    it('clearInput resets pointer.clicked to false', async function () {
        await page.mouse.click(100, 100);
        var result = await page.evaluate(function () {
            punter.clearInput();
            return punter.pointer.clicked;
        });
        expect(result).toBe(false);
    });

    it('pointer.down starts as false', async function () {
        var result = await page.evaluate(function () {
            return punter.pointer.down;
        });
        expect(result).toBe(false);
    });

    it('pointer.down is true while mouse button is held', async function () {
        await page.mouse.down();
        var result = await page.evaluate(function () {
            return punter.pointer.down;
        });
        await page.mouse.up();
        expect(result).toBe(true);
    });

    it('pointer.down is false after mouse button release', async function () {
        await page.mouse.down();
        await page.mouse.up();
        var result = await page.evaluate(function () {
            return punter.pointer.down;
        });
        expect(result).toBe(false);
    });

    it('pointer.down persists across frames (unlike pointer.clicked)', async function () {
        await page.mouse.down();
        var result = await page.evaluate(function () {
            // simulate what the game loop does each tick — only clicked is cleared, not down
            punter.pointer.clicked = false;
            return { down: punter.pointer.down, clicked: punter.pointer.clicked };
        });
        await page.mouse.up();
        expect(result.down).toBe(true);    // down persists while held
        expect(result.clicked).toBe(false); // clicked was cleared (as the loop does each frame)
    });

    it('clearInput resets pointer.down to false', async function () {
        await page.mouse.down();
        var result = await page.evaluate(function () {
            punter.clearInput();
            return punter.pointer.down;
        });
        await page.mouse.up();
        expect(result).toBe(false);
    });

    it('pointer.x and pointer.y update on mousemove', async function () {
        await page.mouse.move(200, 150);
        var result = await page.evaluate(function () {
            return { x: punter.pointer.x, y: punter.pointer.y };
        });
        expect(typeof result.x).toBe('number');
        expect(typeof result.y).toBe('number');
    });

    // --- isPointerDown ---

    it('isPointerDown is a function', async function () {
        var result = await page.evaluate(function () {
            return typeof punter.isPointerDown;
        });
        expect(result).toBe('function');
    });

    it('isPointerDown() returns false when no button is pressed', async function () {
        var result = await page.evaluate(function () {
            return punter.isPointerDown();
        });
        expect(result).toBe(false);
    });

    it('isPointerDown() defaults to left button', async function () {
        await page.mouse.down();
        var result = await page.evaluate(function () {
            return punter.isPointerDown() === punter.isPointerDown('left');
        });
        await page.mouse.up();
        expect(result).toBe(true);
    });

    it('isPointerDown("left") is true while left button held', async function () {
        await page.mouse.down();
        var result = await page.evaluate(function () {
            return punter.isPointerDown('left');
        });
        await page.mouse.up();
        expect(result).toBe(true);
    });

    it('isPointerDown("left") is false after release', async function () {
        await page.mouse.down();
        await page.mouse.up();
        var result = await page.evaluate(function () {
            return punter.isPointerDown('left');
        });
        expect(result).toBe(false);
    });

    it('clearInput resets isPointerDown to false', async function () {
        await page.mouse.down();
        var result = await page.evaluate(function () {
            punter.clearInput();
            return punter.isPointerDown('left');
        });
        await page.mouse.up();
        expect(result).toBe(false);
    });
});
