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

    // --- mouse ---

    it('mouse exposes x, y and clicked properties', async function () {
        var result = await page.evaluate(function () {
            return {
                hasX: typeof punter.mouse.x === 'number',
                hasY: typeof punter.mouse.y === 'number',
                hasClicked: typeof punter.mouse.clicked === 'boolean'
            };
        });
        expect(result.hasX).toBe(true);
        expect(result.hasY).toBe(true);
        expect(result.hasClicked).toBe(true);
    });

    it('mouse.clicked starts as false', async function () {
        var result = await page.evaluate(function () {
            punter.clearInput();
            return punter.mouse.clicked;
        });
        expect(result).toBe(false);
    });

    it('mousedown sets mouse.clicked to true', async function () {
        await page.mouse.click(100, 100);
        var result = await page.evaluate(function () {
            return punter.mouse.clicked;
        });
        expect(result).toBe(true);
    });

    it('clearInput resets mouse.clicked to false', async function () {
        await page.mouse.click(100, 100);
        var result = await page.evaluate(function () {
            punter.clearInput();
            return punter.mouse.clicked;
        });
        expect(result).toBe(false);
    });
});
