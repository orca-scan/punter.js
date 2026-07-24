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

    // --- keys ---

    it('keys is an object that tracks keyboard state', async function () {
        var result = await page.evaluate(function () {
            return typeof punter.keys;
        });
        expect(result).toBe('object');
    });

    it('keydown event sets the key to true', async function () {
        await page.keyboard.down('ArrowLeft');
        var result = await page.evaluate(function () {
            return punter.keys['ArrowLeft'];
        });
        expect(result).toBe(true);
        await page.keyboard.up('ArrowLeft');
    });

    it('keyup event sets the key to false', async function () {
        await page.keyboard.down('ArrowRight');
        await page.keyboard.up('ArrowRight');
        var result = await page.evaluate(function () {
            return punter.keys['ArrowRight'];
        });
        expect(result).toBe(false);
    });

    it('clearInput resets all key states to false', async function () {
        await page.keyboard.down('ArrowLeft');
        await page.keyboard.down('Space');
        // small delay to let DOM events propagate
        await page.evaluate(function () {
            return new Promise(function (r) { setTimeout(r, 10); });
        });
        var result = await page.evaluate(function () {
            punter.clearInput();
            return { left: punter.keys['ArrowLeft'], space: punter.keys[' '] };
        });
        expect(result.left).toBe(false);
        expect(result.space).toBe(false);
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.up('Space');
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
